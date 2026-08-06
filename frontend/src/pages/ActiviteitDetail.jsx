import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Map, Marker } from "@vis.gl/react-google-maps";
import { API_URL, deleteActivity, getActivity, joinActivity, leaveActivity } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useActivityChat } from "../hooks/useActivityChat";
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

  const {
    messages,
    loading: chatLoading,
    error: chatError,
    sendError,
    sendText,
    sendImage,
  } = useActivityChat(id, token, activity?.is_joined ?? false);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function handleSendText(e) {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    sendText(trimmed);
    setChatInput("");
  }

  function handlePickImage(e) {
    const file = e.target.files?.[0];
    if (file) sendImage(file);
    e.target.value = ""; // laat toe dezelfde afbeelding opnieuw te kiezen
  }

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

  if (loading) {
    return (
      <div className="activiteiten-screen">
        <p>Bezig met laden...</p>
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

  return (
    <div className="activiteiten-screen">
      <header className="activiteiten-header">
        <button className="activiteiten-back" onClick={() => navigate(overzichtLink)}>
          &larr;
        </button>
        <h1 className="activiteiten-title">{activity.title}</h1>
      </header>

      <div className="detail-card">
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

        <div className="detail-participants">
          <p className="detail-section-title">
            👥 Deelnemers ({activity.participant_count} / {activity.max_participants})
          </p>
          {activity.participants.length > 0 ? (
            <ul className="deelnemers-lijst">
              {activity.participants.map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          ) : (
            <p className="detail-empty-participants">Nog geen deelnemers.</p>
          )}
        </div>
      </div>

      {actionError && <div className="auth-error">{actionError}</div>}

      <button className="auth-submit" onClick={handleToggleJoin} disabled={joinDisabled}>
        {buttonLabel}
      </button>

      {activity.is_joined && (
        <div className="chat-card">
          <p className="detail-section-title">💬 Chat</p>

          {chatError && <div className="auth-error">{chatError}</div>}

          {chatLoading ? (
            <p className="chat-loading">Chat wordt geladen...</p>
          ) : (
            <div className="chat-berichten">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`chat-bubbel-rij ${m.user.id === user.id ? "chat-bubbel-rij--eigen" : ""}`}
                >
                  <div className={`chat-bubbel ${m.user.id === user.id ? "chat-bubbel--eigen" : ""}`}>
                    <span className="chat-bubbel-naam">{m.user.name}</span>
                    {m.content && <p className="chat-bubbel-tekst">{m.content}</p>}
                    {m.image_url && (
                      <img
                        className="chat-bubbel-afbeelding"
                        src={`${API_URL}${m.image_url}`}
                        alt="Gedeelde afbeelding"
                      />
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}

          {sendError && <div className="auth-error">{sendError}</div>}

          <form className="chat-invoer-rij" onSubmit={handleSendText}>
            <label className="chat-afbeelding-knop">
              📷
              <input type="file" accept="image/*" onChange={handlePickImage} hidden />
            </label>
            <input
              type="text"
              className="chat-tekstveld"
              placeholder="Typ een bericht..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button type="submit" className="chat-verstuur-knop" disabled={!chatInput.trim()}>
              ➤
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
