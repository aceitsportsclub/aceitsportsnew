import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
import fs from 'node:fs';
import path from 'node:path';

const baseDir = 'public/landing/assets';

// Safe write: write to temp file, then rename over original
function safeWrite(filePath, buffer) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, buffer);
  try { fs.unlinkSync(filePath); } catch {}
  fs.renameSync(tmp, filePath);
}

async function optimize() {
  // 1. Optimize aceit_sports_emblem.png → 512x512 PNG
  const emblemSrc = path.join(baseDir, 'icons', 'aceit_sports_emblem.png');
  const emblem512Png = await sharp(emblemSrc).resize(512, 512).png({ compressionLevel: 9 }).toBuffer();
  safeWrite(emblemSrc, emblem512Png);
  console.log('aceit_sports_emblem.png optimized: 512x512 PNG =', emblem512Png.length, 'bytes');

  // 2. Optimize aceit_crest.svg - replace 866KB base64 PNG with 256x256 optimized version
  const crest256Png = await sharp(emblemSrc).resize(256, 256).png({ compressionLevel: 9 }).toBuffer();
  const crest256B64 = crest256Png.toString('base64');
  const newSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <image href="data:image/png;base64,${crest256B64}" width="256" height="256"/>
</svg>
`;
  safeWrite(path.join(baseDir, 'icons', 'aceit_crest.svg'), Buffer.from(newSvg, 'utf8'));
  console.log('aceit_crest.svg optimized:', newSvg.length, 'bytes (was 1,155,404)');

  // 3. Generate WebP versions of hero/event JPGs + optimize originals
  const imageDir = path.join(baseDir, 'images');
  const jpgFiles = fs.readdirSync(imageDir).filter(f => f.endsWith('.jpg'));
  for (const f of jpgFiles) {
    const src = path.join(imageDir, f);
    const stat = fs.statSync(src);
    const isHero = f.startsWith('hero_');
    const maxDim = isHero ? 1920 : 1200;

    // Read into buffer first so file isn't locked during processing
    const srcBuf = fs.readFileSync(src);

    // Generate WebP
    const webpBuf = await sharp(srcBuf)
      .resize({ width: maxDim, withoutEnlargement: true })
      .webp({ quality: 80, effort: 6 })
      .toBuffer();
    const webpPath = path.join(imageDir, f.replace('.jpg', '.webp'));
    fs.writeFileSync(webpPath, webpBuf);

    // Optimize original JPG in-place
    const jpgBuf = await sharp(srcBuf)
      .resize({ width: maxDim, withoutEnlargement: true })
      .jpeg({ quality: 82, progressive: true, mozjpeg: true })
      .toBuffer();
    safeWrite(src, jpgBuf);

    console.log(`${f}: ${Math.round(stat.size / 1024)} KB -> WebP ${Math.round(webpBuf.length / 1024)} KB, JPG ${Math.round(jpgBuf.length / 1024)} KB`);
  }

  // 4. Optimize root emblem
  const rootEmblem = 'public/aceit_sports_emblem.png';
  if (fs.existsSync(rootEmblem)) {
    const rootBuf = await sharp(fs.readFileSync(rootEmblem)).resize(512, 512).png({ compressionLevel: 9 }).toBuffer();
    safeWrite(rootEmblem, rootBuf);
    console.log('root aceit_sports_emblem.png optimized:', rootBuf.length, 'bytes');
  }

  // 5. Create WebP version of emblem
  const emblemWebp = await sharp(emblemSrc).resize(512, 512).webp({ quality: 85 }).toBuffer();
  fs.writeFileSync(path.join(baseDir, 'icons', 'aceit_sports_emblem.webp'), emblemWebp);
  console.log('aceit_sports_emblem.webp created:', emblemWebp.length, 'bytes');

  // 6. Optimize the JPG version of the emblem
  const emblemJpgSrc = path.join(baseDir, 'icons', 'aceit_sports_emblem.jpg');
  if (fs.existsSync(emblemJpgSrc)) {
    const emblemJpg = await sharp(fs.readFileSync(emblemJpgSrc)).resize(512, 512).jpeg({ quality: 82, progressive: true, mozjpeg: true }).toBuffer();
    safeWrite(emblemJpgSrc, emblemJpg);
    console.log('aceit_sports_emblem.jpg optimized:', emblemJpg.length, 'bytes');
  }

  console.log('\nAll image optimizations complete!');
}

optimize().catch(e => { console.error(e); process.exit(1); });
