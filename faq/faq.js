const accordion = document.getElementById("faqAccordion");
const pageTitle = document.getElementById("pageTitle");

// Smoothly grows and shrinks the answer when a question is opened or closed.
function wire(item, body) {
  const summary = item.querySelector("summary");
  summary.addEventListener("click", event => {
    event.preventDefault();
    if (item.open) {
      const height = body.offsetHeight;
      Hub.anim(body, [{ height: height + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 280, easing: Hub.ease.inOut }).finished.then(() => { item.open = false; });
    } else {
      item.open = true;
      const height = body.scrollHeight;
      Hub.anim(body, [{ height: "0px", opacity: 0 }, { height: height + "px", opacity: 1 }], { duration: 420, easing: Hub.ease.out, fill: "backwards" });
    }
  });
}

Hub.json("../data/faq.json").then(data => {
  pageTitle.textContent = data.pageTitle;
  data.questions.forEach(entry => {
    const item = document.createElement("details");
    item.className = "accordion-item";

    const summary = document.createElement("summary");
    summary.textContent = entry.question;

    const answer = document.createElement("div");
    answer.className = "accordion-body";
    answer.textContent = entry.answer;

    item.append(summary, answer);
    accordion.appendChild(item);
    wire(item, answer);
  });

  Hub.stagger(accordion.children, [{ opacity: 0, transform: "translateY(30px)" }, { opacity: 1, transform: "none" }], { each: 70, duration: 700, easing: Hub.ease.spring, fill: "backwards" });
});
