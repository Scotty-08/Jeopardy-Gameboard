// Quiz Blitz: timed multiple choice with streak multipliers.
//   ?mode=blitz   60 seconds on the clock, a wrong answer costs 5 seconds.
//   ?mode=sudden  12 seconds per question, the first wrong answer ends the run.

const $ = id => document.getElementById(id);
const mode = Hub.params.get("mode") === "sudden" ? "sudden" : "blitz";

const CONFIG = {
  blitz: {
    title: "60-Second Blitz",
    text: "Answer as many questions as you can before the clock hits zero.",
    rules: ["Each correct answer is worth <b>100 points</b> plus a speed bonus.", "Every 3 correct in a row raises your <b>multiplier</b> (up to x5).", "A wrong answer costs <b>5 seconds</b> and resets your streak.", "Keys <b>1-4</b> pick an answer."],
    total: 60,
    perQuestion: 0
  },
  sudden: {
    title: "Sudden Death",
    text: "One wrong answer ends your run. Go for the longest streak you can.",
    rules: ["You get <b>12 seconds</b> for each question.", "Each correct answer is worth <b>100 points</b> plus a speed bonus.", "Every 3 correct in a row raises your <b>multiplier</b> (up to x5).", "The first wrong answer or timeout ends the run."],
    total: 0,
    perQuestion: 12
  }
}[mode];

const els = {
  hud: $("hud"), barWrap: $("barWrap"), bar: $("bar"), score: $("score"), time: $("time"), timeLabel: $("timeLabel"),
  streak: $("streak"), mult: $("mult"), start: $("start"), play: $("play"), end: $("end"), count: $("count"),
  q: $("q"), cat: $("qCat"), choices: $("choices")
};

let pool = [];
let queue = [];
let current = null;
let shown = [];
let state = null;
let ticker = 0;
let locked = true;

/* --------------------------------------------------------------- questions */

async function loadPool() {
  const [extra, jeo] = await Promise.all([Hub.json("../data/quiz.json"), Hub.json("../data/questions.json")]);
  const fromJeopardy = [];
  jeo.categories.forEach(cat => cat.questions.forEach(item => {
    if (item.correct && item.wrong) fromJeopardy.push({ cat: cat.name, q: item.question, correct: item.correct, wrong: item.wrong });
  }));
  pool = extra.questions.concat(fromJeopardy);
}

function nextQuestion() {
  if (!queue.length) queue = Hub.shuffle(pool);
  return queue.pop();
}

/* ----------------------------------------------------------------- display */

function multiplier() { return Math.min(5, 1 + Math.floor(state.streak / 3)); }

function paintHud(popStreak) {
  els.streak.textContent = String(state.streak);
  const m = multiplier();
  els.mult.textContent = "x" + m;
  els.mult.classList.toggle("on", m > 1);
  els.streak.parentElement.classList.toggle("hot", m > 1);
  if (popStreak) Hub.anim(els.streak, [{ transform: "scale(1.6)" }, { transform: "scale(1)" }], { duration: 450, easing: Hub.ease.spring });
}

function paintTime() {
  const left = Math.max(0, state.left);
  els.time.textContent = mode === "blitz" ? String(Math.ceil(left)) : String(Math.ceil(left));
  els.time.parentElement.classList.toggle("low", left <= 10 && mode === "blitz" || left <= 4 && mode === "sudden");
}

function showQuestion() {
  current = nextQuestion();
  const right = { text: current.correct, right: true };
  shown = Hub.shuffle([right].concat(current.wrong.slice(0, 3).map(text => ({ text, right: false }))));
  els.cat.textContent = current.cat;
  els.q.textContent = current.q;
  els.choices.replaceChildren();
  shown.forEach((choice, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    const key = document.createElement("kbd");
    key.textContent = String(i + 1);
    const label = document.createElement("span");
    label.textContent = choice.text;
    button.append(key, label);
    button.addEventListener("click", () => answer(i));
    els.choices.appendChild(button);
  });
  Hub.anim(els.q, [{ opacity: 0, transform: "translateX(40px)" }, { opacity: 1, transform: "none" }], { duration: 420, fill: "backwards" });
  Hub.stagger(els.choices.children, [{ opacity: 0, transform: "translateY(20px) scale(0.92)" }, { opacity: 1, transform: "none" }], { each: 55, duration: 460, easing: Hub.ease.spring, fill: "backwards" });
  state.shownAt = performance.now();
  locked = false;
  if (mode === "sudden") {
    state.left = CONFIG.perQuestion;
    paintTime();
    if (state.barAnim) state.barAnim.cancel();
    state.barAnim = Hub.anim(els.bar, [{ transform: "scaleX(1)", backgroundPosition: "0% 0" }, { transform: "scaleX(0)", backgroundPosition: "100% 0" }], { duration: CONFIG.perQuestion * 1000, easing: "linear" });
  }
}

