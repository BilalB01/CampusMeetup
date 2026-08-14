import { Link, useLocation } from "react-router-dom";
import { CATEGORIES } from "../constants/categories";
import { useNotifications } from "../notifications/NotificationsContext";
import { CHATS_TAB, HOME_TAB, ICONS, MELDINGEN_TAB, ONTDEK_TAB, isAuthScreen, isNavActive } from "../utils/nav";

// Vaste onderaan-navigatiebalk, overal zichtbaar behalve op login/register
const TABS = [
  HOME_TAB,
  ONTDEK_TAB,
  { key: "nieuw", label: "Nieuw", Icon: ICONS.plus, to: `/activiteiten/categorie/${CATEGORIES[0].slug}/nieuw` },
  CHATS_TAB,
  MELDINGEN_TAB,
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
