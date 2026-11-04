const styleList = document.getElementById("styleList");
const pageTitle = document.getElementById("pageTitle");
const selectedGameId = new URLSearchParams(window.location.search).get("game");

fetch("../data/board-styles.json")
  .then(response => response.json())
  .then(data => {
    pageTitle.textContent = data.pageTitle;
    const styles = data.styles.filter(style => style.gameId === selectedGameId);
    styles.forEach(style => {
      const button = document.createElement(style.link ? "a" : "button");
      button.className = "choice-button";
      if (style.link) {
        button.href = style.link;
      } else {
        button.type = "button";
        button.disabled = true;
      }
      button.textContent = style.name;
      styleList.appendChild(button);
    });
  });
