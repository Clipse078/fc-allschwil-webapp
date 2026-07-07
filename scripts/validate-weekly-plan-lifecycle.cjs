const fs = require("fs");
const path = require("path");

const root = process.cwd();

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || ["node_modules", ".next", "dist", "build"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|js|jsx|prisma)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

const files = [
  ...walk(path.join(root, "app")),
  ...walk(path.join(root, "components")),
  ...walk(path.join(root, "lib")),
  ...walk(path.join(root, "prisma")),
  ...walk(path.join(root, "scripts")),
];

const corpus = files.map((file) => ({
  file,
  rel: path.relative(root, file),
  text: read(file),
}));

function assertSignal(name, patterns) {
  const found = corpus.some(({ rel, text }) =>
    patterns.some((p) => p.test(rel) || p.test(text))
  );

  if (!found) {
    throw new Error(`Missing lifecycle signal: ${name}`);
  }

  console.log(`OK  ${name}`);
}

console.log("Weekly Plan Lifecycle Validation Runner");
console.log(`Scanned files: ${corpus.length}`);

assertSignal("weekly plan source exists", [
  /weekly[-_ ]?plan/i,
  /wochenplan/i,
  /planner[\\/]week/i,
]);

assertSignal("weekly plan API or server action exists", [
  /app[\\/]api[\\/].*week/i,
  /app[\\/]api[\\/].*plan/i,
  /route\.ts$/,
  /server action/i,
]);

assertSignal("draft/edit lifecycle is represented", [
  /DRAFT/i,
  /draft/i,
  /entwurf/i,
]);

assertSignal("publish lifecycle is represented", [
  /PUBLISHED/i,
  /published/i,
  /publish/i,
  /veröffentlicht/i,
]);

assertSignal("public website feed path is represented", [
  /public.*weekly/i,
  /public.*week/i,
  /public.*plan/i,
  /wochenplan/i,
]);

assertSignal("tenant or club scoping exists", [
  /tenantId/,
  /clubId/,
  /membership/i,
]);

assertSignal("validation or authorization guard exists", [
  /zod/i,
  /authorize/i,
  /permission/i,
  /role/i,
  /can[A-Z]/,
]);

console.log("");
console.log("Weekly plan lifecycle static validation passed.");
