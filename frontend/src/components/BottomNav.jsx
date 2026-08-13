import { Link, useLocation } from "react-router-dom";
import { CATEGORIES } from "../constants/categories";
import { useNotifications } from "../notifications/NotificationsContext";
import { ICONS, isAuthScreen, isNavActive } from "../utils/nav";

// Vaste onderaan-navigatiebalk, overal zichtbaar behalve op login/register
const TABS = [
  { key: "home", label: "Start", Icon: ICONS.home, to: "/" },
  { key: "ontdek", label: "Ontdek", Icon: ICONS.kompas, to: "/activiteiten" },
  { key: "nieuw", label: "Nieuw", Icon: ICONS.plus, to: `/activiteiten/categorie/${CATEGORIES[0].slug}/nieuw` },
  { key: "chats", label: "Chats", Icon: ICONS.chat, to: "/chats" },
  { key: "meldingen", label: "Meldingen", Icon: ICONS.melding, to: "/meldingen" },
  { key: "profiel", label: "Profiel", Icon: ICONS.persoon, to: "/profiel" },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const { unreadCount, chatUnreadCount } = useNotifications();

  if (isAuthScreen(pathname)) return null;

  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => {
        const active = isNavActive(pathname, tab);
        return (
          <Link key={tab.key} to={tab.to} className={`bottom-nav-item${active ? " actief" : ""}`}>
            <span className="bottom-nav-icoon-wrap">
              <tab.Icon size={22} strokeWidth={1.9} />
              {tab.key === "meldingen" && unreadCount > 0 && <span className="bottom-nav-badge" />}
              {tab.key === "chats" && chatUnreadCount > 0 && <span className="bottom-nav-badge" />}
            </span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
