import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../api/client";
import AuthSplitScreen from "../components/AuthSplitScreen";
import { useAuth } from "../auth/AuthContext";
import "./Auth.css";

// Publieke pagina (geen ProtectedRoute) achter de link in de registratiemail
// -- de gebruiker is op dit moment per definitie nog niet ingelogd
export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { saveSession } = useAuth();
  // Start bewust NIET automatisch bij het laden van de pagina: een
  // mailbeveiligingsscanner (bv. Microsoft Defender Safe Links) rendert
  // binnenkomende links vaak zelf even in een browser om ze te controleren,
  // en zou een automatische aanroep hier ongemerkt verbruiken vóór de echte
  // gebruiker de mail ooit opent. Enkel een expliciete klik op de knop
  // hieronder (die een scanner normaal niet simuleert) start de bevestiging.
  const [status, setStatus] = useState(token ? "wachten" : "fout");
  const [foutmelding, setFoutmelding] = useState(token ? "" : "Deze link mist een bevestigingscode.");

  function bevestigen() {
    setStatus("bezig");
    verifyEmail(token)
      .then((data) => {
        saveSession(data);
        setStatus("gelukt");
        navigate("/", { replace: true });
      })
      .catch((err) => {
        setStatus("fout");
        setFoutmelding(err.message);
      });
  }

  return (
    <AuthSplitScreen>
      {status === "wachten" && (
        <>
          <h1 className="auth-title">Bevestig je e-mailadres</h1>
          <p className="auth-subtitle">Klik hieronder om je CampusMeetup-account te activeren.</p>
          <button type="button" className="auth-submit" onClick={bevestigen}>
            E-mailadres bevestigen
          </button>
        </>
      )}
      {status === "bezig" && (
        <>
          <h1 className="auth-title">Even geduld...</h1>
          <p className="auth-subtitle">Je e-mailadres wordt bevestigd.</p>
        </>
      )}
      {status === "fout" && (
        <>
          <h1 className="auth-title">Dat lukte niet</h1>
          <div className="auth-error">{foutmelding}</div>
          <p className="auth-switch">
            <Link to="/register">Opnieuw registreren</Link> of{" "}
            <Link to="/login">naar de inlogpagina</Link>
          </p>
        </>
      )}
    </AuthSplitScreen>
  );
}
