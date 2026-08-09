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

// Zelfde als toDatetimeLocalValue, maar enkel het datumdeel — voor de
// week/dag-kiezer, die dag en tijdstip apart bijhoudt
export function toDateInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Enkel het uur, bv. "18:30" — voor de tijd-linkerkolom op activiteitenkaarten
export function formatTime(isoString) {
  return new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit" }).format(new Date(isoString));
}

// Korte weekdagafkorting, bv. "do" — naast formatTime op activiteitenkaarten
export function formatWeekdayShort(isoString) {
  return new Intl.DateTimeFormat("nl-BE", { weekday: "short" }).format(new Date(isoString)).replace(".", "");
}

// Relatieve tijd voor het chatoverzicht: "14:02" vandaag, "gisteren",
// "ma" deze week, anders "3 aug"
export function formatRelativeTime(isoString) {
  const d = new Date(isoString);
  const nu = new Date();
  if (d.toDateString() === nu.toDateString()) return formatTime(isoString);

  const gisteren = new Date(nu);
  gisteren.setDate(gisteren.getDate() - 1);
  if (d.toDateString() === gisteren.toDateString()) return "gisteren";

  const zevenDagenGeleden = new Date(nu);
  zevenDagenGeleden.setDate(zevenDagenGeleden.getDate() - 7);
  if (d > zevenDagenGeleden) return formatWeekdayShort(isoString);

  return new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short" }).format(d);
}

// Geeft een korte badge-tekst terug voor een naderende activiteit
// ("Start binnen 45 min", "Vandaag", "Morgen"), of null als het te ver in
// de toekomst ligt (of al voorbij is) om te benadrukken
export function formatStartBadge(isoString) {
  const start = new Date(isoString);
  const now = new Date();
  const diffMs = start - now;
  if (diffMs < 0) return null;

  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 6) {
    const diffMin = Math.round(diffMs / (1000 * 60));
    return diffMin < 60 ? `Start binnen ${diffMin} min` : `Start binnen ${Math.round(diffHours)}u`;
  }

  if (start.toDateString() === now.toDateString()) return "Vandaag";

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (start.toDateString() === tomorrow.toDateString()) return "Morgen";

  return null;
}
