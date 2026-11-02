window.Tasks = (() => {
  const list = document.querySelector("#task-list");
  const empty = document.querySelector("#tasks-empty");
  const error = document.querySelector("#tasks-error");
  const dialog = document.querySelector("#task-dialog");
  const form = document.querySelector("#task-form");
  const formError = document.querySelector("#task-form-error");
  const titleInput = document.querySelector("#task-title");
  const dateInput = document.querySelector("#task-date");
  const subjectSelect = document.querySelector("#task-subject");
  const notice = document.querySelector("#task-subject-notice");
  const buttons = [document.querySelector("#add-task"), document.querySelector("#add-exam")];
  let trigger = buttons[0];
  let editingId = null;
  let deletingId = null;
  const deleteDialog = document.querySelector("#delete-task-dialog");
  const deleteError = document.querySelector("#delete-task-error");

  function action(label, task, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button ${label === "Delete" ? "button-delete" : "button-secondary"}`;
    button.textContent = label;
    button.dataset.taskAction = label.toLowerCase();
    button.dataset.taskId = task.id;
    button.setAttribute("aria-label", `${label} ${task.title}`);
    button.addEventListener("click", () => handler(task, button));
    return button;
  }

  function subjects() {
    try {
      notice.hidden = true;
      return StudyStorage.getSubjects();
    } catch (problem) {
      notice.textContent = `${problem.message} You can still add an unassigned task or exam.`;
      notice.hidden = false;
      return [];
    }
  }

  // Compare calendar dates, not elapsed local hours (which can vary with DST).
  function daysUntil(date, today = new Date()) {
    const localDay = new Date(0);
    localDay.setUTCFullYear(today.getFullYear(), today.getMonth(), today.getDate());
    localDay.setUTCHours(0, 0, 0, 0);
    return Math.round((new Date(`${date}T00:00:00Z`).getTime() - localDay.getTime()) / 86400000);
  }

  function sortByDate(tasks) {
    return tasks.map((task, index) => ({ task, index }))
      .sort((a, b) => a.task.date.localeCompare(b.task.date) || a.index - b.index)
      .map(item => item.task);
  }

  function dDayLabel(date, today = new Date()) {
    const days = daysUntil(date, today);
    return days === 0 ? "D-Day" : days > 0 ? `D-${days}` : `D+${-days}`;
  }

  function toggleCompleted(task) {
    try {
      StudyStorage.setTaskCompleted(task.id, !task.completed);
      refresh();
      const button = [...list.querySelectorAll('[data-task-action="complete"]')].find(button => button.dataset.taskId === task.id);
      if (button) button.focus();
      document.querySelector("#tasks-status").textContent = `${task.title} marked ${task.completed ? "incomplete" : "completed"}.`;
    } catch (problem) {
      error.textContent = problem.message;
      error.hidden = false;
    }
  }

  function refresh() {
    try {
      const tasks = sortByDate(StudyStorage.getTasks());
      const names = new Map(subjects().map(subject => [subject.id, subject.name]));
      list.replaceChildren();
      for (const task of tasks) {
        const card = document.createElement("li");
        const days = daysUntil(task.date);
        card.className = `panel task-card${task.completed ? " is-completed" : days < 0 ? " is-overdue" : ""}`;
        const state = document.createElement("p");
        state.className = "task-state";
        const dDay = dDayLabel(task.date);
        state.textContent = `${task.completed ? "Completed" : days < 0 ? "Overdue" : "Incomplete"} · ${dDay}`;
        const badge = document.createElement("span");
        badge.className = `task-type ${task.type}`;
        badge.textContent = task.type === "exam" ? "Exam" : "Task";
        const heading = document.createElement("h2");
        heading.textContent = task.title;
        const date = document.createElement("time");
        date.dateTime = task.date;
        date.textContent = task.date;
        const subject = document.createElement("p");
        subject.className = "task-subject";
        subject.textContent = names.get(task.subjectId) || "미지정 과목";
        card.append(badge, heading, state, date, subject);
        if (task.description) {
          const description = document.createElement("p");
          description.className = "task-description";
          description.textContent = task.description;
          card.append(description);
        }
        const actions = document.createElement("div");
        actions.className = "subject-actions";
        actions.append(action("Edit", task, (item, button) => openEditor(item.type, item, button)), action("Delete", task, openDelete));
        const completion = action(task.completed ? "Mark Incomplete" : "Mark Complete", task, toggleCompleted);
        completion.dataset.taskAction = "complete";
        completion.setAttribute("aria-pressed", String(task.completed));
        actions.prepend(completion);
        card.append(actions);
        list.append(card);
      }
      empty.hidden = tasks.length > 0;
      error.hidden = true;
      buttons.forEach(button => { button.disabled = false; });
    } catch (problem) {
      error.textContent = problem.message;
      error.hidden = false;
      empty.hidden = true;
      buttons.forEach(button => { button.disabled = true; });
    }
  }

  function openEditor(type, task = null, button = buttons[0]) {
    trigger = button;
    editingId = task ? task.id : null;
    form.reset();
    formError.hidden = true;
    titleInput.removeAttribute("aria-invalid");
    dateInput.removeAttribute("aria-invalid");
    document.querySelector("#task-dialog-title").textContent = task ? "Edit task or exam" : "Add a task or exam";
    form.querySelector('[type="submit"]').textContent = task ? "Save Changes" : "Add to Schedule";
    document.querySelector("#task-type").value = type;
    subjectSelect.replaceChildren(new Option("미지정 과목", ""));
    subjects().forEach(subject => subjectSelect.add(new Option(subject.name, subject.id)));
    if (task) {
      titleInput.value = task.title;
      dateInput.value = task.date;
      document.querySelector("#task-description").value = task.description;
      if (task.subjectId !== null && ![...subjectSelect.options].some(option => option.value === task.subjectId)) {
        subjectSelect.add(new Option("미지정 과목 (기존 연결)", task.subjectId));
      }
      subjectSelect.value = task.subjectId || "";
    }
    dialog.showModal();
    titleInput.focus();
  }

  function openDelete(task, button) {
    deletingId = task.id;
    trigger = button;
    deleteError.hidden = true;
    document.querySelector("#delete-task-description").textContent = `Delete “${task.title}”? This cannot be undone.`;
    deleteDialog.showModal();
    document.querySelector("#cancel-delete-task").focus();
  }
  function restoreFocus() { (trigger.isConnected ? trigger : buttons[0]).focus(); }
  buttons.forEach((button, index) => button.addEventListener("click", () => openEditor(index === 0 ? "task" : "exam", null, button)));
  document.querySelector("#cancel-task").addEventListener("click", () => dialog.close());
  document.querySelector("#cancel-delete-task").addEventListener("click", () => deleteDialog.close());
  dialog.addEventListener("close", () => { editingId = null; restoreFocus(); });
  deleteDialog.addEventListener("close", () => { deletingId = null; restoreFocus(); });
  document.querySelector("#confirm-delete-task").addEventListener("click", () => {
    try {
      const task = StudyStorage.deleteTask(deletingId);
      refresh();
      trigger = buttons[0];
      deleteDialog.close();
      document.querySelector("#tasks-status").textContent = `${task.title} deleted.`;
    } catch (problem) {
      deleteError.textContent = problem.message;
      deleteError.hidden = false;
    }
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    titleInput.removeAttribute("aria-invalid");
    dateInput.removeAttribute("aria-invalid");
    if (!titleInput.value.trim() || !dateInput.value || !dateInput.validity.valid) {
      const input = !titleInput.value.trim() ? titleInput : dateInput;
      formError.textContent = input === titleInput ? "Please enter a title." : "Please choose a valid date.";
      formError.hidden = false;
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    try {
      const editing = editingId !== null;
      const values = {
        type: document.querySelector("#task-type").value,
        title: titleInput.value,
        description: document.querySelector("#task-description").value,
        date: dateInput.value,
        subjectId: subjectSelect.value || null,
      };
      const task = editing ? StudyStorage.updateTask(editingId, values) : StudyStorage.addTask(values);
      refresh();
      trigger = [...list.querySelectorAll('[data-task-action="edit"]')].find(button => button.dataset.taskId === task.id) || buttons[0];
      dialog.close();
      document.querySelector("#tasks-status").textContent = `${task.title} ${editing ? "updated" : "added"}.`;
    } catch (problem) {
      formError.textContent = problem.message;
      formError.hidden = false;
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !document.querySelector("#tasks-view").hidden) refresh();
  });
  return { refresh, daysUntil, dDayLabel, sortByDate };
})();
