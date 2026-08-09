import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getPlatformStats } from "../api/client";
import { CATEGORIES } from "../constants/categories";
import { useCountUp } from "../hooks/useCountUp";
import "../pages/Activiteiten.css";

// Losstaand, geen export — enkel gebruikt binnen AuthSplitScreen. Eigen
// opmaak i.p.v. StatTegel.jsx: die is voor een witte kaart gebouwd, hier
// staat het op een paarse gradiënt
function AuthSplitStat({ n, l }) {
  const animated = useCountUp(n);
  return (
    <div className="auth-split-stat">
      <div className="auth-split-stat-getal">{animated}</div>
      <div className="auth-split-stat-label">{l}</div>
    </div>
  );
}

// Gedeelde schil voor Login.jsx/Register.jsx: linkerpaneel met merk/platform-
// stats + tabbalk om te wisselen tussen /login en /register, enkel vanaf
// desktopbreedte (zie veld-desktop in Activiteiten.css) — op mobiel blijft
// enkel .auth-card over, exact zoals vóór deze kaart. Elke pagina blijft
// eigenaar van zijn eigen velden/logica en geeft die door als children
export default function AuthSplitScreen({ onSubmit, children }) {
  const { pathname } = useLocation();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getPlatformStats()
      .then(setStats)
      .catch(() => {}); // stille fallback: statistiekenblok toont dan gewoon niets
  }, []);

  return (
    <div className="auth-screen">
      {/* Aparte wrapper (i.p.v. hero+kaart rechtstreeks als flex-kinderen van
          .auth-screen) — .auth-screen heeft min-height:100vh voor de oude
          mobiele centrering, waardoor align-items:stretch de panelen tot de
          volle schermhoogte zou uitrekken i.p.v. enkel tot elkaars natuurlijke
          hoogte. Deze wrapper heeft zelf geen hoogte-restrictie, dus stretch
          (het standaardgedrag van flex) past hero/kaart enkel op elkaar aan */}
      <div className="auth-split-paneel">
        <div className="auth-split-hero veld-desktop">
          <div className="auth-split-hero-merk">CampusMeetup</div>

          <div className="auth-split-hero-copy">
            <p className="auth-split-hero-titel">
              Vind je vrienden
              <br />
              op de campus.
            </p>
            <p className="auth-split-hero-sub">
              Padel, blokdates, gamenachten of een museumbezoek — georganiseerd door je medestudenten.
            </p>
          </div>

          {stats && (
            <div className="auth-split-stats">
              <AuthSplitStat n={stats.student_count} l="Studenten" />
              <AuthSplitStat n={stats.activities_this_week} l="Deze week" />
              <AuthSplitStat n={CATEGORIES.length} l="Categorieën" />
            </div>
          )}
        </div>

        <form className="auth-card auth-split-card" onSubmit={onSubmit}>
          <div className="profiel-tabs veld-desktop">
            <span
              className="profiel-tabs-indicator"
              style={{ transform: pathname === "/login" ? "translateX(0%)" : "translateX(100%)" }}
            />
            <Link to="/login" className={`profiel-tab${pathname === "/login" ? " actief" : ""}`}>
              Inloggen
            </Link>
            <Link to="/register" className={`profiel-tab${pathname === "/register" ? " actief" : ""}`}>
              Registreren
            </Link>
          </div>
          {children}
        </form>
      </div>
    </div>
  );
}
