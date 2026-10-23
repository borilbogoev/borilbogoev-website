// Builds the web-ready images in public/brand from the originals in assets-src/.
// Run: npm run images. Static, pre-compressed files are served straight from the CDN edge.
import sharp from "sharp";

const out = "public/brand";

// Portrait: shown as a circle, up to 300px wide on desktop. 1x and 2x.
for (const w of [320, 640]) {
  await sharp("assets-src/portrait.png").resize(w, w).webp({ quality: 82 }).toFile(`${out}/portrait-${w}.webp`);
}

// Portrait in the header: a 34px circle. 1x, 2x and 3x.
for (const w of [34, 68, 102]) {
  await sharp("assets-src/portrait.png").resize(w, w).webp({ quality: 85 }).toFile(`${out}/portrait-nav-${w}.webp`);
}

// The Streamliner logo is 3:1 and shown 28 to 36px tall. 1x, 2x and 3x of the larger size.
for (const h of [36, 72, 108]) {
  await sharp("assets-src/streamliner.png").trim().resize({ height: h }).webp({ quality: 90, alphaQuality: 100 }).toFile(`${out}/streamliner-${h}.webp`);
}

// Touch icon and OG fallback tile.
await sharp("public/brand/bb-monogram-tile-dark.svg", { density: 300 }).resize(180, 180).png().toFile("src/app/apple-icon.png");
console.log("images ready");
