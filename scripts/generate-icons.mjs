/**
 * Script to generate PWA icons from the SVG logo.
 * Run: node scripts/generate-icons.mjs
 * Requires: pnpm add -D sharp
 */
import sharp from "sharp";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const iconsDir = join(root, "public", "icons");

if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const BG = { r: 16, g: 80, b: 98, alpha: 1 }; // #105062

const svgPath = join(root, "public", "LOGO-MHEDIA-03.svg"); // White logo — visible on dark background

async function generate() {
  for (const size of SIZES) {
    const padding = Math.round(size * 0.15);
    const inner = size - padding * 2;

    // Regular icon
    await sharp(svgPath)
      .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: padding, bottom: padding, left: padding, right: padding, background: BG })
      .png()
      .toFile(join(iconsDir, `icon-${size}x${size}.png`));

    console.log(`✓ icon-${size}x${size}.png`);
  }

  // Maskable (more padding = safe zone ~20%)
  for (const size of [192, 512]) {
    const padding = Math.round(size * 0.2);
    const inner = size - padding * 2;

    await sharp(svgPath)
      .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: padding, bottom: padding, left: padding, right: padding, background: BG })
      .png()
      .toFile(join(iconsDir, `icon-maskable-${size}x${size}.png`));

    console.log(`✓ icon-maskable-${size}x${size}.png`);
  }

  console.log("\n✅ All PWA icons generated in public/icons/");
}

generate().catch(err => {
  console.error("Error generating icons:", err);
  process.exit(1);
});
