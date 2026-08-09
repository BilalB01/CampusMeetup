import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Map, Marker } from "@vis.gl/react-google-maps";
import { deleteActivity, getActivity, joinActivity, leaveActivity } from "../api/client";
import AvatarStack from "../components/AvatarStack";
import Skeleton from "../components/Skeleton";
import { useAuth } from "../auth/AuthContext";
import { getCategoryByValue } from "../constants/categories";
import { PIN_ICON } from "../constants/maps";
import { formatDateTime } from "../utils/formatDate";
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

  async function handleShare() {
    await navigator.clipboard.writeText(window.location.href);
    setGekopieerd(true);
    setTimeout(() => setGekopieerd(false), 2000);
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

  return (
    <div className="activiteiten-screen">
      <div className="detail-hero">
        <div className="detail-hero-top">
          <button className="detail-hero-back" onClick={() => navigate(overzichtLink)}>
            &larr;
          </button>
          <button className="detail-hero-back" onClick={handleShare} aria-label="Link kopiëren">
            {gekopieerd ? "✓" : "⇪"}
          </button>
        </div>
        {category && <span className="detail-hero-badge">{category.label}</span>}
        <h1 className="detail-hero-title">{activity.title}</h1>
      </div>

      <div className="detail-card">
        <div className="detail-hoofdinhoud">
          {activity.description && <p className="detail-description">{activity.description}</p>}

          <div className="detail-meta">
            <span className="detail-meta-row">
              <span className="detail-meta-icon">📅</span>
              {formatDateTime(activity.start_time)}
            </span>
            <span className="detail-meta-row">
              <span className="detail-meta-icon">📍</span>
              {activity.location_name}
            </span>
            <span className="detail-meta-row">
              <span className="detail-meta-icon">👤</span>
              Georganiseerd door {activity.organizer.name}
            </span>
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
                style={{ width: "100%", height: "160px" }}
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
              <div className="detail-participants-row">
                <AvatarStack participants={activity.participants} max={4} />
                <span className="detail-participants-organizer">{activity.organizer.name} organiseert</span>
              </div>
              <div className="voortgangsbalk">
                <div className="voortgangsbalk-vulling" style={{ width: `${voortgangPercentage}%` }} />
              </div>
              <p className="detail-participants-plekken">
                {isFull ? "Volzet" : `${plekkenVrij} plek${plekkenVrij === 1 ? "" : "ken"} vrij`}
              </p>
            </>
          ) : (
            <p className="detail-empty-participants">Nog geen deelnemers.</p>
          )}
        </div>
      </div>

      {actionError && <div className="auth-error">{actionError}</div>}

      <div className="detail-acties-rij">
        <button className="auth-submit" onClick={handleToggleJoin} disabled={joinDisabled}>
          {buttonLabel}
        </button>
        {activity.is_joined && (
          <Link to={`/activiteiten/${id}/chat`} className="detail-chat-knop" aria-label="Open groepschat">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}
