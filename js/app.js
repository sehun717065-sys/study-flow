const dateLabel = document.querySelector("#current-date");

function refreshDashboardDate(currentDate) {
  if (!dateLabel) return;
  dateLabel.dateTime = StudyStorage.localDate(currentDate);
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
  if (view === "dashboard") {
    refreshDashboardTasks();
    refreshDashboardStudy();
    refreshDashboardRecent();
    refreshDashboardWeek();
  }
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

function renderDashboardStudyValue(element, seconds) {
  element.dataset.seconds = seconds;
  element.setAttribute("aria-label", `${seconds.toLocaleString()} seconds of saved study time`);
  element.title = `${seconds.toLocaleString()} seconds`;
  if (seconds > 0 && seconds < 60) {
    element.textContent = `Less than 1m (${seconds}s)`;
    return;
  }
  const hours = document.createTextNode(String(Math.floor(seconds / 3600)));
  const hourUnit = document.createElement("span");
  hourUnit.className = "stat-unit";
  hourUnit.textContent = "h ";
  const minutes = document.createElement("span");
  minutes.className = "stat-minutes";
  minutes.textContent = String(Math.floor(seconds / 60) % 60).padStart(2, "0");
  const minuteUnit = document.createElement("span");
  minuteUnit.className = "stat-unit";
  minuteUnit.textContent = "m";
  element.replaceChildren(hours, hourUnit, minutes, minuteUnit);
}

function refreshDashboardStudy() {
  const now = new Date();
  const today = StudyStorage.localDate(now);
  refreshDashboardDate(now);
  const todayValue = document.querySelector("#dashboard-today-time");
  const totalValue = document.querySelector("#dashboard-total-time");
  const error = document.querySelector("#dashboard-study-error");
  document.querySelector("#dashboard-study-date").textContent = `Saved today · ${today}`;
  try {
    const records = StudyStorage.getRecords();
    const stats = StudyStats.summarize(records, today);
    renderDashboardStudyValue(todayValue, stats.daily);
    renderDashboardStudyValue(totalValue, stats.total);
    error.hidden = true;
  } catch (problem) {
    for (const element of [todayValue, totalValue]) {
      element.textContent = "—";
      delete element.dataset.seconds;
      element.removeAttribute("title");
      element.setAttribute("aria-label", "Saved study time unavailable");
    }
    error.textContent = problem.message;
    error.hidden = false;
  }
}

function refreshDashboardRecent() {
  const list = document.querySelector("#dashboard-recent-list");
  const empty = document.querySelector("#dashboard-recent-empty");
  const recordsError = document.querySelector("#dashboard-recent-records-error");
  const subjectsError = document.querySelector("#dashboard-recent-subjects-error");
  list.replaceChildren();
  list.hidden = true;
  empty.hidden = true;
  recordsError.hidden = subjectsError.hidden = true;
  try {
    const records = StudyStats.sortRecordsByDate(StudyStorage.getRecords()).slice(0, 3);
    if (!records.length) { empty.hidden = false; return; }
    let subjects = null;
    try { subjects = StudyStorage.getSubjects(); }
    catch (problem) { subjectsError.textContent = problem.message; subjectsError.hidden = false; }
    const names = new Map((subjects || []).map(subject => [subject.id, subject.name]));
    for (const record of records) {
      const item = document.createElement("li");
      item.dataset.recordId = record.id;
      const title = document.createElement("h3");
      title.textContent = subjects === null ? "과목 정보 확인 불가" : (names.get(record.subjectId) || "미지정 과목");
      const details = document.createElement("p");
      const date = document.createElement("time");
      date.dateTime = date.textContent = record.date;
      const duration = document.createElement("span");
      duration.className = "recent-session-duration";
      duration.textContent = StudyStats.formatDuration(record.durationSeconds);
      duration.setAttribute("aria-label", `${record.durationSeconds.toLocaleString()} seconds`);
      details.append(date, ` · ${record.source === "manual" ? "Manual" : "Stopwatch"}`);
      item.append(title, details, duration);
      list.append(item);
    }
    list.hidden = false;
  } catch (problem) {
    list.replaceChildren();
    list.hidden = true;
    empty.hidden = true;
    recordsError.textContent = problem.message;
    recordsError.hidden = false;
  }
}

function refreshDashboardWeek() {
  const content = document.querySelector("#dashboard-week-content");
  const error = document.querySelector("#dashboard-week-error");
  const range = document.querySelector("#dashboard-week-range");
  const total = document.querySelector("#dashboard-week-total");
  const days = document.querySelector("#dashboard-week-days");
  const points = document.querySelector("#dashboard-week-points");
  const detail = document.querySelector("#dashboard-week-detail");
  try {
    const activity = StudyStats.weeklyActivity(StudyStorage.getRecords(), StudyStorage.localDate());
    const maximum = Math.max(...activity.days.map(day => day.seconds));
    const scale = maximum || 1;
    const coordinates = activity.days.map((day, index) => [(index + 0.5) * 720 / 7, 158.5 - day.seconds / scale * 144]);
    const path = coordinates.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(" ");
    document.querySelector(".weekly-chart .chart-zero-line").setAttribute("d", path);
    document.querySelector(".weekly-chart .chart-area").setAttribute("d", `${path} L${coordinates[6][0]} 158.5 L${coordinates[0][0]} 158.5 Z`);
    const axisLabel = seconds => {
      const divisor = seconds >= 3600 ? 3600 : seconds >= 60 ? 60 : 1;
      return `${(seconds / divisor).toLocaleString("en", { maximumSignificantDigits: 3 })}${divisor === 3600 ? "h" : divisor === 60 ? "m" : "s"}`;
    };
    document.querySelectorAll(".chart-y-labels span").forEach((label, index) => {
      label.textContent = maximum ? axisLabel(maximum * (3 - index) / 3) : "0";
    });
    range.textContent = `${activity.start} – ${activity.end} · Local current week`;
    total.textContent = `Weekly total · ${StudyStats.formatDuration(activity.total)}`;
    total.dataset.seconds = activity.total;
    days.replaceChildren();
    points.replaceChildren();
    activity.days.forEach((day, index) => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.classList.add("chart-dot");
      circle.setAttribute("cx", coordinates[index][0]);
      circle.setAttribute("cy", coordinates[index][1]);
      circle.setAttribute("r", "4");
      points.append(circle);
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.seconds = day.seconds;
      button.dataset.date = day.date;
      const label = `${day.weekday} · ${day.date} · ${StudyStats.formatDuration(day.seconds)} (${day.seconds.toLocaleString()} seconds)`;
      button.setAttribute("aria-label", label);
      for (const text of [day.weekday, day.date.slice(5), StudyStats.formatDuration(day.seconds)]) {
        const span = document.createElement("span");
        span.textContent = text;
        button.append(span);
      }
      const select = () => {
        detail.textContent = label;
        [...days.children].forEach(item => item.setAttribute("aria-pressed", String(item === button)));
        [...points.children].forEach((point, i) => point.setAttribute("r", i === index ? "6" : "4"));
      };
      button.addEventListener("mouseenter", select);
      button.addEventListener("focus", select);
      button.addEventListener("click", select);
      days.append(button);
    });
    days.children[0].click();
    document.querySelector("#dashboard-week-empty").hidden = activity.total !== 0;
    error.hidden = true;
    content.hidden = false;
  } catch (problem) {
    content.hidden = true;
    range.textContent = "";
    total.textContent = "Weekly study time unavailable";
    delete total.dataset.seconds;
    error.textContent = problem.message;
    error.hidden = false;
  }
}

refreshDashboardTasks();
refreshDashboardStudy();
refreshDashboardRecent();
refreshDashboardWeek();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !document.querySelector("#dashboard-view").hidden) {
    Subjects.refresh();
    refreshDashboardTasks();
    refreshDashboardStudy();
    refreshDashboardRecent();
    refreshDashboardWeek();
  }
});
