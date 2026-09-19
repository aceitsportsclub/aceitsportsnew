#!/usr/bin/env node
/**
 * InfinityFree Build Packager
 * 
 * Packages the Next.js static export into a deployment-ready `dist-infinityfree/`
 * directory that can be uploaded to InfinityFree's htdocs/ via FTP.
 * 
 * Usage: node scripts/build-infinityfree.mjs
 * 
 * What it does:
 * 1. Temporarily isolates dynamic server API routes so Next.js can produce a pure static export
 * 2. Runs `next build` with `output: 'export'` to generate pre-rendered HTML/CSS/JS in `out/`
 * 3. Immediately and safely restores all API routes and configurations
 * 4. Copies the `out/` directory into `dist-infinityfree/`
 * 5. Generates `.htaccess` for Apache URL rewriting (SPA fallback + caching + headers)
 * 6. Validates all files against InfinityFree's size constraints (HTML/JS < 1MB, media < 10MB)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'out');
const DIST_DIR = path.join(ROOT, 'dist-infinityfree');
const API_DIR = path.join(ROOT, 'app', 'api');
const API_BACKUP_DIR = path.join(ROOT, 'node_modules', '.api_temp_export');
const CLUB_SLUG_DIR = path.join(ROOT, 'app', 'club', '[slug]');
const CLUB_SLUG_BACKUP_DIR = path.join(ROOT, 'node_modules', '.club_slug_temp_export');
const CONFIG_PATH = path.join(ROOT, 'next.config.mjs');

// InfinityFree file size limits
const MAX_HTML_PHP_JS_SIZE = 1024 * 1024; // 1 MB
const MAX_OTHER_SIZE = 10 * 1024 * 1024;  // 10 MB

function log(msg) { console.log(`[build-infinityfree] ${msg}`); }
function warn(msg) { console.warn(`[build-infinityfree] ⚠️  ${msg}`); }
function fatal(msg) { console.error(`[build-infinityfree] ❌ ${msg}`); process.exit(1); }

/**
 * Recursively copy a directory
 */
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Generate the .htaccess file for Apache on InfinityFree
 */
function generateHtaccess() {
  return `# ACEIT Sports - InfinityFree .htaccess
# Optimized for Apache 2.4 on InfinityFree Free Hosting

# Enable rewrite engine
RewriteEngine On

# Force HTTPS (InfinityFree free SSL)
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# ----------------------------------------------------
# 1. SERVE EXISTING STATIC ASSETS DIRECTLY
# Static files: images, JS chunks, CSS, fonts, webp, json, etc.
# ----------------------------------------------------
RewriteCond %{REQUEST_FILENAME} -f
RewriteRule ^ - [L]

# ----------------------------------------------------
# 2. DYNAMIC CLUB APPLICATION SHELL: /club/{slug} & /club/{slug}/{section}
# Routes all club requests to the universal client-side application shell (/club.html).
# The client-side app reads the slug/section dynamically from window.location,
# queries the backend API in real time, and renders the club from the database.
# New admin-created clubs work immediately without rebuilding static files!
# ----------------------------------------------------
RewriteRule ^club(/.*)?$ /club.html [L]

# ----------------------------------------------------
# 3. CLEAN HTML URLS: /{page} -> /{page}.html
# Resolves root pages like /about -> /about.html if present
# ----------------------------------------------------
RewriteCond %{DOCUMENT_ROOT}/$1.html -f [OR]
RewriteCond %{REQUEST_FILENAME}.html -f
RewriteRule ^([a-zA-Z0-9_-]+)/?$ /$1.html [L]

# ----------------------------------------------------
# 4. SERVE EXISTING DIRECTORIES DIRECTLY
# Exclude /club routes and only serve directories containing an index.html file!
# ----------------------------------------------------
RewriteCond %{REQUEST_URI} !^/club
RewriteCond %{REQUEST_FILENAME} -d
RewriteCond %{REQUEST_FILENAME}/index.html -f
RewriteRule ^ - [L]

# ----------------------------------------------------
# 5. SPA FALLBACK
# Fallback for client-side routing and top-level pages
# ----------------------------------------------------
RewriteRule ^ /index.html [L]


# ========================================
# PERFORMANCE & CACHING (Browser Cache)
# ========================================
<IfModule mod_headers.c>
  # Immutable static assets (hashed CSS, JS, Next.js chunks)
  <FilesMatch "\\.(css|js|woff|woff2|ttf|otf|eot)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>

  # Images and icons
  <FilesMatch "\\.(jpg|jpeg|png|gif|svg|webp|ico)$">
    Header set Cache-Control "public, max-age=2592000"
  </FilesMatch>

  # HTML pages (short cache with revalidation)
  <FilesMatch "\\.(html|htm)$">
    Header set Cache-Control "public, max-age=3600, stale-while-revalidate=86400"
  </FilesMatch>
</IfModule>

# ========================================
# COMPRESSION (GZIP)
# ========================================
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/css text/javascript application/javascript application/json image/svg+xml
</IfModule>

# ========================================
# SECURITY & COMPATIBILITY
# ========================================
# Disable directory index browsing
Options -Indexes

# Block sensitive files
<FilesMatch "^\\.(env|git|htaccess|htpasswd)">
  Order allow,deny
  Deny from all
</FilesMatch>

# Security headers
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "SAMEORIGIN"
  Header set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

# Custom 404 page
ErrorDocument 404 /404.html
`;
}

/**
 * Validate file sizes against InfinityFree limits
 */
