// Family Feud: two teams share one keyboard.
// The team in control guesses survey answers. Three strikes hands the other team one steal attempt.
// ?rounds=3 (quick) or ?rounds=6 (full). Later rounds are worth more.

const $ = id => document.getElementById(id);
const ROUNDS = Hub.params.get("rounds") === "6" ? 6 : 3;
const MULTIPLIERS = ROUNDS === 6 ? [1, 1, 2, 2, 3, 3] : [1, 2, 3];

const els = {
  start: $("start"), game: $("game"), end: $("end"), slots: $("slots"), question: $("question"),
  bank: $("bank"), roundChip: $("roundChip"), strikes: $("strikes"), form: $("guessForm"), guess: $("guess"),
  prompt: $("prompt"), hint: $("hint"), next: $("next"), xmark: $("xmark"), submit: $("submit"),
  score: { A: $("scoreA"), B: $("scoreB") }, card: { A: $("cardA"), B: $("cardB") }
};

let surveys = [];
let rounds = [];
let roundIndex = 0;
let round = null;     // { data, revealed: Set, strikes, bank, mult, control, phase }
let scores = { A: 0, B: 0 };
let busy = false;
let saved = false;

/* ---------------------------------------------------------------- matching */

const normalize = text => String(text).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(/\b(a|an|the|some|my|your)\b/g, " ").replace(/\s+/g, " ").trim();

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

// True if the typed guess should count as this survey answer.
function matches(guess, answer) {
  const g = normalize(guess);
  if (!g) return false;
  const terms = [answer.text].concat(answer.aliases || []).map(normalize).filter(Boolean);
  return terms.some(term => {
    if (g === term) return true;
    if (term.length >= 3 && (" " + g + " ").includes(" " + term + " ")) return true;   // "my phone charger" contains "phone charger"
    if (g.length >= 4 && (" " + term + " ").includes(" " + g + " ")) return true;      // "charger" is inside "phone charger"
    const allowed = term.length >= 9 ? 2 : term.length >= 5 ? 1 : 0;                   // small typos
    return allowed > 0 && Math.abs(g.length - term.length) <= allowed && distance(g, term) <= allowed;
  });
}

/* ------------------------------------------------------------------ display */

function paintScores(animate) {
  ["A", "B"].forEach(team => {
    const el = els.score[team];
    if (animate) Hub.countTo(el, scores[team], { from: Number(el.dataset.value) || 0, ms: 900 });
    else { el.dataset.value = String(scores[team]); el.textContent = String(scores[team]); }
  });
}

function setControl(team) {
  round.control = team;
  Object.keys(els.card).forEach(key => els.card[key].classList.toggle("active", key === team));
  const other = team === "A" ? "B" : "A";
  const who = round.phase === "steal" ? other : team;
  els.form.style.setProperty("--team", who === "A" ? "var(--team-a)" : "var(--team-b)");
  els.prompt.replaceChildren();
  const b = document.createElement("b");
  b.textContent = "Team " + who;
  els.prompt.append(b, round.phase === "steal" ? ", steal the bank with ONE guess!" : ", what's your answer?");
}

function paintBank(animate) {
  if (animate) Hub.countTo(els.bank, round.bank, { from: Number(els.bank.dataset.value) || 0, ms: 600 });
  else { els.bank.dataset.value = String(round.bank); els.bank.textContent = String(round.bank); }
}

function paintStrikes() {
  Array.from(els.strikes.children).forEach((el, i) => el.classList.toggle("on", i < round.strikes));
}

function buildSlots() {
  els.slots.replaceChildren();
  round.data.answers.forEach((answer, i) => {
    const li = document.createElement("li");
    li.className = "slot empty";
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = String(i + 1);
    const text = document.createElement("span");
    text.className = "text";
    text.textContent = answer.text;
    const pts = document.createElement("span");
    pts.className = "pts";
    pts.textContent = String(answer.points);
    li.append(num, text, pts);
    els.slots.appendChild(li);
  });
  Hub.stagger(els.slots.children, [{ opacity: 0, transform: "rotateX(80deg) translateY(20px)" }, { opacity: 1, transform: "none" }], { each: 70, duration: 600, easing: Hub.ease.spring, fill: "backwards" });
}

// Flips a slot open. `missed` styles answers nobody guessed.
async function reveal(index, missed) {
  const li = els.slots.children[index];
  if (!li || !li.classList.contains("empty")) return;
  await Hub.anim(li, [{ transform: "rotateX(0)" }, { transform: "rotateX(90deg)" }], { duration: 180, easing: "ease-in", fill: "forwards" }).finished;
  li.classList.remove("empty");
  li.classList.toggle("missed", !!missed);
  await Hub.anim(li, [{ transform: "rotateX(-90deg)" }, { transform: "rotateX(0)" }], { duration: 480, easing: Hub.ease.spring, fill: "forwards" }).finished;
}

