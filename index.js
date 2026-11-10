const title = document.getElementById("welcomeTitle");
const playLink = document.getElementById("playLink");
const eyebrow = document.getElementById("eyebrow");
const tagline = document.getElementById("tagline");
const stats = document.getElementById("stats");
const funnel = document.getElementById("funnel");
const orbit = document.getElementById("orbit");

// Stacked, swaying rings make a tornado funnel (a nod to the Cyclones).
function buildFunnel() {
  const layers = 15;
  for (let i = 0; i < layers; i++) {
    const ring = document.createElement("i");
    const width = 440 - i * 26;
    ring.style.width = width + "px";
    ring.style.height = Math.round(width * 0.26) + "px";
    ring.style.top = i * 7 + "%";
    ring.style.opacity = String(1 - i * 0.03);
    ring.style.animationDelay = i * -0.17 + "s";
    ring.style.animationDuration = 2.2 + i * 0.06 + "s";
    funnel.appendChild(ring);
  }
}

function buildOrbit(games) {
  const radius = Math.min(orbit.clientWidth, 520) / 2 - 38;
  games.forEach((game, i) => {
    const link = document.createElement("a");
    link.href = "content/" + game.link;
    link.dataset.name = game.name;
    link.setAttribute("aria-label", "Play " + game.name);
    link.style.setProperty("--accent", game.accent);
    link.style.setProperty("--ang", (360 / games.length) * i - 90 + "deg");
    link.style.setProperty("--rad", radius + "px");
    const icon = document.createElement("span");
    icon.textContent = game.icon;
    link.appendChild(icon);
    orbit.appendChild(link);
  });
  Hub.stagger(orbit.children, [{ opacity: 0, scale: "0.2" }, { opacity: 1, scale: "1" }], { each: 120, delay: 700, duration: 900, easing: Hub.ease.spring });
}

function showStats(gameCount) {
  const info = Hub.levelInfo(Hub.store.get().xp);
  const data = Hub.store.get();
  [["Level", info.level], ["XP", data.xp], ["Games played", data.plays], ["Games in the hub", gameCount]].forEach(([label, value]) => {
    const item = document.createElement("li");
    const number = document.createElement("b");
    const caption = document.createElement("span");
    number.textContent = "0";
    caption.textContent = label;
    item.append(number, caption);
    stats.appendChild(item);
    Hub.countTo(number, Number(value), { from: 0, ms: 1200 });
  });
  Hub.stagger(stats.children, [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }], { each: 90, delay: 900, duration: 700 });
}

// Rotates through the taglines with a typewriter effect.
async function cycleTaglines(lines) {
  let i = 0;
  for (;;) {
    await Hub.typewriter(tagline, lines[i % lines.length], 26);
    await Hub.sleep(2600);
    i++;
    if (Hub.reduce) return;
  }
}

buildFunnel();
function fitFunnel() { funnel.style.setProperty("--fs", String(Math.min(1, (funnel.parentElement.clientWidth - 20) / 470))); }
fitFunnel();
window.addEventListener("resize", fitFunnel);

Hub.json("data/index.json").then(data => {
  document.title = data.title;
  eyebrow.textContent = data.eyebrow;
  playLink.textContent = data.buttonLabel;
  title.textContent = data.title;

  const letters = Hub.split(title);
  Hub.stagger(letters, [
    { transform: "translateY(-120px) rotate(-24deg) scale(0.4)", opacity: 0, filter: "blur(10px)" },
    { transform: "none", opacity: 1, filter: "blur(0)" }
  ], { each: 55, duration: 1100, easing: Hub.ease.bounce });

  Hub.anim(eyebrow, [{ opacity: 0, letterSpacing: "0.6em" }, { opacity: 1, letterSpacing: "0.16em" }], { duration: 1000, delay: 200 });
  Hub.stagger([playLink, playLink.nextElementSibling], [{ opacity: 0, transform: "translateY(26px) scale(0.85)" }, { opacity: 1, transform: "none" }], { each: 120, delay: 800, duration: 800, easing: Hub.ease.spring });
  cycleTaglines(data.taglines);
});

Hub.json("data/games.json").then(data => {
  buildOrbit(data.games);
  showStats(data.games.length);
});
