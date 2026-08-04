import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import "./Auth.css";

export default function Login() {
  const navigate = useNavigate();
  const { saveSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Stuurt de inloggegevens naar de backend en bewaart het token bij succes
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login({ email, password });
      saveSession(data);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">CampusMeetup</h1>
        <p className="auth-subtitle">Spontane activiteiten op school</p>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-field">
          <label htmlFor="email">E-mailadres</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voornaam.achternaam@student.ehb.be"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password">Wachtwoord</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? "Bezig..." : "Inloggen"}
        </button>

        <p className="auth-switch">
          Nog geen account? <Link to="/register">Registreer</Link>
        </p>
      </form>
    </div>
  );
}
