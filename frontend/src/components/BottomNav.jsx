import { Link, useLocation } from "react-router-dom";
import { CATEGORIES } from "../constants/categories";
import { ICONS, isAuthScreen, isNavActive } from "../utils/nav";

// Vaste onderaan-navigatiebalk, overal zichtbaar behalve op login/register
const TABS = [
  { key: "home", label: "Start", path: ICONS.home, to: "/" },
  { key: "ontdek", label: "Ontdek", path: ICONS.kompas, to: "/activiteiten" },
  { key: "nieuw", label: "Nieuw", path: ICONS.plus, to: `/activiteiten/categorie/${CATEGORIES[0].slug}/nieuw` },
  { key: "chats", label: "Chats", path: ICONS.chat, to: "/chats" },
  { key: "profiel", label: "Profiel", path: ICONS.persoon, to: "/profiel" },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  if (isAuthScreen(pathname)) return null;

  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => {
        const active = isNavActive(pathname, tab);
        return (
          <Link key={tab.key} to={tab.to} className={`bottom-nav-item${active ? " actief" : ""}`}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.path} />
            </svg>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
