import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getCurrentUser } from "../api/client";
import { useAuth } from "./AuthContext";

// Wrapper die een scherm enkel toont als er een token is. Toont de pagina
// meteen (geen wachtscherm bij elke paginawissel), maar laat de backend op
// de achtergrond ook echt verifiëren dat dat token nog geldig is -- bij een
// afwijzing (verlopen/ongeldig) logt logout() de gebruiker uit en stuurt
// deze render dan alsnog naar /login. Draait bij elke paginawissel opnieuw
// dankzij location.pathname in de dependency-array.
// adminOnly: extra check bovenop "is er een geldig token" -- een niet-
// beheerder die rechtstreeks naar /admin navigeert, wordt naar / gestuurd
// i.p.v. dat de 403 van de backend zichtbaar wordt. Hergebruikt bewust deze
// component (i.p.v. een aparte AdminRoute) om de token-verify-logica hierboven niet te dupliceren
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { token, user, logout } = useAuth();
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

  // "from" meegeven zodat Login.jsx na het inloggen kan terugsturen naar de
  // pagina waar de gebruiker eigenlijk naartoe wilde (bv. een gedeelde
  // activiteit) i.p.v. altijd naar de standaard startpagina
  if (!token || ongeldig) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (adminOnly && !user?.is_admin) return <Navigate to="/" replace />;
  return children;
}
