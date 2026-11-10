/* GameHub: shared engine.
   Animation (Web Animations API + canvas particles), synthesized sound, XP / levels,
   per-game leaderboards, page transitions and the animated background.
   No dependencies. Every page loads this file first and uses window.Hub. */
(function () {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function money(n) {
    return (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString();
  }

  function json(url) {
    return fetch(url).then(response => {
      if (!response.ok) throw new Error("Could not load " + url + " (" + response.status + ")");
      return response.json();
    });
  }

  /* ------------------------------------------------------------------ easing */

  // Samples a damped spring into a CSS linear() easing so animations can overshoot and settle.
  function springEasing(stiffness, damping) {
    let x = 0, v = 0;
    const dt = 1 / 240, total = 1.4, samples = 44, out = [];
    const series = [];
    for (let t = 0; t <= total; t += dt) {
      v += (-stiffness * (x - 1) - damping * v) * dt;
      x += v * dt;
      series.push(x);
    }
    for (let i = 0; i < samples; i++) out.push(series[Math.floor((i / (samples - 1)) * (series.length - 1))].toFixed(3));
    out[samples - 1] = "1";
    return "linear(" + out.join(", ") + ")";
  }

  function bounceEasing() {
    const out = [], samples = 40;
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      let value;
      if (t < 1 / 2.75) value = 7.5625 * t * t;
      else if (t < 2 / 2.75) { const s = t - 1.5 / 2.75; value = 7.5625 * s * s + 0.75; }
      else if (t < 2.5 / 2.75) { const s = t - 2.25 / 2.75; value = 7.5625 * s * s + 0.9375; }
      else { const s = t - 2.625 / 2.75; value = 7.5625 * s * s + 0.984375; }
      out.push(value.toFixed(3));
    }
    return "linear(" + out.join(", ") + ")";
  }

  const canLinear = window.CSS && CSS.supports && CSS.supports("animation-timing-function", "linear(0, 1)");
  const ease = {
    out: "cubic-bezier(.16, 1, .3, 1)",
    inOut: "cubic-bezier(.7, 0, .3, 1)",
    back: "cubic-bezier(.34, 1.56, .64, 1)",
    spring: canLinear ? springEasing(120, 9) : "cubic-bezier(.34, 1.56, .64, 1)",
    softSpring: canLinear ? springEasing(70, 8) : "cubic-bezier(.34, 1.3, .64, 1)",
    bounce: canLinear ? bounceEasing() : "cubic-bezier(.34, 1.56, .64, 1)"
  };

  /* --------------------------------------------------------------- animation */

  function anim(el, keyframes, options) {
    if (!el || !el.animate) return { finished: Promise.resolve(), cancel() {} };
    const opts = Object.assign({ duration: 500, easing: ease.out, fill: "both" }, options);
    if (reduce) { opts.duration = 1; opts.delay = 0; }
    const animation = el.animate(keyframes, opts);
    animation.finished.catch(() => {});
    return animation;
  }

  function stagger(els, keyframes, options) {
    const each = (options && options.each) || 45;
    const base = (options && options.delay) || 0;
    return Promise.all(Array.from(els).map((el, i) =>
      anim(el, keyframes, Object.assign({}, options, { delay: base + i * each })).finished.catch(() => {})));
  }

  function shake(el, strength = 10, duration = 450) {
    if (reduce || !el) return Promise.resolve();
    const frames = [];
    for (let i = 0; i < 12; i++) {
      const fade = 1 - i / 12;
      frames.push({ transform: "translate(" + rand(-strength, strength) * fade + "px, " + rand(-strength, strength) * fade * 0.6 + "px) rotate(" + rand(-1.2, 1.2) * fade + "deg)" });
    }
    frames.push({ transform: "none" });
    return anim(el, frames, { duration, easing: "linear" }).finished;
  }

  function countTo(el, to, options = {}) {
    if (!el) return;
    const from = options.from !== undefined ? options.from : (Number(el.dataset.value) || 0);
    const ms = reduce ? 1 : (options.ms || 700);
    const format = options.format || (n => String(Math.round(n)));
    cancelAnimationFrame(el._countRaf);
    el.dataset.value = to;
    const start = performance.now();
    const step = now => {
      const t = clamp((now - start) / ms, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(from + (to - from) * eased);
      if (t < 1) el._countRaf = requestAnimationFrame(step);
    };
    el._countRaf = requestAnimationFrame(step);
  }

  function pulse(el, color) {
    return anim(el, [
      { transform: "scale(1)", boxShadow: "0 0 0 0 " + (color || "rgba(241,190,72,.8)") },
      { transform: "scale(1.12)", boxShadow: "0 0 0 14px rgba(241,190,72,0)", offset: 0.5 },
      { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(241,190,72,0)" }
    ], { duration: 600, easing: ease.out }).finished;
  }

  function flash(color = "#ffffff", duration = 420) {
    if (reduce) return;
    const el = document.createElement("div");
    el.className = "flash";
    el.style.background = color;
    document.body.appendChild(el);
    anim(el, [{ opacity: 0.55 }, { opacity: 0 }], { duration, easing: "ease-out" }).finished.then(() => el.remove());
  }

  function floatText(x, y, text, color = "#F1BE48") {
    const el = document.createElement("div");
    el.className = "floater";
    el.textContent = text;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.color = color;
    document.body.appendChild(el);
    anim(el, [
      { transform: "translate(-50%, 0) scale(.4)", opacity: 0 },
      { transform: "translate(-50%, -30px) scale(1.25)", opacity: 1, offset: 0.25 },
      { transform: "translate(-50%, -110px) scale(1)", opacity: 0 }
    ], { duration: 1200, easing: "ease-out" }).finished.then(() => el.remove());
  }

  // Big centered banner: "DAILY DOUBLE", "LEVEL UP", "STRIKE" ...
  function banner(text, sub, color) {
    const el = document.createElement("div");
    el.className = "banner";
    el.setAttribute("role", "status");
    el.innerHTML = '<strong></strong><span></span>';
    el.firstChild.textContent = text;
    el.lastChild.textContent = sub || "";
    if (color) el.firstChild.style.color = color;
    document.body.appendChild(el);
    const letters = el.firstChild;
    anim(el, [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1700, easing: "linear" }).finished.then(() => el.remove());
    anim(letters, [
      { transform: "scale(3.2) rotate(-6deg)", letterSpacing: "0.5em", filter: "blur(12px)" },
      { transform: "scale(1) rotate(0deg)", letterSpacing: "0.04em", filter: "blur(0px)" }
    ], { duration: 800, easing: ease.spring });
    return el;
  }

  function split(el) {
    const text = el.textContent;
    el.setAttribute("aria-label", text);
    el.textContent = "";
    const spans = [];
    Array.from(text).forEach(ch => {
      const span = document.createElement("span");
      span.className = "ch";
      span.setAttribute("aria-hidden", "true");
      span.textContent = ch === " " ? " " : ch;
      el.appendChild(span);
      spans.push(span);
    });
    return spans;
  }

  function typewriter(el, text, speed = 22) {
    return new Promise(resolve => {
      if (reduce) { el.textContent = text; resolve(); return; }
      el.textContent = "";
      let i = 0;
      const timer = setInterval(() => {
        el.textContent = text.slice(0, ++i);
        if (i >= text.length) { clearInterval(timer); resolve(); }
      }, speed);
    });
  }

  function tilt(el, max = 9) {
    if (reduce || window.matchMedia("(hover: none)").matches) return;
    el.classList.add("tilt");
    el.addEventListener("pointermove", event => {
      const r = el.getBoundingClientRect();
      const px = (event.clientX - r.left) / r.width, py = (event.clientY - r.top) / r.height;
      el.style.setProperty("--rx", ((0.5 - py) * max * 2).toFixed(2) + "deg");
      el.style.setProperty("--ry", ((px - 0.5) * max * 2).toFixed(2) + "deg");
      el.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
      el.style.setProperty("--my", (py * 100).toFixed(1) + "%");
      el.style.setProperty("--s", "1.03");
    });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
      el.style.setProperty("--s", "1");
    });
  }

  /* --------------------------------------------------------------- particles */

  const PALETTE = ["#C8102E", "#F1BE48", "#ffffff", "#ff4d6d", "#ffd76a", "#38e0a0", "#5aa9ff"];
  const fx = (function () {
    let cv, ctx, W = 0, H = 0, dpr = 1, parts = [], raf = 0, last = 0;

    function ensure() {
      if (cv) return;
      cv = document.createElement("canvas");
      cv.id = "fx";
      cv.setAttribute("aria-hidden", "true");
      document.body.appendChild(cv);
      ctx = cv.getContext("2d");
      resize();
      window.addEventListener("resize", resize);
    }

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + "px"; cv.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function add(p) {
      parts.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0.35, drag: 0.992, life: 0, max: 90, size: 6, rot: 0, vr: 0, color: "#fff", shape: "rect", glow: false }, p));
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    }

    function loop(now) {
      const step = clamp((now - last) / 16.67, 0.2, 3);
      last = now;
      ctx.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += step;
        if (p.life >= p.max || p.y > H + 60) { parts.splice(i, 1); continue; }
        p.vx *= Math.pow(p.drag, step); p.vy = p.vy * Math.pow(p.drag, step) + p.g * step;
        p.x += p.vx * step; p.y += p.vy * step; p.rot += p.vr * step;
        const fade = 1 - Math.pow(p.life / p.max, 2.2);
        ctx.save();
        ctx.globalAlpha = clamp(fade, 0, 1);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
        if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = 14; }
        if (p.shape === "rect") ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.62);
        else if (p.shape === "circle") { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, 6.2832); ctx.fill(); }
        else if (p.shape === "spark") { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-p.vx * 2.4, -p.vy * 2.4); ctx.stroke(); }
        else if (p.shape === "star") {
          ctx.beginPath();
          for (let k = 0; k < 10; k++) { const r = k % 2 ? p.size * 0.22 : p.size * 0.55; const a = (k / 10) * 6.2832; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
          ctx.closePath(); ctx.fill();
        } else if (p.shape === "ring") {
          const t = p.life / p.max;
          ctx.lineWidth = 5 * (1 - t) + 1;
          ctx.beginPath(); ctx.arc(0, 0, p.size * (0.2 + t * 4.5), 0, 6.2832); ctx.stroke();
        }
        ctx.restore();
      }
      if (parts.length) raf = requestAnimationFrame(loop);
      else { raf = 0; ctx.clearRect(0, 0, W, H); }
    }

    function confetti(o = {}) {
      if (reduce) return;
      ensure();
      const count = o.count || 110, angle = o.angle !== undefined ? o.angle : -Math.PI / 2;
      const spread = o.spread !== undefined ? o.spread : Math.PI * 0.9, power = o.power || 15;
      const x = o.x !== undefined ? o.x : W / 2, y = o.y !== undefined ? o.y : H * 0.65;
      for (let i = 0; i < count; i++) {
        const a = angle + rand(-spread / 2, spread / 2), s = rand(power * 0.35, power);
        add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.38, drag: 0.985, max: rand(90, 170), size: rand(7, 13), rot: rand(0, 6), vr: rand(-0.3, 0.3), color: pick(PALETTE), shape: Math.random() < 0.18 ? "star" : "rect" });
      }
    }

    function cannons() {
      ensure();
      confetti({ x: 0, y: H, angle: -Math.PI / 3, spread: 0.7, count: 90, power: 24 });
      confetti({ x: W, y: H, angle: -Math.PI * 2 / 3, spread: 0.7, count: 90, power: 24 });
    }

    function burst(x, y, o = {}) {
      if (reduce) return;
      ensure();
      const color = o.color || pick(PALETTE), count = o.count || 26;
      for (let i = 0; i < count; i++) {
        const a = rand(0, 6.2832), s = rand(2, o.power || 9);
        add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.18, drag: 0.965, max: rand(40, 70), size: rand(3, 6), color: Math.random() < 0.3 ? "#ffffff" : color, shape: Math.random() < 0.5 ? "spark" : "circle", glow: true });
      }
    }

    function ring(x, y, color = "#F1BE48") {
      if (reduce) return;
      ensure();
      add({ x, y, vx: 0, vy: 0, g: 0, drag: 1, max: 38, size: 38, color, shape: "ring", glow: true });
    }

    function fireworks(n = 5) {
      if (reduce) return;
      ensure();
      for (let i = 0; i < n; i++) {
        setTimeout(() => {
          const x = rand(W * 0.15, W * 0.85), y = rand(H * 0.12, H * 0.5), color = pick(PALETTE);
          ring(x, y, color);
          burst(x, y, { color, count: 46, power: 12 });
          burst(x, y, { color: "#ffffff", count: 14, power: 6 });
        }, i * 280);
      }
    }

    function rain(ms = 3500) {
      if (reduce) return;
      ensure();
      const end = performance.now() + ms;
      const drop = () => {
        if (performance.now() > end) return;
        for (let i = 0; i < 3; i++) add({ x: rand(0, W), y: -20, vx: rand(-1.5, 1.5), vy: rand(2, 5), g: 0.05, drag: 0.999, max: 260, size: rand(7, 12), rot: rand(0, 6), vr: rand(-0.2, 0.2), color: pick(PALETTE), shape: "rect" });
        setTimeout(drop, 60);
      };
      drop();
    }

    function at(el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    return { confetti, cannons, burst, ring, fireworks, rain, at };
  })();

  /* ------------------------------------------------------------------- sound */

  const store = (function () {
    const KEY = "ISU_Hub";
    const fresh = () => ({ xp: 0, plays: 0, best: {}, muted: false });
    let data;
    function read() {
      try { data = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { data = fresh(); }
      return data;
    }
    function write() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode */ } }
    read();
    return { get: () => data, save: write };
  })();

  const sfx = (function () {
    let ac = null;
    function ctx() {
      if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
      if (ac && ac.state === "suspended") ac.resume().catch(() => {});
      return ac;
    }
    function tone(freq, dur, type = "sine", vol = 0.12, when = 0, slideTo = 0) {
      const a = ctx();
      if (!a) return;
      const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + when;
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(a.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    }
    const sounds = {
      click() { tone(620, 0.06, "triangle", 0.07); },
      hover() { tone(900, 0.03, "sine", 0.025); },
      pop() { tone(440, 0.12, "sine", 0.1, 0, 880); },
      flip() { tone(260, 0.1, "square", 0.04, 0, 640); },
      correct() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, "triangle", 0.12, i * 0.07)); },
      wrong() { tone(170, 0.32, "sawtooth", 0.1, 0, 90); tone(120, 0.34, "square", 0.05, 0.06, 70); },
      strike() { tone(110, 0.5, "sawtooth", 0.16, 0, 55); tone(220, 0.25, "square", 0.06); },
      tick() { tone(1100, 0.025, "square", 0.03); },
      coin() { tone(988, 0.07, "square", 0.06); tone(1319, 0.2, "square", 0.06, 0.07); },
      match() { [659, 880, 1175].forEach((f, i) => tone(f, 0.12, "triangle", 0.1, i * 0.06)); },
      whoosh() { tone(180, 0.35, "sawtooth", 0.04, 0, 1400); },
      level() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, "triangle", 0.11, i * 0.08)); },
      win() { [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, "square", 0.07, i * 0.11)); },
      lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.28, "sawtooth", 0.07, i * 0.16)); }
    };
    function play(name) {
      if (store.get().muted || !sounds[name]) return;
      try { sounds[name](); } catch (e) { /* audio blocked */ }
    }
    return { play };
  })();

  /* ------------------------------------------------------- XP, levels, boards */

  function levelInfo(xp) {
    let level = 1, remaining = xp;
    while (remaining >= 100 * level) { remaining -= 100 * level; level++; }
    return { level, into: remaining, need: 100 * level, pct: remaining / (100 * level) };
  }

  // One game per day is "featured" and pays double XP.
  const GAME_IDS = ["jeopardy", "blitz", "feud", "maze", "memory"];
  const featuredId = () => GAME_IDS[Math.floor(Date.now() / 86400000) % GAME_IDS.length];

  const boardKey = id => (id === "jeopardy" ? "ISU_Leaderboard" : "ISU_Leaderboard_" + id);

  const board = {
    get(id, seed) {
      try {
        const saved = localStorage.getItem(boardKey(id));
        if (saved) return JSON.parse(saved).sort((a, b) => b.score - a.score);
      } catch (e) { /* fall through to seed */ }
      const list = (seed || []).map(entry => Object.assign({}, entry));
      if (list.length) board.write(id, list);
      return list;
    },
    write(id, list) {
      try { localStorage.setItem(boardKey(id), JSON.stringify(list)); } catch (e) { /* ignore */ }
    },
    // Returns the 1-based rank the new score reached, or 0 if it did not make the top 10.
    add(id, score, meta) {
      const list = board.get(id);
      const entry = Object.assign({ score, date: new Date().toISOString() }, meta);
      list.push(entry);
      list.sort((a, b) => b.score - a.score);
      const trimmed = list.slice(0, 10);
      board.write(id, trimmed);
      return trimmed.indexOf(entry) + 1;
    }
  };

  function updateChip() {
    const chip = $(".lvl");
    if (!chip) return;
    const info = levelInfo(store.get().xp);
    $(".lvl-n", chip).textContent = "LV " + info.level;
    $(".lvl-xp", chip).textContent = info.into + " / " + info.need + " XP";
    $(".lvl-bar i", chip).style.transform = "scaleX(" + info.pct.toFixed(3) + ")";
    chip.setAttribute("aria-label", "Level " + info.level + ", " + info.into + " of " + info.need + " experience points");
  }

  function toast(text, icon) {
    let host = $("#toasts");
    if (!host) { host = document.createElement("div"); host.id = "toasts"; host.setAttribute("aria-live", "polite"); document.body.appendChild(host); }
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = (icon ? icon + "  " : "") + text;
    host.appendChild(el);
    anim(el, [
      { transform: "translateY(24px) scale(.9)", opacity: 0 },
      { transform: "translateY(0) scale(1)", opacity: 1, offset: 0.12 },
      { transform: "translateY(0) scale(1)", opacity: 1, offset: 0.85 },
      { transform: "translateY(-10px) scale(.96)", opacity: 0 }
    ], { duration: 3200, easing: "ease-out" }).finished.then(() => el.remove());
  }

  // Records a finished game: leaderboard entry, XP, personal best, level-up celebration.
  function finish(gameId, details) {
    const score = Math.max(0, Math.round(details.score || 0));
    const data = store.get();
    const before = levelInfo(data.xp).level;
    const previousBest = data.best[gameId] || 0;
    const isBest = score > previousBest;
    const rank = score > 0 ? board.add(gameId, score, { mode: details.mode }) : 0;
    const bonus = gameId === featuredId();
    const xp = Math.max(5, Math.round(details.xp || score / 20)) * (bonus ? 2 : 1);
    data.xp += xp;
    data.plays += 1;
    if (isBest) data.best[gameId] = score;
    store.save();
    const after = levelInfo(data.xp).level;
    updateChip();
    toast("+" + xp + " XP" + (bonus ? " (2x featured game)" : ""), "✨");
    if (after > before) {
      setTimeout(() => {
        sfx.play("level");
        banner("LEVEL " + after, "You leveled up!", "#F1BE48");
        fx.fireworks(4);
      }, 900);
    }
    return { score, rank, xp, isBest, bonus, level: after, leveledUp: after > before };
  }

  /* -------------------------------------------------------------- background */

  function background() {
    if ($("#bg")) return;
    const cv = document.createElement("canvas");
    cv.id = "bg";
    cv.setAttribute("aria-hidden", "true");
    document.body.prepend(cv);
    const ctx = cv.getContext("2d");
    let W = 0, H = 0, mx = 0, my = 0, parts = [], running = true;
    const count = window.innerWidth < 700 ? 46 : 90;

    function resize() {
      W = cv.width = window.innerWidth;
      H = cv.height = window.innerHeight;
    }
    function seed() {
      parts = Array.from({ length: count }, () => ({
        a: rand(0, 6.2832), r: rand(40, Math.max(W, H) * 0.62), s: rand(0.0016, 0.0042),
        y: rand(-0.5, 0.5), size: rand(1, 3.4), hue: Math.random() < 0.55 ? "200,16,46" : "241,190,72", tw: rand(0, 6.2832)
      }));
    }
    function draw(t) {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      const cx = W * 0.72 + mx * 30, cy = H * 0.46 + my * 20;
      ctx.globalCompositeOperation = "lighter";
      for (const p of parts) {
        p.a += p.s * (1 + 90 / (p.r + 90));
        const x = cx + Math.cos(p.a) * p.r, y = cy + Math.sin(p.a) * p.r * 0.34 + p.y * p.r * 0.9;
        const alpha = 0.12 + 0.2 * (0.5 + 0.5 * Math.sin(t / 700 + p.tw));
        ctx.fillStyle = "rgba(" + p.hue + "," + alpha.toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(x, y, p.size, 0, 6.2832); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      if (!reduce) requestAnimationFrame(draw);
    }
    resize(); seed();
    window.addEventListener("resize", () => { resize(); seed(); });
    window.addEventListener("pointermove", e => { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; }, { passive: true });
    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
      if (running && !reduce) requestAnimationFrame(draw);
    });
    requestAnimationFrame(draw);
  }

  /* ---------------------------------------------------------- nav and chrome */

  function enhanceNav() {
    const nav = $(".site-nav");
    if (!nav || $(".lvl", nav)) return;
    const brand = document.createElement("span");
    brand.className = "brand";
    brand.setAttribute("aria-hidden", "true");
    brand.innerHTML = '<svg viewBox="0 0 32 32" width="26" height="26"><g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 7h22"/><path d="M8 13h17"/><path d="M11 19h11"/><path d="M14 25h5"/></g></svg><b>GameHub</b>';
    nav.prepend(brand);

    const right = document.createElement("div");
    right.className = "nav-right";
    right.innerHTML =
      '<div class="lvl" role="img"><span class="lvl-n"></span><span class="lvl-bar"><i></i></span><span class="lvl-xp"></span></div>' +
      '<button class="mute" type="button" aria-label="Sound"></button>';
    nav.appendChild(right);
    const mute = $(".mute", right);
    const paint = () => { const on = !store.get().muted; mute.textContent = on ? "🔊" : "🔇"; mute.setAttribute("aria-pressed", String(!on)); mute.title = on ? "Sound on" : "Sound off"; };
    mute.addEventListener("click", () => { store.get().muted = !store.get().muted; store.save(); paint(); sfx.play("click"); });
    paint();
    updateChip();
  }

  // A short curtain slides away when a page opens. There is no exit animation on purpose:
  // an exit curtain gets frozen over the page when the browser restores it from the
  // back/forward cache, which made the Back button and swipe-back look stuck.
  function transitions() {
    if (reduce) return;
    let type = "navigate";
    try { type = performance.getEntriesByType("navigation")[0].type; } catch (e) { /* older browsers */ }
    if (type !== "navigate") return;   // reload, back and forward show the page straight away

    const wipe = document.createElement("div");
    wipe.className = "wipe";
    wipe.setAttribute("aria-hidden", "true");
    wipe.style.transform = "translateX(0)";
    document.body.appendChild(wipe);
    const remove = () => wipe.remove();
    const run = anim(wipe, [{ transform: "translateX(0)" }, { transform: "translateX(101%)" }], { duration: 480, easing: ease.inOut, delay: 40 });
    run.finished.then(remove, remove);

    // Safety net: if the page is shown again from the cache, the curtain must never be there.
    window.addEventListener("pageshow", remove);
    window.addEventListener("pagehide", remove);
    setTimeout(remove, 1500);
  }

  function buttonSounds() {
    document.addEventListener("click", event => {
      const el = event.target.closest && event.target.closest("button, .btn, summary");
      if (el && !el.disabled && !el.dataset.silent) sfx.play("click");
    });
  }

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(() => {
    if (!document.body.dataset.noBg) background();
    enhanceNav();
    transitions();
    buttonSounds();
  });

  window.Hub = {
    reduce, $, $$, sleep, rand, pick, clamp, shuffle, money, json, ease,
    anim, stagger, shake, countTo, pulse, flash, floatText, banner, split, typewriter, tilt,
    fx, sfx, store, board, levelInfo, finish, toast, updateChip, featuredId,
    params: new URLSearchParams(window.location.search)
  };
})();
