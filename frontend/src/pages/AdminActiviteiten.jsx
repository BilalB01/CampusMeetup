import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteAdminActivity, getAdminActivities } from "../api/client";
import ActiviteitRijKaart from "../components/ActiviteitRijKaart";
import Skeleton from "../components/Skeleton";
import { useAuth } from "../auth/AuthContext";
import { CATEGORIES, getCategoryByValue } from "../constants/categories";
import "./Activiteiten.css";

// Beheerscherm: alle activiteiten -- enkel bereikbaar voor is_admin=True (zie
// ProtectedRoute adminOnly-prop in App.jsx). Eigen, losstaande pagina i.p.v.
// een tab binnen één gedeeld Admin-scherm, met een eigen link in de zijbalk.
// Bewust GEEN "verlopen (>1u)"-filter zoals /activiteiten: een beheerder
// moet ook oude activiteiten terugvinden (zie GET /admin/activities)
export default function AdminActiviteiten() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categorieFilter, setCategorieFilter] = useState(null);
  const [zoekterm, setZoekterm] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getAdminActivities({ category: categorieFilter }, token)
      .then((data) => {
        if (!cancelled) setActivities(data);
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
  }, [token, categorieFilter]);

  // Permanent + verplichte reden -- window.prompt i.p.v. window.confirm,
  // want er is echte tekstinvoer nodig. De reden komt bij de deelnemers
  // terecht via de melding die de backend verstuurt (routers/admin.py)
  async function handleDeleteActivity(activity) {
    const reden = window.prompt(
      `Waarom wil je "${activity.title}" permanent verwijderen? Dit wordt getoond aan de deelnemers en kan niet ongedaan gemaakt worden.`,
    );
    if (reden === null) return; // geannuleerd
    if (!reden.trim()) {
      window.alert("Geef een reden op.");
      return;
    }
    try {
      await deleteAdminActivity(activity.id, reden.trim(), token);
      setActivities((prev) => prev.filter((a) => a.id !== activity.id));
    } catch (err) {
      setError(err.message);
    }
  }

  // Client-side filter op titel of locatie, bovenop de categoriefilter
  // hierboven (die loopt al server-side mee in getAdminActivities)
  const term = zoekterm.trim().toLowerCase();
  const zichtbareActiviteiten = term
    ? activities.filter(
        (a) => a.title?.toLowerCase().includes(term) || a.location_name?.toLowerCase().includes(term),
      )
    : activities;

  return (
    <div className="activiteiten-screen">
      <header className="activiteiten-header">
        <button className="activiteiten-back" onClick={() => navigate("/profiel")}>
          &larr;
        </button>
        <h1 className="activiteiten-title">Activiteiten ({activities.length})</h1>
      </header>

      <input
        type="text"
        className="admin-zoekbalk"
        placeholder="Zoek op titel of locatie..."
        value={zoekterm}
        onChange={(e) => setZoekterm(e.target.value)}
      />

      <div className="filter-pillen">
        <button
          type="button"
          className={`filter-pil${categorieFilter === null ? " actief" : ""}`}
          onClick={() => setCategorieFilter(null)}
        >
          Alle
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.slug}
            type="button"
            className={`filter-pil${categorieFilter === c.value ? " actief" : ""}`}
            onClick={() => setCategorieFilter(categorieFilter === c.value ? null : c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && <div className="auth-error">{error}</div>}
      {loading ? (
        <ul className="activiteiten-lijst">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <div className="activiteit-rij">
                <Skeleton style={{ width: 50, height: 50, borderRadius: 12, flexShrink: 0 }} />
                <div className="activiteit-rij-inhoud">
                  <Skeleton style={{ height: 14, width: "70%", marginBottom: 8 }} />
                  <Skeleton style={{ height: 11, width: "40%" }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : zichtbareActiviteiten.length === 0 ? (
        <p className="activiteiten-empty">
          {term ? "Geen activiteiten gevonden voor deze zoekopdracht." : "Geen activiteiten gevonden."}
        </p>
      ) : (
        <ul className="activiteiten-lijst">
          {zichtbareActiviteiten.map((a) => {
            const cat = getCategoryByValue(a.category);
            return (
              <li key={a.id} className="admin-activiteit-kaart-wrap">
                <ActiviteitRijKaart activiteit={a} categorie={cat} />
                <button
                  type="button"
                  className="admin-activiteit-verwijder-overlay"
                  onClick={() => handleDeleteActivity(a)}
                  aria-label="Activiteit verwijderen"
                  title="Activiteit verwijderen"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
