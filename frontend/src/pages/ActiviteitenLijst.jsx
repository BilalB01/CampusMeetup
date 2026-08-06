import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Map, Marker, InfoWindow } from "@vis.gl/react-google-maps";
import { listActivities } from "../api/client";
import { getCategoryBySlug } from "../constants/categories";
import { EHB_CAMPUS_CENTER, PIN_ICON } from "../constants/maps";
import { formatDateTime } from "../utils/formatDate";
import "./Activiteiten.css";

export default function ActiviteitenLijst() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const category = getCategoryBySlug(slug);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("lijst");
  const [selected, setSelected] = useState(null);

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

      <div className="profiel-tabs">
        <button
          className={`profiel-tab${view === "lijst" ? " actief" : ""}`}
          onClick={() => setView("lijst")}
        >
          Lijst
        </button>
        <button
          className={`profiel-tab${view === "kaart" ? " actief" : ""}`}
          onClick={() => setView("kaart")}
        >
          Kaart
        </button>
      </div>

      {error && <div className="auth-error">{error}</div>}
      {loading && <p>Bezig met laden...</p>}
      {!loading && !error && activities.length === 0 && (
        <p className="activiteiten-empty">Nog geen activiteiten in deze categorie. Maak er zelf een aan!</p>
      )}

      {!loading && !error && activities.length > 0 && view === "lijst" && (
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
      )}

      {!loading && !error && activities.length > 0 && view === "kaart" && (
        <div className="kaart-weergave">
          <Map
            style={{ width: "100%", height: "420px" }}
            defaultCenter={EHB_CAMPUS_CENTER}
            defaultZoom={15}
            gestureHandling="greedy"
          >
            {activities
              .filter((a) => a.latitude && a.longitude)
              .map((a) => (
                <Marker
                  key={a.id}
                  position={{ lat: a.latitude, lng: a.longitude }}
                  icon={PIN_ICON}
                  onClick={() => setSelected(a)}
                />
              ))}
            {selected && (
              <InfoWindow
                position={{ lat: selected.latitude, lng: selected.longitude }}
                onCloseClick={() => setSelected(null)}
              >
                <div className="kaart-infovenster">
                  <strong>{selected.title}</strong>
                  <p>{formatDateTime(selected.start_time)}</p>
                  <Link to={`/activiteiten/${selected.id}`}>Bekijk details</Link>
                </div>
              </InfoWindow>
            )}
          </Map>
        </div>
      )}

      <Link to={`/activiteiten/categorie/${slug}/nieuw`} className="fab" aria-label="Activiteit aanmaken">
        +
      </Link>
    </div>
  );
}
