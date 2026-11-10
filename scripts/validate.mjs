// Checks the project without a browser. Run it locally with:  node scripts/validate.mjs
// The GitHub Actions workflow runs the same script before every deploy.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const fail = message => problems.push(message);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name === "node_modules" || name === "scripts") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out); else out.push(full);
  }
  return out;
}

const files = walk(root);
const rel = file => file.slice(root.length + 1);
const read = file => readFileSync(file, "utf8");

// 1. Every JSON file parses.
const json = {};
files.filter(f => extname(f) === ".json").forEach(f => {
  try { json[rel(f)] = JSON.parse(read(f)); } catch (error) { fail(rel(f) + " is not valid JSON: " + error.message); }
});

// 2. Every JavaScript file has valid syntax.
files.filter(f => extname(f) === ".js").forEach(f => {
  const check = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
  if (check.status !== 0) fail(rel(f) + " has a syntax error:\n" + check.stderr);
});

// 3. Local files referenced by HTML and CSS exist.
files.filter(f => extname(f) === ".html").forEach(f => {
  for (const match of read(f).matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|data:|\/\/)/.test(target)) continue;
    if (!existsSync(resolve(dirname(f), target))) fail(rel(f) + " points to a missing file: " + target);
  }
});
files.filter(f => extname(f) === ".css").forEach(f => {
  for (const match of read(f).matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    if (/^(https?:|data:|#)/.test(match[1])) continue;
    if (!existsSync(resolve(dirname(f), match[1]))) fail(rel(f) + " points to a missing file: " + match[1]);
  }
});

// 4. Game data has the shape the games expect.
const questions = json["data/questions.json"];
if (questions) {
  questions.categories.forEach(category => category.questions.forEach(q => {
    const where = "data/questions.json " + q.id;
    if (!q.correct || !Array.isArray(q.wrong) || q.wrong.length !== 3) fail(where + " needs correct and exactly 3 wrong answers");
    if (q.wrong && q.wrong.includes(q.correct)) fail(where + " lists the correct answer as a wrong answer");
    if (q.image && !existsSync(resolve(root, "content", q.image))) fail(where + " image is missing: " + q.image);
  }));
}
const quiz = json["data/quiz.json"];
if (quiz) quiz.questions.forEach((q, i) => {
  if (!q.q || !q.correct || !Array.isArray(q.wrong) || q.wrong.length !== 3) fail("data/quiz.json question " + (i + 1) + " needs q, correct and 3 wrong answers");
  if (q.wrong && q.wrong.includes(q.correct)) fail("data/quiz.json question " + (i + 1) + " repeats the correct answer");
});
const feud = json["data/feud.json"];
if (feud) feud.rounds.forEach((round, i) => {
  const sum = round.answers.reduce((total, a) => total + a.points, 0);
  if (sum !== 100) fail("data/feud.json round " + (i + 1) + " points add up to " + sum + ", not 100");
  const sorted = round.answers.every((a, k) => k === 0 || round.answers[k - 1].points >= a.points);
  if (!sorted) fail("data/feud.json round " + (i + 1) + " answers should be sorted from most to fewest points");
});
const memory = json["data/memory.json"];
if (memory) memory.cards.forEach(card => {
  if (!existsSync(resolve(root, "content", card.image))) fail("data/memory.json image is missing: " + card.image);
});
const games = json["data/games.json"];
if (games) games.games.forEach(game => {
  if (!existsSync(resolve(root, "content", game.link.split("?")[0]))) fail("data/games.json link is missing: " + game.link);
});
const modes = json["data/board-styles.json"];
if (modes) modes.styles.forEach(style => {
  if (!existsSync(resolve(root, "content", style.link.split("?")[0]))) fail("data/board-styles.json link is missing: " + style.link);
});

// 5. The maze generator makes perfect mazes and all three solvers agree on the shortest path.
const MazeLib = createRequire(import.meta.url)(join(root, "content", "maze-lib.js"));
for (let seed = 1; seed <= 60; seed++) {
  const w = 4 + (seed % 17), h = 4 + ((seed * 7) % 17);
  const maze = MazeLib.generate(w, h, MazeLib.mulberry(seed));
  let edges = 0;
  for (let i = 0; i < w * h; i++) edges += MazeLib.neighbours(maze, i).length;
  if (edges / 2 !== w * h - 1) { fail("maze " + seed + " is not a perfect maze"); break; }
  const lengths = ["bfs", "dfs", "astar"].map(name => MazeLib.solvers[name](maze, 0, w * h - 1).path.length);
  if (new Set(lengths).size !== 1) { fail("maze " + seed + " solvers disagree: " + lengths.join(", ")); break; }
}

if (problems.length) {
  console.error("Validation failed:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log("Validated " + files.length + " files: JSON, JavaScript syntax, local links, game data and the maze library.");
