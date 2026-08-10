import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Map, Marker } from "@vis.gl/react-google-maps";
import { API_URL, deleteActivity, getActivity, joinActivity, leaveActivity, shareActivityByEmail } from "../api/client";
import Skeleton from "../components/Skeleton";
import { useAuth } from "../auth/AuthContext";
import { getCategoryByValue } from "../constants/categories";
import { PIN_ICON } from "../constants/maps";
import { getGoogleAgendaUrl } from "../utils/calendar";
import { distanceInMeters, formatDistance } from "../utils/distance";
import { formatDateTime } from "../utils/formatDate";
import { useUserLocation } from "../hooks/useUserLocation";
import "./Activiteiten.css";

export default function ActiviteitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [gekopieerd, setGekopieerd] = useState(false);
  const [toonDeelPaneel, setToonDeelPaneel] = useState(false);
  const [toonAgendaPaneel, setToonAgendaPaneel] = useState(false);
  const [deelEmail, setDeelEmail] = useState("");
  const [deelBericht, setDeelBericht] = useState("");
  const [deelBezig, setDeelBezig] = useState(false);
  const [deelFout, setDeelFout] = useState("");
  const [deelGelukt, setDeelGelukt] = useState(false);
  const userLocation = useUserLocation(user?.share_location);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getActivity(id, { token })
      .then((data) => {
        if (!cancelled) setActivity(data);
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
        "Weet je zeker dat je deze activiteit wil verwijderen? Dit kan niet ongedaan gemaakt worden.",
      )
    )
      return;
    setActionError("");
    setActionLoading(true);
    try {
      await deleteActivity(id, token);
      navigate(overzichtLink);
    } catch (err) {
      setActionError(err.message);
      setActionLoading(false);
    }
  }

  async function handleToggleJoin() {
    setActionError("");
    setActionLoading(true);
    try {
      // Join/leave geven allebei het volledige, bijgewerkte detail terug —
      // geen extra fetch nodig om de nieuwe teller/status te tonen
      const updated = activity.is_joined ? await leaveActivity(id, token) : await joinActivity(id, token);
      setActivity(updated);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setGekopieerd(true);
    setTimeout(() => setGekopieerd(false), 2000);
  }

  async function handleEmailDelen(e) {
    e.preventDefault();
    setDeelFout("");
    setDeelBezig(true);
    try {
      await shareActivityByEmail(id, { email: deelEmail, message: deelBericht || null }, token);
      setDeelGelukt(true);
      setDeelEmail("");
      setDeelBericht("");
      setTimeout(() => {
        setDeelGelukt(false);
        setToonDeelPaneel(false);
      }, 1500);
    } catch (err) {
      setDeelFout(err.message);
    } finally {
      setDeelBezig(false);
    }
  }

  if (loading) {
    return (
      <div className="activiteiten-screen">
        <div className="detail-hero">
          <div className="detail-hero-top">
            <Skeleton style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,.35)" }} />
          </div>
          <Skeleton style={{ width: "60%", height: 24, background: "rgba(255,255,255,.35)" }} />
        </div>
        <div className="detail-card">
          <div className="detail-hoofdinhoud">
            <Skeleton style={{ height: 16, width: "90%" }} />
            <Skeleton style={{ height: 16, width: "70%" }} />
            <Skeleton style={{ height: 60 }} />
          </div>
          <Skeleton style={{ height: 100 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="activiteiten-screen">
        <div className="auth-error">{error}</div>
        <Link to="/">Terug naar categorieën</Link>
      </div>
    );
  }

  const category = getCategoryByValue(activity.category);
  const overzichtLink = category ? `/activiteiten/categorie/${category.slug}` : "/";

  const isFull = activity.participant_count >= activity.max_participants;
  const joinDisabled = actionLoading || (isFull && !activity.is_joined);
  const buttonLabel = actionLoading
    ? "Bezig..."
    : isFull && !activity.is_joined
      ? "Volzet"
      : activity.is_joined
        ? "Afmelden"
        : "Doe mee";
  const plekkenVrij = activity.max_participants - activity.participant_count;
  const voortgangPercentage = Math.min(100, (activity.participant_count / activity.max_participants) * 100);
  const joinHint = activity.is_joined ? "Je staat op de lijst. De groepschat is open." : null;
  const afstand =
    userLocation && activity.latitude && activity.longitude
      ? formatDistance(distanceInMeters(userLocation, { lat: activity.latitude, lng: activity.longitude }))
      : null;

  return (
    <div className="activiteiten-screen">
      <div className="detail-hero">
        <div className="detail-hero-blob-clip" />
        <div className="detail-hero-top">
          <button className="detail-hero-back detail-hero-back--tekst" onClick={() => navigate(overzichtLink)}>
            &larr; Alle activiteiten
          </button>
          <div className="detail-hero-acties">
            <div className="detail-deel-wrap">
              <button
                className="detail-hero-back detail-hero-back--tekst"
                onClick={() => setToonAgendaPaneel((v) => !v)}
              >
                📅 Agenda
              </button>
              {toonAgendaPaneel && (
                <div className="detail-deel-paneel">
                  <a
                    className="detail-deel-link-knop"
                    href={`${API_URL}/activities/${activity.id}/ics`}
                    onClick={() => setToonAgendaPaneel(false)}
                  >
                    📥 Downloaden (.ics)
                  </a>
                  <a
                    className="detail-deel-link-knop"
                    href={getGoogleAgendaUrl(activity)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setToonAgendaPaneel(false)}
                  >
                    🗓️ Google Agenda
                  </a>
                </div>
              )}
            </div>
            <div className="detail-deel-wrap">
              <button
                className="detail-hero-back detail-hero-back--tekst"
                onClick={() => setToonDeelPaneel((v) => !v)}
              >
                ⇪ Delen
              </button>
              {toonDeelPaneel && (
                <div className="detail-deel-paneel">
                  <button type="button" className="detail-deel-link-knop" onClick={handleCopyLink}>
                    {gekopieerd ? "✓ Link gekopieerd" : "Link kopiëren"}
                  </button>
                  <form className="detail-deel-form" onSubmit={handleEmailDelen}>
                    <label htmlFor="deel-email">Versturen via e-mail</label>
                    <input
                      id="deel-email"
                      type="email"
                      required
                      placeholder="vriend@student.ehb.be"
                      value={deelEmail}
                      onChange={(e) => setDeelEmail(e.target.value)}
                    />
                    <textarea
                      placeholder="Persoonlijk berichtje (optioneel)"
                      value={deelBericht}
                      onChange={(e) => setDeelBericht(e.target.value)}
                    />
                    {deelFout && <div className="auth-error">{deelFout}</div>}
                    {deelGelukt && <div className="instellingen-gelukt">Uitnodiging verstuurd!</div>}
                    <button className="auth-submit" type="submit" disabled={deelBezig}>
                      {deelBezig ? "Bezig..." : "Versturen"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="detail-hero-content">
          {category && <span className="detail-hero-badge">{category.label}</span>}
          <h1 className="detail-hero-title">{activity.title}</h1>
          <p className="detail-hero-sub">
            {formatDateTime(activity.start_time)} · {activity.location_name}
            {afstand && ` · ${afstand}`}
          </p>
        </div>
      </div>

      <div className="detail-card">
        <div className="detail-hoofdinhoud">
          {activity.description && <p className="detail-description">{activity.description}</p>}

          <div className="detail-info-grid">
            <div className="detail-info-chip">
              <span className="detail-meta-icon">📅</span>
              {formatDateTime(activity.start_time)}
            </div>
            <div className="detail-info-chip">
              <span className="detail-meta-icon">📍</span>
              {activity.location_name}
            </div>
            <div className="detail-info-chip">
              <span className="detail-meta-icon">👤</span>
              Georganiseerd door {activity.organizer.name}
            </div>
          </div>

          {activity.organizer.id === user.id && (
            <div className="organizer-acties">
              <Link
                to={`/activiteiten/${activity.id}/bewerken`}
                className="organizer-actie organizer-actie--bewerken"
              >
                Bewerken
              </Link>
              <button
                type="button"
                className="organizer-actie organizer-actie--verwijderen"
                onClick={handleDelete}
                disabled={actionLoading}
              >
                Verwijderen
              </button>
            </div>
          )}

          {activity.latitude && activity.longitude && (
            <div className="locatie-kaart">
              <Map
                style={{ width: "100%", height: "440px" }}
                defaultCenter={{ lat: activity.latitude, lng: activity.longitude }}
                defaultZoom={16}
                gestureHandling="cooperative"
                disableDefaultUI
              >
                <Marker position={{ lat: activity.latitude, lng: activity.longitude }} icon={PIN_ICON} />
              </Map>
              <a
                className="route-link"
                href={`https://www.google.com/maps/dir/?api=1&destination=${activity.latitude},${activity.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Route bekijken →
              </a>
            </div>
          )}
        </div>

        <div className="detail-participants">
          <p className="detail-section-title">
            👥 Deelnemers ({activity.participant_count} / {activity.max_participants})
          </p>
          {activity.participants.length > 0 ? (
            <>
              <div className="voortgangsbalk">
                <div className="voortgangsbalk-vulling" style={{ width: `${voortgangPercentage}%` }} />
              </div>
              <p className="detail-participants-plekken">
                {isFull ? "Volzet" : `${plekkenVrij} plek${plekkenVrij === 1 ? "" : "ken"} vrij`}
              </p>
              <ul className="detail-deelnemers-lijst">
                {activity.participants.map((p) => (
                  <li key={p.id} className="detail-deelnemer-rij">
                    <span className="detail-deelnemer-avatar">{p.name?.[0]?.toUpperCase() ?? "?"}</span>
                    <span className="detail-deelnemer-naam">{p.name}</span>
                    <span className="detail-deelnemer-rol">
                      {p.id === activity.organizer.id ? "Organisator" : "Deelnemer"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="detail-empty-participants">Nog geen deelnemers.</p>
          )}

          {actionError && <div className="auth-error">{actionError}</div>}

          <button className="auth-submit" onClick={handleToggleJoin} disabled={joinDisabled}>
            {buttonLabel}
          </button>
          {activity.is_joined && (
            <Link to={`/activiteiten/${id}/chat`} className="detail-chat-link">
              Groepschat openen
            </Link>
          )}
          {joinHint && <p className="detail-join-hint">{joinHint}</p>}
        </div>
      </div>
    </div>
  );
}
