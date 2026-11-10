// ISU Jeopardy board.
// Two ways to play (chosen with ?mode=choice on the URL, or by clicking the mode chip):
//   host   - one person reads the clue, reveals the answer, and awards points.
//   choice - teams take turns picking a tile and answering a timed multiple choice question.
// Shared helpers (animation, sound, XP, leaderboard) come from ../assets/hub.js.

const $ = id => document.getElementById(id);

const board = $("ISU_gameBoard");
const scoreEls = { A: $("team1Score"), B: $("team2Score") };
const cardEls = { A: $("cardA"), B: $("cardB") };
const newGameButton = $("newGame");
const howToPlayButton = $("howToPlay");
const boardTitle = $("boardTitle");
const modeChip = $("modeChip");
const turnBanner = $("turnBanner");

const questionDialog = $("questionDialog");
const qCat = $("qCat");
const qVal = $("qVal");
const qTurn = $("qTurn");
const qTimer = $("qTimer");
const qSeconds = $("qSeconds");
const dialogTitle = $("dialogTitle");
const dialogQuestion = $("dialogQuestion");
const wagerBox = $("wagerBox");
const wagerMax = $("wagerMax");
const wagerRange = $("wagerRange");
const wagerOut = $("wagerOut");
const lockWager = $("lockWager");
const choicesBox = $("choices");
const revealAnswerButton = $("revealAnswer");
const answerSection = $("answerSection");
const dialogAnswer = $("dialogAnswer");
const dialogAnswerImage = $("dialogAnswerImage");
const awardTeamAButton = $("awardTeamA");
const awardTeamBButton = $("awardTeamB");
const noPointsButton = $("noPoints");
const roundResult = $("roundResult");
const closeDialogButton = $("closeDialog");

const helpDialog = $("helpDialog");
const helpList = $("helpList");
const finaleDialog = $("finaleDialog");

const QUESTION_SECONDS = 20;
const LETTERS = ["A", "B", "C", "D"];

// Scores of the two teams.
const teamScores = { A: 0, B: 0 };

let gameData = null;
let mode = Hub.params.get("mode") === "choice" ? "choice" : "host";
let turn = "A";
let answered = 0;
let totalTiles = 0;
let gameSaved = false;
let dailyDoubleId = null;

// The question that is currently open.
let currentQuestion = null;
let currentTile = null;
let currentWorth = 0;
let resolved = false;
let timerId = 0;
let timerAnim = null;
let shownChoices = [];

/* ------------------------------------------------------------------ scores */

function paintScore(team, animate) {
  const el = scoreEls[team];
  const from = Number(el.dataset.value) || 0;
  if (animate) {
    Hub.countTo(el, teamScores[team], { from, ms: 800, format: Hub.money });
  } else {
    el.dataset.value = String(teamScores[team]);
    el.textContent = Hub.money(teamScores[team]);
  }
}

function updateScores(animate = false) {
  paintScore("A", animate);
  paintScore("B", animate);
}

// Kept for anything else that calls into the board (the old code exposed this).
window.addPointsToTeam = function (team, points) {
  if (!Object.hasOwn(teamScores, team) || !Number.isFinite(points)) return;
  teamScores[team] += points;
  paintScore(team, true);
};

function scoreDelta(team, points) {
  teamScores[team] += points;
  paintScore(team, true);
  const card = cardEls[team];
  const where = Hub.fx.at(card);
  Hub.floatText(where.x, where.y, (points >= 0 ? "+" : "-") + "$" + Math.abs(points), points >= 0 ? "#38e0a0" : "#ff4d6d");
  Hub.pulse(card, points >= 0 ? "rgba(56,224,160,.8)" : "rgba(255,77,109,.8)");
}

