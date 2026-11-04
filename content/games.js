const gameList = document.getElementById("gameList");
const pageTitle = document.getElementById("pageTitle");

fetch("../data/games.json")
  .then(response => response.json())
  .then(data => {
    pageTitle.textContent = data.pageTitle;
    data.games.forEach(game => {
      const button = document.createElement("a");
      button.className = "choice-button";
      button.href = game.link;
      button.textContent = game.name;
      gameList.appendChild(button);
    });
  });
