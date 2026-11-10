const pageTitle = document.getElementById("pageTitle");
const leaderboard = document.getElementById("leaderboard");
const tableHeader = document.getElementById("tableHeader");
const tabs = document.getElementById("tabs");
const emptyNote = document.getElementById("empty");
const playGame = document.getElementById("playGame");

const MEDALS = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
let games = [];
let seeds = {};

function formatScore(game, score) {
  return game.unit === "$" ? Hub.money(score) : score.toLocaleString() + " pts";
}

function formatWhen(entry) {
  if (!entry.date) return "—";
  const when = new Date(entry.date);
  return isNaN(when) ? "—" : when.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function render(game) {
  const scores = Hub.board.get(game.id, seeds[game.id]).sort((first, second) => second.score - first.score);
  leaderboard.replaceChildren();
  emptyNote.hidden = scores.length > 0;
  const newest = Hub.params.get("new") === game.id ? Hub.params.get("rank") : null;

  scores.forEach((entry, index) => {
    const row = document.createElement("tr");
    if (index < 3) row.className = "top" + (index + 1);
    if (newest && Number(newest) === index + 1) row.classList.add("mine");

    const rank = document.createElement("td");
    rank.textContent = index < 3 ? MEDALS[index] : String(index + 1);
    const score = document.createElement("td");
    score.textContent = formatScore(game, entry.score);
    const mode = document.createElement("td");
    mode.textContent = entry.mode || "Classic";
    const when = document.createElement("td");
    when.textContent = formatWhen(entry);

    row.append(rank, score, mode, when);
    leaderboard.appendChild(row);
  });

  Hub.stagger(leaderboard.children, [
    { opacity: 0, transform: "translateX(-40px) scale(0.96)" },
    { opacity: 1, transform: "none" }
  ], { each: 70, duration: 700, easing: Hub.ease.spring, fill: "backwards" });

  if (scores.length) {
    const top = leaderboard.firstElementChild;
    const point = Hub.fx.at(top);
    setTimeout(() => Hub.fx.burst(point.x, point.y, { color: "#F1BE48", count: 20 }), 400);
  }
}

function select(game, tab) {
  Array.from(tabs.children).forEach(button => button.setAttribute("aria-selected", String(button === tab)));
  document.documentElement.style.setProperty("--accent", game.accent);
  document.documentElement.style.setProperty("--accent2", game.accent2);
  playGame.href = game.link;
  playGame.textContent = "Play " + game.name;
  render(game);
}

Promise.all([Hub.json("../data/leaderboard.json"), Hub.json("../data/games.json")]).then(([data, gameData]) => {
  pageTitle.textContent = data.pageTitle;
  seeds = data.seeds || {};
  games = gameData.games;

  data.columns.forEach(name => {
    const th = document.createElement("th");
    th.textContent = name;
    tableHeader.appendChild(th);
  });

  games.forEach(game => {
    const tab = document.createElement("button");
    tab.className = "tab";
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.textContent = game.icon + " " + game.name;
    tab.addEventListener("click", () => select(game, tab));
    tabs.appendChild(tab);
  });

  const wanted = Hub.params.get("game") || Hub.params.get("new") || "jeopardy";
  const index = Math.max(0, games.findIndex(game => game.id === wanted));
  select(games[index], tabs.children[index]);
});
