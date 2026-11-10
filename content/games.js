const gameList = document.getElementById("gameList");
const pageTitle = document.getElementById("pageTitle");
const pageSub = document.getElementById("pageSub");
const featured = document.getElementById("featured");

function bestLabel(game) {
  const best = Hub.store.get().best[game.id];
  if (!best) return "Not played yet";
  return "Your best: " + (game.unit === "$" ? Hub.money(best) : best.toLocaleString() + " pts");
}

function chip(text, extra) {
  const el = document.createElement("span");
  el.className = "chip" + (extra ? " " + extra : "");
  el.textContent = text;
  return el;
}

function buildCard(game) {
  const card = document.createElement("a");
  card.className = "gcard card";
  card.href = game.link;
  card.style.setProperty("--accent", game.accent);
  card.style.setProperty("--accent2", game.accent2);
  card.setAttribute("aria-label", game.name + ". " + game.tagline);

  const orb = document.createElement("span");
  orb.className = "orb";
  orb.setAttribute("aria-hidden", "true");
  orb.textContent = game.icon;

  const chips = document.createElement("span");
  chips.className = "chips";
  if (game.tag) chips.appendChild(chip(game.tag, game.tag === "New" ? "hot" : ""));
  if (game.id === Hub.featuredId()) chips.appendChild(chip("2x XP", "live"));

  const name = document.createElement("h2");
  name.textContent = game.name;

  const tagline = document.createElement("p");
  tagline.textContent = game.tagline;

  const meta = document.createElement("span");
  meta.className = "meta";
  const players = document.createElement("span");
  players.textContent = "\u{1F465} " + game.players;
  const time = document.createElement("span");
  time.textContent = "⏱️ " + game.time;
  meta.append(players, time);

  const best = document.createElement("span");
  best.className = "best";
  best.textContent = bestLabel(game);

  const go = document.createElement("span");
  go.className = "go";
  go.textContent = "Play →";

  card.append(orb, chips, name, tagline, meta, best, go);
  Hub.tilt(card, 8);
  card.addEventListener("pointerenter", () => Hub.sfx.play("hover"));
  return card;
}

Hub.json("../data/games.json").then(data => {
  pageTitle.textContent = data.pageTitle;
  document.title = "Choose a Game";
  pageSub.textContent = data.tagline;

  const today = data.games.find(game => game.id === Hub.featuredId());
  if (today) {
    featured.textContent = "\u{1F525} Today's featured game: " + today.name + ". Double XP!";
    featured.hidden = false;
  }

  data.games.forEach(game => gameList.appendChild(buildCard(game)));

  Hub.stagger(gameList.children, [
    { opacity: 0, transform: "translateY(50px) rotateX(-24deg) scale(0.88)" },
    { opacity: 1, transform: "none" }
  ], { each: 100, duration: 1000, easing: Hub.ease.spring, fill: "backwards" });
  Hub.anim(pageTitle, [{ opacity: 0, transform: "translateY(-24px)" }, { opacity: 1, transform: "none" }], { duration: 700 });
});
