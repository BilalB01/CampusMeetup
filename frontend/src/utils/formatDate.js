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
