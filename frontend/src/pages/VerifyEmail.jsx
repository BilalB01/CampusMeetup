import { useEffect, useState } from "react";
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
  const [status, setStatus] = useState("bezig");
  const [foutmelding, setFoutmelding] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("fout");
      setFoutmelding("Deze link mist een bevestigingscode.");
      return;
    }
    let cancelled = false;
    verifyEmail(token)
      .then((data) => {
        if (cancelled) return;
        saveSession(data);
        setStatus("gelukt");
        navigate("/", { replace: true });
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus("fout");
          setFoutmelding(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthSplitScreen>
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
