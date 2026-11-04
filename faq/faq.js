const accordion = document.getElementById("faqAccordion");
const pageTitle = document.getElementById("pageTitle");

fetch("../data/faq.json")
  .then(response => response.json())
  .then(data => {
    pageTitle.textContent = data.pageTitle;
    data.questions.forEach((item, index) => {
      const section = document.createElement("div");
      section.className = "accordion-item";

      const heading = document.createElement("h2");
      heading.className = "accordion-header";

      const button = document.createElement("button");
      button.className = "accordion-button collapsed";
      button.type = "button";
      button.setAttribute("data-bs-toggle", "collapse");
      button.setAttribute("data-bs-target", `#faqAnswer${index}`);
      button.textContent = item.question;

      const answerPanel = document.createElement("div");
      answerPanel.id = `faqAnswer${index}`;
      answerPanel.className = "accordion-collapse collapse";
      answerPanel.setAttribute("data-bs-parent", "#faqAccordion");

      const answer = document.createElement("div");
      answer.className = "accordion-body";
      answer.textContent = item.answer;

      answerPanel.appendChild(answer);
      heading.appendChild(button);
      section.append(heading, answerPanel);
      accordion.appendChild(section);
    });
  });
