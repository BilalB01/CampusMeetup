import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { API_URL, getActivity } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useActivityChat } from "../hooks/useActivityChat";
import "./Activiteiten.css";

// Volledige-scherm groepschat, apart van het detailscherm (zelfde
// useActivityChat-hook en typtekst-indicator, enkel andere lay-out —
// meer ruimte voor de berichtenlijst dan een ingebedde kaart onderaan
// het detailscherm toeliet)
export default function ActiviteitChat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    typingUsers,
    notifyTyping,
  } = useActivityChat(id, token, activity?.is_joined ?? false, user?.id);
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

  function handleChatInputChange(e) {
    setChatInput(e.target.value);
    notifyTyping();
  }

  function handlePickImage(e) {
    const file = e.target.files?.[0];
    if (file) sendImage(file);
    e.target.value = ""; // laat toe dezelfde afbeelding opnieuw te kiezen
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

  if (!activity.is_joined) {
    return (
      <div className="activiteiten-screen">
        <div className="auth-error">Enkel deelnemers hebben toegang tot deze chat.</div>
        <Link to={`/activiteiten/${id}`}>Terug naar de activiteit</Link>
      </div>
    );
  }

  return (
    <div className="activiteiten-screen chat-scherm">
      <header className="chat-scherm-header">
        <button className="activiteiten-back" onClick={() => navigate(`/activiteiten/${id}`)}>
          &larr;
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="chat-scherm-titel">{activity.title}</div>
          <div className="chat-scherm-sub">{activity.participant_count} deelnemers · groepschat</div>
        </div>
      </header>

      {chatError && <div className="auth-error">{chatError}</div>}

      {chatLoading ? (
        <p className="chat-loading">Chat wordt geladen...</p>
      ) : (
        <div className="chat-scherm-berichten">
          {messages.map((m) => (
            <div key={m.id} className={`chat-bubbel-rij ${m.user.id === user.id ? "chat-bubbel-rij--eigen" : ""}`}>
              <div className={`chat-bubbel ${m.user.id === user.id ? "chat-bubbel--eigen" : ""}`}>
                <span className="chat-bubbel-naam">{m.user.name}</span>
                {m.content && <p className="chat-bubbel-tekst">{m.content}</p>}
                {m.image_url && (
                  <img className="chat-bubbel-afbeelding" src={`${API_URL}${m.image_url}`} alt="Gedeelde afbeelding" />
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      )}

      {typingUsers.length > 0 && (
        <div className="chat-typing">
          <span className="chat-typing-dots">
            <span />
            <span />
            <span />
          </span>
          {typingUsers.length === 1 ? `${typingUsers[0].name} typt...` : `${typingUsers.length} mensen zijn aan het typen...`}
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
          onChange={handleChatInputChange}
        />
        <button type="submit" className="chat-verstuur-knop" disabled={!chatInput.trim()}>
          ➤
        </button>
      </form>
    </div>
  );
}
