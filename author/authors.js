const authorList = document.getElementById("authors");
const courseName = document.getElementById("courseName");
const pageTitle = document.getElementById("pageTitle");

Hub.json("../data/authors.json").then(data => {
  pageTitle.textContent = data.pageTitle;
  courseName.textContent = data.course;

  data.authors.forEach(author => {
    const card = document.createElement("article");
    card.className = "author card";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = author.initials;

    const name = document.createElement("h2");
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
    authorList.appendChild(card);
  });

  Hub.stagger(authorList.children, [
    { opacity: 0, transform: "translateY(50px) rotateY(-30deg)" },
    { opacity: 1, transform: "none" }
  ], { each: 150, duration: 1000, easing: Hub.ease.spring, fill: "backwards" });
});
