import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL, getMessages, uploadChatImage } from "../api/client";

const WS_BASE_URL = API_URL.replace(/^http/, "ws");

// Beheert de live groepschat van één activiteit: laadt de geschiedenis,
// houdt een WebSocket-verbinding open zolang enabled true is (== de
// gebruiker neemt deel), en biedt sendText()/sendImage() aan. Twee losse
// useEffects: één voor de geschiedenis (fetch, met hetzelfde
// cancelled-patroon als ActiviteitDetail.jsx), één voor de WebSocket (met
// zijn eigen `return () => ws.close()`-cleanup). currentUserId dient enkel
// om de eigen typtekst-events uit te filteren (de server broadcast naar
// iedereen in de room, inclusief de verzender zelf)
export function useActivityChat(activityId, token, enabled, currentUserId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const wsRef = useRef(null);
  const typingTimeoutsRef = useRef(new Map());
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    getMessages(activityId, token)
      .then((data) => {
        if (!cancelled) setMessages(data);
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
  }, [activityId, token, enabled]);

  useEffect(() => {
    if (!enabled) return;
    // JWT als querystring-parameter: de browser kan geen custom headers
    // zetten tijdens de WS-handshake. Aanvaarde vereenvoudiging voor dit
    // schoolproject (token kan bv. in serverlogs terechtkomen).
    const ws = new WebSocket(
      `${WS_BASE_URL}/activities/${activityId}/ws?token=${encodeURIComponent(token)}`
    );
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "typing") {
        if (data.user.id === currentUserId) return; // eigen typtekst-event niet aan onszelf tonen
        setTypingUsers((prev) => (prev.some((u) => u.id === data.user.id) ? prev : [...prev, data.user]));
        clearTimeout(typingTimeoutsRef.current.get(data.user.id));
        typingTimeoutsRef.current.set(
          data.user.id,
          setTimeout(() => {
            setTypingUsers((prev) => prev.filter((u) => u.id !== data.user.id));
          }, 3000),
        );
        return;
      }

      setMessages((prev) => [...prev, data]);
      setTypingUsers((prev) => prev.filter((u) => u.id !== data.user.id));
    };
    ws.onerror = () => {
      setError("Verbinding met de chat verbroken.");
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [activityId, token, enabled, currentUserId]);

  const sendText = useCallback((content) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setSendError("Geen verbinding met de chat.");
      return;
    }
    ws.send(JSON.stringify({ content }));
  }, []);

  // Throttled: max 1 keer per 2s versturen, ook al typt de gebruiker
  // ononderbroken door
  const notifyTyping = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    ws.send(JSON.stringify({ type: "typing" }));
  }, []);

  const sendImage = useCallback(
    async (file) => {
      setSendError("");
      try {
        await uploadChatImage(activityId, file, token);
        // Geen lokale toevoeging nodig: de backend broadcast dit bericht
        // ook naar de eigen open WebSocket hierboven
      } catch (err) {
        setSendError(err.message);
      }
    },
    [activityId, token]
  );

  return { messages, loading, error, sendError, sendText, sendImage, typingUsers, notifyTyping };
}
