import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { listActivities } from "../api/client";
import { getCategoryBySlug } from "../constants/categories";
import { formatDateTime } from "../utils/formatDate";
import "./Activiteiten.css";

export default function ActiviteitenLijst() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const category = getCategoryBySlug(slug);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!category) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    listActivities({ category: category.value })
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
  }, [slug]);

  if (!category) {
    return (
      <div className="activiteiten-screen">
        <p>Onbekende categorie.</p>
        <Link to="/">Terug naar categorieën</Link>
      </div>
    );
  }

  return (
    <div className="activiteiten-screen">
      <header className="activiteiten-header">
        <button className="activiteiten-back" onClick={() => navigate("/")}>
          &larr;
        </button>
        <h1 className="activiteiten-title">{category.label}</h1>
      </header>

      {error && <div className="auth-error">{error}</div>}
      {loading && <p>Bezig met laden...</p>}
      {!loading && !error && activities.length === 0 && (
        <p className="activiteiten-empty">Nog geen activiteiten in deze categorie. Maak er zelf een aan!</p>
      )}

      <ul className="activiteiten-lijst">
        {activities.map((a) => (
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

      <Link to={`/activiteiten/categorie/${slug}/nieuw`} className="fab" aria-label="Activiteit aanmaken">
        +
      </Link>
    </div>
  );
}
