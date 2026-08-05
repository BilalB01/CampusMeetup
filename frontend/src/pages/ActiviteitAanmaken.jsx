import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { createActivity } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CATEGORIES, getCategoryBySlug } from "../constants/categories";
import "./Activiteiten.css";

// Vaste plaatshouder-coördinaat (EhB-campus) zolang er geen echte kaartintegratie is
const PLACEHOLDER_LOCATIE = { latitude: 50.8466, longitude: 4.3528 };

export default function ActiviteitAanmaken() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const defaultCategory = getCategoryBySlug(slug)?.value ?? CATEGORIES[0].value;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [category, setCategory] = useState(defaultCategory);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // datetime-local geeft lokale tijd zonder tijdzone; Date zet dit correct om naar ISO/UTC
      const activity = await createActivity(
        {
          title,
          description,
          location_name: locationName,
          latitude: PLACEHOLDER_LOCATIE.latitude,
          longitude: PLACEHOLDER_LOCATIE.longitude,
          start_time: new Date(startTime).toISOString(),
          max_participants: Number(maxParticipants),
          category,
        },
        token,
      );
      navigate(`/activiteiten/${activity.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">Activiteit aanmaken</h1>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-field">
          <label htmlFor="title">Titel</label>
          <input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="auth-field">
          <label htmlFor="description">Beschrijving</label>
          <textarea
            id="description"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="category">Categorie</label>
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="auth-field">
          <label htmlFor="location">Locatie</label>
          <input
            id="location"
            required
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="bv. Cafetaria EhB"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="start_time">Datum en tijd</label>
          <input
            id="start_time"
            type="datetime-local"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="max_participants">Max. aantal deelnemers</label>
          <input
            id="max_participants"
            type="number"
            min="1"
            max="500"
            required
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
          />
        </div>

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? "Bezig..." : "Aanmaken"}
        </button>
        <Link className="auth-switch" to={`/activiteiten/categorie/${slug}`}>
          Annuleren
        </Link>
      </form>
    </div>
  );
}
