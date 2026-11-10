const styleList = document.getElementById("styleList");
const pageTitle = document.getElementById("pageTitle");
const gameName = document.getElementById("gameName");
const gameIcon = document.getElementById("gameIcon");
const selectedGameId = Hub.params.get("game");

function buildMode(style, game) {
  const card = document.createElement(style.link ? "a" : "div");
  card.className = "gcard mcard card";
  card.style.setProperty("--accent", game.accent);
  card.style.setProperty("--accent2", game.accent2);

  if (style.link) {
    card.href = style.link;
  } else {
    card.setAttribute("aria-disabled", "true");
    card.style.opacity = "0.5";
  }

  const orb = document.createElement("span");
  orb.className = "orb";
  orb.setAttribute("aria-hidden", "true");
  orb.textContent = style.icon || game.icon;

  const chips = document.createElement("span");
  chips.className = "chips";
  const badge = document.createElement("span");
  badge.className = "chip";
  badge.textContent = style.badge || "Mode";
  chips.appendChild(badge);

  const name = document.createElement("h2");
  name.textContent = style.name;

  const description = document.createElement("p");
  description.textContent = style.description || "";

  card.append(orb, chips, name, description);
  if (style.link) {
    const go = document.createElement("span");
    go.className = "go";
    go.textContent = "Start →";
    card.appendChild(go);
  }
  Hub.tilt(card, 7);
  return card;
}

Promise.all([Hub.json("../data/games.json"), Hub.json("../data/board-styles.json")]).then(([games, data]) => {
  const game = games.games.find(item => item.id === selectedGameId) || games.games[0];
  const styles = data.styles.filter(style => style.gameId === game.id);

  pageTitle.textContent = data.pageTitle;
  gameName.textContent = game.name + ": " + game.tagline;
  gameIcon.textContent = game.icon;
  gameIcon.style.setProperty("--accent", game.accent);
  gameIcon.style.setProperty("--accent2", game.accent2);
  document.title = game.name + ": Choose Your Mode";

  styles.forEach(style => styleList.appendChild(buildMode(style, game)));

  Hub.anim(gameIcon, [{ transform: "scale(0) rotate(-200deg)" }, { transform: "scale(1) rotate(0)" }], { duration: 1000, easing: Hub.ease.spring, fill: "backwards" });
  Hub.stagger(styleList.children, [
    { opacity: 0, transform: "translateX(-60px) scale(0.92)" },
    { opacity: 1, transform: "none" }
  ], { each: 120, delay: 250, duration: 900, easing: Hub.ease.spring, fill: "backwards" });
});
