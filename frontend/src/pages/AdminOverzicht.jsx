import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminActivities, getAdminUsers } from "../api/client";
import Skeleton from "../components/Skeleton";
import StartStatKaart from "../components/StartStatKaart";
import { useAuth } from "../auth/AuthContext";
import { capitalize, formatRelativeTime } from "../utils/formatDate";
import "./Activiteiten.css";

// Landingspagina voor beheerders (/, zie App.jsx) -- i.p.v. de normale
// Start-pagina (Categorieen.jsx) met categorietegels/"Binnenkort op de
// campus", wat allemaal over zelf deelnemen gaat en dus niet past bij een
// beheerder (zie ook Sidebar.jsx: een admin ziet geen Start/Ontdek/...)
export default function AdminOverzicht() {
  const { user, token } = useAuth();
  const voornaam = user?.name?.split(" ")[0];
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getAdminUsers(token).then(setUsers), getAdminActivities({}, token).then(setActivities)])
      .catch(() => {}) // stille fallback: tellingen blijven dan gewoon 0
      .finally(() => setLoading(false));
  }, [token]);

  const vandaag = new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const vandaagMetHoofdletter = capitalize(vandaag);

  const zevenDagenGeleden = new Date();
  zevenDagenGeleden.setDate(zevenDagenGeleden.getDate() - 7);
  const nieuweDezeWeek = users.filter((u) => new Date(u.created_at) >= zevenDagenGeleden).length;

  const stats = [
    { n: users.length, l: "Gebruikers", icoon: "👥", bg: "#E9E1FF", accent: "#6C4FF5" },
    { n: activities.length, l: "Activiteiten", icoon: "📅", bg: "#DCE9FF", accent: "#2F6FE4" },
    { n: nieuweDezeWeek, l: "Nieuw deze week", icoon: "✨", bg: "#FFE7D9", accent: "#E1571E" },
  ];

  // Meest recent geregistreerd bovenaan -- GET /admin/users sorteert
  // alfabetisch (voor AdminGebruikers.jsx), dus hier zelf op created_at
  // sorteren i.p.v. blind op de volgorde van de API te vertrouwen
  const recenteGebruikers = [...users]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return (
    <div className="activiteiten-screen">
      <header className="activiteiten-header activiteiten-header--start">
        <h1 className="activiteiten-title">CampusMeetup</h1>
        <Link to="/profiel" className="profiel-avatar profiel-avatar--klein" aria-label="Profiel">
          {user?.name?.[0]?.toUpperCase() ?? "?"}
        </Link>
      </header>

      <div className="categorieen-intro">
        <p className="categorieen-datum">{vandaagMetHoofdletter}</p>
        <p className="categorieen-groet">Hey {voornaam}</p>
        {!loading && (
          <p className="activiteiten-subtitle">
            {users.length} gebruikers, {activities.length} activiteiten op het platform.
          </p>
        )}
      </div>

      {loading ? (
        <div className="start-hero-grid">
          <Skeleton className="uitgelicht-kaart" style={{ minHeight: 150 }} />
          <div className="start-stats-kolom">
            <Skeleton style={{ height: 62 }} />
            <Skeleton style={{ height: 62 }} />
            <Skeleton style={{ height: 62 }} />
          </div>
        </div>
      ) : (
        <div className="start-hero-grid">
          <div className="uitgelicht-kaart">
            <div className="uitgelicht-titel">Beheerderspaneel</div>
            <div className="uitgelicht-sub">Beheer gebruikers en activiteiten op het platform.</div>
            <div className="admin-overzicht-acties">
              <Link to="/admin/gebruikers" className="uitgelicht-leeg-cta">
                Gebruikers beheren →
              </Link>
              <Link to="/admin/activiteiten" className="uitgelicht-leeg-cta">
                Activiteiten beheren →
              </Link>
            </div>
          </div>

          <div className="start-stats-kolom">
            {stats.map((s) => (
              <StartStatKaart key={s.l} n={s.n} l={s.l} icoon={s.icoon} bg={s.bg} accent={s.accent} />
            ))}
          </div>
        </div>
      )}

      <div className="categorieen-sectiekop">
        <span>Recent geregistreerd</span>
        <Link to="/admin/gebruikers" className="activiteiten-link-button">
          Alles
        </Link>
      </div>

      {loading ? (
        <ul className="activiteiten-lijst">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i}>
              <div className="profiel-item">
                <Skeleton style={{ width: 42, height: 42, borderRadius: 15, flexShrink: 0 }} />
                <div className="profiel-item-tekst">
                  <Skeleton style={{ height: 13, width: "60%", marginBottom: 6 }} />
                  <Skeleton style={{ height: 10, width: "40%" }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="activiteiten-lijst">
          {recenteGebruikers.map((u) => (
            <li key={u.id}>
              {/* Eigen rij linkt naar /profiel i.p.v. de generieke detailpagina --
                  die laatste toont enkel georganiseerd/deelgenomen, en een
                  beheerder kan geen van beide (zie activities.py _ensure_not_admin) */}
              <Link
                to={u.id === user?.id ? "/profiel" : `/admin/gebruikers/${u.id}`}
                className="profiel-item"
              >
                <span className="profiel-item-icoon" style={{ background: "#ede8fb" }}>
                  {u.name?.[0]?.toUpperCase() ?? "?"}
                </span>
                <span className="profiel-item-tekst">
                  <span className="profiel-item-titel">{u.name}</span>
                  <span className="profiel-item-sub">{u.email}</span>
                </span>
                <span className="profiel-item-tag">{formatRelativeTime(u.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
