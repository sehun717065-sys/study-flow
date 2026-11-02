window.Subjects = (() => {
  const list = document.querySelector("#subject-list");
  const empty = document.querySelector("#subjects-empty");
  const error = document.querySelector("#storage-error");
  const addButton = document.querySelector("#add-subject");
  const dialog = document.querySelector("#subject-dialog");
  const form = document.querySelector("#subject-form");
  const nameInput = document.querySelector("#subject-name");
  const colorInput = document.querySelector("#subject-color");
  const formError = document.querySelector("#subject-form-error");
  const deleteDialog = document.querySelector("#delete-subject-dialog");
  const deleteError = document.querySelector("#delete-subject-error");
  let editingId = null;
  let deletingId = null;
  let returnFocus = addButton;

  function actionButton(label, subject, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button ${label === "Delete" ? "button-delete" : "button-secondary"}`;
    button.textContent = label;
    button.dataset.action = label.toLowerCase();
    button.dataset.subjectId = subject.id;
    button.setAttribute("aria-label", `${label} ${subject.name}`);
    button.addEventListener("click", () => handler(subject, button));
    return button;
  }

  function refresh() {
    try {
      const subjects = StudyStorage.getSubjects();
      list.replaceChildren();
      for (const subject of subjects) {
        const item = document.createElement("li");
        item.className = "panel subject-card";
        const color = document.createElement("span");
        color.className = "subject-color";
        color.style.backgroundColor = subject.color;
        color.setAttribute("aria-hidden", "true");
        const heading = document.createElement("h2");
        heading.textContent = subject.name;
        const date = document.createElement("p");
        date.textContent = `Added ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(subject.createdAt))}`;
        const actions = document.createElement("div");
        actions.className = "subject-actions";
        actions.append(actionButton("Edit", subject, openEditor), actionButton("Delete", subject, openDelete));
        item.append(color, heading, date, actions);
        list.append(item);
      }
      empty.hidden = subjects.length > 0;
      error.hidden = true;
      addButton.disabled = false;
      document.querySelector("#subject-count").textContent = subjects.length;
      return true;
    } catch (problem) {
      error.textContent = problem.message;
      error.hidden = false;
      empty.hidden = true;
      addButton.disabled = true;
      document.querySelector("#subject-count").textContent = "—";
      return false;
    }
  }

  function openEditor(subject = null, trigger = addButton) {
    editingId = subject ? subject.id : null;
    returnFocus = trigger;
    form.reset();
    nameInput.value = subject ? subject.name : "";
    colorInput.value = subject ? subject.color : "#567ce8";
    document.querySelector("#subject-dialog-title").textContent = subject ? "Edit subject" : "Add a subject";
    form.querySelector('[type="submit"]').textContent = subject ? "Save Changes" : "Add Subject";
    formError.hidden = true;
    nameInput.removeAttribute("aria-invalid");
    dialog.showModal();
    nameInput.focus();
  }

  function openDelete(subject, trigger) {
    deletingId = subject.id;
    returnFocus = trigger;
    document.querySelector("#delete-subject-description").textContent = `Delete “${subject.name}”? This cannot be undone.`;
    deleteError.hidden = true;
    deleteDialog.showModal();
    document.querySelector("#cancel-delete-subject").focus();
  }

  function restoreFocus() {
    (returnFocus.isConnected ? returnFocus : addButton).focus();
  }
  dialog.addEventListener("close", () => { editingId = null; restoreFocus(); });
  deleteDialog.addEventListener("close", () => { deletingId = null; restoreFocus(); });
  addButton.addEventListener("click", () => openEditor());
  document.querySelector("#cancel-subject").addEventListener("click", () => dialog.close());
  document.querySelector("#cancel-delete-subject").addEventListener("click", () => deleteDialog.close());

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!nameInput.value.trim()) {
      formError.textContent = "Please enter a subject name.";
      formError.hidden = false;
      nameInput.setAttribute("aria-invalid", "true");
      nameInput.focus();
      return;
    }
    try {
      const editing = editingId !== null;
      const subject = editing ? StudyStorage.updateSubject(editingId, nameInput.value, colorInput.value) :
        StudyStorage.addSubject(nameInput.value, colorInput.value);
      refresh();
      returnFocus = [...list.querySelectorAll('[data-action="edit"]')].find(button => button.dataset.subjectId === subject.id) || addButton;
      dialog.close();
      document.querySelector("#subject-status").textContent = `${subject.name} ${editing ? "updated" : "added"}.`;
    } catch (problem) {
      formError.textContent = problem.message;
      formError.hidden = false;
    }
  });

  document.querySelector("#confirm-delete-subject").addEventListener("click", () => {
    try {
      const subject = StudyStorage.deleteSubject(deletingId);
      refresh();
      returnFocus = addButton;
      deleteDialog.close();
      document.querySelector("#subject-status").textContent = `${subject.name} deleted.`;
    } catch (problem) {
      deleteError.textContent = problem.message;
      deleteError.hidden = false;
    }
  });
  return { refresh };
})();
