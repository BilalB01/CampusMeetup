import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getMyActivities } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CATEGORIES } from "../constants/categories";
import { formatStartBadge } from "../utils/formatDate";
import { ICONS, isAuthScreen, isNavActive } from "../utils/nav";

const TABS = [
  { key: "home", label: "Start", path: ICONS.home, to: "/" },
  { key: "ontdek", label: "Ontdek", path: ICONS.kompas, to: "/activiteiten" },
  { key: "profiel", label: "Profiel", path: ICONS.persoon, to: "/profiel" },
];

// Vaste linker-navigatie vanaf desktopbreedte (≥900px, zie Activiteiten.css),
// vervangt op die breedte de onderaan-navigatiebalk. Geen "Nieuw"-tab in de
// lijst hieronder — die staat als aparte, prominente CTA-knop
export default function Sidebar() {
  const { pathname } = useLocation();
  const { user, token } = useAuth();
  const [volgende, setVolgende] = useState(null);

  useEffect(() => {
    if (!token) return;
    getMyActivities(token)
      .then((data) => {
        const nu = new Date();
        const eerst = [...data.organized, ...data.joined]
          .filter((a) => new Date(a.start_time) > nu)
          .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];
        setVolgende(eerst ?? null);
      })
      .catch(() => {}); // stille fallback: widget toont dan gewoon niets
  }, [token]);

  if (isAuthScreen(pathname)) return null;

  const initial = user?.name?.[0]?.toUpperCase() ?? "?";

  return (
    <aside className="sidebar">
      <Link to="/profiel" className="sidebar-profiel">
        <span className="sidebar-avatar">{initial}</span>
        <span className="sidebar-profiel-naam">{user?.name}</span>
      </Link>

      <Link to={`/activiteiten/categorie/${CATEGORIES[0].slug}/nieuw`} className="sidebar-cta">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d={ICONS.plus} />
        </svg>
        Nieuwe activiteit
      </Link>

      <nav className="sidebar-nav">
        {TABS.map((tab) => {
          const active = isNavActive(pathname, tab);
          return (
            <Link key={tab.key} to={tab.to} className={`sidebar-nav-item${active ? " actief" : ""}`}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d={tab.path} />
              </svg>
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {volgende && (
        <Link to={`/activiteiten/${volgende.id}`} className="sidebar-volgende">
          <span className="sidebar-volgende-label">Volgende activiteit</span>
          <span className="sidebar-volgende-titel">{volgende.title}</span>
          <span className="sidebar-volgende-badge">{formatStartBadge(volgende.start_time) ?? "Binnenkort"}</span>
        </Link>
      )}
    </aside>
  );
}
