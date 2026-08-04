import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div style={{ padding: 32, fontFamily: "sans-serif" }}>
      <h1>Welkom, {user?.name}</h1>
      <p>Je bent ingelogd met {user?.email}.</p>
      {/* Tijdelijke placeholder — activiteiten-endpoints volgen in Sprint 2 */}
      <p style={{ color: "#5b6b80" }}>
        De categorieën- en activiteitenschermen komen in Sprint 2.
      </p>
      <button onClick={handleLogout}>Uitloggen</button>
    </div>
  );
}