async function showX(count) {
  els.xmark.replaceChildren();
  for (let i = 0; i < count; i++) { const s = document.createElement("span"); s.textContent = "X"; els.xmark.appendChild(s); }
  els.xmark.hidden = false;
  Hub.sfx.play("strike");
  Hub.flash("#ff2a4d", 500);
  Hub.shake(els.game, 16, 550);
  await Hub.anim(els.xmark, [{ opacity: 0, transform: "scale(2.4)" }, { opacity: 1, transform: "scale(1)", offset: 0.2 }, { opacity: 1, transform: "scale(1)", offset: 0.75 }, { opacity: 0, transform: "scale(0.9)" }], { duration: 1200, easing: "ease-out" }).finished;
  els.xmark.hidden = true;
}

function setHint(text, kind) {
  els.hint.textContent = text || "";
  els.hint.className = "hint" + (kind ? " " + kind : "");
}

function lockInput(locked) {
  els.guess.disabled = locked;
  els.submit.disabled = locked;
  if (!locked) els.guess.focus({ preventScroll: true });
}

/* -------------------------------------------------------------- round flow */

async function startRound() {
  const data = rounds[roundIndex];
  round = { data, revealed: new Set(), strikes: 0, bank: 0, mult: MULTIPLIERS[roundIndex], control: roundIndex % 2 === 0 ? "A" : "B", phase: "play" };
  els.question.textContent = data.question;
  els.roundChip.textContent = "Round " + (roundIndex + 1) + " of " + ROUNDS + (round.mult > 1 ? "  x" + round.mult : "");
  els.next.hidden = true;
  els.form.hidden = false;
  els.guess.value = "";
  setHint(round.mult > 1 ? "Points count x" + round.mult + " this round!" : "");
  buildSlots();
  paintBank(false);
  paintStrikes();
  setControl(round.control);
  Hub.anim(els.question, [{ opacity: 0, transform: "translateY(-18px)" }, { opacity: 1, transform: "none" }], { duration: 600, fill: "backwards" });
  if (round.mult > 1) Hub.banner("x" + round.mult + " ROUND", "Every answer counts more", "#2fb8ff");
  lockInput(false);
}

async function submitGuess(event) {
  event.preventDefault();
  if (busy || !round) return;
  const text = els.guess.value.trim();
  if (!text) return;
  busy = true;
  lockInput(true);
  els.guess.value = "";

  const answers = round.data.answers;
  const hit = answers.findIndex((answer, i) => !round.revealed.has(i) && matches(text, answer));
  const already = hit === -1 && answers.findIndex((answer, i) => round.revealed.has(i) && matches(text, answer)) !== -1;

  if (already) {
    setHint("That answer is already on the board!", "bad");
    Hub.sfx.play("flip");
    busy = false;
    lockInput(false);
    return;
  }

  if (round.phase === "steal") {
    await resolveSteal(hit);
  } else if (hit !== -1) {
    await takeAnswer(hit);
    if (round.revealed.size === answers.length) await endRound(round.control, "cleared the board");
  } else {
    await strike(text);
  }
  busy = false;
  if (round && round.phase !== "done") lockInput(false);
}

async function takeAnswer(index) {
  const answer = round.data.answers[index];
  round.revealed.add(index);
  const gained = answer.points * round.mult;
  round.bank += gained;
  Hub.sfx.play("correct");
  setHint("Survey says: " + answer.text + "! +" + gained, "good");
  await reveal(index, false);
  const where = Hub.fx.at(els.slots.children[index]);
  Hub.fx.burst(where.x, where.y, { count: 28 });
  Hub.floatText(where.x, where.y, "+" + gained, "#ffd76a");
  paintBank(true);
}

async function strike() {
  round.strikes++;
  paintStrikes();
  setHint("Not on the board.", "bad");
  await showX(round.strikes === 3 ? 3 : round.strikes);
  if (round.strikes >= 3) {
    round.phase = "steal";
    setControl(round.control);
    setHint("Three strikes. The other team gets one chance to steal.", "");
  }
}

async function resolveSteal(hit) {
  const stealer = round.control === "A" ? "B" : "A";
  if (hit !== -1) {
    const answer = round.data.answers[hit];
    round.revealed.add(hit);
    const gained = answer.points * round.mult;
    round.bank += gained;
    paintBank(true);
    Hub.sfx.play("correct");
    await reveal(hit, false);
    await endRound(stealer, "stole the bank");
  } else {
    await showX(1);
    await endRound(round.control, "kept the bank");
  }
}