/* ------------------------------------------------------------------ answer */

function answer(index) {
  if (locked || !state) return;
  locked = true;
  const buttons = Array.from(els.choices.children);
  const timedOut = index === null;
  const ok = !timedOut && shown[index].right;
  buttons.forEach((button, i) => {
    button.disabled = true;
    if (shown[i].right) button.classList.add("right");
    else if (i === index) button.classList.add("wrong");
    else button.classList.add("dim");
  });
  state.answered++;

  if (ok) {
    const elapsed = performance.now() - state.shownAt;
    const bonus = Hub.clamp(Math.round(50 - elapsed / 100), 0, 50);
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.correct++;
    const points = 100 * multiplier() + bonus;
    state.score += points;
    Hub.countTo(els.score, state.score, { from: Number(els.score.dataset.value) || 0, ms: 450 });
    const where = Hub.fx.at(buttons[index]);
    Hub.floatText(where.x, where.y, "+" + points, "#38e0a0");
    Hub.fx.burst(where.x, where.y, { count: 22 });
    Hub.sfx.play(state.streak > 0 && state.streak % 3 === 0 ? "coin" : "correct");
    if (state.streak % 3 === 0) { Hub.banner("x" + multiplier() + " MULTIPLIER", state.streak + " in a row", "#ff7a18"); }
    paintHud(true);
    setTimeout(advance, state.streak % 3 === 0 ? 900 : 520);
  } else {
    state.streak = 0;
    Hub.sfx.play("wrong");
    Hub.flash("#ff4d6d", 380);
    Hub.shake(els.play, 12, 480);
    paintHud(false);
    if (mode === "blitz") {
      state.left -= 5;
      const where = Hub.fx.at(els.time);
      Hub.floatText(where.x, where.y + 20, "-5s", "#ff4d6d");
      paintTime();
    }
    if (mode === "sudden") {
      setTimeout(() => endGame(timedOut ? "Out of time!" : "Wrong answer"), 1100);
    } else {
      setTimeout(advance, 950);
    }
  }
}

function advance() {
  if (!state || state.over) return;
  showQuestion();
}

/* --------------------------------------------------------------- game flow */

function tick() {
  if (!state || state.over) return;
  const now = performance.now();
  const dt = (now - state.last) / 1000;
  state.last = now;
  if (mode === "blitz") {
    state.left -= dt;
    els.bar.style.transform = "scaleX(" + Hub.clamp(state.left / CONFIG.total, 0, 1).toFixed(4) + ")";
    els.bar.style.backgroundPosition = (100 - Hub.clamp(state.left / CONFIG.total, 0, 1) * 100) + "% 0";
    const whole = Math.ceil(state.left);
    if (whole !== state.lastWhole && whole <= 5 && whole > 0) Hub.sfx.play("tick");
    state.lastWhole = whole;
    paintTime();
    if (state.left <= 0) endGame("Time!");
  } else if (!locked) {
    state.left -= dt;
    paintTime();
    const whole = Math.ceil(state.left);
    if (whole !== state.lastWhole && whole <= 3 && whole > 0) Hub.sfx.play("tick");
    state.lastWhole = whole;
    if (state.left <= 0) answer(null);
  }
}

async function countdown() {
  els.count.hidden = false;
  for (const word of ["3", "2", "1", "GO!"]) {
    els.count.textContent = word;
    Hub.sfx.play(word === "GO!" ? "coin" : "tick");
    await Hub.anim(els.count, [{ transform: "scale(2.4)", opacity: 0 }, { transform: "scale(1)", opacity: 1, offset: 0.35 }, { transform: "scale(0.85)", opacity: 0 }], { duration: word === "GO!" ? 650 : 800, easing: "ease-out" }).finished;
  }
  els.count.hidden = true;
}

