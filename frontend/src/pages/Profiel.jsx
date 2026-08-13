import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getMyActivities, getMyBadges } from "../api/client";
import Skeleton from "../components/Skeleton";
import StatTegel from "../components/StatTegel";
import { useAuth } from "../auth/AuthContext";
import { getCategoryByValue } from "../constants/categories";
import { formatDateTime } from "../utils/formatDate";
import { InstellingenSecties } from "./Instellingen";
import "./Activiteiten.css";

// Eigen kleurenpalet per badge (losstaand van CATEGORIES — badges zijn geen
// categorieën) voor dezelfde kleurwas/gloed-behandeling als categorie-tile2 —
// enkel toegepast als de badge al verdiend is, zie badge-tegel hieronder
const BADGE_KLEUREN = {
  eerste_organisatie: { bg: "#FFE7D9", accent: "#E1571E" },
  drukbezet_organisator: { bg: "#DCE9FF", accent: "#2F6FE4" },
  nieuwsgierig: { bg: "#E9E1FF", accent: "#6C4FF5" },
  sociale_vlinder: { bg: "#FFE0EC", accent: "#D62F73" },
  prater: { bg: "#FFF1C9", accent: "#A87400" },
  alleskunner: { bg: "#D8F5E9", accent: "#0E8A64" },
};

// "Vandaag"/"Actief"/"Voorbij", afgeleid van start_time t.o.v. nu — geen
// nieuw databaseveld nodig
function statusLabel(startTime) {
  const start = new Date(startTime);
  const now = new Date();
  if (start < now) return "Voorbij";
  if (start.toDateString() === now.toDateString()) return "Vandaag";
  return "Actief";
}

