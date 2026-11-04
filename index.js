const title = document.getElementById("welcomeTitle");
const playLink = document.getElementById("playLink");

fetch("data/index.json")
  .then(response => response.json())
  .then(data => {
    title.textContent = data.title;
    playLink.textContent = data.buttonLabel;
  });
