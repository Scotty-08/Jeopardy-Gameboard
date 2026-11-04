const authorList = document.getElementById("authors");
const courseName = document.getElementById("courseName");
const pageTitle = document.getElementById("pageTitle");

fetch("../data/authors.json")
  .then(response => response.json())
  .then(data => {
    pageTitle.textContent = data.pageTitle;
    courseName.textContent = data.course;
    data.authors.forEach(author => {
      const card = document.createElement("article");
      card.className = "author";

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.textContent = author.initials;

      const name = document.createElement("h2");
      name.textContent = author.name;

      const email = document.createElement("p");
      email.textContent = author.email;

      const bio = document.createElement("p");
      bio.textContent = author.bio;

      card.append(avatar, name, email, bio);
      authorList.appendChild(card);
    });
  });
