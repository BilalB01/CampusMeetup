import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { deleteAdminUser, getAdminUserDetail } from "../api/client";
import Skeleton from "../components/Skeleton";
import { useAuth } from "../auth/AuthContext";
import { getCategoryByValue } from "../constants/categories";
import { formatDateTime } from "../utils/formatDate";
import { heeftTerugGeschiedenis } from "../utils/nav";
import "./Activiteiten.css";

// "Vandaag"/"Actief"/"Voorbij" -- zelfde helper als Profiel.jsx
function statusLabel(startTime) {
  const start = new Date(startTime);
  const now = new Date();
  if (start < now) return "Voorbij";
  if (start.toDateString() === now.toDateString()) return "Vandaag";
  return "Actief";
}

// Detail van één gebruiker, bereikt door op een kaartje op
// AdminGebruikers.jsx te klikken -- enkel bereikbaar voor is_admin=True
export default function AdminGebruikerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useAuth();

  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("organized");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getAdminUserDetail(id, token)
      .then((data) => {
        if (!cancelled) setTarget(data);
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
  }, [id, token]);

  async function handleDelete() {
    if (
      !window.confirm(
        `Weet je zeker dat je "${target.name}" permanent wil verwijderen? Dit account, zijn/haar activiteiten en berichten verdwijnen definitief. Dit kan niet ongedaan gemaakt worden.`,
      )
    )
      return;
    try {
      await deleteAdminUser(target.id, token);
      navigate("/admin/gebruikers");
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="activiteiten-screen">
        <header className="activiteiten-header">
          <button
            className="activiteiten-back"
            onClick={() => navigate(heeftTerugGeschiedenis(location) ? -1 : "/admin/gebruikers")}
          >
            <ArrowLeft size={18} strokeWidth={2.3} />
          </button>
        </header>
        <Skeleton style={{ height: 42, width: 42, borderRadius: 15, marginBottom: 12 }} />
        <Skeleton style={{ height: 16, width: "50%", marginBottom: 8 }} />
        <Skeleton style={{ height: 12, width: "70%" }} />
      </div>
    );
  }

  if (error || !target) {
    return (
      <div className="activiteiten-screen">
        <div className="auth-error">{error || "Gebruiker niet gevonden."}</div>
        <Link to="/admin/gebruikers">Terug naar gebruikers</Link>
      </div>
    );
  }

  const activeList = tab === "organized" ? target.organized : target.joined;

  return (
    <div className="activiteiten-screen">
      <header className="activiteiten-header">
        <button
          className="activiteiten-back"
          onClick={() => navigate(heeftTerugGeschiedenis(location) ? -1 : "/admin/gebruikers")}
        >
          <ArrowLeft size={18} strokeWidth={2.3} />
        </button>
        <h1 className="activiteiten-title">{target.name}</h1>
      </header>

      <div className="profiel-header-kaart">
        <div className="profiel-avatar-row">
          <div className="profiel-avatar">{target.name?.[0]?.toUpperCase() ?? "?"}</div>
          <div>
            <p className="profiel-naam">
              {target.name} {target.is_admin && <span className="admin-badge">Beheerder</span>}
            </p>
            <p className="profiel-email">{target.email}</p>
          </div>
        </div>

        <p className="activiteiten-subtitle">
          Lid sinds {formatDateTime(target.created_at)} · Inlog via{" "}
          {target.auth_provider === "microsoft" ? "Microsoft" : "wachtwoord"}
        </p>

        {error && <div className="auth-error">{error}</div>}

        {target.id !== user?.id && (
          <div className="profiel-header-acties">
            <button type="button" className="profiel-logout" onClick={handleDelete}>
              Gebruiker verwijderen
            </button>
          </div>
        )}
      </div>

      <div className="profiel-content-grid">
        <div className="profiel-activiteiten-kolom">
          <div className="profiel-tabs">
            <span
              className="profiel-tabs-indicator"
              style={{ transform: tab === "organized" ? "translateX(0%)" : "translateX(100%)" }}
            />
            <button
              className={`profiel-tab${tab === "organized" ? " actief" : ""}`}
              onClick={() => setTab("organized")}
            >
              Georganiseerd ({target.organized.length})
            </button>
            <button className={`profiel-tab${tab === "joined" ? " actief" : ""}`} onClick={() => setTab("joined")}>
              Deelgenomen ({target.joined.length})
            </button>
          </div>

          {activeList.length === 0 ? (
            <p className="activiteiten-empty">
              {tab === "organized" ? "Heeft nog geen activiteiten georganiseerd." : "Neemt nog niet deel aan andermans activiteiten."}
            </p>
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
    </div>
  );
}
