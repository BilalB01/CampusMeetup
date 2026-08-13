import { useState } from "react";
import { Link } from "react-router-dom";
import { register } from "../api/client";
import AuthSplitScreen from "../components/AuthSplitScreen";
import "./Auth.css";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Geen token/sessie na registreren: het account moet eerst via de
  // bevestigingsmail geactiveerd worden (zie routers/auth.py). Dit bewaart
  // enkel de melding van de backend om te tonen i.p.v. meteen door te sturen
  const [bevestigingsmelding, setBevestigingsmelding] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await register({ name, email, password });
      setBevestigingsmelding(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (bevestigingsmelding) {
    return (
      <AuthSplitScreen>
        <h1 className="auth-title">Bijna klaar!</h1>
        <p className="auth-subtitle">{bevestigingsmelding}</p>
        <p className="auth-switch">
          <Link to="/login">Naar de inlogpagina</Link>
        </p>
      </AuthSplitScreen>
    );
  }

  return (
    <AuthSplitScreen onSubmit={handleSubmit}>
      <h1 className="auth-title">Maak je account</h1>
      <p className="auth-subtitle">Enkel je schoolmail is nodig om te starten.</p>

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
          pattern="(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}"
          title="Minstens 8 tekens, met een hoofdletter, een cijfer en een speciaal teken"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <span className="auth-hint">Minstens 8 tekens, met een hoofdletter, een cijfer en een speciaal teken</span>
      </div>

      <button className="auth-submit" type="submit" disabled={loading}>
        {loading ? "Bezig..." : "Account aanmaken"}
      </button>

      {/* Enkel op mobiel: op desktop doet de tabbalk in AuthSplitScreen dit al */}
      <p className="auth-switch veld-mobiel">
        Al een account? <Link to="/login">Log in</Link>
      </p>
    </AuthSplitScreen>
  );
}
