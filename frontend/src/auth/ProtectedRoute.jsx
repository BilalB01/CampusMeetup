import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Wrapper die een scherm enkel toont als er een token is, anders terug naar /login
export default function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
