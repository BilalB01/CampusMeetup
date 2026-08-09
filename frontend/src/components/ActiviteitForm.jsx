import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Map, Marker, useMap } from "@vis.gl/react-google-maps";
import { CATEGORIES } from "../constants/categories";
import { EHB_CAMPUS_CENTER, PIN_ICON } from "../constants/maps";
import { useAddressAutocomplete } from "../hooks/useAddressAutocomplete";
import "../pages/Activiteiten.css";

// Stuurt de kaart imperatief aan: defaultCenter werkt enkel bij het
// eerste laden, dus dit pant de kaart mee zodra position() nadien wijzigt
// (bv. na het kiezen van een adressuggestie)
function KaartPanner({ position }) {
  const map = useMap();
  useEffect(() => {
    if (map) map.panTo(position);
  }, [map, position]);
  return null;
}

// Herbruikbaar formulier voor zowel het aanmaken als het bewerken van een
// activiteit — enkel de beginwaarden en de save-actie verschillen tussen
// ActiviteitAanmaken.jsx en ActiviteitBewerken.jsx
export default function ActiviteitForm({ heading, initialValues, onSave, submitLabel, cancelLink }) {
  const [title, setTitle] = useState(initialValues.title ?? "");
  const [description, setDescription] = useState(initialValues.description ?? "");
  const [locationName, setLocationName] = useState(initialValues.locationName ?? "");
  const [position, setPosition] = useState(initialValues.position ?? EHB_CAMPUS_CENTER);
  const [startTime, setStartTime] = useState(initialValues.startTime ?? "");
  const [maxParticipants, setMaxParticipants] = useState(initialValues.maxParticipants ?? 2);
  const [category, setCategory] = useState(initialValues.category ?? CATEGORIES[0].value);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { suggestions, search, selectSuggestion } = useAddressAutocomplete();

  function handleMapClick(e) {
    if (e.detail.latLng) setPosition(e.detail.latLng);
  }

  function handleLocationChange(e) {
    const value = e.target.value;
    setLocationName(value);
    search(value);
  }

  async function handleSelectSuggestion(suggestion) {
    const { name, lat, lng } = await selectSuggestion(suggestion);
    setLocationName(name);
    setPosition({ lat, lng });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // datetime-local geeft lokale tijd zonder tijdzone; Date zet dit correct om naar ISO/UTC
      await onSave({
        title,
        description,
        location_name: locationName,
        latitude: position.lat,
        longitude: position.lng,
        start_time: new Date(startTime).toISOString(),
        max_participants: Number(maxParticipants),
        category,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card auth-card--form" onSubmit={handleSubmit}>
        <h1 className="auth-title">{heading}</h1>

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

        <div className="auth-field auth-field--autocomplete">
          <label htmlFor="location">Locatie</label>
          <input
            id="location"
            required
            autoComplete="off"
            value={locationName}
            onChange={handleLocationChange}
            placeholder="bv. Cafetaria EhB"
          />
          {suggestions.length > 0 && (
            <ul className="locatie-suggesties">
              {suggestions.map((s) => (
                <li key={s.placePrediction.placeId}>
                  <button type="button" onMouseDown={() => handleSelectSuggestion(s)}>
                    {s.placePrediction.text.toString()}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="auth-field">
          <label>Locatie op de kaart</label>
          <div className="locatie-kaart">
            <Map
              style={{ width: "100%", height: "220px" }}
              defaultCenter={position}
              defaultZoom={16}
              gestureHandling="cooperative"
              disableDefaultUI
              onClick={handleMapClick}
            >
              <Marker position={position} icon={PIN_ICON} />
              <KaartPanner position={position} />
            </Map>
          </div>
          <span className="auth-hint">Tik op de kaart om de exacte locatie te kiezen.</span>
        </div>

        <div className="auth-field--rij">
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
        </div>

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? "Bezig..." : submitLabel}
        </button>
        <Link className="auth-switch" to={cancelLink}>
          Annuleren
        </Link>
      </form>
    </div>
  );
}
