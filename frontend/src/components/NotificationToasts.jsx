import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useNotifications } from "../notifications/NotificationsContext";
import { isAuthScreen } from "../utils/nav";

const AUTO_DISMISS_MS = 6000;

// Eigen component per toast i.p.v. één gedeeld effect over de hele
// toasts-array: zo krijgt elke toast zijn eigen onafhankelijke dismiss-
// timer, gekoppeld aan zijn eigen mount-levensduur (React herbergt een
// component nooit voor dezelfde key) -- een timer loopt dan altijd exact
// AUTO_DISMISS_MS vanaf het verschijnen van díe toast, ongeacht of er
// intussen een andere toast bijkomt/verdwijnt of de poll opnieuw rendert
function Toast({ toast, onDismiss, onClick }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.toastId), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button type="button" className="melding-toast" onClick={() => onClick(toast)}>
      <span className="melding-toast-stip" />
      <span className="melding-toast-tekst">{toast.text}</span>
      <span
        className="melding-toast-sluit"
        role="button"
        aria-label="Melding sluiten"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.toastId);
        }}
      >
        <X size={13} strokeWidth={2.4} />
      </span>
    </button>
  );
}

export default function NotificationToasts() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { toasts, dismissToast } = useNotifications();

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
        <Toast key={t.toastId} toast={t} onDismiss={dismissToast} onClick={handleKlik} />
      ))}
    </div>
  );
}
