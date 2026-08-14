import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Plus } from "lucide-react";
import { listActivities } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CATEGORIES } from "../constants/categories";
import { useNotifications } from "../notifications/NotificationsContext";
import { formatStartBadge } from "../utils/formatDate";
import { CHATS_TAB, HOME_TAB, ICONS, MELDINGEN_TAB, ONTDEK_TAB, isAuthScreen, isNavActive } from "../utils/nav";

const TABS = [
  HOME_TAB,
  ONTDEK_TAB,
  CHATS_TAB,
  MELDINGEN_TAB,
  { key: "instellingen", label: "Instellingen", Icon: ICONS.tandwiel, to: "/instellingen" },
];
// Enkel getoond aan beheerders (user.is_admin) -- zie tabs hieronder. Twee
// losse knoppen i.p.v. één "Admin"-tab met interne tabjes: rechtstreeks
// navigeerbaar, geen tab-wissel-UI die (net als op het profielscherm)
// hergebruikt zou worden voor iets heel anders
const ADMIN_TABS = [
  { key: "admin-gebruikers", label: "Gebruikers", Icon: ICONS.persoon, to: "/admin/gebruikers" },
  { key: "admin-activiteiten", label: "Activiteiten", Icon: ICONS.lijst, to: "/admin/activiteiten" },
];

// Vaste linker-navigatie vanaf desktopbreedte (≥900px, zie Activiteiten.css),
// vervangt op die breedte de onderaan-navigatiebalk. Geen "Nieuw"-tab in de
// lijst hieronder — die staat als aparte, prominente CTA-knop
export default function Sidebar() {
  const { pathname } = useLocation();
  const { user, token } = useAuth();
  const [volgendeActiviteiten, setVolgendeActiviteiten] = useState([]);
  const { unreadCount, chatUnreadCount } = useNotifications();

  useEffect(() => {
    // Beheerders nemen zelf niet deel aan activiteiten (zie hieronder) --
    // deze widget gaat net daarover, dus geen reden om 'm voor hen op te
    // halen
    if (!token || user?.is_admin) return;
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
  }, [token, user?.is_admin]);

  if (isAuthScreen(pathname)) return null;

  const initial = user?.name?.[0]?.toUpperCase() ?? "?";
  // Een beheerder is geen deelnemer: enkel de twee beheertaken te zien, geen
  // Start/Ontdek/Chats/Meldingen/Instellingen (die gaan allemaal over zelf
  // activiteiten bijwonen/organiseren)
  const tabs = user?.is_admin ? ADMIN_TABS : TABS;

  return (
    <aside className="sidebar">
      <Link to="/profiel" className="sidebar-profiel">
        <span className="sidebar-avatar">{initial}</span>
        <span className="sidebar-profiel-tekst">
          <span className="sidebar-profiel-naam">{user?.name}</span>
          <span className="sidebar-profiel-sub">Bekijk profiel</span>
        </span>
      </Link>

      {!user?.is_admin && (
        <Link to={`/activiteiten/categorie/${CATEGORIES[0].slug}/nieuw`} className="sidebar-cta">
          <Plus size={18} strokeWidth={2} />
          Nieuwe activiteit
        </Link>
      )}

      <nav className="sidebar-nav">
        {tabs.map((tab) => {
          const active = isNavActive(pathname, tab);
          return (
            <Link key={tab.key} to={tab.to} className={`sidebar-nav-item${active ? " actief" : ""}`}>
              <tab.Icon size={20} strokeWidth={1.9} />
              <span className="sidebar-nav-label">{tab.label}</span>
              {tab.key === "meldingen" && unreadCount > 0 && (
                <span className="sidebar-nav-badge">{unreadCount}</span>
              )}
              {tab.key === "chats" && chatUnreadCount > 0 && (
                <span className="sidebar-nav-badge">{chatUnreadCount}</span>
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
