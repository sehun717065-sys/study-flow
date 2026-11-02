const dateLabel = document.querySelector("#current-date");

if (dateLabel) {
  const currentDate = new Date();
  dateLabel.dateTime = currentDate.toISOString().slice(0, 10);
  dateLabel.textContent = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(currentDate).toUpperCase();
}

function showView(view) {
  document.querySelector("#dashboard-view").hidden = view !== "dashboard";
  document.querySelector("#subjects-view").hidden = view !== "subjects";
  document.querySelector("#current-view-label").textContent = view === "subjects" ? "Subjects" : "Dashboard";
  document.title = `${view === "subjects" ? "Subjects" : "Dashboard"} · STUDY FLOW`;
  document.querySelectorAll("[data-view]").forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  Subjects.refresh();
}

document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.view));
});
Subjects.refresh();
