import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { login, loginWithMicrosoft } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import "./Auth.css";

export default function Login() {
  const navigate = useNavigate();
  const { saveSession } = useAuth();
  const { instance, accounts } = useMsal();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [msLoading, setMsLoading] = useState(false);

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

  // Redirect i.p.v. pop-up: betrouwbaarder over browsers heen (pop-ups
  // worden vaak geblokkeerd, ook in privévensters). De pagina navigeert
  // zelf naar Microsoft en komt na het inloggen terug op deze pagina —
  // de useEffect hieronder vangt dat resultaat dan op
  function handleMicrosoftLogin() {
    setError("");
    instance.loginRedirect({ scopes: ["openid", "profile", "email"] });
  }

  // MsalProvider verwerkt de terugkeer van Microsoft zelf al intern (roept
  // handleRedirectPromise() aan vóór deze component effects draait) — dat
  // hier zelf nog eens aanroepen zou kunnen botsen met MSAL's eigen
  // initialisatie. In plaats daarvan reageren we gewoon op "er staat nu een
  // account in de MSAL-cache", en halen we daar zelf een ID-token voor op
  useEffect(() => {
    if (accounts.length === 0) return;
    let cancelled = false;
    (async () => {
      setMsLoading(true);
      try {
        const result = await instance.acquireTokenSilent({
          account: accounts[0],
          scopes: ["openid", "profile", "email"],
        });
        const data = await loginWithMicrosoft(result.idToken);
        if (cancelled) return;
        saveSession(data);
        navigate("/");
      } catch (err) {
        if (!cancelled) setError(err.message || "Inloggen met Microsoft is mislukt");
      } finally {
        if (!cancelled) setMsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length]);

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

        <button
          type="button"
          className="auth-microsoft-knop"
          onClick={handleMicrosoftLogin}
          disabled={msLoading}
        >
          <svg width="18" height="18" viewBox="0 0 21 21">
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
          {msLoading ? "Bezig..." : "Inloggen met Microsoft"}
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
