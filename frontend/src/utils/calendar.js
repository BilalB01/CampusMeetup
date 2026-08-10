// Bouwt een "Voeg toe aan Google Agenda"-link puur client-side (geen API-key
// of OAuth nodig) -- Google ondersteunt een vooringevulde-aanmaakpagina via
// URL-parameters. Het .ics-bestand zelf komt van de backend (zie
// GET /activities/{id}/ics in activities.py) voor Outlook/Apple Calendar/etc.

// Geen einduur/duur opgeslagen op de activiteit -- 2u is een redelijke
// standaardinschatting, zelfde aanname als ICS_STANDAARD_DUUR in activities.py
const STANDAARD_DUUR_MS = 2 * 60 * 60 * 1000;

function naarGoogleDatum(d) {
  return d.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

export function getGoogleAgendaUrl(activity) {
  const start = new Date(activity.start_time);
  const end = new Date(start.getTime() + STANDAARD_DUUR_MS);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: activity.title,
    dates: `${naarGoogleDatum(start)}/${naarGoogleDatum(end)}`,
    location: activity.location_name,
  });
  if (activity.description) params.set("details", activity.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
