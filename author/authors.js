const pageTitle = document.getElementById("pageTitle");
const intro = document.getElementById("intro");
const hubList = document.getElementById("hubAuthors");
const boardTitle = document.getElementById("boardTitle");
const boardIntro = document.getElementById("boardIntro");
const boardList = document.getElementById("boardAuthors");

function addCards(list, people) {
  people.forEach(author => {
    const card = document.createElement("article");
    card.className = "author card";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = author.initials;

    const name = document.createElement("h3");
    name.textContent = author.name;

    const email = document.createElement("p");
    const mail = document.createElement("a");
    mail.href = "mailto:" + author.email;
    mail.textContent = author.email;
    email.appendChild(mail);

    const bio = document.createElement("p");
    bio.textContent = author.bio;

    card.append(avatar, name, email, bio);
    Hub.tilt(card, 6);
    list.appendChild(card);
  });
  Hub.stagger(list.children, [
    { opacity: 0, transform: "translateY(50px) rotateY(-30deg)" },
    { opacity: 1, transform: "none" }
  ], { each: 150, duration: 1000, easing: Hub.ease.spring, fill: "backwards" });
}

Hub.json("../data/authors.json").then(data => {
  pageTitle.textContent = data.pageTitle;
  intro.textContent = data.intro;
  boardTitle.textContent = data.boardTitle;
  boardIntro.textContent = data.boardIntro;
  addCards(hubList, data.hub);
  addCards(boardList, data.board);
});
