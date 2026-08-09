import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getConversations } from "../api/client";
import Skeleton from "../components/Skeleton";
import { useAuth } from "../auth/AuthContext";
import { getCategoryByValue } from "../constants/categories";
import { formatRelativeTime } from "../utils/formatDate";
import "./Activiteiten.css";

export default function ChatOverzicht() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getConversations(token)
      .then((data) => {
        if (!cancelled) setConversations(data);
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

  return (
    <div className="activiteiten-screen">
      <header className="activiteiten-header">
        <h1 className="activiteiten-title">Chats</h1>
      </header>

      {error && <div className="auth-error">{error}</div>}

      {loading && (
        <ul className="gesprekken-lijst">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i}>
              <div className="gesprek-item">
                <Skeleton style={{ width: 40, height: 40, borderRadius: 14, flexShrink: 0 }} />
                <div className="gesprek-inhoud">
                  <Skeleton style={{ height: 13, width: "50%", marginBottom: 6 }} />
                  <Skeleton style={{ height: 11, width: "70%" }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && conversations.length === 0 && (
        <p className="activiteiten-empty">
          Je neemt nog niet deel aan een groepschat. Doe mee met een activiteit om te chatten.
        </p>
      )}

      {!loading && !error && conversations.length > 0 && (
        <ul className="gesprekken-lijst">
          {conversations.map((c) => {
            const categorie = getCategoryByValue(c.category);
            return (
              <li key={c.activity_id}>
                <Link to={`/activiteiten/${c.activity_id}/chat`} className="gesprek-item">
                  <span className="gesprek-icoon" style={{ background: categorie?.bg ?? "#ede8fb" }}>
                    {categorie?.icon ?? "📌"}
                  </span>
                  <span className="gesprek-inhoud">
                    <span className="gesprek-titel-rij">
                      <span className="gesprek-titel">{c.title}</span>
                      <span className="gesprek-tijd">{formatRelativeTime(c.last_message_at)}</span>
                    </span>
                    <span className="gesprek-preview">{c.last_message ?? "Nog geen berichten"}</span>
                  </span>
                  {c.unread_count > 0 && <span className="gesprek-ongelezen">{c.unread_count}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
