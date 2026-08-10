import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getCurrentUser } from "../api/client";
import { useAuth } from "./AuthContext";

// Wrapper die een scherm enkel toont als er een token is. Toont de pagina
// meteen (geen wachtscherm bij elke paginawissel), maar laat de backend op
// de achtergrond ook echt verifiëren dat dat token nog geldig is -- bij een
// afwijzing (verlopen/ongeldig) logt logout() de gebruiker uit en stuurt
// deze render dan alsnog naar /login. Draait bij elke paginawissel opnieuw
// dankzij location.pathname in de dependency-array
export default function ProtectedRoute({ children }) {
  const { token, logout } = useAuth();
  const location = useLocation();
  const [ongeldig, setOngeldig] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getCurrentUser(token).catch(() => {
      if (!cancelled) {
        logout();
        setOngeldig(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token, location.pathname]);

  if (!token || ongeldig) return <Navigate to="/login" replace />;
  return children;
}
