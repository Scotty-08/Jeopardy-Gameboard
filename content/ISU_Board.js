
const board = document.getElementById("ISU_gameBoard");
const team1ScoreDisplay = document.getElementById("team1Score");
const team2ScoreDisplay = document.getElementById("team2Score");
const newGameButton = document.getElementById("newGame");
const howToPlayButton = document.getElementById("howToPlay");
const boardTitle = document.getElementById("boardTitle");
const questionDialog = document.getElementById("questionDialog");
const dialogTitle = document.getElementById("dialogTitle");
const dialogQuestion = document.getElementById("dialogQuestion");
const awardTeamAButton = document.getElementById("awardTeamA");
const awardTeamBButton = document.getElementById("awardTeamB");
const closeDialogButton = document.getElementById("closeDialog");
const revealAnswerButton = document.getElementById("revealAnswer");
const answerSection = document.getElementById("answerSection");
const dialogAnswer = document.getElementById("dialogAnswer");
const noPointsButton = document.getElementById("noPoints");
const roundResult = document.getElementById("roundResult");
const dialogAnswerImage = document.getElementById("dialogAnswerImage");

//Stores scores of teams
const teamScores = {
  A: 0,
  B: 0
};
//Holds data from the questions file
let gameData;
//Updates score on webpage when a team gains points
function updateScores() {
  team1ScoreDisplay.textContent = "$" + teamScores.A;
  team2ScoreDisplay.textContent = "$" + teamScores.B;
}
//Keeps track of current quetstion
let currentQuestion = null;
let currentTile = null;
function openDialog(title, message){
  dialogTitle.textContent = title;
  dialogQuestion.textContent = message;

  //Hide answer and prior round 
  answerSection.hidden = true;
  roundResult.hidden = true;
  roundResult.textContent = "";
  revealAnswerButton.hidden = false;

  //Enables scoring buttons for question
  awardTeamAButton.disabled = false;
  awardTeamBButton.disabled = false;
  noPointsButton.disabled = false;
  
  dialogAnswerImage.removeAttribute("src");
  dialogAnswerImage.hidden = true;

  if(!questionDialog.open){
    questionDialog.showModal();
  }
}
//Reveals answer when the button is clicked
revealAnswerButton.addEventListener("click", () =>{
  if(!currentQuestion){
    return;
  }
  
  //Gets the correct answer for the questions
  const answer = currentQuestion.answer ?? currentQuestion.correctAnswer;

  dialogAnswer.textContent = answer;

  const imagePath = currentQuestion.image;

  if (imagePath) {
    dialogAnswerImage.src = imagePath;
    dialogAnswerImage.alt = `Image related to: ${answer}`;
    dialogAnswerImage.hidden = false;
  } else {
    dialogAnswerImage.removeAttribute("src");
    dialogAnswerImage.alt = "";
    dialogAnswerImage.hidden = true;
  }

  answerSection.hidden = false;
  revealAnswerButton.hidden = true;
});
//Closes dialog when button is clicked
closeDialogButton.addEventListener("click", ()=>{
  currentQuestion = null;
  currentTile = null;
  questionDialog.close();
});

//For the add points to team A or B button call this to add points
window.addPointsToTeam = function (team, points) {
  if (!Object.hasOwn(teamScores, team) || !Number.isFinite(points)) {
    return;
  }

  teamScores[team] += points;
  updateScores();
};

//Awards points to winning team, and disables question afterwards
function finishQuestion(result, team = null){
  if(!currentQuestion || !currentTile){
    return;
  }

  if(team){
    addPointsToTeam(team, currentQuestion.value);
  }

   //Makes sure that the question gets fully disabled.
  roundResult.textContent =result;
  roundResult.hidden = false;
  currentTile.disabled = true;
  currentTile.textContent = "X";
  awardTeamAButton.disabled = true;
  awardTeamBButton.disabled = true;
  noPointsButton.disabled = true;

  currentQuestion = null;
  currentTile = null;
}
//Awards points to team A
awardTeamAButton.addEventListener("click", () =>{
  finishQuestion( `Team A gets $${currentQuestion?.value ?? 0} points.`,
    "A");
});
//Awards points to team B
awardTeamBButton.addEventListener("click", () =>{
   finishQuestion( `Team B gets $${currentQuestion?.value ?? 0} points.`,
    "B");
});
//Awards no points
noPointsButton.addEventListener("click", () =>{
  finishQuestion("No points awarded.");
})

function renderBoard() {
  board.replaceChildren();

  gameData.categories.forEach(category => {
    const heading = document.createElement("div");
    heading.className = "category-cell";
    heading.textContent = category.name;
    board.appendChild(heading);
  });

  const values = [100, 200, 300, 400];

  
  values.forEach(value => {
    gameData.categories.forEach(category => {
      const question = category.questions.find(item => item.value === value);
      const tile = document.createElement("button");
      tile.className = "question-cell";
      tile.type = "button";
      tile.textContent = "$" + value;
      tile.disabled = !question;

      //Use this for the Click event to get what tile: question and value was.
      if (question) {
       tile.dataset.questionId = question.id;
       tile.dataset.value = question.value;
       tile.dataset.category = category.name;

       tile.addEventListener("click", ()=> {
        currentQuestion = question;
        currentTile = tile;

        const questionText = 
        question.txt ?? question.question ?? question.prompt;

       openDialog(
        `${category.name} ($${question.value})`,
           questionText,
          true
          );
       });
      }

      board.appendChild(tile);
    });
  });
}

const database_key = "ISU_Leaderboard";

function saveScore(score) {
  const saved = JSON.parse(localStorage.getItem(database_key)) || [];
  saved.push({ score });
  saved.sort((first, second) => second.score - first.score);
  localStorage.setItem(database_key, JSON.stringify(saved.slice(0, 10)));
}


//This resets the game. Add any other reset logic here if needed.
function startNewGame() {
  const finalScore = Math.max(teamScores.A, teamScores.B);
  
  if(finalScore > 0){
    saveScore(finalScore);
  }

  teamScores.A = 0;
  teamScores.B = 0;
  updateScores();

  currentQuestion = null;
  currentTile = null;

  if(questionDialog.open){
    questionDialog.close();
  }

  if (gameData) {
    renderBoard();
  }
}

//Event listeners for the buttons
newGameButton.addEventListener("click", startNewGame);
howToPlayButton.addEventListener("click", () => {
  currentQuestion = null;
  currentTile = null;
  //Instructions on how to play
  openDialog(
    "How to Play",
    "Choose a category and a value underneath it to reveal a question.\n" + 
    "Question difficulty increases with value.\n" + 
    "After it is answered correctly, points go to either team A or B.\n" + 
    "Each question can only be scored once, to reset the game, click New Game.", 
    false
);
});

//Load this game's question data, then build the board from it.
fetch("../data/questions.json")
  .then(response => {
    if (!response.ok) {
      throw new Error(`Could not load questions.json (${response.status})`);
    }
    return response.json();
  })
  .then(data => {
    gameData = data;
    boardTitle.textContent = data.pageTitle;
    renderBoard();
  })
  .catch(error => {
    console.error(error);
  });

updateScores();
