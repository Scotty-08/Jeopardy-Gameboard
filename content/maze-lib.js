// Maze generation and path finding. No DOM in here, so it can be tested in Node too.
// A maze is { w, h, walls, order }.
//   walls[i] is a bit mask of the walls that still stand around cell i (N=1, E=2, S=4, W=8).
//   order lists the cells in the order the generator carved them (used for the build animation).
(function (root) {
  const N = 1, E = 2, S = 4, W = 8;
  const DX = { [N]: 0, [E]: 1, [S]: 0, [W]: -1 };
  const DY = { [N]: -1, [E]: 0, [S]: 1, [W]: 0 };
  const OPPOSITE = { [N]: S, [E]: W, [S]: N, [W]: E };
  const DIRS = [N, E, S, W];

  // Small seeded random number generator so a maze can be repeated if needed.
  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Iterative recursive backtracker: always a "perfect" maze (exactly one path between any two cells).
  function generate(w, h, rand) {
    rand = rand || Math.random;
    const walls = new Uint8Array(w * h).fill(N | E | S | W);
    const seen = new Uint8Array(w * h);
    const order = [];
    const stack = [0];
    seen[0] = 1;
    order.push(0);
    while (stack.length) {
      const i = stack[stack.length - 1];
      const x = i % w, y = (i / w) | 0;
      const options = DIRS.filter(d => {
        const nx = x + DX[d], ny = y + DY[d];
        return nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[ny * w + nx];
      });
      if (!options.length) { stack.pop(); continue; }
      const d = options[Math.floor(rand() * options.length)];
      const j = (y + DY[d]) * w + (x + DX[d]);
      walls[i] &= ~d;
      walls[j] &= ~OPPOSITE[d];
      seen[j] = 1;
      order.push(j);
      stack.push(j);
    }
    return { w, h, walls, order };
  }

  // Open neighbours of cell i.
  function neighbours(maze, i) {
    const { w, walls } = maze;
    const x = i % w, y = (i / w) | 0;
    const out = [];
    DIRS.forEach(d => { if (!(walls[i] & d)) out.push((y + DY[d]) * w + (x + DX[d])); });
    return out;
  }

  function rebuild(prev, start, goal) {
    const path = [];
    for (let at = goal; at !== -1 && at !== undefined; at = prev[at]) { path.push(at); if (at === start) break; }
    return path.reverse();
  }

  // Each solver returns { visited: cells in the order they were explored, path: start..goal }.
  function bfs(maze, start, goal) {
    const prev = new Int32Array(maze.w * maze.h).fill(-2);
    const visited = [];
    const queue = [start];
    prev[start] = -1;
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head];
      visited.push(i);
      if (i === goal) break;
      neighbours(maze, i).forEach(j => { if (prev[j] === -2) { prev[j] = i; queue.push(j); } });
    }
    return { visited, path: rebuild(prev, start, goal) };
  }

  function dfs(maze, start, goal) {
    const prev = new Int32Array(maze.w * maze.h).fill(-2);
    const visited = [];
    const stack = [start];
    prev[start] = -1;
    const done = new Uint8Array(maze.w * maze.h);
    while (stack.length) {
      const i = stack.pop();
      if (done[i]) continue;
      done[i] = 1;
      visited.push(i);
      if (i === goal) break;
      neighbours(maze, i).forEach(j => { if (!done[j]) { prev[j] = i; stack.push(j); } });
    }
    return { visited, path: rebuild(prev, start, goal) };
  }

  function astar(maze, start, goal) {
    const { w } = maze;
    const total = w * maze.h;
    const prev = new Int32Array(total).fill(-2);
    const g = new Float64Array(total).fill(Infinity);
    const done = new Uint8Array(total);
    const visited = [];
    const gx = goal % w, gy = (goal / w) | 0;
    const heuristic = i => Math.abs((i % w) - gx) + Math.abs(((i / w) | 0) - gy);
    const open = [{ i: start, f: heuristic(start) }];
    g[start] = 0;
    prev[start] = -1;
    while (open.length) {
      let best = 0;
      for (let k = 1; k < open.length; k++) if (open[k].f < open[best].f) best = k;
      const { i } = open.splice(best, 1)[0];
      if (done[i]) continue;
      done[i] = 1;
      visited.push(i);
      if (i === goal) break;
      neighbours(maze, i).forEach(j => {
        const cost = g[i] + 1;
        if (cost < g[j]) { g[j] = cost; prev[j] = i; open.push({ i: j, f: cost + heuristic(j) }); }
      });
    }
    return { visited, path: rebuild(prev, start, goal) };
  }

  const api = { N, E, S, W, DX, DY, DIRS, OPPOSITE, mulberry, generate, neighbours, solvers: { bfs, dfs, astar } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MazeLib = api;
})(typeof window !== "undefined" ? window : globalThis);
