import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../api/client";
import Skeleton from "../components/Skeleton";
import { useAuth } from "../auth/AuthContext";
import { formatRelativeTime } from "../utils/formatDate";
import "./Activiteiten.css";

export default function MeldingenOverzicht() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getNotifications(token)
      .then((data) => {
        if (!cancelled) setNotifications(data);
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
  }, [token]);

  async function handleOpen(notification) {
    if (!notification.read) {
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
      markNotificationRead(notification.id, token).catch(() => {}); // stille fallback: badge-teller kan dan tijdelijk afwijken, geen blokkerende fout
    }
    if (notification.activity_id) {
      const pad = notification.type === "chatbericht" ? "chat" : null;
      navigate(pad ? `/activiteiten/${notification.activity_id}/${pad}` : `/activiteiten/${notification.activity_id}`);
    }
  }

  async function handleAllesGelezen() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead(token);
    } catch (err) {
      setError(err.message);
    }
  }

  const heeftOngelezen = notifications.some((n) => !n.read);

  return (
    <div className="activiteiten-screen">
      <header className="activiteiten-header">
        <h1 className="activiteiten-title">Meldingen</h1>
        {heeftOngelezen && (
          <button type="button" className="activiteiten-link-button" onClick={handleAllesGelezen}>
            Alles gelezen
          </button>
        )}
      </header>

      {error && <div className="auth-error">{error}</div>}

      {loading && (
        <ul className="meldingen-lijst">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i}>
              <div className="melding-item">
                <Skeleton style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0 }} />
                <div className="melding-inhoud">
                  <Skeleton style={{ height: 13, width: "70%", marginBottom: 6 }} />
                  <Skeleton style={{ height: 11, width: "40%" }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && notifications.length === 0 && (
        <p className="activiteiten-empty">Nog geen meldingen — die verschijnen hier zodra er iets gebeurt.</p>
      )}

      {!loading && !error && notifications.length > 0 && (
        <ul className="meldingen-lijst">
          {notifications.map((n) => (
            <li key={n.id}>
              <button type="button" className={`melding-item${n.read ? "" : " melding-item--ongelezen"}`} onClick={() => handleOpen(n)}>
                <span className="melding-stip" />
                <span className="melding-inhoud">
                  <span className="melding-tekst">{n.text}</span>
                  <span className="melding-tijd">{formatRelativeTime(n.created_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
