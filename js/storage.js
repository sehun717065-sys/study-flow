// Keep subject persistence separate from rendering and other feature data.
window.StudyStorage = (() => {
  const key = "study-flow.subjects.v1";

  function read() {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return { version: 1, subjects: [] };
      const data = JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.subjects) ||
          !data.subjects.every(subject => subject && typeof subject.id === "string" &&
            typeof subject.name === "string" && subject.name.trim() &&
            /^#[0-9a-f]{6}$/i.test(subject.color) &&
            typeof subject.createdAt === "string" && Number.isFinite(Date.parse(subject.createdAt)))) {
        throw new Error("Invalid subject data");
      }
      return data;
    } catch {
      throw new Error("Saved subjects could not be loaded. Your existing data has been preserved.");
    }
  }

  function validate(name, color) {
    name = name.trim();
    if (!name || name.length > 100) throw new Error("Enter a subject name between 1 and 100 characters.");
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Choose a valid subject color.");
    return name;
  }

  function addSubject(name, color) {
    name = validate(name, color);
    const data = read();
    const subject = {
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() :
        Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join(""),
      name,
      color,
      createdAt: new Date().toISOString(),
    };
    data.subjects.push(subject);
    save(data);
    return subject;
  }

  function save(data, storageKey = key) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      throw new Error("Changes could not be saved. Check browser storage permissions or available space, then try again.");
    }
  }

  function updateSubject(id, name, color) {
    name = validate(name, color);
    const data = read();
    const matches = data.subjects.filter(subject => subject.id === id);
    if (matches.length !== 1) throw new Error("The subject could not be found uniquely. Reload subjects and try again.");
    const subject = matches[0];
    subject.name = name;
    subject.color = color;
    save(data);
    return subject;
  }

  function deleteSubject(id) {
    const data = read();
    const matches = data.subjects.filter(subject => subject.id === id);
    if (matches.length !== 1) throw new Error("The subject could not be found uniquely. Reload subjects and try again.");
    data.subjects = data.subjects.filter(subject => subject.id !== id);
    save(data);
    return matches[0];
  }

  const taskKey = "study-flow.tasks.v1";

  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function readTasks() {
    try {
      const raw = localStorage.getItem(taskKey);
      if (raw === null) return { version: 1, tasks: [] };
      const data = JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.tasks) || !data.tasks.every(task =>
        task && typeof task.id === "string" && ["task", "exam"].includes(task.type) &&
        typeof task.title === "string" && task.title.trim() && typeof task.description === "string" &&
        (task.completed === undefined || typeof task.completed === "boolean") &&
        validDate(task.date) && (task.subjectId === null || typeof task.subjectId === "string") &&
        typeof task.createdAt === "string" && Number.isFinite(Date.parse(task.createdAt)))) {
        throw new Error("Invalid task data");
      }
      return data;
    } catch {
      throw new Error("Saved tasks and exams could not be loaded. Existing data has been preserved.");
    }
  }

  function validateTask({ type, title, description, date, subjectId }, previousSubjectId = null) {
    title = title.trim();
    description = description.trim();
    if (!["task", "exam"].includes(type)) throw new Error("Choose Task or Exam.");
    if (!title || title.length > 200) throw new Error("Enter a title between 1 and 200 characters.");
    if (description.length > 2000) throw new Error("Keep the description within 2000 characters.");
    if (!validDate(date)) throw new Error("Choose a valid date.");
    if (subjectId !== null && subjectId !== previousSubjectId && !read().subjects.some(subject => subject.id === subjectId)) {
      throw new Error("This subject is no longer available. Reopen the form and choose another subject.");
    }
    return { type, title, description, date, subjectId };
  }

  function addTask(values) {
    const fields = validateTask(values);
    const data = readTasks();
    const task = {
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() :
        Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join(""),
      ...fields, completed: false, createdAt: new Date().toISOString(),
    };
    data.tasks.push(task);
    save(data, taskKey);
    return task;
  }

  function updateTask(id, values) {
    const data = readTasks();
    const matches = data.tasks.filter(task => task.id === id);
    if (matches.length !== 1) throw new Error("The schedule item could not be found uniquely. Reload and try again.");
    const task = matches[0];
    Object.assign(task, validateTask(values, task.subjectId));
    save(data, taskKey);
    return task;
  }

  function deleteTask(id) {
    const data = readTasks();
    const matches = data.tasks.filter(task => task.id === id);
    if (matches.length !== 1) throw new Error("The schedule item could not be found uniquely. Reload and try again.");
    data.tasks = data.tasks.filter(task => task.id !== id);
    save(data, taskKey);
    return matches[0];
  }

  function setTaskCompleted(id, completed) {
    if (typeof completed !== "boolean") throw new Error("Choose a valid completion state.");
    const data = readTasks();
    const matches = data.tasks.filter(task => task.id === id);
    if (matches.length !== 1) throw new Error("The schedule item could not be found uniquely. Reload and try again.");
    matches[0].completed = completed;
    save(data, taskKey);
    return matches[0];
  }

  const recordKey = "study-flow.records.v1";

  function validRecord(record) {
    return record && typeof record.id === "string" && record.id.trim() &&
      typeof record.subjectId === "string" && record.subjectId.trim() && validDate(record.date) &&
      Number.isSafeInteger(record.durationSeconds) && record.durationSeconds > 0 &&
      typeof record.note === "string" && ["stopwatch", "manual"].includes(record.source) &&
      typeof record.createdAt === "string" && Number.isFinite(Date.parse(record.createdAt));
  }

  function readRecords() {
    try {
      const raw = localStorage.getItem(recordKey);
      if (raw === null) return { version: 1, records: [] };
      const data = JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.records) || !data.records.every(validRecord) ||
          new Set(data.records.map(record => record.id)).size !== data.records.length) {
        throw new Error("Invalid record data");
      }
      return data;
    } catch {
      throw new Error("Saved study records could not be loaded. Existing data has been preserved.");
    }
  }

  function addRecord(record) {
    if (!validRecord(record)) throw new Error("A valid subject and at least one full second are required.");
    const data = readRecords();
    const existing = data.records.find(item => item.id === record.id);
    if (existing) {
      if (Object.keys(record).every(field => record[field] === existing[field])) return existing;
      throw new Error("This record ID already exists. Your measurement has been preserved.");
    }
    data.records.push({ ...record });
    save(data, recordKey);
    return record;
  }

  function localDate(date = new Date()) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }

  function validateRecordFields({ subjectId, date, hours, minutes, seconds = "0", note }, previousSubjectId = null) {
    if (!subjectId || (subjectId !== previousSubjectId && !read().subjects.some(subject => subject.id === subjectId))) {
      throw new Error("Choose an available subject.");
    }
    if (!validDate(date)) throw new Error("Choose a valid study date.");
    if (date > localDate()) throw new Error("Study dates cannot be in the future.");
    if (![hours, minutes, seconds].every(value => typeof value === "string" && /^\d+$/.test(value))) {
      throw new Error("Enter whole numbers for hours, minutes and seconds, with no signs or decimals.");
    }
    const [h, m, s] = [hours, minutes, seconds].map(Number);
    if (![h, m, s].every(Number.isSafeInteger) || m > 59 || s > 59) {
      throw new Error("Enter valid whole hours, with minutes and seconds between 0 and 59.");
    }
    const durationSeconds = h * 3600 + m * 60 + s;
    if (!Number.isSafeInteger(durationSeconds) || durationSeconds <= 0) {
      throw new Error("Enter a study duration greater than zero and within the supported numeric range.");
    }
    if (typeof note !== "string" || note.length > 2000) throw new Error("Keep your note within 2000 characters.");
    return { subjectId, date, durationSeconds, note };
  }

  function addManualRecord(values) {
    const fields = validateRecordFields(values);
    return addRecord({ id: values.id, ...fields, note: fields.note.trim(), source: "manual", createdAt: new Date().toISOString() });
  }

  function updateRecord(id, values) {
    const data = readRecords();
    const record = data.records.find(item => item.id === id);
    if (!record) throw new Error("This study record is no longer available. Reload and try again.");
    Object.assign(record, validateRecordFields(values, record.subjectId));
    save(data, recordKey);
    return record;
  }

  function deleteRecord(id) {
    const data = readRecords();
    const record = data.records.find(item => item.id === id);
    if (!record) throw new Error("This study record is no longer available. Reload and try again.");
    data.records = data.records.filter(item => item.id !== id);
    save(data, recordKey);
    return record;
  }

  return { updateRecord, deleteRecord, localDate, addManualRecord, getRecords: () => readRecords().records, addRecord, setTaskCompleted, updateTask, deleteTask, getTasks: () => readTasks().tasks.map(task => ({ ...task, completed: task.completed ?? false })), addTask, getSubjects: () => read().subjects, addSubject, updateSubject, deleteSubject };
})();