export default function Profiel() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [data, setData] = useState({ organized: [], joined: [] });
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("organized");

  // Een beheerder organiseert/verdient/deelt zelf niet (zie ook Sidebar.jsx
  // en AdminOverzicht.jsx) -- deze data hoeft dan niet eens opgehaald te
  // worden, laat staan getoond
  useEffect(() => {
    if (user?.is_admin) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    getMyActivities(token)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    getMyBadges(token)
      .then((result) => {
        if (!cancelled) setBadges(result);
      })
      .catch(() => {}); // stille fallback: badges tonen dan gewoon niet
    return () => {
      cancelled = true;
    };
  }, [token, user?.is_admin]);

  async function handleLogout() {
    // Eerst wegnavigeren, dan pas uitloggen -- zelfde reden als
    // handleVerwijderen in Instellingen.jsx: zolang deze pagina nog gemount
    // is wanneer token null wordt, stuurt ProtectedRoute zelf ook naar
    // /login, maar dan met deze pagina als terugkeer-bestemming
    navigate("/login", { replace: true });
    await logout();
  }

  const initial = user?.name?.[0]?.toUpperCase() ?? "?";

  // Eigen, kortere weergave voor een beheerder: geen statistieken/badges/
  // georganiseerd-deelgenomen-tabs (dat gaat allemaal over zelf deelnemen aan
  // activiteiten, wat een beheerder per ontwerp niet doet), maar wél meteen
  // de instellingen-secties zelf op deze pagina i.p.v. enkel een link ernaar
  // -- voor een beheerder zijn "profiel" en "instellingen" hetzelfde scherm
  if (user?.is_admin) {
    return (
      <div className="activiteiten-screen">
        <header className="activiteiten-header">
          <button className="activiteiten-back" onClick={() => navigate("/")}>
            <ArrowLeft size={18} strokeWidth={2.3} />
          </button>
        </header>

        <div className="profiel-header-kaart">
          <div className="profiel-avatar-row">
            <div className="profiel-avatar">{initial}</div>
            <div>
              <p className="profiel-naam">
                {user?.name} <span className="admin-badge">Beheerder</span>
              </p>
              <p className="profiel-email">{user?.email}</p>
            </div>
          </div>

          <div className="profiel-header-acties">
            <Link to="/admin/gebruikers" className="profiel-instellingen-pil">
              Gebruikers beheren
            </Link>
            <Link to="/admin/activiteiten" className="profiel-instellingen-pil">
              Activiteiten beheren
            </Link>
            <button type="button" className="profiel-logout" onClick={handleLogout}>
              Uitloggen
            </button>
          </div>
        </div>

        <InstellingenSecties />
      </div>
    );
  }

  const activeList = tab === "organized" ? data.organized : data.joined;
  const emptyMessage =
    tab === "organized"
      ? "Je hebt nog geen activiteiten georganiseerd."
      : "Je neemt nog niet deel aan activiteiten van iemand anders.";

  const alleActiviteiten = [...data.organized, ...data.joined];
  const nu = new Date();
  const inZevenDagen = new Date(nu);
  inZevenDagen.setDate(inZevenDagen.getDate() + 7);
  const stats = [
    { n: data.organized.length, l: "Georg." },
    { n: alleActiviteiten.filter((a) => new Date(a.start_time) < nu).length, l: "Gedaan" },
    {
      n: alleActiviteiten.filter((a) => new Date(a.start_time) >= nu && new Date(a.start_time) <= inZevenDagen).length,
      l: "Deze week",
    },
  ];

  return (
    <div className="activiteiten-screen">
      <header className="activiteiten-header">
        <button className="activiteiten-back" onClick={() => navigate("/")}>
          <ArrowLeft size={18} strokeWidth={2.3} />
        </button>
      </header>

      <div className="profiel-header-kaart">
        <div className="profiel-avatar-row">
          <div className="profiel-avatar">{initial}</div>
          <div>
            <p className="profiel-naam">{user?.name}</p>
            <p className="profiel-email">{user?.email}</p>
          </div>
        </div>

        {loading ? (
          <div className="profiel-stats-rij">
            <Skeleton className="profiel-stat-tegel" style={{ height: 62 }} />
            <Skeleton className="profiel-stat-tegel" style={{ height: 62 }} />
            <Skeleton className="profiel-stat-tegel" style={{ height: 62 }} />
          </div>
        ) : (
          !error && (
            <div className="profiel-stats-rij">
              {stats.map((s) => (
                <StatTegel key={s.l} n={s.n} l={s.l} />
              ))}
            </div>
          )
        )}

        <div className="profiel-header-acties">
          <Link to="/instellingen" className="profiel-instellingen-pil">
            Instellingen
          </Link>
          <button type="button" className="profiel-logout" onClick={handleLogout}>
            Uitloggen
          </button>
        </div>
      </div>

      {error && <div className="auth-error">{error}</div>}
      {loading && (
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
      )}

      {!loading && !error && (
        <div className="profiel-content-grid">
          {badges.length > 0 && (
            <div className="badges-grid">
              {badges.map((b) => (
                <div
                  key={b.key}
                  className={`badge-tegel${b.earned ? "" : " badge-tegel--onverdiend"}`}
                  style={
                    b.earned
                      ? { "--tile-bg": BADGE_KLEUREN[b.key]?.bg, "--tile-accent": BADGE_KLEUREN[b.key]?.accent }
                      : undefined
                  }
                  data-tooltip={b.description}
                  aria-label={b.description}
                >
                  <span className="badge-tegel-blob" aria-hidden="true" />
                  <span className="badge-tegel-icoon">{b.icon}</span>
                  <span className="badge-tegel-label">{b.label}</span>
                </div>
              ))}
            </div>
          )}

          <div className="profiel-activiteiten-kolom">
            {/* Tabwissel is pure lokale state: beide lijsten zijn al opgehaald
                in de useEffect hierboven, dus wisselen kost geen extra API-call */}
            <div className="profiel-tabs">
              <span
                className="profiel-tabs-indicator"
                style={{ transform: tab === "organized" ? "translateX(0%)" : "translateX(100%)" }}
              />
              <button
                className={`profiel-tab${tab === "organized" ? " actief" : ""}`}
                onClick={() => setTab("organized")}
              >
                Georganiseerd ({data.organized.length})
              </button>
              <button
                className={`profiel-tab${tab === "joined" ? " actief" : ""}`}
                onClick={() => setTab("joined")}
              >
                Deelgenomen ({data.joined.length})
              </button>
            </div>

            {activeList.length === 0 ? (
              <p className="activiteiten-empty">{emptyMessage}</p>
            ) : (
              <ul className="activiteiten-lijst">
                {activeList.map((a) => {
                  const cat = getCategoryByValue(a.category);
                  return (
                    <li key={a.id}>
                      <Link to={`/activiteiten/${a.id}`} className="profiel-item">
                        <span className="profiel-item-icoon" style={{ background: cat?.bg ?? "#ede8fb" }}>
                          {cat?.icon ?? "📌"}
                        </span>
                        <span className="profiel-item-tekst">
                          <span className="profiel-item-titel">{a.title}</span>
                          <span className="profiel-item-sub">
                            {formatDateTime(a.start_time)} · {a.location_name}
                          </span>
                        </span>
                        <span className="profiel-item-tag" style={{ color: cat?.accent ?? "#6c4ff5" }}>
                          {statusLabel(a.start_time)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