function validateFiles(dir) {
  const issues = [];
  let totalSize = 0;

  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        const stat = fs.statSync(fullPath);
        totalSize += stat.size;
        const ext = path.extname(entry.name).toLowerCase();
        const isCodeFile = ['.html', '.htm', '.php', '.js', '.css'].includes(ext);
        const maxSize = isCodeFile ? MAX_HTML_PHP_JS_SIZE : MAX_OTHER_SIZE;
        if (stat.size > maxSize) {
          const relPath = path.relative(dir, fullPath);
          issues.push(`${relPath}: ${(stat.size / 1024).toFixed(0)} KB exceeds ${isCodeFile ? '1 MB' : '10 MB'} limit`);
        }
      }
    }
  }

  walk(dir);
  return { issues, totalSize };
}

// ============================================================
// Main Build Process
// ============================================================

async function main() {
  log('Starting InfinityFree static build process...');

  const originalConfig = fs.readFileSync(CONFIG_PATH, 'utf8');
  let apiMoved = false;
  let clubSlugMoved = false;

  try {
    // 1. Clean previous export and dist directories
    if (fs.existsSync(OUT_DIR)) {
      fs.rmSync(OUT_DIR, { recursive: true, force: true });
    }
    if (fs.existsSync(DIST_DIR)) {
      fs.rmSync(DIST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(DIST_DIR, { recursive: true });

    // 2. Temporarily isolate app/api and app/club/[slug] for static export
    if (fs.existsSync(API_DIR)) {
      log('Isolating dynamic API routes for static export...');
      fs.renameSync(API_DIR, API_BACKUP_DIR);
      apiMoved = true;
    }
    if (fs.existsSync(CLUB_SLUG_DIR)) {
      log('Isolating dynamic club routes so universal /club.html shell is exported...');
      fs.renameSync(CLUB_SLUG_DIR, CLUB_SLUG_BACKUP_DIR);
      clubSlugMoved = true;
    }

    // 3. Temporarily set output: 'export' in next.config.mjs
    log('Configuring next.config.mjs for static export...');
    const staticConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  compress: true,
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true
  }
};

export default nextConfig;
`;
    fs.writeFileSync(CONFIG_PATH, staticConfig, 'utf8');

    // 4. Run Next.js static build
    log('Building static export (next build)...');
    execSync('npx next build', {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    });

  } finally {
    // ALWAYS restore original config, club routes, and API directory
    log('Restoring project configuration and routes...');
    fs.writeFileSync(CONFIG_PATH, originalConfig, 'utf8');
    if (clubSlugMoved && fs.existsSync(CLUB_SLUG_BACKUP_DIR)) {
      fs.renameSync(CLUB_SLUG_BACKUP_DIR, CLUB_SLUG_DIR);
      log('Dynamic club routes restored successfully.');
    }
    if (apiMoved && fs.existsSync(API_BACKUP_DIR)) {
      fs.renameSync(API_BACKUP_DIR, API_DIR);
      log('API routes restored successfully.');
    }
  }

  // 5. Verify and copy static output
  if (!fs.existsSync(OUT_DIR)) {
    fatal('Static build did not produce an "out/" directory.');
  }

  log('Copying static export into dist-infinityfree/...');
  copyDirSync(OUT_DIR, DIST_DIR);

  // 6. Optimize and minify HTML files to stay comfortably under InfinityFree's 1 MB limit
  log('Minifying exported HTML files for InfinityFree size compliance (< 1 MB)...');
  function minifyHtml(html) {
    return html
      .replace(/>\s{2,}</g, '><')
      .replace(/\s{2,}/g, ' ')
      .replace(/<!--(?!\[if)[\s\S]*?-->/g, '');
  }

  function walkAndMinify(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkAndMinify(full);
      } else if (entry.name.endsWith('.html')) {
        const orig = fs.readFileSync(full, 'utf8');
        const min = minifyHtml(orig);
        fs.writeFileSync(full, min, 'utf8');
      }
    }
  }
  walkAndMinify(DIST_DIR);

  // 7. Generate .htaccess
  log('Generating .htaccess for InfinityFree...');
  fs.writeFileSync(path.join(DIST_DIR, '.htaccess'), generateHtaccess(), 'utf8');

  // 7. Validate generated files
  log('Validating files against InfinityFree constraints...');
  const { issues, totalSize } = validateFiles(DIST_DIR);
  const totalMB = (totalSize / (1024 * 1024)).toFixed(2);

  let fileCount = 0;
  function countFiles(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) countFiles(path.join(d, entry.name));
      else fileCount++;
    }
  }
  countFiles(DIST_DIR);

  log('');
  log('====================================================');
  log('  INFINITYFREE STATIC EXPORT COMPLETED SUCCESSFULLY!');
  log('====================================================');
  log(`  Distribution Directory:  dist-infinityfree/`);
  log(`  Total Files:             ${fileCount}`);
  log(`  Total Size:              ${totalMB} MB (out of 5,000 MB quota)`);
  log(`  Issues / Violations:     ${issues.length}`);
  if (issues.length > 0) {
    warn('The following files exceed InfinityFree limits:');
    issues.forEach(iss => warn(`  - ${iss}`));
  } else {
    log('  Status:                  100% compliant with InfinityFree rules');
  }
  log('');
  log('  DEPLOYMENT INSTRUCTIONS:');
  log('  1. Open your FTP client (FileZilla, WinSCP, or InfinityFree Web FTP).');
  log('  2. Connect to your InfinityFree account and navigate to htdocs/');
  log('  3. Upload the contents of "dist-infinityfree" directly into "htdocs/".');
  log('  4. Make sure .htaccess is uploaded (it is located in dist-infinityfree/.htaccess).');
  log('  5. The public ACEIT Sports website is live!');
  log('====================================================');
}

main().catch(err => {
  console.error('[build-infinityfree] Error:', err);
  process.exit(1);
});
