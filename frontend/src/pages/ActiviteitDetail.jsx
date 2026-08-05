import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getActivity, joinActivity, leaveActivity } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { formatDateTime } from "../utils/formatDate";
import "./Activiteiten.css";

export default function ActiviteitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
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
        <button className="activiteiten-back" onClick={() => navigate(-1)}>
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
    </div>
  );
}
