import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL, getMessages, uploadChatImage } from "../api/client";

const WS_BASE_URL = API_URL.replace(/^http/, "ws");

// Beheert de live groepschat van één activiteit: laadt de geschiedenis,
// houdt een WebSocket-verbinding open zolang enabled true is (== de
// gebruiker neemt deel), en biedt sendText()/sendImage() aan. Twee losse
// useEffects: één voor de geschiedenis (fetch, met hetzelfde
// cancelled-patroon als ActiviteitDetail.jsx), één voor de WebSocket (met
// zijn eigen `return () => ws.close()`-cleanup)
export function useActivityChat(activityId, token, enabled) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const wsRef = useRef(null);

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
      setMessages((prev) => [...prev, JSON.parse(event.data)]);
    };
    ws.onerror = () => {
      setError("Verbinding met de chat verbroken.");
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [activityId, token, enabled]);

  const sendText = useCallback((content) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setSendError("Geen verbinding met de chat.");
      return;
    }
    ws.send(JSON.stringify({ content }));
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

  return { messages, loading, error, sendError, sendText, sendImage };
}
