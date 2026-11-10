// Memory Match with campus and Iowa pictures.
//   ?size=easy  4x4 board (8 pairs), no clock.
//   ?size=hard  6x4 board (12 pairs) against a 90 second clock.
// Matching pairs back to back builds a combo that multiplies the points.

const $ = id => document.getElementById(id);
const hard = Hub.params.get("size") === "hard";
const CONFIG = hard
  ? { pairs: 12, cols: 6, seconds: 90, label: "Hard 6x4", title: "Memory Match: Hard" }
  : { pairs: 8, cols: 4, seconds: 0, label: "Easy 4x4", title: "Memory Match: Easy" };

const grid = $("grid");
let allCards = [];
let deck = [];
let first = null;
let second = null;
let locked = true;
let state = null;
let ticker = 0;

function paintHud(bumpCombo) {
  $("moves").textContent = String(state.moves);
  const combo = $("combo");
  combo.textContent = "x" + Math.min(5, state.combo || 1);
  combo.parentElement.classList.toggle("hot", state.combo >= 2);
  if (bumpCombo) Hub.anim(combo, [{ transform: "scale(1.7)" }, { transform: "scale(1)" }], { duration: 450, easing: Hub.ease.spring });
}

function addScore(points) {
  state.score += points;
  Hub.countTo($("score"), state.score, { from: Number($("score").dataset.value) || 0, ms: 500 });
}

function buildDeck() {
  const picks = Hub.shuffle(allCards).slice(0, CONFIG.pairs);
  deck = Hub.shuffle(picks.concat(picks.map(card => Object.assign({}, card))));
  grid.replaceChildren();
  deck.forEach((card, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card-btn";
    button.dataset.id = card.id;
    button.setAttribute("aria-label", "Card " + (i + 1) + ", face down");

    const back = document.createElement("div");
    back.className = "face back";
    back.textContent = "🌪️";
    const front = document.createElement("div");
    front.className = "face front";
    const img = document.createElement("img");
    img.src = card.image;
    img.alt = card.name;
    img.draggable = false;
    const label = document.createElement("span");
    label.textContent = card.name;
    front.append(img, label);
    button.append(back, front);
    button.addEventListener("click", () => flip(button, card, i));
    grid.appendChild(button);
  });
  Hub.stagger(grid.children, [{ opacity: 0, transform: "translateY(-60px) rotate(-12deg) scale(0.6)" }, { opacity: 1, transform: "none" }], { each: 45, duration: 700, easing: Hub.ease.spring, fill: "backwards" });
}

function flip(button, card, index) {
  if (locked || button.classList.contains("flipped") || button.classList.contains("matched")) return;
  button.classList.add("flipped");
  button.setAttribute("aria-label", card.name + ", face up");
  Hub.sfx.play("flip");
  if (!first) { first = { button, card }; return; }
  second = { button, card };
  state.moves++;
  locked = true;
  setTimeout(check, 650);
  paintHud(false);
}

function check() {
  const a = first, b = second;
  first = null;
  second = null;
  if (a.card.id === b.card.id) {
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.found++;
    const points = 100 + 50 * (Math.min(5, state.combo) - 1);
    [a.button, b.button].forEach(button => { button.classList.add("matched"); button.disabled = true; });
    Hub.sfx.play("match");
    const where = Hub.fx.at(b.button);
    Hub.fx.burst(where.x, where.y, { count: 30 });
    Hub.floatText(where.x, where.y - 20, "+" + points, "#ff7ad9");
    // Only the glow is animated: a transform animation would override the card's flip rotation.
    [a.button, b.button].forEach(button => Hub.anim(button, [{ boxShadow: "0 0 0 0 rgba(255,122,217,.8)" }, { boxShadow: "0 0 0 16px rgba(255,122,217,0)" }], { duration: 650, fill: "none" }));
    addScore(points);
    $("status").textContent = a.card.name + "! " + (state.combo >= 2 ? "Combo x" + Math.min(5, state.combo) + "." : "");
    paintHud(true);
    locked = false;
    if (state.found === CONFIG.pairs) endGame("All pairs found");
  } else {
    state.combo = 0;
    Hub.sfx.play("wrong");
    [a.button, b.button].forEach(button => button.classList.add("bad"));
    $("status").textContent = "No match.";
    paintHud(false);
    setTimeout(() => {
      [a.button, b.button].forEach(button => { button.classList.remove("flipped", "bad"); button.setAttribute("aria-label", "Card, face down"); });
      locked = false;
    }, 520);
  }
}

function tick() {
  if (!state || state.over) return;
  const now = performance.now();
  state.elapsed = (now - state.start) / 1000;
  if (CONFIG.seconds) {
    const left = Math.max(0, CONFIG.seconds - state.elapsed);
    $("time").textContent = String(Math.ceil(left));
    $("time").parentElement.classList.toggle("low", left <= 15);
    $("bar").style.transform = "scaleX(" + (left / CONFIG.seconds).toFixed(4) + ")";
    const whole = Math.ceil(left);
    if (whole <= 5 && whole > 0 && whole !== state.lastWhole) Hub.sfx.play("tick");
    state.lastWhole = whole;
    if (left <= 0) endGame("Time's up!");
  } else {
    $("time").textContent = String(Math.floor(state.elapsed));
  }
}

