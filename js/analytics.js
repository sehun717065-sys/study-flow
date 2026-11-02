// Pure calculations: no DOM or storage access, and no mutations of source records.
window.StudyStats = (() => {
  function totalSeconds(records) {
    if (!Array.isArray(records)) throw new Error("Study records must be an array.");
    return records.reduce((total, record) => {
      const seconds = record?.durationSeconds;
      if (!Number.isSafeInteger(seconds) || seconds <= 0) {
        throw new Error("Study durations must be positive whole seconds. Existing data has been preserved.");
      }
      const next = total + seconds;
      if (!Number.isSafeInteger(next)) {
        throw new Error("Total study time exceeds the supported numeric range. Existing data has been preserved.");
      }
      return next;
    }, 0);
  }
  function monthDays(year, month) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  }

  function parseDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Choose a valid date in YYYY-MM-DD format.");
    const [year, month, day] = value.split("-").map(Number);
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthDays(year, month)) {
      throw new Error("Invalid study date. Existing data has been preserved.");
    }
    return { year, month, day };
  }

  // Gregorian calendar day numbers, independent of UTC offsets and DST.
  function dayNumber({ year, month, day }) {
    const y = year - 1;
    let days = y * 365 + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + day;
    for (let m = 1; m < month; m++) days += monthDays(year, m);
    return days;
  }

  function dateKey({ year, month, day }) {
    return [String(year).padStart(4, "0"), String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
  }

  function shiftDays(date, offset) {
    let { year, month, day } = date;
    day += offset;
    while (day < 1) {
      if (--month < 1) { month = 12; year--; }
      day += monthDays(year, month);
    }
    while (day > monthDays(year, month)) {
      day -= monthDays(year, month);
      if (++month > 12) { month = 1; year++; }
    }
    return { year, month, day };
  }

  function startOfWeek(selected) {
    // 0001-01-01 was Monday; Sunday has offset 6.
    return shiftDays(selected, -((dayNumber(selected) - 1) % 7));
  }

  function weeklyActivity(records, selectedDate) {
    totalSeconds(records); // Validate every duration and the safe aggregate range.
    const start = startOfWeek(parseDate(selectedDate));
    const firstDay = dayNumber(start);
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((weekday, index) => ({
      weekday, date: dateKey(shiftDays(start, index)), seconds: 0,
    }));
    for (const record of records) {
      const index = dayNumber(parseDate(record.date)) - firstDay;
      if (index >= 0 && index < 7) days[index].seconds += record.durationSeconds;
    }
    return { start: days[0].date, end: days[6].date, days, total: days.reduce((sum, day) => sum + day.seconds, 0) };
  }

  function summarize(records, selectedDate) {
    const total = totalSeconds(records);
    const selected = parseDate(selectedDate);
    const day = dayNumber(selected);
    const weekStart = startOfWeek(selected);
    const weekEnd = shiftDays(weekStart, 6);
    const monthStart = { ...selected, day: 1 };
    const monthEnd = { ...selected, day: monthDays(selected.year, selected.month) };
    const dated = records.map(record => ({ record, day: dayNumber(parseDate(record.date)) }));
    const sum = (start, end) => totalSeconds(dated.filter(item => item.day >= start && item.day <= end).map(item => item.record));
    return {
      total,
      daily: sum(day, day),
      weekly: sum(dayNumber(weekStart), dayNumber(weekEnd)),
      monthly: sum(dayNumber(monthStart), dayNumber(monthEnd)),
      ranges: { daily: [selectedDate, selectedDate], weekly: [dateKey(weekStart), dateKey(weekEnd)], monthly: [dateKey(monthStart), dateKey(monthEnd)] },
    };
  }
  function subjectBreakdown(records, subjects) {
    const total = totalSeconds(records);
    if (!Array.isArray(subjects)) throw new Error("Subjects must be an array.");
    const groups = new Map();
    subjects.forEach((subject, order) => {
      if (!subject || typeof subject.id !== "string" || !subject.id.trim() ||
          typeof subject.name !== "string" || !subject.name.trim() || !/^#[0-9a-f]{6}$/i.test(subject.color) || groups.has(subject.id)) {
        throw new Error("Invalid or duplicate subject data. Existing data has been preserved.");
      }
      groups.set(subject.id, { subjectId: subject.id, name: subject.name, color: subject.color, seconds: 0, order });
    });
    let unassigned = null;
    for (const record of records) {
      if (typeof record.subjectId !== "string" || !record.subjectId.trim()) {
        throw new Error("Invalid record subject. Existing data has been preserved.");
      }
      let group = groups.get(record.subjectId);
      if (!group) {
        unassigned ??= { subjectId: null, name: "미지정 과목", color: "#8792a5", seconds: 0, order: subjects.length };
        group = unassigned;
      }
      group.seconds += record.durationSeconds;
      if (!Number.isSafeInteger(group.seconds)) throw new Error("Subject study time exceeds the supported numeric range.");
    }
    const rows = [...groups.values(), ...(unassigned ? [unassigned] : [])]
      .sort((a, b) => b.seconds - a.seconds || a.order - b.order)
      .map(({ order, ...group }) => ({ ...group, percentage: total === 0 ? 0 : group.seconds / total * 100 }));
    return { total, rows };
  }
  function sortRecordsByDate(records) {
    return records.slice().sort((a, b) => b.date.localeCompare(a.date) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  function formatDuration(seconds) {
    if (!Number.isSafeInteger(seconds) || seconds < 0) throw new Error("Invalid study duration.");
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map(value => String(value).padStart(2, "0")).join(":");
  }
  return { totalSeconds, summarize, subjectBreakdown, weeklyActivity, sortRecordsByDate, formatDuration };
})();
