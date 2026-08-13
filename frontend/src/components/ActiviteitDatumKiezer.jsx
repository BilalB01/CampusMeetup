import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatTime, formatWeekdayShort } from "../utils/formatDate";

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=zo..6=za
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weeksBetween(a, b) {
  return Math.round((startOfWeek(a) - startOfWeek(b)) / (7 * 24 * 60 * 60 * 1000));
}

function getWeekDays(monday) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

// Halfuurblokken 09:00 t.e.m. 21:30
const SLOTS = [];
for (let h = 9; h <= 21; h++) {
  SLOTS.push(`${String(h).padStart(2, "0")}:00`);
  SLOTS.push(`${String(h).padStart(2, "0")}:30`);
}

// Presentationeel: ActiviteitForm.jsx blijft eigenaar van pickerDate/
// startTime, dit component stuurt enkel via onSelectDay/onSelectSlot bij
export default function ActiviteitDatumKiezer({ activities, pickerDate, onSelectDay, selectedTime, onSelectSlot }) {
  const vandaag = new Date();
  const vandaagMiddernacht = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate());
  // Start op de week van pickerDate — belangrijk bij bewerken van een
  // activiteit die verder in de toekomst ligt
  const [weekOffset, setWeekOffset] = useState(() => weeksBetween(pickerDate, vandaag));

  const weekStart = startOfWeek(vandaag);
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);
  const dagen = getWeekDays(weekStart);

  const maandLabel = new Intl.DateTimeFormat("nl-BE", { month: "long", year: "numeric" }).format(weekStart);
  const maandLabelMetHoofdletter = maandLabel.charAt(0).toUpperCase() + maandLabel.slice(1);

  const geplandOpGekozenDag = activities
    .filter((a) => isSameDay(new Date(a.start_time), pickerDate))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const isVandaagGekozen = isSameDay(pickerDate, vandaag);

  return (
    <div className="datum-kiezer">
      <div className="datum-kiezer-weeknav">
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w - 1)}
          disabled={weekOffset <= 0}
          aria-label="Vorige week"
        >
          <ChevronLeft size={16} strokeWidth={2.3} />
        </button>
        <span>{maandLabelMetHoofdletter}</span>
        <button type="button" onClick={() => setWeekOffset((w) => w + 1)} aria-label="Volgende week">
          <ChevronRight size={16} strokeWidth={2.3} />
        </button>
      </div>

      <div className="dag-rij">
        {dagen.map((dag) => {
          const voorbij = dag < vandaagMiddernacht;
          const heeftActiviteiten = activities.some((a) => isSameDay(new Date(a.start_time), dag));
          return (
            <button
              key={dag.toISOString()}
              type="button"
              className={`dag-chip${isSameDay(dag, pickerDate) ? " actief" : ""}`}
              disabled={voorbij}
              onClick={() => onSelectDay(dag)}
            >
              <span>{formatWeekdayShort(dag)}</span>
              <span>{dag.getDate()}</span>
              {heeftActiviteiten && <span className="dag-chip-stip" />}
            </button>
          );
        })}
      </div>

      {geplandOpGekozenDag.length > 0 && (
        <div className="al-gepland">
          Al gepland: {geplandOpGekozenDag.map((a) => `${a.title} (${formatTime(a.start_time)})`).join(", ")}
        </div>
      )}

      <div className="tijdslot-grid">
        {SLOTS.map((slot) => {
          let voorbij = false;
          if (isVandaagGekozen) {
            const [uur, minuut] = slot.split(":").map(Number);
            const slotTijdstip = new Date(vandaag);
            slotTijdstip.setHours(uur, minuut, 0, 0);
            voorbij = slotTijdstip < vandaag;
          }
          return (
            <button
              key={slot}
              type="button"
              className={`tijdslot${selectedTime === slot ? " actief" : ""}`}
              disabled={voorbij}
              onClick={() => onSelectSlot(slot)}
            >
              {slot}
            </button>
          );
        })}
      </div>
    </div>
  );
}
