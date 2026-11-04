const pageTitle = document.getElementById("pageTitle");
const leaderboard = document.getElementById("leaderboard");
const tableHeader = document.getElementById("tableHeader");
const database_key = "ISU_Leaderboard";



function render(scores){
    leaderboard.replaceChildren();
    scores
        .sort((first,second) => second.score - first.score)
        .forEach((entry, index) => {
          const row = document.createElement("tr");
          const rank = document.createElement("td");
          const score = document.createElement("td");

          rank.textContent = index + 1;
          score.textContent = `$${entry.score.toLocaleString()}`;

          row.append(rank, score);
          leaderboard.appendChild(row);
        })
}
  fetch("../data/leaderboard.json")
  .then(response => response.json())
  .then(data => {
    pageTitle.textContent = data.pageTitle;

    data.columns.forEach(name => {
      const th = document.createElement("th");
      th.textContent = name;
      tableHeader.appendChild(th);
    });

    const saved = localStorage.getItem(database_key);
    const scores = saved ? JSON.parse(saved) : data.scores;

    if(!saved){
        localStorage.setItem(database_key, JSON.stringify(scores));
    }

    render(scores);
   
      });

