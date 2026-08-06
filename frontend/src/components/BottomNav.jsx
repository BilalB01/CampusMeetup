import { Link, useLocation } from "react-router-dom";
import { CATEGORIES } from "../constants/categories";

const ICONS = {
  home: "M4 10.5L12 4l8 6.5V20H4zM9.5 20v-6h5v6",
  kompas: "M12 3a9 9 0 100 18 9 9 0 000-18zM15.5 8.5l-2 5-5 2 2-5z",
  plus: "M12 5v14M5 12h14",
  persoon: "M4.5 21a7.5 7.5 0 0115 0M12 12a4 4 0 100-8 4 4 0 000 8z",
};

// Vaste onderaan-navigatiebalk, overal zichtbaar behalve op login/register.
// Geen Chat-tab: chat zit per activiteit, er bestaat geen algemene chatlijst
// om naar te linken
const TABS = [
  { key: "home", label: "Start", path: ICONS.home, to: "/" },
  { key: "ontdek", label: "Ontdek", path: ICONS.kompas, to: "/activiteiten" },
  { key: "nieuw", label: "Nieuw", path: ICONS.plus, to: `/activiteiten/categorie/${CATEGORIES[0].slug}/nieuw` },
  { key: "profiel", label: "Profiel", path: ICONS.persoon, to: "/profiel" },
];

function isActive(pathname, tab) {
  if (tab.key === "home") return pathname === "/";
  if (tab.key === "nieuw") return pathname.endsWith("/nieuw");
  if (tab.key === "ontdek") {
    if (pathname.endsWith("/nieuw")) return false;
    return pathname === "/activiteiten" || pathname.startsWith("/activiteiten/categorie");
  }
  return pathname.startsWith(tab.to);
}

export default function BottomNav() {
  const { pathname } = useLocation();
  if (pathname === "/login" || pathname === "/register") return null;

  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => {
        const active = isActive(pathname, tab);
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
