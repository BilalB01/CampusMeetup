import { Link, useLocation } from "react-router-dom";
import { capitalize } from "../utils/formatDate";
import { isAuthScreen } from "../utils/nav";

// Vaste topbalk vanaf desktopbreedte (≥900px, zie Activiteiten.css).
// Bewust geen zoekbalk: die was in de mockup niet aan iets gekoppeld,
// en een niet-werkende zoekbalk bouwen zou een nepfunctie zijn
export default function TopBar() {
  const { pathname } = useLocation();
  if (isAuthScreen(pathname)) return null;

  const vandaag = new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const vandaagMetHoofdletter = capitalize(vandaag);

  return (
    <header className="top-bar">
      <Link to="/" className="top-bar-logo">
        <span className="top-bar-logo-badge">C</span>
        <span className="top-bar-logo-tekst">CampusMeetup</span>
      </Link>
      <span className="top-bar-datum">{vandaagMetHoofdletter}</span>
    </header>
  );
}
