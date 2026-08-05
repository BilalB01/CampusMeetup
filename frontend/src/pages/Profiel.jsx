import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getMyActivities } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { formatDateTime } from "../utils/formatDate";
import "./Activiteiten.css";

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

  return (
    <div className="activiteiten-screen">
      <header className="activiteiten-header">
        <button className="activiteiten-back" onClick={() => navigate("/")}>
          &larr;
        </button>
        <h1 className="activiteiten-title">Profiel</h1>
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
              {activeList.map((a) => (
                <li key={a.id}>
                  <Link to={`/activiteiten/${a.id}`} className="activiteit-card">
                    <h2>{a.title}</h2>
                    <p>
                      {formatDateTime(a.start_time)} · {a.location_name}
                    </p>
                    <p>
                      {a.participant_count} / {a.max_participants} deelnemers
                    </p>
                    <span className="activiteit-cta">Bekijken</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <button className="profiel-logout" onClick={handleLogout}>
        Uitloggen
      </button>
    </div>
  );
}
