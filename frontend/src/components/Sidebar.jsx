import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getNotifications, listActivities } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CATEGORIES } from "../constants/categories";
import { formatStartBadge } from "../utils/formatDate";
import { ICONS, isAuthScreen, isNavActive } from "../utils/nav";

const TABS = [
  { key: "home", label: "Start", path: ICONS.home, to: "/" },
  { key: "ontdek", label: "Ontdek", path: ICONS.kompas, to: "/activiteiten" },
  { key: "chats", label: "Chats", path: ICONS.chat, to: "/chats" },
  { key: "meldingen", label: "Meldingen", path: ICONS.melding, to: "/meldingen" },
  { key: "instellingen", label: "Instellingen", path: ICONS.tandwiel, to: "/instellingen" },
];

// Vaste linker-navigatie vanaf desktopbreedte (≥900px, zie Activiteiten.css),
// vervangt op die breedte de onderaan-navigatiebalk. Geen "Nieuw"-tab in de
// lijst hieronder — die staat als aparte, prominente CTA-knop
export default function Sidebar() {
  const { pathname } = useLocation();
  const { user, token } = useAuth();
  const [volgendeActiviteiten, setVolgendeActiviteiten] = useState([]);
  const [ongelezenMeldingen, setOngelezenMeldingen] = useState(0);

  useEffect(() => {
    if (!token) return;
    // Bewust van iedereen (listActivities, geen token nodig) i.p.v. enkel
    // eigen georganiseerde/deelgenomen activiteiten -- de eerste 3 die
    // ergens op het platform plaatsvinden, niet enkel waar je zelf bij
    // betrokken bent
    listActivities()
      .then((data) => {
        const nu = new Date();
        const eerstDrie = data
          .filter((a) => new Date(a.start_time) > nu)
          .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
          .slice(0, 3);
        setVolgendeActiviteiten(eerstDrie);
      })
      .catch(() => {}); // stille fallback: widget toont dan gewoon niets
    // Eenmalig bij mount, geen polling — ververst bij een volle paginalaad
    // of bezoek aan /meldingen (zelfde bewuste keuze als bij "volgende activiteit")
    getNotifications(token)
      .then((data) => setOngelezenMeldingen(data.filter((n) => !n.read).length))
      .catch(() => {});
  }, [token]);

  if (isAuthScreen(pathname)) return null;

  const initial = user?.name?.[0]?.toUpperCase() ?? "?";

  return (
    <aside className="sidebar">
      <Link to="/profiel" className="sidebar-profiel">
        <span className="sidebar-avatar">{initial}</span>
        <span className="sidebar-profiel-tekst">
          <span className="sidebar-profiel-naam">{user?.name}</span>
          <span className="sidebar-profiel-sub">Bekijk profiel</span>
        </span>
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
              <span className="sidebar-nav-label">{tab.label}</span>
              {tab.key === "meldingen" && ongelezenMeldingen > 0 && (
                <span className="sidebar-nav-badge">{ongelezenMeldingen}</span>
              )}
              {active && <span className="sidebar-nav-dot" />}
            </Link>
          );
        })}
      </nav>

      {volgendeActiviteiten.length > 0 && (
        <div className="sidebar-volgende-lijst">
          {volgendeActiviteiten.map((activiteit) => (
            <Link key={activiteit.id} to={`/activiteiten/${activiteit.id}`} className="sidebar-volgende">
              <span className="sidebar-volgende-label">Volgende activiteit</span>
              <span className="sidebar-volgende-titel">{activiteit.title}</span>
              <span className="sidebar-volgende-badge">{formatStartBadge(activiteit.start_time) ?? "Binnenkort"}</span>
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}
