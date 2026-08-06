// Formatteert een ISO-datum naar leesbare NL-tekst, bv. "4 augustus 2026, 14:30"
// (geen "Vandaag"/"Morgen"-labels zoals in Figma — bewuste vereenvoudiging)
export function formatDateTime(isoString) {
  return new Intl.DateTimeFormat("nl-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

// Tegenpool van formatDateTime: zet een ISO-datum om naar het
// YYYY-MM-DDTHH:mm-formaat dat een <input type="datetime-local"> verwacht,
// in lokale tijd (nodig om het bewerkformulier voor te vullen)
export function toDatetimeLocalValue(isoString) {
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
