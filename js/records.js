window.Records = (() => {
  const select = document.querySelector("#study-subject");
  const error = document.querySelector("#stopwatch-error");
  const note = document.querySelector("#stopwatch-subject-note");
  const display = document.querySelector("#stopwatch-time");
  const status = document.querySelector("#stopwatch-status");
  const startButton = document.querySelector("#stopwatch-start");
  const pauseButton = document.querySelector("#stopwatch-pause");
  const resumeButton = document.querySelector("#stopwatch-resume");
  const stopButton = document.querySelector("#stopwatch-stop");
  const result = document.querySelector("#stopwatch-result");
  const saveButton = document.querySelector("#save-record");
  const discardDialog = document.querySelector("#discard-record-dialog");
  let pendingRecord = null;
  let saving = false;
  let state = "idle";
  let accumulatedMs = 0;
  let startedAt = null;
  let displayTimer = null;
  let sessionSubject = null;

  function elapsedMs() {
    return accumulatedMs + (state === "running" ? performance.now() - startedAt : 0);
  }

  function render() {
    display.textContent = formatTime(Math.floor(elapsedMs() / 1000));
    const label = { idle: "Not started", running: "Running", paused: "Paused", stopped: "Awaiting save" }[state];
    if (status.textContent !== label) status.textContent = label;
    status.dataset.state = state;
    startButton.hidden = startButton.disabled = state !== "idle";
    pauseButton.hidden = pauseButton.disabled = state !== "running";
    resumeButton.hidden = resumeButton.disabled = state !== "paused";
    stopButton.hidden = stopButton.disabled = !["running", "paused"].includes(state);
    result.hidden = state !== "stopped";
    saveButton.disabled = saving || !pendingRecord || pendingRecord.durationSeconds < 1;
    select.disabled = state !== "idle";
  }

  function formatTime(seconds) {
    return StudyStats.formatDuration(seconds);
  }

  // This interval only repaints; elapsed time never depends on callback counts.
  function startDisplayUpdates() {
    if (displayTimer === null) displayTimer = setInterval(render, 200);
  }

  function refresh() {
    if (state === "idle") {
      const selected = select.value;
      select.replaceChildren(new Option("Choose a subject", ""));
      try {
        const subjects = StudyStorage.getSubjects();
        subjects.forEach(subject => select.add(new Option(subject.name, subject.id)));
        select.value = subjects.some(subject => subject.id === selected) ? selected : "";
        note.textContent = subjects.length ? "Choose a subject. The selection stays locked until you save or discard the session." :
          "No subjects yet. Add a subject in Subjects before starting a session.";
      } catch (problem) {
        note.textContent = problem.message;
      }
    }
    render();
    renderHistory();
  }

  function start() {
    if (state !== "idle") return;
    try {
      const subject = StudyStorage.getSubjects().find(subject => subject.id === select.value);
      if (!subject) throw new Error("Please choose a subject before starting.");
      sessionSubject = { id: subject.id, name: subject.name };
      error.hidden = true;
      accumulatedMs = 0;
      startedAt = performance.now();
      state = "running";
      startDisplayUpdates();
      render();
      pauseButton.focus();
    } catch (problem) {
      error.textContent = problem.message;
      error.hidden = false;
      select.focus();
    }
  }

  function pause() {
    if (state !== "running") return;
    accumulatedMs = elapsedMs();
    startedAt = null;
    state = "paused";
    clearInterval(displayTimer);
    displayTimer = null;
    render();
    resumeButton.focus();
  }

  function resume() {
    if (state !== "paused") return;
    startedAt = performance.now();
    state = "running";
    startDisplayUpdates();
    render();
    pauseButton.focus();
  }

  function stop() {
    if (!["running", "paused"].includes(state)) return;
    accumulatedMs = elapsedMs();
    startedAt = null;
    state = "stopped";
    clearInterval(displayTimer);
    displayTimer = null;
    const now = new Date();
    pendingRecord = {
      id: newRecordId(),
      subjectId: sessionSubject.id,
      date: StudyStorage.localDate(now),
      durationSeconds: Math.floor(accumulatedMs / 1000),
      note: "", source: "stopwatch", createdAt: now.toISOString(),
    };
    document.querySelector("#result-description").textContent = `${sessionSubject.name} · ${formatTime(pendingRecord.durationSeconds)}`;
    error.hidden = pendingRecord.durationSeconds > 0;
    if (!error.hidden) error.textContent = "This session is shorter than one second and cannot be saved. Discard it to start again.";
    render();
    (saveButton.disabled ? document.querySelector("#discard-record") : saveButton).focus();
  }

  function reset() {
    state = "idle";
    accumulatedMs = 0;
    startedAt = null;
    sessionSubject = pendingRecord = null;
    error.hidden = true;
    refresh();
    startButton.focus();
  }

  function saveRecord() {
    if (state !== "stopped" || saving || !pendingRecord || pendingRecord.durationSeconds < 1) return;
    saving = true;
    saveButton.disabled = true;
    try {
      StudyStorage.addRecord(pendingRecord);
    } catch (problem) {
      error.textContent = problem.message;
      error.hidden = false;
      saving = false;
      render();
      return;
    }
    saving = false;
    reset();
  }

  const statsDate = document.querySelector("#stats-date");
  statsDate.value = StudyStorage.localDate();
  statsDate.addEventListener("change", () => renderHistory());

  function studyTimeLabel(seconds) {
    return seconds > 0 && seconds < 60 ? `1분 미만 (${seconds}초)` :
      `${Math.floor(seconds / 3600)}시간 ${Math.floor(seconds / 60) % 60}분`;
  }

  function showPeriodError(problem) {
    for (const period of ["daily", "weekly", "monthly"]) {
      document.querySelector(`#${period}-study-value`).textContent = "계산할 수 없음";
      document.querySelector(`#${period}-study-range`).textContent = "";
    }
    const error = document.querySelector("#study-period-error");
    error.textContent = problem.message;
    error.hidden = false;
  }

  function renderPeriods(records) {
    try {
      const stats = StudyStats.summarize(records, statsDate.value);
      for (const period of ["daily", "weekly", "monthly"]) {
        document.querySelector(`#${period}-study-value`).textContent = studyTimeLabel(stats[period]);
        const [start, end] = stats.ranges[period];
        document.querySelector(`#${period}-study-range`).textContent = start === end ? start : `${start} – ${end}`;
      }
      document.querySelector("#study-period-error").hidden = true;
    } catch (problem) { showPeriodError(problem); }
  }

  function showTotalError(problem) {
    document.querySelector("#study-total-value").textContent = "계산할 수 없음";
    document.querySelector("#study-total-detail").hidden = true;
    const totalError = document.querySelector("#study-total-error");
    totalError.textContent = problem.message;
    totalError.hidden = false;
    showPeriodError(problem);
  }

  function renderTotal(records) {
    try {
      const total = StudyStats.totalSeconds(records);
      document.querySelector("#study-total-value").textContent = studyTimeLabel(total);
      const detail = document.querySelector("#study-total-detail");
      detail.textContent = `${total.toLocaleString()}초 · 저장된 기록만 포함`;
      detail.hidden = false;
      document.querySelector("#study-total-error").hidden = true;
    } catch (problem) {
      showTotalError(problem);
    }
  }

  function showActivityError(problem) {
    document.querySelector("#weekly-activity-chart").replaceChildren();
    document.querySelector("#weekly-activity-range").textContent = "";
    document.querySelector("#weekly-activity-detail").textContent = "";
    document.querySelector("#weekly-activity-empty").hidden = true;
    const error = document.querySelector("#weekly-activity-error");
    error.textContent = problem.message;
    error.hidden = false;
  }

  function renderActivity(records) {
    try {
      const activity = StudyStats.weeklyActivity(records, statsDate.value);
      const max = Math.max(0, ...activity.days.map(day => day.seconds));
      const chart = document.querySelector("#weekly-activity-chart");
      const buttons = activity.days.map(day => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "activity-day";
        button.dataset.date = day.date;
        button.dataset.seconds = day.seconds;
        const label = `${day.weekday} · ${day.date} · ${formatTime(day.seconds)} (${day.seconds.toLocaleString()}초)`;
        button.setAttribute("aria-label", label);
        button.title = label;
        const plot = document.createElement("span");
        plot.className = "activity-plot";
        plot.setAttribute("aria-hidden", "true");
        const bar = document.createElement("span");
        bar.className = `activity-bar${day.seconds > 0 ? " has-time" : ""}`;
        bar.style.height = `${max === 0 ? 0 : day.seconds / max * 100}%`;
        plot.append(bar);
        const weekday = document.createElement("span");
        weekday.textContent = day.weekday;
        const date = document.createElement("span");
        date.className = "activity-date";
        date.textContent = day.date.split("-").slice(1).join("-");
        button.append(plot, weekday, date);
        const selectDay = () => {
          chart.querySelectorAll("button").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
          document.querySelector("#weekly-activity-detail").textContent = label;
        };
        button.addEventListener("mouseenter", selectDay);
        button.addEventListener("focus", selectDay);
        button.addEventListener("click", selectDay);
        return button;
      });
      chart.replaceChildren(...buttons);
      document.querySelector("#weekly-activity-range").textContent = `${activity.start} – ${activity.end} · Total ${formatTime(activity.total)}`;
      document.querySelector("#weekly-activity-empty").hidden = activity.total !== 0;
      document.querySelector("#weekly-activity-error").hidden = true;
      const selected = buttons.find(button => button.dataset.date === statsDate.value) || buttons[0];
      selected.click();
    } catch (problem) { showActivityError(problem); }
  }

  function showBreakdownError(problem) {
    document.querySelector("#subject-breakdown-list").replaceChildren();
    document.querySelector("#subject-breakdown-empty").hidden = true;
    document.querySelector("#subject-breakdown-rounding").hidden = true;
    const error = document.querySelector("#subject-breakdown-error");
    error.textContent = problem.message;
    error.hidden = false;
  }

  function renderBreakdown(records, subjects) {
    try {
      const { total, rows } = StudyStats.subjectBreakdown(records, subjects);
      const items = rows.map(row => {
        const item = document.createElement("li");
        item.dataset.subjectId = row.subjectId ?? "";
        const heading = document.createElement("div");
        heading.className = "breakdown-heading";
        const title = document.createElement("h3");
        const swatch = document.createElement("span");
        swatch.className = "breakdown-swatch";
        swatch.style.backgroundColor = row.color;
        swatch.setAttribute("aria-hidden", "true");
        title.append(swatch, document.createTextNode(row.name));
        const value = document.createElement("p");
        value.textContent = `${studyTimeLabel(row.seconds)} · ${row.seconds.toLocaleString()}초 · ${row.percentage.toFixed(1)}%`;
        const track = document.createElement("div");
        track.className = "breakdown-track";
        track.setAttribute("aria-hidden", "true");
        const bar = document.createElement("span");
        bar.style.width = `${row.percentage}%`;
        bar.style.backgroundColor = row.color;
        track.append(bar);
        heading.append(title, value);
        item.append(heading, track);
        return item;
      });
      document.querySelector("#subject-breakdown-list").replaceChildren(...items);
      const empty = document.querySelector("#subject-breakdown-empty");
      empty.hidden = total > 0;
      empty.textContent = rows.length ? "No saved study time yet. Each subject starts at zero." : "No subjects or saved study records yet.";
      document.querySelector("#subject-breakdown-rounding").hidden = rows.length === 0;
      document.querySelector("#subject-breakdown-error").hidden = true;
    } catch (problem) { showBreakdownError(problem); }
  }

  function renderHistory() {
    const list = document.querySelector("#records-list");
    const listError = document.querySelector("#records-error");
    const empty = document.querySelector("#records-empty");
    const filter = document.querySelector("#records-subject-filter");
    const filterStatus = document.querySelector("#records-filter-status");
    listError.hidden = true;
    list.replaceChildren();
    empty.hidden = true;
    filterStatus.textContent = "";
    try {
      const savedRecords = StudyStorage.getRecords();
      renderTotal(savedRecords);
      renderPeriods(savedRecords);
      renderActivity(savedRecords);
      const sortedRecords = StudyStats.sortRecordsByDate(savedRecords);
      let subjects = [];
      try {
        subjects = StudyStorage.getSubjects();
        renderBreakdown(savedRecords, subjects);
      } catch (problem) {
        listError.textContent = `Subject data unavailable. ${problem.message}`;
        listError.hidden = false;
        filter.disabled = true;
        showBreakdownError(problem);
        return;
      }
      const selected = filter.value;
      const subjectIds = new Set(subjects.map(subject => subject.id));
      const hasUnassigned = savedRecords.some(record => !subjectIds.has(record.subjectId));
      filter.replaceChildren(new Option("All Subjects", ""));
      for (const subject of subjects) filter.add(new Option(subject.name, `subject:${subject.id}`));
      if (hasUnassigned) filter.add(new Option("미지정 과목", "unassigned"));
      filter.value = [...filter.options].some(option => option.value === selected) ? selected : "";
      filter.disabled = false;
      const records = sortedRecords.filter(record => !filter.value ||
        (filter.value === "unassigned" ? !subjectIds.has(record.subjectId) : `subject:${record.subjectId}` === filter.value));
      filterStatus.textContent = `Showing ${records.length} of ${savedRecords.length} saved records.`;
      empty.textContent = !savedRecords.length ? "No study records yet. Save a stopwatch session or add a manual record." :
        filter.value === "unassigned" ? "No saved records for 미지정 과목." :
        `No saved records for ${filter.selectedOptions[0].textContent}. Choose All Subjects to see other records.`;
      const names = new Map(subjects.map(subject => [subject.id, subject.name]));
      const items = records.map(record => {
        const item = document.createElement("li");
        const heading = document.createElement("h3");
        heading.textContent = names.get(record.subjectId) || "미지정 과목";
        const details = document.createElement("p");
        const date = document.createElement("time");
        date.dateTime = date.textContent = record.date;
        details.append(date, ` · ${formatTime(record.durationSeconds)} · ${record.source === "manual" ? "Manual" : "Stopwatch"}`);
        item.append(heading, details);
        if (record.note) {
          const memo = document.createElement("p");
          memo.className = "record-note";
          memo.textContent = record.note;
          item.append(memo);
        }
        const actions = document.createElement("div");
        actions.className = "record-actions";
        for (const [action, label] of [["edit", "Edit"], ["delete", "Delete"]]) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `button ${action === "delete" ? "button-danger" : "button-secondary"}`;
          button.textContent = label;
          button.dataset.recordAction = action;
          button.dataset.recordId = record.id;
          button.setAttribute("aria-label", `${label} ${heading.textContent} record on ${record.date}`);
          actions.append(button);
        }
        item.append(actions);
        return item;
      });
      list.replaceChildren(...items);
      empty.hidden = records.length > 0;
    } catch (problem) {
      listError.textContent = `Study records unavailable. ${problem.message}`;
      listError.hidden = false;
      filter.disabled = true;
      empty.hidden = true;
      showTotalError(problem);
      showBreakdownError(problem);
      showActivityError(problem);
    }
  }

  document.querySelector("#records-subject-filter").addEventListener("change", renderHistory);

  function newRecordId() {
    return typeof crypto.randomUUID === "function" ? crypto.randomUUID() :
      Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
  }

  const manualDialog = document.querySelector("#manual-record-dialog");
  const manualForm = document.querySelector("#manual-record-form");
  const manualError = document.querySelector("#manual-record-error");
  const manualSubject = document.querySelector("#manual-subject");
  const manualSave = document.querySelector("#save-manual-record");
  let manualId = null;
  let editingId = null;
  let manualSaving = false;

  function openRecordForm(record = null) {
    editingId = record ? record.id : null;
    manualForm.reset();
    manualError.hidden = true;
    manualSave.disabled = false;
    manualSave.textContent = record ? "Save Changes" : "Save Record";
    document.querySelector("#manual-record-title").textContent = record ? "Edit Study Record" : "Add Manual Record";
    manualId = record ? record.id : newRecordId();
    manualSubject.replaceChildren(new Option("Choose a subject", ""));
    const date = document.querySelector("#manual-date");
    date.max = StudyStorage.localDate();
    date.value = record ? record.date : date.max;
    const subjectNotice = document.querySelector("#manual-subject-note");
    subjectNotice.hidden = true;
    try {
      const subjects = StudyStorage.getSubjects();
      subjects.forEach(subject => manualSubject.add(new Option(subject.name, subject.id)));
      if (record && !subjects.some(subject => subject.id === record.subjectId)) {
        manualSubject.add(new Option("미지정 과목 (keep existing link)", record.subjectId));
        subjectNotice.textContent = "This subject no longer exists. Keep the existing link or choose another subject.";
        subjectNotice.hidden = false;
      } else if (!subjects.length) {
        subjectNotice.textContent = "No subjects yet. Add a subject in Subjects before saving a record.";
        subjectNotice.hidden = false;
      }
    } catch (problem) {
      manualError.textContent = problem.message;
      manualError.hidden = false;
      if (record) manualSubject.add(new Option("미지정 과목 (keep existing link)", record.subjectId));
    }
    if (record) {
      manualSubject.value = record.subjectId;
      document.querySelector("#manual-hours").value = Math.floor(record.durationSeconds / 3600);
      document.querySelector("#manual-minutes").value = Math.floor(record.durationSeconds / 60) % 60;
      document.querySelector("#manual-seconds").value = record.durationSeconds % 60;
      document.querySelector("#manual-note").value = record.note;
    }
    manualDialog.showModal();
    manualSubject.focus();
  }
  document.querySelector("#add-manual-record").addEventListener("click", () => openRecordForm());
  document.querySelector("#cancel-manual-record").addEventListener("click", () => manualDialog.close());
  manualForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!manualDialog.open || manualSaving) return;
    manualSaving = true;
    manualSave.disabled = true;
    try {
      const values = {
        id: manualId, subjectId: manualSubject.value, date: document.querySelector("#manual-date").value,
        hours: document.querySelector("#manual-hours").value, minutes: document.querySelector("#manual-minutes").value,
        seconds: document.querySelector("#manual-seconds").value,
        note: document.querySelector("#manual-note").value,
      };
      if (editingId) StudyStorage.updateRecord(editingId, values);
      else StudyStorage.addManualRecord(values);
      manualDialog.close();
      renderHistory();
    } catch (problem) {
      manualError.textContent = problem.message;
      manualError.hidden = false;
      manualError.focus();
    } finally {
      manualSaving = false;
      manualSave.disabled = false;
    }
  });

  const deleteDialog = document.querySelector("#delete-record-dialog");
  const deleteError = document.querySelector("#delete-record-error");
  let deletingId = null;
  document.querySelector("#records-list").addEventListener("click", event => {
    const button = event.target.closest("[data-record-action]");
    if (!button) return;
    try {
      const record = StudyStorage.getRecords().find(item => item.id === button.dataset.recordId);
      if (!record) throw new Error("This study record is no longer available. Reload and try again.");
      if (button.dataset.recordAction === "edit") openRecordForm(record);
      else {
        deletingId = record.id;
        deleteError.hidden = true;
        document.querySelector("#delete-record-description").textContent = `${record.date} · ${formatTime(record.durationSeconds)} · ${record.source === "manual" ? "Manual" : "Stopwatch"}. This cannot be undone.`;
        deleteDialog.showModal();
        document.querySelector("#cancel-delete-record").focus();
      }
    } catch (problem) {
      const listError = document.querySelector("#records-error");
      listError.textContent = problem.message;
      listError.hidden = false;
    }
  });
  document.querySelector("#cancel-delete-record").addEventListener("click", () => deleteDialog.close());
  document.querySelector("#confirm-delete-record").addEventListener("click", () => {
    if (!deleteDialog.open || !deletingId) return;
    try {
      StudyStorage.deleteRecord(deletingId);
      deletingId = null;
      deleteDialog.close();
      renderHistory();
    } catch (problem) {
      deleteError.textContent = problem.message;
      deleteError.hidden = false;
    }
  });

  stopButton.addEventListener("click", stop);
  saveButton.addEventListener("click", saveRecord);
  document.querySelector("#discard-record").addEventListener("click", () => {
    if (state === "stopped") discardDialog.showModal();
  });
  document.querySelector("#cancel-discard-record").addEventListener("click", () => discardDialog.close());
  document.querySelector("#confirm-discard-record").addEventListener("click", () => {
    if (state !== "stopped") return;
    discardDialog.close();
    reset();
  });
  window.addEventListener("beforeunload", event => {
    if (state === "idle") return;
    event.preventDefault();
    event.returnValue = "";
  });

  startButton.addEventListener("click", start);
  pauseButton.addEventListener("click", pause);
  resumeButton.addEventListener("click", resume);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
  });
  // Expose a copy for future session integrations without allowing state changes.
  return { refresh, getSnapshot: () => ({ state, elapsedMs: elapsedMs(), subject: sessionSubject ? { ...sessionSubject } : null }) };
})();
