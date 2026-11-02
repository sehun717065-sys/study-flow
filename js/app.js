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
