/**
 * Builds every logo variant from the approved artwork (brand/source/qitl-logo.webp). Run: node scripts/build-brand.mjs
 * Outputs (committed): public/brand/*, src/app/icon.png, src/app/apple-icon.png, src/app/opengraph-image.png.
 * The dark variant recolours the deep-green ink to ivory so the mark stays legible on the journey's dark ground;
 * gold and the cream pages are kept. Nothing figurative is added.
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "brand/source/qitl-logo.webp";
const OUT = "public/brand";
mkdirSync(OUT, { recursive: true });

const IVORY = [242, 245, 238];
const EVERGREEN = { r: 6, g: 21, b: 25, alpha: 1 }; // journey surface

/** Deep green ink: green dominant, dark. Gold (r high) and cream (all high) are untouched. */
function isGreenInk(r, g, b) {
  return g > r + 8 && g >= b - 4 && r < 90 && g < 140;
}

async function rgba(input) {
  return sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

async function recolour(input) {
  const { data, info } = await rgba(input);
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    // The source was cut from a white ground: neutral light-grey edge pixels are that ground's halo. Invisible on
    // light surfaces, they read as a grey fringe on dark ones, so the dark variant drops them (cream pages and gold
    // are warm, not neutral, and stay).
    if (data[i + 3] > 0 && Math.max(r, g, b) - Math.min(r, g, b) < 14 && Math.min(r, g, b) > 150) {
      data[i + 3] = 0;
      continue;
    }
    if (data[i + 3] > 0 && isGreenInk(data[i], data[i + 1], data[i + 2])) {
      // Keep shading: lighter for lighter greens.
      const shade = Math.min(1, 0.82 + (data[i + 1] / 140) * 0.18);
      data[i] = Math.round(IVORY[0] * shade);
      data[i + 1] = Math.round(IVORY[1] * shade);
      data[i + 2] = Math.round(IVORY[2] * shade);
    }
  }
  return sharp(data, { raw: info }).png();
}

// Trimmed full logo (emblem + wordmark + tagline).
const full = await sharp(SRC).trim({ threshold: 1 }).png().toBuffer();
const meta = await sharp(full).metadata();

// The emblem (arch, spine and open book) is symmetric about its spine, and its right wing touches the Q of the
// wordmark. Take its left half up to the spine and mirror it, so the compact mark carries no lettering.
const { data: px, info: pi } = await rgba(full);
let apexX = 0;
outer: for (let y = 0; y < pi.height; y++)
  for (let x = 0; x < Math.round(pi.width * 0.45); x++)
    if (px[(y * pi.width + x) * 4 + 3] > 128) {
      apexX = x;
      break outer;
    }
const halfW = apexX + 3; // include the spine itself
const left = await sharp(full).extract({ left: 0, top: 0, width: halfW, height: meta.height }).png().toBuffer();
const right = await sharp(full).extract({ left: 0, top: 0, width: halfW - 6, height: meta.height }).flop().png().toBuffer();
const emblem = await sharp({ create: { width: halfW * 2 - 6, height: meta.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    { input: left, left: 0, top: 0 },
    { input: right, left: halfW, top: 0 },
  ])
  .png()
  .toBuffer()
  .then((b) => sharp(b).trim({ threshold: 1 }).png().toBuffer());

await sharp(full).resize({ width: 1200 }).png({ compressionLevel: 9 }).toFile(`${OUT}/qitl-logo.png`);
await sharp(full).resize({ width: 640 }).webp({ quality: 92 }).toFile(`${OUT}/qitl-logo.webp`);
const fullDark = await (await recolour(full)).toBuffer();
await sharp(fullDark).resize({ width: 1200 }).png({ compressionLevel: 9 }).toFile(`${OUT}/qitl-logo-dark.png`);
await sharp(fullDark).resize({ width: 640 }).webp({ quality: 92 }).toFile(`${OUT}/qitl-logo-dark.webp`);

await sharp(emblem).resize({ height: 256 }).png().toFile(`${OUT}/qitl-mark.png`);
await sharp(emblem).resize({ height: 128 }).webp({ quality: 92 }).toFile(`${OUT}/qitl-mark.webp`);
const emblemDark = await (await recolour(emblem)).toBuffer();
await sharp(emblemDark).resize({ height: 256 }).png().toFile(`${OUT}/qitl-mark-dark.png`);
await sharp(emblemDark).resize({ height: 128 }).webp({ quality: 92 }).toFile(`${OUT}/qitl-mark-dark.webp`);

// App icons: the ivory emblem on the evergreen journey ground, padded so it reads at 16-32px.
async function icon(size, file, pad = 0.14) {
  const inner = Math.round(size * (1 - pad * 2));
  const mark = await sharp(emblemDark).resize({ width: inner, height: inner, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: EVERGREEN } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(file);
}
await icon(512, "src/app/icon.png");
await icon(180, "src/app/apple-icon.png", 0.12);
await icon(512, `${OUT}/qitl-icon-512.png`);
await icon(192, `${OUT}/qitl-icon-192.png`);

// Open Graph: the dark logo centred on the journey ground.
const og = await sharp(fullDark).resize({ width: 820 }).png().toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: EVERGREEN } })
  .composite([{ input: og, gravity: "center" }])
  .png()
  .toFile("src/app/opengraph-image.png");

console.log("brand: wrote public/brand/*, src/app/icon.png, apple-icon.png, opengraph-image.png");