async function endRound(winner, why) {
  round.phase = "done";
  lockInput(true);
  els.form.hidden = true;
  const bank = round.bank;
  scores[winner] += bank;
  Hub.sfx.play("win");
  Hub.banner("TEAM " + winner, why + " +" + bank, winner === "A" ? "#ff5d7a" : "#2fb8ff");
  const where = Hub.fx.at(els.card[winner]);
  Hub.fx.confetti({ x: where.x, y: where.y + 30, count: 90 });
  paintScores(true);

  // Show what everyone missed.
  const answers = round.data.answers;
  await Hub.sleep(900);
  for (let i = 0; i < answers.length; i++) {
    if (!round.revealed.has(i)) { await reveal(i, true); }
  }
  els.next.textContent = roundIndex + 1 >= ROUNDS ? "See final scores" : "Next round";
  els.next.hidden = false;
  Hub.anim(els.next, [{ opacity: 0, transform: "scale(0.7)" }, { opacity: 1, transform: "none" }], { duration: 500, easing: Hub.ease.spring, fill: "backwards" });
  els.next.focus({ preventScroll: true });
}

els.next.addEventListener("click", () => {
  roundIndex++;
  if (roundIndex >= ROUNDS) showEnd(); else startRound();
});

/* ------------------------------------------------------------------ finale */

function showEnd() {
  els.game.hidden = true;
  els.end.hidden = false;
  const a = scores.A, b = scores.B;
  const best = Math.max(a, b);
  let result = null;
  if (!saved) { saved = true; result = Hub.finish("feud", { score: best, mode: ROUNDS + " rounds", xp: 15 + Math.round(best / 8) }); }

  const title = $("endTitle");
  title.textContent = a === b ? "It's a tie!" : "Team " + (a > b ? "A" : "B") + " wins!";
  Hub.split(title);
  Hub.stagger(title.children, [{ transform: "translateY(-60px) scale(0.4)", opacity: 0 }, { transform: "none", opacity: 1 }], { each: 45, duration: 900, easing: Hub.ease.bounce, fill: "backwards" });
  [["endA", a], ["endB", b]].forEach(([id, value]) => {
    const card = $(id);
    const num = card.querySelector("b");
    num.textContent = "0";
    num.dataset.value = "0";
    Hub.countTo(num, value, { from: 0, ms: 1300 });
    card.classList.toggle("win", a === b || (id === "endA" ? a > b : b > a));
  });
  const notes = [];
  if (result) {
    notes.push("+" + result.xp + " XP");
    if (result.rank) notes.push("Leaderboard rank #" + result.rank);
    if (result.isBest && best > 0) notes.push("New personal best!");
    $("endBoard").href = "leaderboard.html?game=feud" + (result.rank ? "&new=feud&rank=" + result.rank : "");
  }
  $("endNote").textContent = notes.join("  ·  ");
  Hub.sfx.play("win");
  Hub.fx.cannons();
  setTimeout(() => Hub.fx.fireworks(4), 700);
}

function newMatch() {
  scores = { A: 0, B: 0 };
  roundIndex = 0;
  saved = false;
  busy = false;
  rounds = Hub.shuffle(surveys).slice(0, ROUNDS);
  paintScores(false);
  els.end.hidden = true;
  els.start.hidden = true;
  els.game.hidden = false;
  startRound();
}

/* -------------------------------------------------------------------- init */

els.form.addEventListener("submit", submitGuess);
$("go").addEventListener("click", newMatch);
$("again").addEventListener("click", newMatch);

document.title = (ROUNDS === 6 ? "Family Feud: Full Match" : "Family Feud: Quick Match");
$("rules").replaceChildren(...[
  "<b>" + ROUNDS + " rounds.</b> Round " + ROUNDS + " is worth x3." + (ROUNDS === 6 ? " Rounds 3-4 are x2." : " Round 2 is x2."),
  "The team in <b>control</b> types answers. Each correct one flips a slot and adds to the bank.",
  "Three <b>strikes</b> and the other team gets <b>one steal</b>. If they match an answer, they take the bank.",
  "Clear the board and the bank is yours. The surveys are made up, so argue away."
].map(html => { const li = document.createElement("li"); li.innerHTML = html; return li; }));
Hub.split($("feudTitle"));
Hub.stagger($("feudTitle").children, [{ transform: "translateY(-70px) scale(0.4)", opacity: 0 }, { transform: "none", opacity: 1 }], { each: 45, duration: 900, easing: Hub.ease.bounce, fill: "backwards" });

$("go").disabled = true;
Hub.json("../data/feud.json")
  .then(data => { surveys = data.rounds; $("go").disabled = false; })
  .catch(error => { console.error(error); $("rules").textContent = "Could not load the surveys. Run the project through a local web server (see README)."; });
