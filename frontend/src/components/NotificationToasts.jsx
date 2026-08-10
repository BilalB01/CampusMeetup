import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNotifications } from "../notifications/NotificationsContext";
import { isAuthScreen } from "../utils/nav";

const AUTO_DISMISS_MS = 6000;

export default function NotificationToasts() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { toasts, dismissToast } = useNotifications();

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => setTimeout(() => dismissToast(t.toastId), AUTO_DISMISS_MS));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismissToast]);

  function handleKlik(toast) {
    dismissToast(toast.toastId);
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
              dismissToast(t.toastId);
            }}
          >
            ✕
          </span>
        </button>
      ))}
    </div>
  );
}
