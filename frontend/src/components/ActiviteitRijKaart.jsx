import { Link } from "react-router-dom";
import AvatarStack from "./AvatarStack";
import { formatDayMonth, formatTime, formatWeekdayShort } from "../utils/formatDate";

// Presentationele activiteitenkaart, zelfde opmaak (.activiteit-rij) als
// ActiviteitenLijst.jsx — apart component zodat andere schermen (bv. de
// "Binnenkort op de campus"-sectie op Start) deze kaart kunnen hergebruiken
// zonder de al werkende ActiviteitenLijst.jsx aan te raken
export default function ActiviteitRijKaart({ activiteit, categorie, afstand }) {
  const vol = activiteit.participant_count >= activiteit.max_participants;

  return (
    <Link
      to={`/activiteiten/${activiteit.id}`}
      className="activiteit-rij"
      style={{ "--accent": categorie?.accent ?? "#6c4ff5" }}
    >
      <div className="activiteit-rij-tijd">
        <span className="activiteit-rij-uur">{formatTime(activiteit.start_time)}</span>
        <span className="activiteit-rij-dag">{formatWeekdayShort(activiteit.start_time)}</span>
        <span className="activiteit-rij-datum">{formatDayMonth(activiteit.start_time)}</span>
        <span className="activiteit-rij-balk" />
      </div>
      <div className="activiteit-rij-inhoud">
        {categorie && (
          <span className="badge" style={{ background: categorie.bg, color: categorie.accent }}>
            {categorie.label}
          </span>
        )}
        <div className="activiteit-rij-titel">{activiteit.title}</div>
        <div className="activiteit-rij-plaats">
          {activiteit.location_name}
          {afstand && ` · ${afstand}`}
        </div>
        <div className="activiteit-rij-footer">
          <AvatarStack participants={activiteit.participants_preview} />
          <span className="activiteit-rij-spots" style={{ color: vol ? "#b4aed4" : categorie?.accent ?? "#6c4ff5" }}>
            {vol ? "Vol" : `${activiteit.max_participants - activiteit.participant_count} plekken`}
          </span>
        </div>
      </div>
    </Link>
  );
}