async function startGame() {
  if (!pool.length) return;
  els.start.hidden = true;
  els.end.hidden = true;
  await countdown();
  state = { score: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0, left: mode === "blitz" ? CONFIG.total : CONFIG.perQuestion, last: performance.now(), over: false, lastWhole: 0, barAnim: null };
  els.score.textContent = "0";
  els.score.dataset.value = "0";
  els.hud.hidden = false;
  els.barWrap.hidden = false;
  els.timeLabel.textContent = mode === "blitz" ? "Time" : "Question";
  els.bar.style.transform = "scaleX(1)";
  els.play.hidden = false;
  paintHud(false);
  paintTime();
  Hub.anim(els.play, [{ opacity: 0, transform: "scale(0.9) translateY(30px)" }, { opacity: 1, transform: "none" }], { duration: 600, easing: Hub.ease.spring, fill: "backwards" });
  showQuestion();
  state.last = performance.now();
  clearInterval(ticker);
  ticker = setInterval(tick, 100);
}

function endGame(kicker) {
  if (!state || state.over) return;
  state.over = true;
  clearInterval(ticker);
  if (state.barAnim) state.barAnim.cancel();
  els.play.hidden = true;
  els.barWrap.hidden = true;
  els.hud.hidden = true;

  const result = Hub.finish("blitz", { score: state.score, mode, xp: 10 + state.correct * 3 });
  $("endKicker").textContent = kicker;
  els.end.hidden = false;
  const scoreEl = $("endScore");
  scoreEl.textContent = "0";
  scoreEl.dataset.value = "0";
  Hub.countTo(scoreEl, state.score, { from: 0, ms: 1300 });
  Hub.anim(els.end, [{ opacity: 0, transform: "scale(0.85)" }, { opacity: 1, transform: "none" }], { duration: 700, easing: Hub.ease.spring, fill: "backwards" });

  const notes = [];
  if (result.isBest && state.score > 0) notes.push("New personal best!");
  if (result.rank) notes.push("Leaderboard rank #" + result.rank);
  $("endNote").textContent = notes.join("  ·  ") || "Give it another go.";
  $("endBoard").href = "leaderboard.html?game=blitz" + (result.rank ? "&new=blitz&rank=" + result.rank : "");

  const stats = $("endStats");
  stats.replaceChildren();
  [["Correct", state.correct], ["Answered", state.answered], ["Best streak", state.bestStreak], ["XP", "+" + result.xp]].forEach(([label, value]) => {
    const li = document.createElement("li");
    const b = document.createElement("b");
    b.textContent = String(value);
    const span = document.createElement("span");
    span.textContent = label;
    li.append(b, span);
    stats.appendChild(li);
  });
  Hub.stagger(stats.children, [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }], { each: 90, delay: 500, duration: 500, fill: "backwards" });

  if (state.score > 0) { Hub.sfx.play("win"); Hub.fx.cannons(); } else { Hub.sfx.play("lose"); }
}

document.addEventListener("keydown", event => {
  if (locked || !state || state.over) return;
  const index = Number(event.key) - 1;
  if (index >= 0 && index < shown.length) answer(index);
});

$("go").addEventListener("click", startGame);
$("again").addEventListener("click", () => { els.end.hidden = true; startGame(); });

$("modeTitle").textContent = CONFIG.title;
document.title = CONFIG.title + " | Quiz Blitz";
$("modeText").textContent = CONFIG.text;
$("rules").replaceChildren(...CONFIG.rules.map(html => { const li = document.createElement("li"); li.innerHTML = html; return li; }));
Hub.split($("modeTitle"));
Hub.stagger($("modeTitle").children, [{ transform: "translateY(-70px) scale(0.4)", opacity: 0 }, { transform: "none", opacity: 1 }], { each: 45, duration: 900, easing: Hub.ease.bounce, fill: "backwards" });

$("go").disabled = true;
loadPool()
  .then(() => { $("go").disabled = false; })
  .catch(error => { console.error(error); $("modeText").textContent = "Could not load the questions. Run the project through a local web server (see README)."; });
