// Maze game.
//   ?mode=run     steer Cy through three bigger and bigger mazes against the clock.
//   ?mode=solver  watch breadth-first search, depth-first search and A* solve a maze.
// Generation and solvers live in maze-lib.js.

const $ = id => document.getElementById(id);
const mode = Hub.params.get("mode") === "solver" ? "solver" : "run";
const { generate, solvers, N, E, S, W, DX, DY } = MazeLib;

const canvas = $("maze");
const ctx = canvas.getContext("2d");
const LEVELS = [8, 12, 16];
const ALGO_NAMES = { bfs: "Breadth-first search", dfs: "Depth-first search", astar: "A*" };

let maze = null;
let size = 10;
let cell = 20;
let dpr = 1;
let carved = 0;            // how many cells of maze.order are drawn so far (build animation)
let building = false;
let raf = 0;

// run mode
let level = 0;
let pos = 0;
let trail = new Set();
let moves = 0;
let totalScore = 0;
let levelStart = 0;
let playing = false;
let px = 0, py = 0;        // smoothed player position in cell units

// solver mode
let algo = "bfs";
let run = null;            // { visited, path, shown, pathShown, phase }
let results = {};
let finished = false;

/* ----------------------------------------------------------------- drawing */

function fit() {
  const wrap = canvas.parentElement;
  const avail = Math.max(220, Math.min(640, wrap.clientWidth - 24));
  cell = Math.max(6, Math.floor(avail / size));
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const css = cell * size;
  canvas.style.width = css + "px";
  canvas.style.height = css + "px";
  canvas.width = Math.round(css * dpr);
  canvas.height = Math.round(css * dpr);
}