function endGame(kicker) {
  if (state.over) return;
  state.over = true;
  clearInterval(ticker);
  locked = true;
  const timeLeft = CONFIG.seconds ? Math.max(0, CONFIG.seconds - state.elapsed) : 0;
  const complete = state.found === CONFIG.pairs;
  let bonus = 0;
  if (complete) bonus = CONFIG.seconds ? Math.round(timeLeft * 10) : Math.max(0, (CONFIG.pairs * 3 - state.moves)) * 25;
  const total = state.score + bonus;

  const delay = complete ? 900 : 300;
  setTimeout(() => {
    $("game").hidden = true;
    $("end").hidden = false;
    const result = Hub.finish("memory", { score: total, mode: CONFIG.label, xp: 10 + state.found * 5 });
    $("endKicker").textContent = kicker;
    const scoreEl = $("endScore");
    scoreEl.textContent = "0";
    scoreEl.dataset.value = "0";
    Hub.countTo(scoreEl, total, { from: 0, ms: 1300 });
    Hub.anim($("end"), [{ opacity: 0, transform: "scale(0.85)" }, { opacity: 1, transform: "none" }], { duration: 700, easing: Hub.ease.spring, fill: "backwards" });
    const notes = [];
    if (bonus) notes.push("Bonus +" + bonus);
    if (result.rank) notes.push("Leaderboard rank #" + result.rank);
    if (result.isBest && total > 0) notes.push("New personal best!");
    $("endNote").textContent = notes.join("  ·  ") || "Give it another go.";
    $("endBoard").href = "leaderboard.html?game=memory" + (result.rank ? "&new=memory&rank=" + result.rank : "");

    const stats = $("endStats");
    stats.replaceChildren();
    [["Pairs", state.found + "/" + CONFIG.pairs], ["Moves", state.moves], ["Best combo", "x" + Math.min(5, state.bestCombo || 1)], ["XP", "+" + result.xp]].forEach(([label, value]) => {
      const li = document.createElement("li");
      const b = document.createElement("b");
      b.textContent = String(value);
      const span = document.createElement("span");
      span.textContent = label;
      li.append(b, span);
      stats.appendChild(li);
    });
    Hub.stagger(stats.children, [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }], { each: 90, delay: 500, duration: 500, fill: "backwards" });
    if (complete) { Hub.sfx.play("win"); Hub.fx.cannons(); } else { Hub.sfx.play("lose"); }
  }, delay);
}

function startGame() {
  $("start").hidden = true;
  $("end").hidden = true;
  $("game").hidden = false;
  grid.style.setProperty("--cols", String(CONFIG.cols));
  document.querySelector(".memory").style.setProperty("--cols", String(CONFIG.cols));
  state = { score: 0, moves: 0, combo: 0, bestCombo: 0, found: 0, over: false, start: performance.now(), elapsed: 0, lastWhole: 0 };
  first = null;
  second = null;
  $("score").textContent = "0";
  $("score").dataset.value = "0";
  $("time").textContent = CONFIG.seconds ? String(CONFIG.seconds) : "0";
  $("timeLabel").textContent = CONFIG.seconds ? "Time left" : "Time";
  $("barWrap").hidden = !CONFIG.seconds;
  $("bar").style.transform = "scaleX(1)";
  $("status").textContent = "Flip two cards to find a pair.";
  paintHud(false);
  buildDeck();
  clearInterval(ticker);
  setTimeout(() => {
    locked = false;
    state.start = performance.now();
    ticker = setInterval(tick, 200);
  }, 900);
}

$("go").addEventListener("click", startGame);
$("again").addEventListener("click", startGame);

document.title = CONFIG.title;
$("memLead").textContent = hard ? "Twelve pairs, ninety seconds. Keep your combo alive." : "Eight pairs of campus and Iowa pictures. Take your time.";
$("rules").replaceChildren(...[
  "Flip two cards. If the pictures match, they stay face up.",
  "Matching pairs back to back builds a <b>combo</b> worth up to <b>x5</b> points.",
  hard ? "Finish before the <b>90 second</b> clock runs out. Leftover time is bonus points." : "Fewer moves means a bigger bonus when you finish."
].map(html => { const li = document.createElement("li"); li.innerHTML = html; return li; }));
Hub.split($("memTitle"));
Hub.stagger($("memTitle").children, [{ transform: "translateY(-70px) scale(0.4)", opacity: 0 }, { transform: "none", opacity: 1 }], { each: 45, duration: 900, easing: Hub.ease.bounce, fill: "backwards" });

$("go").disabled = true;
Hub.json("../data/memory.json")
  .then(data => { allCards = data.cards; $("go").disabled = false; })
  .catch(error => { console.error(error); $("memLead").textContent = "Could not load the cards. Run the project through a local web server (see README)."; });
