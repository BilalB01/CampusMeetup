import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getMyActivities } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { getCategoryByValue } from "../constants/categories";
import { formatDateTime } from "../utils/formatDate";
import "./Activiteiten.css";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("organized");

  useEffect(() => {
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
    return () => {
      cancelled = true;
    };
  }, [token]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const initial = user?.name?.[0]?.toUpperCase() ?? "?";
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
          &larr;
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" className="profiel-logout-link" onClick={handleLogout}>
          Uitloggen
        </button>
      </header>

      <div className="profiel-avatar-row">
        <div className="profiel-avatar">{initial}</div>
        <div>
          <p className="profiel-naam">{user?.name}</p>
          <p className="profiel-email">{user?.email}</p>
        </div>
      </div>

      {error && <div className="auth-error">{error}</div>}
      {loading && <p>Bezig met laden...</p>}

      {!loading && !error && (
        <>
          <div className="profiel-stats-rij">
            {stats.map((s) => (
              <div key={s.l} className="profiel-stat-tegel">
                <div className="profiel-stat-getal">{s.n}</div>
                <div className="profiel-stat-label">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Tabwissel is pure lokale state: beide lijsten zijn al opgehaald
              in de useEffect hierboven, dus wisselen kost geen extra API-call */}
          <div className="profiel-tabs">
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
        </>
      )}
    </div>
  );
}