function drawMaze() {
  const css = cell * size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, css, css);
  ctx.fillStyle = "#0d0714";
  ctx.fillRect(0, 0, css, css);
  if (!maze) return;

  const total = maze.w * maze.h;
  const shown = new Uint8Array(total);
  for (let k = 0; k < carved; k++) shown[maze.order[k]] = 1;

  // floor, visited cells and path
  const explored = run ? run.visited.slice(0, Math.floor(run.shown)) : [];
  const exploredMap = new Map();
  explored.forEach((cellIndex, k) => exploredMap.set(cellIndex, k));
  const pathSet = run && run.phase !== "explore" ? new Set(run.path.slice(0, Math.floor(run.pathShown))) : null;

  for (let i = 0; i < total; i++) {
    if (!shown[i]) continue;
    const x = (i % maze.w) * cell, y = ((i / maze.w) | 0) * cell;
    ctx.fillStyle = "#170c20";
    ctx.fillRect(x, y, cell, cell);
    if (exploredMap.has(i)) {
      const t = exploredMap.get(i) / Math.max(1, run.visited.length);
      ctx.fillStyle = "hsla(" + (190 + t * 120) + ", 90%, 55%, 0.55)";
      ctx.fillRect(x, y, cell, cell);
    }
    if (trail.has(i)) {
      ctx.fillStyle = "rgba(241, 190, 72, 0.22)";
      ctx.fillRect(x, y, cell, cell);
    }
    if (pathSet && pathSet.has(i)) {
      ctx.fillStyle = "#ffd76a";
      ctx.shadowColor = "#ffd76a";
      ctx.shadowBlur = cell * 0.7;
      const m = cell * 0.22;
      ctx.fillRect(x + m, y + m, cell - 2 * m, cell - 2 * m);
      ctx.shadowBlur = 0;
    }
  }

  // walls
  ctx.strokeStyle = "#e9d9ff";
  ctx.lineWidth = Math.max(2, cell * 0.1);
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i < total; i++) {
    if (!shown[i]) continue;
    const x = (i % maze.w) * cell, y = ((i / maze.w) | 0) * cell;
    const w = maze.walls[i];
    if (w & N) { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
    if (w & W) { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
    if (w & E) { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
    if (w & S) { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
  }
  ctx.stroke();

  // start and goal
  const goal = total - 1;
  ctx.font = Math.round(cell * 0.7) + "px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (shown[goal]) ctx.fillText("🏁", (goal % maze.w + 0.5) * cell, ((goal / maze.w | 0) + 0.5) * cell);
  if (mode === "solver" && shown[0]) { ctx.fillStyle = "#38e0a0"; ctx.beginPath(); ctx.arc(cell * 0.5, cell * 0.5, cell * 0.25, 0, 6.3); ctx.fill(); }

  // player (run mode)
  if (mode === "run" && shown[0]) {
    const cx = (px + 0.5) * cell, cy = (py + 0.5) * cell;
    ctx.shadowColor = "#ff2a4d";
    ctx.shadowBlur = cell * 0.8;
    ctx.fillStyle = "#c8102e";
    ctx.beginPath(); ctx.arc(cx, cy, cell * 0.34, 0, 6.3); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(2, cell * 0.09);
    ctx.strokeStyle = "#f1be48";
    ctx.stroke();
    ctx.fillStyle = "#f1be48";
    ctx.beginPath(); ctx.arc(cx + cell * 0.12, cy - cell * 0.08, cell * 0.06, 0, 6.3); ctx.fill();
  }
}

function frame() {
  raf = requestAnimationFrame(frame);
  let animating = false;

  if (building) {
    carved = Math.min(maze.order.length, carved + Math.max(1, Math.ceil(maze.order.length / 80)));
    animating = true;
    if (carved >= maze.order.length) { building = false; onBuilt(); }
  }
  if (mode === "run") {
    const dx = pos % size - px, dy = ((pos / size) | 0) - py;
    if (Math.abs(dx) > 0.002 || Math.abs(dy) > 0.002) { px += dx * 0.4; py += dy * 0.4; animating = true; }
    else { px = pos % size; py = (pos / size) | 0; }
    if (playing) updateTime();
  }
  if (run && run.phase !== "done") {
    animating = true;
    stepSolver();
  }
  if (animating || playing) drawMaze();
}

/* ------------------------------------------------------------- maze set up */

function newMaze(n) {
  size = n;
  fit();
  maze = generate(n, n);
  carved = Hub.reduce ? maze.order.length : 0;
  building = !Hub.reduce;
  run = null;
  trail = new Set([0]);
  results = {};
  finished = false;
  pos = 0; px = 0; py = 0; moves = 0;
  playing = false;
  drawMaze();
  if (Hub.reduce) onBuilt();
}

function onBuilt() {
  if (mode === "run") {
    levelStart = performance.now();
    playing = true;
    $("status").textContent = "Reach the flag. Arrow keys, WASD, swipe or the buttons.";
    Hub.sfx.play("pop");
  } else {
    $("solve").disabled = false;
    $("status").textContent = "Pick an algorithm and press Solve.";
  }
  drawMaze();
}

/* ---------------------------------------------------------------- run mode */

function updateTime() {
  const seconds = Math.floor((performance.now() - levelStart) / 1000);
  $("time").textContent = String(seconds);
}

function startLevel(n) {
  level = n;
  $("level").textContent = String(n + 1);
  $("moves").textContent = "0";
  $("time").textContent = "0";
  $("overlay").hidden = true;
  newMaze(LEVELS[n]);
  Hub.anim(canvas, [{ transform: "scale(0.85) rotate(-3deg)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 650, easing: Hub.ease.spring, fill: "backwards" });
}

function move(dir) {
  if (!playing || !maze) return;
  const bit = { N, E, S, W }[dir];
  if (maze.walls[pos] & bit) {
    Hub.shake(canvas, 4, 160);
    Hub.sfx.play("hover");
    return;
  }
  const x = pos % size + DX[bit], y = ((pos / size) | 0) + DY[bit];
  pos = y * size + x;
  trail.add(pos);
  moves++;
  $("moves").textContent = String(moves);
  Hub.sfx.play("tick");
  if (pos === size * size - 1) completeLevel();
}

async function completeLevel() {
  playing = false;
  const seconds = (performance.now() - levelStart) / 1000;
  const par = size * 5;
  const gained = 200 * (level + 1) + Math.max(0, Math.round(par - seconds)) * 10;
  totalScore += gained;
  Hub.countTo($("score"), totalScore, { from: Number($("score").dataset.value) || 0, ms: 800 });
  Hub.sfx.play("match");
  const where = Hub.fx.at(canvas);
  Hub.fx.confetti({ x: where.x, y: where.y, count: 120 });
  const overlay = $("overlay");
  overlay.textContent = "Maze cleared! +" + gained;
  overlay.hidden = false;
  Hub.anim(overlay, [{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "none" }], { duration: 600, easing: Hub.ease.spring, fill: "backwards" });
  await Hub.sleep(1700);
  if (level + 1 < LEVELS.length) startLevel(level + 1);
  else endRun();
}

function endRun() {
  $("stage").hidden = true;
  $("end").hidden = false;
  const result = Hub.finish("maze", { score: totalScore, mode, xp: 20 + Math.round(totalScore / 25) });
  const scoreEl = $("endScore");
  scoreEl.textContent = "0";
  scoreEl.dataset.value = "0";
  Hub.countTo(scoreEl, totalScore, { from: 0, ms: 1300 });
  Hub.anim($("end"), [{ opacity: 0, transform: "scale(0.85)" }, { opacity: 1, transform: "none" }], { duration: 700, easing: Hub.ease.spring, fill: "backwards" });
  const notes = ["+" + result.xp + " XP"];
  if (result.rank) notes.push("Leaderboard rank #" + result.rank);
  if (result.isBest) notes.push("New personal best!");
  $("endNote").textContent = notes.join("  ·  ");
  $("endBoard").href = "leaderboard.html?game=maze" + (result.rank ? "&new=maze&rank=" + result.rank : "");
  Hub.sfx.play("win");
  Hub.fx.cannons();
  setTimeout(() => Hub.fx.fireworks(4), 600);
}

function startRun() {
  totalScore = 0;
  $("score").textContent = "0";
  $("score").dataset.value = "0";
  $("end").hidden = true;
  $("start").hidden = true;
  $("stage").hidden = false;
  $("runHud").hidden = false;
  $("pad").hidden = false;
  startLevel(0);
}

const KEYS = { ArrowUp: "N", ArrowDown: "S", ArrowLeft: "W", ArrowRight: "E", w: "N", s: "S", a: "W", d: "E", W: "N", S: "S", A: "W", D: "E" };
document.addEventListener("keydown", event => {
  if (mode !== "run" || event.ctrlKey || event.metaKey || event.altKey) return;
  const dir = KEYS[event.key];
  if (!dir) return;
  event.preventDefault();
  move(dir);
});

document.querySelectorAll("#pad button").forEach(button => button.addEventListener("click", () => move(button.dataset.dir)));

let swipe = null;
canvas.addEventListener("pointerdown", event => { swipe = { x: event.clientX, y: event.clientY }; });
canvas.addEventListener("pointerup", event => {
  if (!swipe || mode !== "run") return;
  const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
  swipe = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "E" : "W") : (dy > 0 ? "S" : "N"));
});

/* ------------------------------------------------------------- solver mode */

function startSolver() {
  $("start").hidden = true;
  $("stage").hidden = false;
  $("runHud").hidden = true;
  $("solverControls").hidden = false;
  $("solve").disabled = true;
  newMaze(Number($("size").value));
}

function speedPerFrame() {
  const base = { slow: 0.7, normal: 2.5, fast: 10 }[$("speed").value];
  return base * Math.max(1, size / 14);
}

function solve() {
  if (!maze || building || (run && run.phase !== "done")) return;
  const goal = size * size - 1;
  const out = solvers[algo](maze, 0, goal);
  run = { visited: out.visited, path: out.path, shown: 0, pathShown: 0, phase: "explore", algo };
  $("stats").hidden = true;
  $("solve").disabled = true;
  $("newMaze").disabled = true;
  $("status").textContent = ALGO_NAMES[algo] + " is searching...";
  Hub.sfx.play("whoosh");
}

function stepSolver() {
  if (run.phase === "explore") {
    const before = Math.floor(run.shown);
    run.shown = Math.min(run.visited.length, run.shown + speedPerFrame());
    if (Math.floor(run.shown) !== before && Math.floor(run.shown) % 4 === 0) Hub.sfx.play("tick");
    if (run.shown >= run.visited.length) { run.phase = "path"; Hub.sfx.play("coin"); }
  } else if (run.phase === "path") {
    run.pathShown = Math.min(run.path.length, run.pathShown + Math.max(1, speedPerFrame() * 0.6));
    if (run.pathShown >= run.path.length) finishSolve();
  }
}

function finishSolve() {
  run.phase = "done";
  results[run.algo] = { explored: run.visited.length, path: run.path.length };
  $("solve").disabled = false;
  $("newMaze").disabled = false;
  Hub.sfx.play("match");
  const where = Hub.fx.at(canvas);
  Hub.fx.burst(where.x, where.y, { count: 60, power: 12 });

  const stats = $("stats");
  stats.replaceChildren();
  const r = results[run.algo];
  [["Algorithm", run.algo === "astar" ? "A*" : run.algo.toUpperCase()], ["Cells explored", r.explored], ["Path length", r.path], ["Efficiency", Math.round(100 * r.path / r.explored) + "%"]].forEach(([label, value]) => {
    const li = document.createElement("li");
    const b = document.createElement("b");
    b.textContent = String(value);
    const span = document.createElement("span");
    span.textContent = label;
    li.append(b, span);
    stats.appendChild(li);
  });
  stats.hidden = false;
  Hub.stagger(stats.children, [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { each: 80, duration: 450, fill: "backwards" });

  const done = Object.keys(results);
  if (done.length === 3 && !finished) {
    finished = true;
    const best = Math.min(...done.map(key => results[key].explored));
    const pathLength = results.bfs.path;
    const score = Math.round(1000 * pathLength / best);
    const result = Hub.finish("maze", { score, mode, xp: 25 });
    $("status").textContent = "All three solved! Best efficiency score: " + score + (result.rank ? " (leaderboard rank #" + result.rank + ")" : "") + ". Make a new maze to go again.";
    Hub.fx.cannons();
  } else {
    const left = ["bfs", "dfs", "astar"].filter(key => !results[key]);
    $("status").textContent = left.length
      ? "Done. Try " + left.map(key => ALGO_NAMES[key]).join(" and ") + " on this same maze to compare."
      : "Done.";
  }
}

document.querySelectorAll("#algoSeg button").forEach(button => button.addEventListener("click", () => {
  algo = button.dataset.algo;
  document.querySelectorAll("#algoSeg button").forEach(other => other.setAttribute("aria-checked", String(other === button)));
}));
$("solve").addEventListener("click", solve);
$("newMaze").addEventListener("click", () => { $("stats").hidden = true; newMaze(Number($("size").value)); });
$("size").addEventListener("change", () => { if (!run || run.phase === "done") { $("stats").hidden = true; newMaze(Number($("size").value)); } });

/* -------------------------------------------------------------------- init */

window.addEventListener("resize", () => { if (maze) { fit(); drawMaze(); } });

const COPY = {
  run: {
    title: "Maze Run",
    lead: "Race Cy to the flag through three mazes that get bigger every time.",
    rules: ["Move with the <b>arrow keys</b> or <b>WASD</b>. On a phone, swipe or use the buttons.", "Each maze is worth more than the last, and every second under par adds a bonus.", "Every maze is brand new, so no two runs are the same."],
    button: "Start the run"
  },
  solver: {
    title: "Maze Solver",
    lead: "Watch search algorithms explore a maze and find the way out.",
    rules: ["Pick <b>BFS</b>, <b>DFS</b> or <b>A*</b> and press Solve. Colors show the order cells were explored.", "BFS always finds the shortest path. DFS dives deep first. A* aims at the goal.", "Solve one maze with all three to earn an efficiency score and XP."],
    button: "Open the lab"
  }
}[mode];

document.title = COPY.title;
$("mazeTitle").textContent = COPY.title;
$("mazeLead").textContent = COPY.lead;
$("rules").replaceChildren(...COPY.rules.map(html => { const li = document.createElement("li"); li.innerHTML = html; return li; }));
$("go").textContent = COPY.button;
Hub.split($("mazeTitle"));
Hub.stagger($("mazeTitle").children, [{ transform: "translateY(-70px) scale(0.4)", opacity: 0 }, { transform: "none", opacity: 1 }], { each: 45, duration: 900, easing: Hub.ease.bounce, fill: "backwards" });

$("go").addEventListener("click", mode === "run" ? startRun : startSolver);
$("again").addEventListener("click", startRun);
raf = requestAnimationFrame(frame);
