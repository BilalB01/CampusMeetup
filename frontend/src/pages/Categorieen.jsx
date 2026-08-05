import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CATEGORIES } from "../constants/categories";
import "./Activiteiten.css";

export default function Categorieen() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="activiteiten-screen">
      <header className="activiteiten-header">
        <h1 className="activiteiten-title">CampusMeetup</h1>
        <button className="activiteiten-link-button" onClick={handleLogout}>
          Uitloggen
        </button>
      </header>
      <p className="activiteiten-subtitle">Waar heb je zin in vandaag, {user?.name}?</p>

      <div className="categorie-grid">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            to={`/activiteiten/categorie/${cat.slug}`}
            className="categorie-tile"
            style={{ background: cat.bg }}
          >
            <span className="categorie-icon">{cat.icon}</span>
            <span>{cat.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
