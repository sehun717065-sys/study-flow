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

  function save(data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      throw new Error("The subject could not be saved. Check browser storage permissions or available space, then try again.");
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

  return { getSubjects: () => read().subjects, addSubject, updateSubject, deleteSubject };
})();
