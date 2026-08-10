import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Map, Marker, InfoWindow } from "@vis.gl/react-google-maps";
import { listActivities } from "../api/client";
import AvatarStack from "../components/AvatarStack";
import Skeleton from "../components/Skeleton";
import { useAuth } from "../auth/AuthContext";
import { getCategoryBySlug, getCategoryByValue } from "../constants/categories";
import { EHB_CAMPUS_CENTER, PIN_ICON } from "../constants/maps";
import { distanceInMeters, formatDistance } from "../utils/distance";
import { formatDateTime, formatTime, formatWeekdayShort } from "../utils/formatDate";
import { useUserLocation } from "../hooks/useUserLocation";
import "./Activiteiten.css";

const FILTERS = [
  { key: "vandaag", label: "Vandaag" },
  { key: "week", label: "Deze week" },
  { key: "dichtbij", label: "< 1 km" },
  { key: "plek", label: "Plek vrij" },
];

function matchesFilter(a, filter, userLocation) {
  if (!filter) return true;
  const start = new Date(a.start_time);
  const now = new Date();
  if (filter === "vandaag") return start.toDateString() === now.toDateString();
  if (filter === "week") {
    const inZevenDagen = new Date(now);
    inZevenDagen.setDate(inZevenDagen.getDate() + 7);
    return start >= now && start <= inZevenDagen;
  }
  if (filter === "dichtbij") {
    if (!userLocation || !a.latitude || !a.longitude) return false;
    return distanceInMeters(userLocation, { lat: a.latitude, lng: a.longitude }) < 1000;
  }
  if (filter === "plek") return a.participant_count < a.max_participants;
  return true;
}

export default function ActiviteitenLijst() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const category = slug ? getCategoryBySlug(slug) : null;
  const isOntdek = !slug;
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("lijst");
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState(null);
  const userLocation = useUserLocation(user?.share_location);

  useEffect(() => {
    if (!isOntdek && !category) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    listActivities(category ? { category: category.value } : {})
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

  if (!isOntdek && !category) {
    return (
      <div className="activiteiten-screen">
        <p>Onbekende categorie.</p>
        <Link to="/">Terug naar categorieën</Link>
      </div>
    );
  }

  const zichtbareActiviteiten = activities.filter((a) => matchesFilter(a, filter, userLocation));

  return (
    <div className="activiteiten-screen">
      <header className="activiteiten-header">
        <button className="activiteiten-back" onClick={() => navigate("/")}>
          &larr;
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="activiteiten-title">{category ? category.label : "Alle activiteiten"}</h1>
          <p className="activiteiten-count-subtitle">{activities.length} activiteiten</p>
        </div>
      </header>

      <div className="profiel-tabs">
        <span
          className="profiel-tabs-indicator"
          style={{ transform: view === "lijst" ? "translateX(0%)" : "translateX(100%)" }}
        />
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
      {loading && (
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
      )}
      {!loading && !error && activities.length === 0 && (
        <p className="activiteiten-empty">
          {isOntdek ? "Nog geen activiteiten. Maak er zelf een aan!" : "Nog geen activiteiten in deze categorie. Maak er zelf een aan!"}
        </p>
      )}

      {!loading && !error && activities.length > 0 && view === "lijst" && (
        <>
          <div className="filter-pillen">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`filter-pil${filter === f.key ? " actief" : ""}`}
                onClick={() => setFilter(filter === f.key ? null : f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {zichtbareActiviteiten.length === 0 ? (
            <p className="activiteiten-empty">Geen activiteiten voor dit filter.</p>
          ) : (
            <ul className="activiteiten-lijst">
              {zichtbareActiviteiten.map((a) => {
                const itemCategory = isOntdek ? getCategoryByValue(a.category) : category;
                const vol = a.participant_count >= a.max_participants;
                const afstand =
                  userLocation && a.latitude && a.longitude
                    ? formatDistance(distanceInMeters(userLocation, { lat: a.latitude, lng: a.longitude }))
                    : null;

                return (
                  <li key={a.id}>
                    <Link to={`/activiteiten/${a.id}`} className="activiteit-rij">
                      <div className="activiteit-rij-tijd" style={{ "--accent": itemCategory?.accent ?? "#6c4ff5" }}>
                        <span className="activiteit-rij-uur">{formatTime(a.start_time)}</span>
                        <span className="activiteit-rij-dag">{formatWeekdayShort(a.start_time)}</span>
                        <span className="activiteit-rij-balk" />
                      </div>
                      <div className="activiteit-rij-inhoud">
                        {isOntdek && itemCategory && (
                          <span className="badge" style={{ background: itemCategory.bg, color: itemCategory.accent }}>
                            {itemCategory.label}
                          </span>
                        )}
                        <div className="activiteit-rij-titel">{a.title}</div>
                        <div className="activiteit-rij-plaats">
                          {a.location_name}
                          {afstand && ` · ${afstand}`}
                        </div>
                        <div className="activiteit-rij-footer">
                          <AvatarStack participants={a.participants_preview} />
                          <span className="activiteit-rij-spots" style={{ color: vol ? "#a29dbc" : itemCategory?.accent ?? "#6c4ff5" }}>
                            {vol ? "Vol" : `${a.max_participants - a.participant_count} plekken`}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
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
    </div>
  );
}
