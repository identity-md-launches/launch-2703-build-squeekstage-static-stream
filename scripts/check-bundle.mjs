import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const budget = JSON.parse(await readFile("artifacts/path-budget.json", "utf8"));
const reportPath = "artifacts/bundle-check.json";
const excluded = new Set([
  "node_modules",
  ".cache",
  ".vite",
  ".npm",
  ".git",
  ".github",
  ".playwright-mcp",
]);
const files = [];
async function collect(path) {
  const info = await stat(path);
  if (info.isDirectory()) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (
        excluded.has(entry.name) ||
        entry.name === ".env" ||
        entry.name.startsWith(".env.")
      )
        throw new Error(
          `Forbidden generated/configuration path in payload: ${path}/${entry.name}`,
        );
      if (entry.isSymbolicLink())
        throw new Error(`Symlink in payload: ${path}/${entry.name}`);
      await collect(join(path, entry.name));
    }
  } else if (path !== reportPath) files.push({ path, bytes: info.size });
}
const groups = [];
for (const [pattern, limit] of Object.entries(budget.paths)) {
  const path = pattern.replace(/\/\*\*$/, "");
  const before = files.length;
  await collect(path);
  const bytes = files.slice(before).reduce((sum, file) => sum + file.bytes, 0);
  if (bytes > limit)
    throw new Error(`${pattern} exceeds its explicit ${limit}-byte budget`);
  groups.push({ path: pattern, bytes, budget: limit });
}
const index = await readFile("dist/index.html", "utf8");
if (!index.includes("./assets/") || /(?:src|href)=["']\/assets\//.test(index))
  throw new Error("Export must have relative asset URLs");
for (const required of [
  "dist/share.png",
  "dist/favicon.svg",
  "package-lock.json",
])
  await stat(required);
const exportFiles = [];
for (const file of files.filter((f) => f.path.startsWith("dist/"))) {
  if (/\.(tgz|zip|gz|map)$/.test(file.path))
    throw new Error(`Unnecessary packaging asset: ${file.path}`);
  exportFiles.push({
    ...file,
    sha256: createHash("sha256")
      .update(await readFile(file.path))
      .digest("hex"),
  });
}
const payloadBytes = files.reduce((sum, file) => sum + file.bytes, 0);
const report = {
  passed: true,
  limitBytes: budget.submissionLimitBytes,
  payloadBytesExcludingThisReport: payloadBytes,
  totalBytesIncludingReport: 0,
  exportBytes: exportFiles.reduce((sum, file) => sum + file.bytes, 0),
  fileCountIncludingReport: files.length + 1,
  relativeExportAssets: true,
  groups,
  exportFiles,
};
let serialized = "";
for (let i = 0; i < 5; i++) {
  serialized = JSON.stringify(report, null, 2) + "\n";
  report.totalBytesIncludingReport =
    payloadBytes + Buffer.byteLength(serialized);
}
serialized = JSON.stringify(report, null, 2) + "\n";
if (report.totalBytesIncludingReport > budget.submissionLimitBytes)
  throw new Error("Submission exceeds 8 MiB");
await writeFile(reportPath, serialized);
console.log(
  JSON.stringify(
    {
      passed: true,
      exportBytes: report.exportBytes,
      totalBytesIncludingReport: report.totalBytesIncludingReport,
      limitBytes: report.limitBytes,
      fileCountIncludingReport: report.fileCountIncludingReport,
      relativeExportAssets: true,
    },
    null,
    2,
  ),
);
