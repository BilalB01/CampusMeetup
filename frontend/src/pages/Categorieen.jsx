import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CATEGORIES } from "../constants/categories";
import "./Activiteiten.css";

export default function Categorieen() {
  const { user } = useAuth();
  const initial = user?.name?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="activiteiten-screen">
      <header className="activiteiten-header">
        <h1 className="activiteiten-title">CampusMeetup</h1>
        {/* Uitloggen staat nu op het profielscherm, zoals in het Figma-ontwerp */}
        <Link to="/profiel" className="profiel-avatar profiel-avatar--klein" aria-label="Profiel">
          {initial}
        </Link>
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
