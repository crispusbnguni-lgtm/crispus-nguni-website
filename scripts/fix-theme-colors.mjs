
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src");
const backupRoot = path.resolve("theme-fix-backups");

const extensions = new Set([".tsx", ".ts", ".jsx", ".js"]);

let changedFiles = 0;
let replacements = 0;

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(filePath);
      continue;
    }

    if (!extensions.has(path.extname(entry.name))) continue;

    const original = fs.readFileSync(filePath, "utf8");
    const updated = original.replaceAll(
      "bg-[#05070D]",
      "bg-[var(--bg)]"
    );

    if (updated === original) continue;

    const relativePath = path.relative(root, filePath);
    const backupPath = path.join(backupRoot, relativePath);

    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.writeFileSync(backupPath, original, "utf8");
    fs.writeFileSync(filePath, updated, "utf8");

    changedFiles++;
    replacements +=
      (original.match(/bg-\[#05070D\]/g) || []).length;

    console.log(`Updated: ${relativePath}`);
  }
}

if (!fs.existsSync(root)) {
  console.error("Could not find the src folder. Run this from your project root.");
  process.exit(1);
}

walk(root);

console.log(`\nFinished: ${replacements} replacements in ${changedFiles} files.`);
console.log(`Backups saved to: ${backupRoot}`);