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
  const labels = { dashboard: "Dashboard", subjects: "Subjects", tasks: "Tasks & Exams", records: "Study Records" };
  for (const name of Object.keys(labels)) document.querySelector(`#${name}-view`).hidden = view !== name;
  document.querySelector("#current-view-label").textContent = labels[view];
  document.title = `${labels[view]} · STUDY FLOW`;
  document.querySelectorAll("[data-view]").forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  Subjects.refresh();
  if (view === "tasks") Tasks.refresh();
  if (view === "records") Records.refresh();
  if (view === "dashboard") refreshDashboardTasks();
}

document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.view));
});
Subjects.refresh();

function refreshDashboardTasks() {
  const count = document.querySelector("#pending-task-count");
  const list = document.querySelector("#upcoming-deadlines");
  const empty = document.querySelector("#upcoming-empty");
  const summary = document.querySelector("#upcoming-summary");
  const error = document.querySelector("#dashboard-tasks-error");
  list.replaceChildren();
  error.hidden = true;
  summary.hidden = true;
  try {
    const tasks = StudyStorage.getTasks();
    const today = new Date();
    count.textContent = tasks.filter(task => task.type === "task" && !task.completed).length;
    const upcoming = Tasks.sortByDate(tasks.filter(task => !task.completed && Tasks.daysUntil(task.date, today) >= 0));
    let subjects = [];
    try {
      subjects = StudyStorage.getSubjects();
    } catch (problem) {
      error.textContent = problem.message;
      error.hidden = false;
    }
    const names = new Map(subjects.map(subject => [subject.id, subject.name]));
    for (const task of upcoming.slice(0, 3)) {
      const item = document.createElement("li");
      item.className = "deadline-item";
      const content = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = task.title;
      const detail = document.createElement("p");
      detail.textContent = `${task.type === "exam" ? "Exam" : "Task"} · ${names.get(task.subjectId) || "미지정 과목"}`;
      content.append(title, detail);
      const date = document.createElement("time");
      date.dateTime = task.date;
      date.textContent = Tasks.dDayLabel(task.date, today);
      date.title = task.date;
      item.append(content, date);
      list.append(item);
    }
    list.hidden = upcoming.length === 0;
    empty.hidden = upcoming.length > 0;
    if (upcoming.length > 3) {
      summary.textContent = `Showing 3 of ${upcoming.length} upcoming deadlines`;
      summary.hidden = false;
    }
  } catch (problem) {
    count.textContent = "—";
    list.hidden = true;
    empty.hidden = true;
    error.textContent = problem.message;
    error.hidden = false;
  }
}

refreshDashboardTasks();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !document.querySelector("#dashboard-view").hidden) {
    Subjects.refresh();
    refreshDashboardTasks();
  }
});