function setTurn(team, announce) {
  turn = team;
  Object.keys(cardEls).forEach(key => cardEls[key].classList.toggle("active", mode === "choice" && key === team));
  turnBanner.hidden = mode !== "choice";
  if (mode !== "choice") return;
  turnBanner.style.setProperty("--team", team === "A" ? "#ff5d7a" : "#5aa9ff");
  turnBanner.innerHTML = "";
  const label = document.createElement("b");
  label.textContent = "Team " + team;
  turnBanner.append(label, " picks the next tile");
  if (announce) Hub.anim(turnBanner, [{ transform: "scale(0.7)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 600, easing: Hub.ease.spring, fill: "backwards" });
}

/* ------------------------------------------------------------------- timer */

function stopTimer() {
  clearInterval(timerId);
  timerId = 0;
  if (timerAnim) { timerAnim.cancel(); timerAnim = null; }
}

function startTimer() {
  stopTimer();
  qTimer.hidden = false;
  qTimer.classList.remove("low");
  let left = QUESTION_SECONDS;
  qSeconds.textContent = left + "s";
  const bar = qTimer.querySelector("i");
  timerAnim = Hub.anim(bar, [{ transform: "scaleX(1)", backgroundPosition: "0% 0" }, { transform: "scaleX(0)", backgroundPosition: "100% 0" }], { duration: QUESTION_SECONDS * 1000, easing: "linear" });
  timerId = setInterval(() => {
    left--;
    qSeconds.textContent = Math.max(0, left) + "s";
    if (left <= 5 && left > 0) { qTimer.classList.add("low"); Hub.sfx.play("tick"); }
    if (left <= 0) {
      stopTimer();
      resolveChoice(null);
    }
  }, 1000);
}

/* ------------------------------------------------------------ question box */

function resetDialog() {
  stopTimer();
  qTimer.hidden = true;
  wagerBox.hidden = true;
  choicesBox.hidden = true;
  choicesBox.replaceChildren();
  shownChoices = [];
  answerSection.hidden = true;
  answerSection.classList.toggle("auto", mode === "choice");
  roundResult.hidden = true;
  roundResult.textContent = "";
  roundResult.className = "";
  revealAnswerButton.hidden = true;
  dialogQuestion.hidden = false;
  dialogAnswerImage.removeAttribute("src");
  dialogAnswerImage.hidden = true;
  awardTeamAButton.disabled = false;
  awardTeamBButton.disabled = false;
  noPointsButton.disabled = false;
  qTurn.hidden = true;
  closeDialogButton.hidden = false;
}

// The dialog grows out of the tile that was clicked.
function morphFrom(tile) {
  if (!tile) return;
  const from = tile.getBoundingClientRect();
  const to = questionDialog.getBoundingClientRect();
  if (!to.width || !to.height) return;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  Hub.anim(questionDialog, [
    { transform: "translate(" + dx + "px," + dy + "px) scale(" + from.width / to.width + "," + from.height / to.height + ")", opacity: 0.15 },
    { transform: "none", opacity: 1 }
  ], { duration: 620, easing: Hub.ease.spring, fill: "backwards" });
}

function openQuestion(category, question, tile) {
  currentQuestion = question;
  currentTile = tile;
  currentWorth = question.value;
  resolved = false;
  resetDialog();

  qCat.textContent = category;
  qVal.textContent = Hub.money(question.value);
  dialogTitle.textContent = category + " for " + Hub.money(question.value);
  dialogQuestion.textContent = question.question ?? question.txt ?? question.prompt ?? "";

  if (mode === "choice") {
    qTurn.hidden = false;
    qTurn.textContent = "Team " + turn;
    qTurn.style.background = turn === "A" ? "linear-gradient(180deg,#ff8aa0,#ff5d7a)" : "linear-gradient(180deg,#9bcaff,#5aa9ff)";
    closeDialogButton.hidden = true;
  }

  if (!questionDialog.open) questionDialog.showModal();
  morphFrom(tile);

  if (tile.dataset.questionId === dailyDoubleId) {
    startDailyDouble();
  } else {
    beginQuestion();
  }
}

// Shows the question: choices and a timer in choice mode, a reveal button in host mode.
function beginQuestion() {
  dialogQuestion.hidden = false;
  Hub.anim(dialogQuestion, [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 450, fill: "backwards" });

  if (mode === "choice") {
    showChoices();
    startTimer();
  } else {
    revealAnswerButton.hidden = false;
  }
}

function startDailyDouble() {
  Hub.sfx.play("level");
  Hub.flash("#f1be48", 600);
  Hub.banner("DAILY DOUBLE", "Wager up to your score", "#F1BE48");
  Hub.fx.cannons();

  const own = mode === "choice" ? teamScores[turn] : Math.max(teamScores.A, teamScores.B);
  const cap = Math.max(400, Math.ceil(Math.max(0, own) / 100) * 100);
  wagerRange.max = String(cap);
  wagerRange.value = String(Math.min(cap, 200));
  wagerMax.textContent = Hub.money(cap);
  wagerOut.textContent = Hub.money(Number(wagerRange.value));
  dialogQuestion.hidden = true;
  wagerBox.hidden = false;
  Hub.anim(wagerBox, [{ opacity: 0, transform: "scale(0.8)" }, { opacity: 1, transform: "none" }], { duration: 600, easing: Hub.ease.spring, delay: 500, fill: "backwards" });
}

wagerRange.addEventListener("input", () => { wagerOut.textContent = Hub.money(Number(wagerRange.value)); });

lockWager.addEventListener("click", () => {
  if (!currentQuestion) return;
  currentWorth = Number(wagerRange.value);
  qVal.textContent = Hub.money(currentWorth) + " wager";
  wagerBox.hidden = true;
  Hub.sfx.play("coin");
  beginQuestion();
});

/* --------------------------------------------------------- multiple choice */

function showChoices() {
  const q = currentQuestion;
  const wrong = Array.isArray(q.wrong) ? q.wrong.slice(0, 3) : [];
  const right = q.correct ?? String(q.answer || "").replace(/^(what|who) (is|are) /i, "").replace(/\?$/, "");
  shownChoices = Hub.shuffle([{ text: right, right: true }, ...wrong.map(text => ({ text, right: false }))]);

  choicesBox.replaceChildren();
  shownChoices.forEach((choice, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    const key = document.createElement("kbd");
    key.textContent = LETTERS[i];
    const label = document.createElement("span");
    label.textContent = choice.text;
    button.append(key, label);
    button.addEventListener("click", () => resolveChoice(i));
    choicesBox.appendChild(button);
  });
  choicesBox.hidden = false;
  Hub.stagger(choicesBox.children, [{ opacity: 0, transform: "translateY(22px) scale(0.9)" }, { opacity: 1, transform: "none" }], { each: 70, delay: 150, duration: 520, easing: Hub.ease.spring, fill: "backwards" });
}

function resolveChoice(index) {
  if (resolved || !currentQuestion) return;
  resolved = true;
  stopTimer();
  qTimer.hidden = true;

  const buttons = Array.from(choicesBox.children);
  const timedOut = index === null;
  const isRight = !timedOut && shownChoices[index].right;
  buttons.forEach((button, i) => {
    button.disabled = true;
    if (shownChoices[i].right) button.classList.add("right");
    else if (i === index) button.classList.add("wrong");
    else button.classList.add("dim");
  });

  const team = turn;
  const answerText = shownChoices.find(choice => choice.right).text;

  if (isRight) {
    Hub.sfx.play("correct");
    Hub.flash("#38e0a0", 500);
    const where = Hub.fx.at(buttons[index]);
    Hub.fx.confetti({ x: where.x, y: where.y, count: 90 });
    Hub.anim(buttons[index], [{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: 520, easing: Hub.ease.spring });
    scoreDelta(team, currentWorth);
    showResult("Correct! Team " + team + " earns " + Hub.money(currentWorth) + " and keeps control.", "good");
  } else {
    Hub.sfx.play("wrong");
    Hub.flash("#ff4d6d", 500);
    Hub.shake(questionDialog, 14, 550);
    scoreDelta(team, -currentWorth);
    const other = team === "A" ? "B" : "A";
    showResult((timedOut ? "Time's up! " : "Not quite. ") + "Team " + team + " loses " + Hub.money(currentWorth) + ". Control passes to Team " + other + ".", "bad");
  }

  showAnswer(answerText);
  markTile(isRight ? (team === "A" ? "won-a" : "won-b") : "lost", isRight ? team : "✕");
  if (!isRight) setTurn(team === "A" ? "B" : "A", true);
  finishRound();
}

/* ----------------------------------------------------------- host mode */

revealAnswerButton.addEventListener("click", () => {
  if (!currentQuestion || resolved) return;
  Hub.sfx.play("flip");
  showAnswer(currentQuestion.answer ?? currentQuestion.correctAnswer ?? currentQuestion.correct);
  revealAnswerButton.hidden = true;
});

function award(team) {
  if (!currentQuestion || resolved) return;
  resolved = true;
  if (team) {
    scoreDelta(team, currentWorth);
    Hub.sfx.play("correct");
    const where = Hub.fx.at(cardEls[team]);
    Hub.fx.confetti({ x: where.x, y: where.y + 40, count: 80 });
    showResult("Team " + team + " gets " + Hub.money(currentWorth) + ".", "good");
  } else {
    Hub.sfx.play("wrong");
    showResult("No points awarded.", "bad");
  }
  awardTeamAButton.disabled = true;
  awardTeamBButton.disabled = true;
  noPointsButton.disabled = true;
  if (answerSection.hidden) showAnswer(currentQuestion.answer ?? currentQuestion.correct);
  revealAnswerButton.hidden = true;
  markTile(team ? (team === "A" ? "won-a" : "won-b") : "lost", team || "✕");
  finishRound();
}

awardTeamAButton.addEventListener("click", () => award("A"));
awardTeamBButton.addEventListener("click", () => award("B"));
noPointsButton.addEventListener("click", () => award(null));

/* ------------------------------------------------------------ shared bits */

function showResult(text, kind) {
  roundResult.textContent = text;
  roundResult.className = kind;
  roundResult.hidden = false;
  Hub.anim(roundResult, [{ opacity: 0, transform: "scale(0.85)" }, { opacity: 1, transform: "none" }], { duration: 500, easing: Hub.ease.spring, fill: "backwards" });
}

function showAnswer(text) {
  dialogAnswer.textContent = text;
  const image = currentQuestion && currentQuestion.image;
  if (image) {
    dialogAnswerImage.onerror = () => { dialogAnswerImage.hidden = true; };
    dialogAnswerImage.src = image;
    dialogAnswerImage.alt = "Image related to: " + text;
    dialogAnswerImage.hidden = false;
  }
  answerSection.hidden = false;
  Hub.anim(answerSection, [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 450, fill: "backwards" });
}

// Marks the tile on the board as played: team letter if won, a cross if not.
function markTile(kind, label) {
  if (!currentTile) return;
  currentTile.disabled = true;
  currentTile.classList.add("done", kind);
  currentTile.textContent = label;
  currentTile.dataset.done = "1";
}

function finishRound() {
  answered++;
  closeDialogButton.hidden = false;
  closeDialogButton.textContent = answered >= totalTiles ? "See results" : "Back to the board";
  if (answered >= totalTiles) closeDialogButton.dataset.finale = "1";
}

closeDialogButton.addEventListener("click", () => {
  const done = closeDialogButton.dataset.finale === "1";
  questionDialog.close();
  if (done) setTimeout(showFinale, 500);
});

// Escape or the close button on an unanswered question just puts the tile back (host mode).
// In choice mode a question must be answered, so Escape is ignored until it is.
questionDialog.addEventListener("cancel", event => {
  if (mode === "choice" && currentQuestion && !resolved) event.preventDefault();
});

questionDialog.addEventListener("close", () => {
  stopTimer();
  if (!resolved) {
    currentQuestion = null;
    currentTile = null;
  } else {
    currentQuestion = null;
    currentTile = null;
    if (answered >= totalTiles && !finaleDialog.open && !gameSaved) setTimeout(showFinale, 500);
  }
  closeDialogButton.textContent = "Close";
});

document.addEventListener("keydown", event => {
  if (!questionDialog.open || mode !== "choice" || resolved || choicesBox.hidden) return;
  const index = Number(event.key) - 1;
  if (index >= 0 && index < shownChoices.length) resolveChoice(index);
});

/* ------------------------------------------------------------- game over */

function showFinale() {
  if (gameSaved || finaleDialog.open) return;
  gameSaved = true;

  const a = teamScores.A, b = teamScores.B;
  const best = Math.max(a, b);
  const result = Hub.finish("jeopardy", { score: best, mode, xp: 20 + Math.round(Math.max(0, best) / 25) });

  const title = $("finaleTitle");
  title.textContent = a === b ? "It's a tie!" : "Team " + (a > b ? "A" : "B") + " wins!";
  $("finalA").textContent = Hub.money(0);
  $("finalB").textContent = Hub.money(0);
  document.querySelectorAll(".finale-team").forEach(el => el.classList.remove("win"));
  if (a !== b) document.querySelector(a > b ? ".finale-team.team-a" : ".finale-team.team-b").classList.add("win");
  if (a === b) document.querySelectorAll(".finale-team").forEach(el => el.classList.add("win"));

  const bits = ["+" + result.xp + " XP"];
  if (result.rank) bits.push("Leaderboard rank #" + result.rank);
  else if (best <= 0) bits.push("Score above $0 to land on the leaderboard");
  if (result.isBest && best > 0) bits.push("New personal best!");
  $("finaleNote").textContent = bits.join("  ·  ");
  $("finaleBoard").href = "leaderboard.html?game=jeopardy" + (result.rank ? "&new=jeopardy&rank=" + result.rank : "");

  finaleDialog.showModal();
  Hub.split(title);
  Hub.stagger(title.children, [{ transform: "translateY(-60px) scale(0.4)", opacity: 0 }, { transform: "none", opacity: 1 }], { each: 45, duration: 900, easing: Hub.ease.bounce, fill: "backwards" });
  Hub.countTo($("finalA"), a, { from: 0, ms: 1400, format: Hub.money });
  Hub.countTo($("finalB"), b, { from: 0, ms: 1400, format: Hub.money });
  Hub.sfx.play(best > 0 ? "win" : "lose");
  if (best > 0) { Hub.fx.cannons(); setTimeout(() => Hub.fx.fireworks(4), 600); }
}

$("playAgain").addEventListener("click", () => {
  finaleDialog.close();
  startNewGame();
});

/* ------------------------------------------------------------------- board */

function renderBoard() {
  board.replaceChildren();
  answered = 0;
  totalTiles = 0;
  closeDialogButton.dataset.finale = "";
  const headings = [];
  const tiles = [];

  gameData.categories.forEach(category => {
    const heading = document.createElement("div");
    heading.className = "category-cell";
    heading.textContent = category.name;
    board.appendChild(heading);
    headings.push(heading);
  });

  const values = [100, 200, 300, 400];
  const ids = [];
  gameData.categories.forEach(category => category.questions.forEach(item => ids.push(item.id)));
  dailyDoubleId = ids.length ? Hub.pick(ids) : null;

  values.forEach(value => {
    gameData.categories.forEach(category => {
      const question = category.questions.find(item => item.value === value);
      const tile = document.createElement("button");
      tile.className = "question-cell";
      tile.type = "button";
      tile.textContent = "$" + value;
      tile.disabled = !question;
      if (question) {
        totalTiles++;
        tile.dataset.questionId = question.id;
        tile.dataset.value = question.value;
        tile.dataset.category = category.name;
        tile.setAttribute("aria-label", category.name + " for $" + value);
        Hub.tilt(tile, 8);
        tile.addEventListener("click", () => {
          if (questionDialog.open || tile.dataset.done) return;
          Hub.sfx.play("pop");
          openQuestion(category.name, question, tile);
        });
      }
      board.appendChild(tile);
      tiles.push(tile);
    });
  });

  // Headings drop in, then the tiles flip up row by row.
  Hub.stagger(headings, [{ opacity: 0, transform: "translateY(-30px) scale(0.8)" }, { opacity: 1, transform: "none" }], { each: 80, duration: 650, easing: Hub.ease.spring, fill: "backwards" });
  Hub.stagger(tiles, [{ opacity: 0, transform: "rotateX(80deg) translateY(30px) scale(0.7)" }, { opacity: 1, transform: "none" }], { each: 32, delay: 350, duration: 700, easing: Hub.ease.spring, fill: "backwards" });
}

function startNewGame() {
  // Save an unfinished game's best score once, so it still shows up on the leaderboard.
  const best = Math.max(teamScores.A, teamScores.B);
  if (!gameSaved && best > 0) Hub.finish("jeopardy", { score: best, mode });
  gameSaved = false;

  teamScores.A = 0;
  teamScores.B = 0;
  updateScores(true);
  currentQuestion = null;
  currentTile = null;
  resolved = false;
  if (questionDialog.open) questionDialog.close();
  if (finaleDialog.open) finaleDialog.close();
  setTurn("A", true);
  paintMode();
  if (gameData) renderBoard();
}

function paintMode() {
  modeChip.textContent = mode === "choice" ? "Multiple choice" : "Host mode";
  modeChip.title = "Click to switch mode";
  document.title = "ISU Jeopardy Board" + (mode === "choice" ? " - Multiple Choice" : "");
  const rules = mode === "choice"
    ? [
        "Teams take turns. The team with control picks any tile.",
        "Read the clue and tap an answer (or press 1-4) before the " + QUESTION_SECONDS + " second timer runs out.",
        "Correct: you win the tile's value and keep control. Wrong or out of time: you lose the value and control passes.",
        "One hidden tile is a Daily Double. Wager before you see the clue.",
        "When every tile is played, the higher score wins and goes on the leaderboard."
      ]
    : [
        "Pick a category and a value. Value goes up with difficulty.",
        "Read the clue aloud, then press Reveal Answer.",
        "Award the points to Team A, Team B, or nobody.",
        "One hidden tile is a Daily Double. Set the wager before the clue is read.",
        "When every tile is played, the higher score wins. Click the Multiple Choice chip for the timed version."
      ];
  helpList.replaceChildren(...rules.map(text => { const li = document.createElement("li"); li.textContent = text; return li; }));
}

modeChip.setAttribute("role", "button");
modeChip.tabIndex = 0;
function toggleMode() {
  mode = mode === "choice" ? "host" : "choice";
  const url = new URL(location.href);
  if (mode === "choice") url.searchParams.set("mode", "choice"); else url.searchParams.delete("mode");
  history.replaceState(null, "", url);
  Hub.sfx.play("whoosh");
  startNewGame();
}
modeChip.addEventListener("click", toggleMode);
modeChip.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleMode(); } });

newGameButton.addEventListener("click", startNewGame);
howToPlayButton.addEventListener("click", () => helpDialog.showModal());
$("helpClose").addEventListener("click", () => helpDialog.close());

// Warn nothing, lose nothing: an unfinished game is saved if the page is left.
window.addEventListener("pagehide", () => {
  const best = Math.max(teamScores.A, teamScores.B);
  if (!gameSaved && best > 0 && answered > 0) { gameSaved = true; Hub.finish("jeopardy", { score: best, mode }); }
});

paintMode();
setTurn("A", false);
updateScores(false);

Hub.json("../data/questions.json")
  .then(data => {
    gameData = data;
    boardTitle.textContent = data.pageTitle;
    Hub.split(boardTitle);
    Hub.stagger(boardTitle.children, [{ transform: "translateY(-50px) rotate(-10deg) scale(0.5)", opacity: 0 }, { transform: "none", opacity: 1 }], { each: 40, duration: 900, easing: Hub.ease.bounce, fill: "backwards" });
    renderBoard();
  })
  .catch(error => {
    console.error(error);
    board.textContent = "Could not load the questions. Start the project with a local web server (see README).";
  });
