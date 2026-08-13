import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Map, Marker, useMap } from "@vis.gl/react-google-maps";
import { listActivities } from "../api/client";
import ActiviteitDatumKiezer from "./ActiviteitDatumKiezer";
import { CATEGORIES, getCategoryByValue } from "../constants/categories";
import { EHB_CAMPUS_CENTER, PIN_ICON } from "../constants/maps";
import { useAddressAutocomplete } from "../hooks/useAddressAutocomplete";
import { formatWeekdayShort, toDateInputValue } from "../utils/formatDate";
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

  // Enkel voor de desktop week/dag-kiezer (zie ActiviteitDatumKiezer.jsx) —
  // startTime blijft de echte bron van waarheid, pickerDate stuurt enkel
  // welke dag daar geselecteerd is
  const [pickerDate, setPickerDate] = useState(
    initialValues.startTime ? new Date(initialValues.startTime) : new Date(),
  );
  // Enkel voor dagstippen/"al gepland" in de kiezer, geen invloed op opslaan
  const [activities, setActivities] = useState([]);
  useEffect(() => {
    listActivities().then(setActivities).catch(() => {});
  }, []);

  function handleSelectDay(date) {
    setPickerDate(date);
    if (startTime) {
      // dag wijzigen terwijl er al een tijdstip gekozen is: uur behouden
      const [, timePart] = startTime.split("T");
      setStartTime(`${toDateInputValue(date)}T${timePart}`);
    }
  }

  function handleSelectSlot(timeStr) {
    setStartTime(`${toDateInputValue(pickerDate)}T${timeStr}`);
  }

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
    // Op desktop is de datetime-local-input (met het required-attribuut)
    // verborgen — een verborgen required-veld telt in sommige browsers nog
    // mee voor validatie en kan de submit stil laten mislukken, dus hier
    // expliciet gecheckt i.p.v. enkel op native HTML-validatie te vertrouwen
    if (!startTime) {
      setError("Kies een datum en tijdstip.");
      return;
    }
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
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <span className="auth-hint auth-hint--rechts">{description.length} / 1000</span>
        </div>

        {/* Categorie: mobiel een <select>, desktop pillen — zelfde category-state,
            CSS wisselt welke variant getoond wordt vanaf 900px */}
        <div className="auth-field veld-mobiel">
          <label htmlFor="category">Categorie</label>
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="auth-field veld-desktop">
          <label>Categorie</label>
          <div className="categorie-pillen">
            {CATEGORIES.map((c) => (
              <button
                key={c.slug}
                type="button"
                className={`categorie-pil${category === c.value ? " actief" : ""}`}
                style={{ "--cat-bg": c.bg, "--cat-accent": c.accent }}
                onClick={() => setCategory(c.value)}
              >
                <span>{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
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

        {/* datetime-local + max_participants: mobiel de bestaande eenvoudige
            velden, desktop de week/dag-kiezer + tijdslot-grid + voorbeeldkaart
            (zie ActiviteitDatumKiezer.jsx). required weg bij de datetime-local-
            input: die staat verborgen op desktop, en een verborgen required-
            veld kan de submit daar stil laten mislukken (zie handleSubmit) */}
        <div className="auth-field--rij veld-mobiel">
          <div className="auth-field">
            <label htmlFor="start_time">Datum en tijd</label>
            <input
              id="start_time"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="max_participants">Max. aantal deelnemers</label>
            <input
              id="max_participants"
              type="number"
              min="2"
              max="500"
              required
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
            />
          </div>
        </div>

        <div className="auth-field veld-desktop">
          <label>Datum en tijd</label>
          <ActiviteitDatumKiezer
            activities={activities}
            pickerDate={pickerDate}
            onSelectDay={handleSelectDay}
            selectedTime={startTime ? startTime.split("T")[1] : null}
            onSelectSlot={handleSelectSlot}
          />
        </div>

        <div className="auth-field veld-desktop">
          <label htmlFor="max_participants_desktop">Max. aantal deelnemers</label>
          {/* Geen required hier: dit veld staat op mobiel verborgen (.veld-
              desktop), en een verborgen required-veld kan de submit daar stil
              laten mislukken (zelfde reden als bij de datetime-local-input
              hierboven) -- het zichtbare mobiele #max_participants-veld
              hierboven blijft wél required en bewaakt de ondergrens van 2 */}
          <input
            id="max_participants_desktop"
            type="number"
            min="2"
            max="500"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
          />
        </div>

        <div className="auth-field veld-desktop">
          <label>Voorbeeld</label>
          {(() => {
            const previewCategory = getCategoryByValue(category);
            const previewTime = startTime ? startTime.split("T")[1] : "--:--";
            return (
              <div className="activiteit-rij activiteit-voorbeeld">
                <div className="activiteit-rij-tijd" style={{ "--accent": previewCategory?.accent ?? "#6c4ff5" }}>
                  <span className="activiteit-rij-uur">{previewTime}</span>
                  <span className="activiteit-rij-dag">{formatWeekdayShort(pickerDate)}</span>
                  <span className="activiteit-rij-balk" />
                </div>
                <div className="activiteit-rij-inhoud">
                  <span
                    className="badge"
                    style={{ background: previewCategory?.bg, color: previewCategory?.accent }}
                  >
                    {previewCategory?.label}
                  </span>
                  <div className="activiteit-rij-titel">{title || "Titel van je activiteit"}</div>
                  <div className="activiteit-rij-plaats">{locationName || "Locatie"}</div>
                </div>
              </div>
            );
          })()}
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
