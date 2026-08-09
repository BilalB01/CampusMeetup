import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyActivities, listActivities } from "../api/client";
import AvatarStack from "../components/AvatarStack";
import { useAuth } from "../auth/AuthContext";
import { CATEGORIES } from "../constants/categories";
import { formatStartBadge } from "../utils/formatDate";
import "./Activiteiten.css";

export default function Categorieen() {
  const { user, token } = useAuth();
  const initial = user?.name?.[0]?.toUpperCase() ?? "?";
  const voornaam = user?.name?.split(" ")[0];
  const [activities, setActivities] = useState([]);
  const [eigenActiviteiten, setEigenActiviteiten] = useState([]);

  useEffect(() => {
    // Ongefilterd ophalen volstaat om zowel het totaal als de telling per
    // categorie client-side te berekenen — geen apart telling-endpoint nodig
    listActivities()
      .then(setActivities)
      .catch(() => {}); // stille fallback: tellingen blijven dan gewoon 0
    getMyActivities(token)
      .then((data) => setEigenActiviteiten([...data.organized, ...data.joined]))
      .catch(() => {});
  }, [token]);

  const vandaag = new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const vandaagMetHoofdletter = vandaag.charAt(0).toUpperCase() + vandaag.slice(1);

  // Eerstvolgende activiteit waar de gebruiker zelf iets mee te maken heeft
  // (georganiseerd of deelgenomen) — niets tonen als die er niet is, geen
  // nepdata verzinnen
  const nu = new Date();
  const volgende = eigenActiviteiten
    .filter((a) => new Date(a.start_time) > nu)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];
  const volgendeBadge = volgende ? formatStartBadge(volgende.start_time) : null;

  // Statistieken voor de desktop-statistiekenkolom (zie start-stats-kolom in
  // Activiteiten.css) — enkel uit al opgehaalde data, geen nepcijfers
  const inZevenDagen = new Date(nu);
  inZevenDagen.setDate(inZevenDagen.getDate() + 7);
  const stats = [
    {
      n: eigenActiviteiten.filter((a) => new Date(a.start_time).toDateString() === nu.toDateString()).length,
      l: "Vandaag",
    },
    {
      n: eigenActiviteiten.filter((a) => new Date(a.start_time) >= nu && new Date(a.start_time) <= inZevenDagen)
        .length,
      l: "Deze week",
    },
    {
      n: activities.filter((a) => new Date(a.start_time).toDateString() === nu.toDateString()).length,
      l: "Op de campus",
    },
  ];

  return (
    <div className="activiteiten-screen">
      {/* activiteiten-header--start: verborgen vanaf 900px, want "CampusMeetup"
          + profiellink staan daar al in TopBar/Sidebar (zie Activiteiten.css) */}
      <header className="activiteiten-header activiteiten-header--start">
        <h1 className="activiteiten-title">CampusMeetup</h1>
        {/* Uitloggen staat nu op het profielscherm, zoals in het Figma-ontwerp */}
        <Link to="/profiel" className="profiel-avatar profiel-avatar--klein" aria-label="Profiel">
          {initial}
        </Link>
      </header>

      <div className="categorieen-intro">
        <p className="categorieen-datum">{vandaagMetHoofdletter}</p>
        <p className="categorieen-groet">Hey {voornaam}</p>
      </div>

      <div className="start-hero-grid">
        {volgende && (
          <Link to={`/activiteiten/${volgende.id}`} className="uitgelicht-kaart">
            <div className="uitgelicht-badge">
              <span className="uitgelicht-stip" />
              {volgendeBadge ?? "Binnenkort"}
            </div>
            <div className="uitgelicht-titel">{volgende.title}</div>
            <div className="uitgelicht-sub">{volgende.location_name}</div>
            <div className="uitgelicht-footer">
              <AvatarStack participants={volgende.participants_preview} />
              <span className="uitgelicht-cta">Bekijken</span>
            </div>
          </Link>
        )}

        <div className="start-stats-kolom">
          {stats.map((s) => (
            <div key={s.l} className="profiel-stat-tegel">
              <div className="profiel-stat-getal">{s.n}</div>
              <div className="profiel-stat-label">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="categorieen-sectiekop">
        <span>Waar heb je zin in?</span>
        <Link to="/activiteiten" className="activiteiten-link-button">
          Alles
        </Link>
      </div>

      <div className="categorie-grid">
        {CATEGORIES.map((cat) => {
          const aantal = activities.filter((a) => a.category === cat.value).length;
          return (
            <Link key={cat.slug} to={`/activiteiten/categorie/${cat.slug}`} className="categorie-tile2">
              <div className="categorie-tile2-top">
                <span className="categorie-icon" style={{ background: cat.bg }}>
                  {cat.icon}
                </span>
                <span className="categorie-tile2-count" style={{ color: cat.accent }}>
                  {aantal}
                </span>
              </div>
              <span className="categorie-tile2-label">{cat.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
