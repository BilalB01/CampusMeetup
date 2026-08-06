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
        <div className="auth-hero">
          <div className="auth-hero-content">
            <p className="auth-hero-title">
              Zin in iets
              <br />
              vanavond?
            </p>
            <p className="auth-hero-subtitle">Spontane plannen op en rond de campus.</p>
          </div>
        </div>

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

        <div className="auth-info-callout">
          <span>🎓</span>
          <span>
            Enkel met je <strong>@student.ehb.be</strong>-adres. Zo weet je dat iedereen op de app ook echt
            medestudent is.
          </span>
        </div>
      </form>
    </div>
  );
}
