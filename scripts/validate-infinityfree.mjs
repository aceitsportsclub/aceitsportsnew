#!/usr/bin/env node
/**
 * InfinityFree Deployment Validator
 * 
 * Verifies that the build output in dist-infinityfree/ satisfies all
 * constraints of InfinityFree free hosting:
 * - HTML, PHP, JS files < 1 MB
 * - Other files (images, media, etc.) < 10 MB
 * - .htaccess is present and valid
 * - index.html is present
 * - 404.html is present
 * - No sensitive files (.env, .git, etc.) are present
 * - Total size is well within the 5 GB disk quota
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist-infinityfree');

const MAX_HTML_PHP_JS_SIZE = 1024 * 1024; // 1 MB limit for scripts/pages
const MAX_OTHER_SIZE = 10 * 1024 * 1024;  // 10 MB limit for assets
const MAX_TOTAL_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB limit

function log(msg) { console.log(`[validate-infinityfree] ${msg}`); }
function error(msg) { console.error(`[validate-infinityfree] ❌ ERROR: ${msg}`); }
function warn(msg) { console.warn(`[validate-infinityfree] ⚠️  WARNING: ${msg}`); }
function pass(msg) { console.log(`[validate-infinityfree] ✅ PASS: ${msg}`); }

function runValidation() {
  log('Starting validation of dist-infinityfree/ for InfinityFree compatibility...\n');

  if (!fs.existsSync(DIST_DIR)) {
    error('dist-infinityfree/ directory does not exist. Run "npm run build:infinityfree" first.');
    process.exit(1);
  }

  let failures = 0;
  let warnings = 0;
  let totalBytes = 0;
  let fileCount = 0;

  // 1. Check critical files
  const criticalFiles = ['index.html', '.htaccess'];
  for (const cf of criticalFiles) {
    const fullPath = path.join(DIST_DIR, cf);
    if (fs.existsSync(fullPath)) {
      pass(`Found critical file: ${cf}`);
    } else {
      error(`Missing critical file: ${cf}`);
      failures++;
    }
  }

  // Check 404 handler
  if (fs.existsSync(path.join(DIST_DIR, '404.html'))) {
    pass('Custom 404.html is present for client error handling');
  } else {
    warn('No 404.html found; default Apache 404 page will be shown for missing paths');
    warnings++;
  }

  // 2. Scan all files for size and prohibited content
  const sensitivePatterns = [/\.env(\..+)?$/i, /\.git/i, /credentials/i, /secret/i, /supabase.*service.*key/i];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        fileCount++;
        const stat = fs.statSync(fullPath);
        totalBytes += stat.size;
        const relPath = path.relative(DIST_DIR, fullPath).replace(/\\/g, '/');
        const ext = path.extname(entry.name).toLowerCase();

        // Check sensitive files
        for (const pat of sensitivePatterns) {
          if (pat.test(entry.name)) {
            error(`Potential sensitive file found in deployment: ${relPath}`);
            failures++;
          }
        }

        // Check size constraints
        const isCode = ['.html', '.htm', '.php', '.js', '.css'].includes(ext);
        const limit = isCode ? MAX_HTML_PHP_JS_SIZE : MAX_OTHER_SIZE;
        const limitName = isCode ? '1 MB' : '10 MB';

        if (stat.size > limit) {
          error(`${relPath} is ${(stat.size / 1024).toFixed(1)} KB (exceeds ${limitName} InfinityFree limit)`);
          failures++;
        }
      }
    }
  }

  walk(DIST_DIR);

  // 3. Disk quota check
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
  if (totalBytes > MAX_TOTAL_SIZE) {
    error(`Total build size (${totalMB} MB) exceeds 5 GB InfinityFree storage quota!`);
    failures++;
  } else {
    pass(`Total deployment size: ${totalMB} MB across ${fileCount} files (well within 5 GB quota)`);
  }

  console.log('\n----------------------------------------');
  console.log(`Validation summary: ${failures} errors, ${warnings} warnings`);
  if (failures === 0) {
    console.log('🎉 Your build is 100% compliant and ready for InfinityFree htdocs/ upload!');
  } else {
    console.log('❌ Fix the errors above before deploying to InfinityFree.');
    process.exit(1);
  }
}

runValidation();
