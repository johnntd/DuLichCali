#!/usr/bin/env node
/**
 * generate-promo.js
 * -----------------
 * Render a FoodPromo video and (optionally) upload to Firebase Storage,
 * then print the public download URL so it can be stored in Firestore.
 *
 * Usage:
 *   node generate-promo.js --props '{"vendorName":"...","itemName":"...",...}'
 *   node generate-promo.js --props-file ./emily-eggroll.json [--upload]
 *
 * Flags:
 *   --props <json>         Inline JSON overrides for FoodPromoSchema defaults
 *   --props-file <path>    Path to a JSON file with props
 *   --image <path>         Absolute/relative path to the food image; it will be
 *                          copied into remotion-promo/public/ automatically
 *   --output <path>        Where to save the MP4 (default: ./out/food-promo.mp4)
 *   --upload               Upload the rendered video to Firebase Storage
 *   --bucket <name>        Firebase Storage bucket (default: dulichcali-booking-calendar.appspot.com)
 *   --help                 Show this help
 *
 * Prerequisites:
 *   npm install   (inside remotion-promo/)
 *   Place food image in remotion-promo/public/ OR pass --image <path>
 *
 * Firebase upload requires:
 *   npm install -g firebase-tools
 *   firebase login
 *   OR set GOOGLE_APPLICATION_CREDENTIALS env var
 */

const { execSync, spawnSync } = require("child_process");
const fs   = require("fs");
const path = require("path");

// ─── Argument parsing ────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getFlag(name) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

function hasFlag(name) {
  return args.includes(name);
}

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Usage: node generate-promo.js [options]

Options:
  --props <json>         Inline JSON props (merged on top of schema defaults)
  --props-file <path>    JSON file containing props
  --image <path>         Food image to copy into public/ before rendering
  --name <slug>          Output filename slug (e.g. "chuoi-dau-nau-oc" → out/chuoi-dau-nau-oc.mp4)
  --output <path>        Explicit output path (overrides --name; default: ./out/food-promo.mp4)
  --upload               Upload rendered video to Firebase Storage
  --bucket <name>        Firebase Storage bucket name
  --help                 Show this help
`);
  process.exit(0);
}

// ─── Resolve paths ───────────────────────────────────────────────────────────

const scriptDir  = __dirname;                          // remotion-promo/
const publicDir  = path.join(scriptDir, "public");
const nameSlug   = getFlag("--name");
const outDefault = nameSlug
  ? path.join(scriptDir, "out", nameSlug + ".mp4")
  : path.join(scriptDir, "out", "food-promo.mp4");
const outputPath = getFlag("--output") || outDefault;

// Ensure public/ and out/ exist
fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

// ─── Merge props ─────────────────────────────────────────────────────────────

let inputProps = {};

const propsFile = getFlag("--props-file");
if (propsFile) {
  const resolved = path.resolve(process.cwd(), propsFile);
  if (!fs.existsSync(resolved)) {
    console.error(`❌  Props file not found: ${resolved}`);
    process.exit(1);
  }
  inputProps = JSON.parse(fs.readFileSync(resolved, "utf8"));
}

const inlineProps = getFlag("--props");
if (inlineProps) {
  try {
    Object.assign(inputProps, JSON.parse(inlineProps));
  } catch (e) {
    console.error("❌  --props is not valid JSON:", e.message);
    process.exit(1);
  }
}

// ─── Copy image into public/ if --image was supplied ─────────────────────────

const imageSrc = getFlag("--image");
if (imageSrc) {
  const resolved = path.resolve(process.cwd(), imageSrc);
  if (!fs.existsSync(resolved)) {
    console.error(`❌  Image file not found: ${resolved}`);
    process.exit(1);
  }
  const basename = path.basename(resolved);
  const dest     = path.join(publicDir, basename);
  fs.copyFileSync(resolved, dest);
  console.log(`✔  Copied image → public/${basename}`);
  // Auto-set itemImage in props if not already set
  if (!inputProps.itemImage) {
    inputProps.itemImage = basename;
  }
}

// ─── Render ──────────────────────────────────────────────────────────────────

const propsJson = JSON.stringify(inputProps);

// Write props to a temp file — avoids shell quote-stripping when passing JSON inline.
const tmpPropsPath = path.join(scriptDir, "out", "_render-props.json");
fs.mkdirSync(path.dirname(tmpPropsPath), { recursive: true });
fs.writeFileSync(tmpPropsPath, propsJson, "utf8");

console.log("\n🎬  Rendering FoodPromo video…");
console.log(`    Props: ${propsJson.slice(0, 120)}${propsJson.length > 120 ? "…" : ""}`);
console.log(`    Output: ${outputPath}\n`);

const renderArgs = [
  "remotion",
  "render",
  "src/index.ts",       // entry point
  "FoodPromo",          // composition ID
  outputPath,
  "--props", tmpPropsPath,   // file path — shell-safe
  "--log", "verbose",
];

const result = spawnSync("npx", renderArgs, {
  cwd:   scriptDir,
  stdio: "inherit",
  shell: true,
});

// Clean up temp props file regardless of outcome
try { fs.unlinkSync(tmpPropsPath); } catch (_) {}

if (result.status !== 0) {
  console.error("\n❌  Render failed (exit code", result.status, ")");
  process.exit(result.status || 1);
}

console.log(`\n✅  Render complete → ${outputPath}`);

// ─── Upload to Firebase Storage ───────────────────────────────────────────────

if (!hasFlag("--upload")) {
  console.log("\nSkipping Firebase upload (pass --upload to enable).");
  console.log("Done.\n");
  process.exit(0);
}

const bucket = getFlag("--bucket") || "dulichcali-booking-calendar.appspot.com";

// Derive a storage path from the output filename
const videoFilename  = path.basename(outputPath);                       // food-promo.mp4
const storageDest    = `food-promo-videos/${videoFilename}`;            // path inside bucket
const gsUri          = `gs://${bucket}/${storageDest}`;
const publicUrl      = `https://storage.googleapis.com/${bucket}/${storageDest}`;

console.log(`\n☁️   Uploading to Firebase Storage…`);
console.log(`    ${outputPath} → ${gsUri}\n`);

try {
  execSync(`gsutil cp "${outputPath}" "${gsUri}"`, { stdio: "inherit" });
  execSync(`gsutil acl ch -u AllUsers:R "${gsUri}"`, { stdio: "inherit" });
  console.log(`\n✅  Upload complete!`);
  console.log(`\n📺  Public video URL:`);
  console.log(`    ${publicUrl}`);
  console.log(`\nSave this URL as the "videoUrl" field on the Firestore product document.\n`);
} catch (e) {
  console.error(
    "\n⚠️  gsutil upload failed. Make sure gsutil is installed and authenticated:",
    "\n    gcloud auth login",
    "\n    gcloud config set project dulichcali-booking-calendar",
  );
  console.error("\n    Rendered video is available locally at:", outputPath);
  process.exit(1);
}
