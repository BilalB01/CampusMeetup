import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import "./Auth.css";

export default function Register() {
  const navigate = useNavigate();
  const { saveSession } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Maakt een account aan en logt de gebruiker meteen in bij succes
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await register({ name, email, password });
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
        <h1 className="auth-title">Account aanmaken</h1>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-field">
          <label htmlFor="name">Naam</label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

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
          <span className="auth-hint">
            Gebruik je schoolmail: voornaam.achternaam@student.ehb.be
          </span>
        </div>

        <div className="auth-field">
          <label htmlFor="password">Wachtwoord</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="auth-hint">Minstens 8 tekens</span>
        </div>

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? "Bezig..." : "Account aanmaken"}
        </button>

        <p className="auth-switch">
          Al een account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
