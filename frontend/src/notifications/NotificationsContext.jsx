import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getNotifications } from "../api/client";
import { useAuth } from "../auth/AuthContext";

// Centrale, gedeelde bron voor meldingen — Sidebar/BottomNav/NotificationToasts
// haalden voorheen elk apart en enkel bij mount hun eigen kopie op, waardoor
// bv. de ongelezen-teller in de zijbalk niet bijwerkte nadat je een melding
// op /meldingen had gelezen. Nu heeft de hele app één poll-lus en één bron
// van waarheid; refresh() laat een mutatie (gelezen markeren, ...) meteen
// overal doorwerken i.p.v. te wachten op de volgende poll
const NotificationsContext = createContext(null);

const POLL_INTERVAL_MS = 30000;

export function NotificationsProvider({ children }) {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  // null = eerste poll nog niet gebeurd — die legt enkel de baseline vast,
  // toont geen pop-ups voor meldingen die al bestonden vóór het openen van de app
  const gezienIds = useRef(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    let data;
    try {
      data = await getNotifications(token);
    } catch {
      return; // stille fallback: een mislukte poll is geen kritieke fout
    }
    setNotifications(data);

    if (gezienIds.current === null) {
      gezienIds.current = new Set(data.map((n) => n.id));
      return;
    }
    const nieuwe = data.filter((n) => !n.read && !gezienIds.current.has(n.id));
    if (nieuwe.length === 0) return;
    nieuwe.forEach((n) => gezienIds.current.add(n.id));
    setToasts((prev) => [...prev, ...nieuwe.map((n) => ({ ...n, toastId: `${n.id}-${Date.now()}` }))]);
  }, [token]);

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      setToasts([]);
      gezienIds.current = null;
      return;
    }
    gezienIds.current = null;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, refresh]);

  function dismissToast(toastId) {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const chatUnreadCount = notifications.filter((n) => !n.read && n.type === "chatbericht").length;

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, chatUnreadCount, toasts, refresh, dismissToast }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationsProvider");
  return ctx;
}
