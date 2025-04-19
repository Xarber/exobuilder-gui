// scripts/release.js
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const crossZip = require("cross-zip");

const pkg = require("../package.json");
const version = pkg.version;
const tag = `v${version}`;
const branch = "release";

const OUT_DIR = path.join(__dirname, "..", "out");
const DIST_DIR = path.join(__dirname, "..", "release-zips");
if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR);

// Step 1: Zip packaged builds
const builds = fs.readdirSync(OUT_DIR).filter(f => f.endsWith("-x64") || f.endsWith("-arm64"));
const zippedFiles = [];

for (const build of builds) {
  const fullPath = path.join(OUT_DIR, build);
  const zipPath = path.join(DIST_DIR, `${pkg.apptitle || pkg.name}-${build}-v${version}.zip`);
  console.log(`Zipping ${build} → ${zipPath}`);
  crossZip.zipSync(fullPath, zipPath);
  zippedFiles.push(zipPath);
}

// Step 2: Commit everything to release branch
try {
  console.log(`Switching to branch '${branch}'...`);
  execSync(`git checkout -B ${branch}`);
  execSync(`git add .`);
  execSync(`git commit -m "Release ${tag}"`);
  execSync(`git push origin ${branch} --force`);
} catch (err) {
  console.warn("⚠️ Git commit/push failed. Maybe no changes? Continuing...");
}

// Step 3: Create + push Git tag if it doesn’t exist
try {
  execSync(`git rev-parse ${tag}`, { stdio: "ignore" });
  console.log(`Git tag ${tag} already exists.`);
} catch {
  console.log(`Creating Git tag ${tag}...`);
  execSync(`git tag ${tag}`);
  execSync(`git push origin ${tag}`);
}

// Step 4: Create GitHub release (includes auto source code)
console.log(`Creating GitHub release ${tag}...`);
execSync(
  `gh release create ${tag} ${zippedFiles.join(" ")} -t "${tag}" -n "Auto build for ${tag}" --draft`,
  { stdio: "inherit" }
);