import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getNotifications } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { isAuthScreen } from "../utils/nav";

// Geen WebSocket-kanaal voor meldingen (enkel chat heeft dat) — een lichte
// achtergrond-check volstaat voor een pop-up die niet meteen na aanmaken
// hoeft te verschijnen
const POLL_INTERVAL_MS = 30000;
const AUTO_DISMISS_MS = 6000;

export default function NotificationToasts() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [toasts, setToasts] = useState([]);
  // null = eerste poll nog niet gebeurd — die legt enkel de baseline vast,
  // toont geen pop-ups voor meldingen die al bestonden vóór het openen van de app
  const gezienIds = useRef(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function poll() {
      let data;
      try {
        data = await getNotifications(token);
      } catch {
        return; // stille fallback: een mislukte poll is geen kritieke fout
      }
      if (cancelled) return;

      if (gezienIds.current === null) {
        gezienIds.current = new Set(data.map((n) => n.id));
        return;
      }

      const nieuwe = data.filter((n) => !n.read && !gezienIds.current.has(n.id));
      if (nieuwe.length === 0) return;
      nieuwe.forEach((n) => gezienIds.current.add(n.id));
      setToasts((prev) => [...prev, ...nieuwe.map((n) => ({ ...n, toastId: `${n.id}-${Date.now()}` }))]);
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  function verwijderToast(toastId) {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
  }

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => setTimeout(() => verwijderToast(t.toastId), AUTO_DISMISS_MS));
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  function handleKlik(toast) {
    verwijderToast(toast.toastId);
    if (toast.activity_id) {
      const pad = toast.type === "chatbericht" ? "chat" : null;
      navigate(pad ? `/activiteiten/${toast.activity_id}/${pad}` : `/activiteiten/${toast.activity_id}`);
    }
  }

  if (isAuthScreen(pathname) || toasts.length === 0) return null;

  return (
    <div className="melding-toasts">
      {toasts.map((t) => (
        <button key={t.toastId} type="button" className="melding-toast" onClick={() => handleKlik(t)}>
          <span className="melding-toast-stip" />
          <span className="melding-toast-tekst">{t.text}</span>
          <span
            className="melding-toast-sluit"
            role="button"
            aria-label="Melding sluiten"
            onClick={(e) => {
              e.stopPropagation();
              verwijderToast(t.toastId);
            }}
          >
            ✕
          </span>
        </button>
      ))}
    </div>
  );
}
