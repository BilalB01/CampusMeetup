import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyActivities, listActivities } from "../api/client";
import ActiviteitRijKaart from "../components/ActiviteitRijKaart";
import AvatarStack from "../components/AvatarStack";
import Skeleton from "../components/Skeleton";
import StartStatKaart from "../components/StartStatKaart";
import { useAuth } from "../auth/AuthContext";
import { CATEGORIES, getCategoryByValue } from "../constants/categories";
import { distanceInMeters, formatDistance } from "../utils/distance";
import { capitalize, formatStartBadge } from "../utils/formatDate";
import { useUserLocation } from "../hooks/useUserLocation";
import "./Activiteiten.css";

export default function Categorieen() {
  const { user, token } = useAuth();
  const userLocation = useUserLocation(user?.share_location);
  const initial = user?.name?.[0]?.toUpperCase() ?? "?";
  const voornaam = user?.name?.split(" ")[0];
  const [activities, setActivities] = useState([]);
  const [eigenActiviteiten, setEigenActiviteiten] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Ongefilterd ophalen volstaat om zowel het totaal als de telling per
    // categorie client-side te berekenen — geen apart telling-endpoint nodig
    const p1 = listActivities()
      .then(setActivities)
      .catch(() => {}); // stille fallback: tellingen blijven dan gewoon 0
    const p2 = getMyActivities(token)
      .then((data) => setEigenActiviteiten([...data.organized, ...data.joined]))
      .catch(() => {});
    Promise.all([p1, p2]).finally(() => setLoading(false));
  }, [token]);

  const vandaag = new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const vandaagMetHoofdletter = capitalize(vandaag);

  // Eerstvolgende activiteit waar de gebruiker zelf iets mee te maken heeft
  // (georganiseerd of deelgenomen), gesorteerd op starttijd i.p.v. bv.
  // populariteit: zo verdringt een drukbezochte activiteit die nog ver in de
  // toekomst ligt nooit een kleinere activiteit die al over 2 dagen plaatsvindt.
  // Niets tonen als die er niet is, geen nepdata verzinnen
  const nu = new Date();
  const volgende = eigenActiviteiten
    .filter((a) => new Date(a.start_time) > nu)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];
  const volgendeBadge = volgende ? formatStartBadge(volgende.start_time) : null;

  // Statistieken voor de desktop-statistiekenkolom (zie start-stats-kolom in
  // Activiteiten.css) — enkel uit al opgehaalde data, geen nepcijfers.
  // Bewust van ALLE gebruikers samen (activities), niet enkel eigen
  // activiteiten — en alle 3 tegels + de subtitel gebruiken dezelfde bron
  // en hetzelfde tijdvak, anders lijken de cijfers elkaar tegen te spreken
  const startVanVandaag = new Date(nu);
  startVanVandaag.setHours(0, 0, 0, 0);
  // Einde van de LOPENDE kalenderweek (zondag), niet "rollend 7 dagen
  // vooruit" -- dat laatste zou "deze week" op een maandag tot in de
  // volgende week laten doorlopen, wat niet is wat "deze week" betekent
  const eindeVanDeWeek = new Date(startVanVandaag);
  const dagenTotZondag = (7 - startVanVandaag.getDay()) % 7;
  eindeVanDeWeek.setDate(eindeVanDeWeek.getDate() + dagenTotZondag);
  eindeVanDeWeek.setHours(23, 59, 59, 999);
  const activiteitenVandaag = activities.filter((a) => new Date(a.start_time).toDateString() === nu.toDateString());
  // "Deelnemers": som van participant_count over vandaag's activiteiten
  // i.p.v. een activiteitentelling — klopt zo ook echt met het label
  const deelnemersVandaag = activiteitenVandaag.reduce((sum, a) => sum + a.participant_count, 0);
  const metPlekVrij = activiteitenVandaag.filter((a) => a.participant_count < a.max_participants).length;
  const subtitel =
    activiteitenVandaag.length === 0
      ? "Nog geen activiteiten vandaag — maak er zelf een aan!"
      : `${activiteitenVandaag.length} activiteit${activiteitenVandaag.length === 1 ? "" : "en"} vandaag, ${metPlekVrij} met plek vrij.`;

  const stats = [
    {
      n: activiteitenVandaag.length,
      l: "Vandaag",
      icoon: "⚡",
      bg: "#FFE7D9",
      accent: "#E1571E",
    },
    {
      // Zelfde ondergrens als "vandaag" (start van de kalenderdag, niet
      // dit exacte moment) zodat "vandaag" altijd binnen "deze week" past
      n: activities.filter(
        (a) => new Date(a.start_time) >= startVanVandaag && new Date(a.start_time) <= eindeVanDeWeek,
      ).length,
      l: "Deze week",
      icoon: "📅",
      bg: "#DCE9FF",
      accent: "#2F6FE4",
    },
    {
      n: deelnemersVandaag,
      l: "Deelnemers",
      icoon: "👥",
      bg: "#E9E1FF",
      accent: "#6C4FF5",
    },
  ];

  // "Binnenkort op de campus": eerstvolgende 3 activiteiten op de Erasmus-
  // hogeschool Brussel-locatie (niet eender welke locatie, ondanks de
  // sectienaam) van alle gebruikers (niet enkel eigen), gesorteerd op
  // starttijd. location_name is vrije tekst (geen apart campus-veld), dus
  // substring-match i.p.v. een exacte string — Google's Places-suggestie
  // voor dit adres geeft soms een samengestelde naam terug (bv.
  // "Erasmushogeschool Brussel | Campus Kaai"), die dan ook nog matcht
  const binnenkort = activities
    .filter(
      (a) => new Date(a.start_time) > nu && a.location_name?.toLowerCase().includes("erasmushogeschool brussel"),
    )
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 3);

  return (
    <div className="activiteiten-screen">
      {/* activiteiten-header--start: verborgen vanaf 900px, want "CampusMeetup"
          + profiellink staan daar al in TopBar/Sidebar (zie Activiteiten.css) */}
      <header className="activiteiten-header activiteiten-header--start">
        <h1 className="activiteiten-title">CampusMeetup</h1>
        {/* Uitloggen staat nu op het profielscherm, zoals in het Figma-ontwerp */}
        <Link to="/profiel" className="profiel-avatar profiel-avatar--klein" aria-label="Profiel">
          {initial}
        </Link>
      </header>

      <div className="categorieen-intro">
        <p className="categorieen-datum">{vandaagMetHoofdletter}</p>
        <p className="categorieen-groet">Hey {voornaam}</p>
        {!loading && <p className="activiteiten-subtitle">{subtitel}</p>}
      </div>

      {loading ? (
        <div className="start-hero-grid">
          <Skeleton className="uitgelicht-kaart" style={{ minHeight: 150 }} />
          <div className="start-stats-kolom">
            <Skeleton style={{ height: 62 }} />
            <Skeleton style={{ height: 62 }} />
            <Skeleton style={{ height: 62 }} />
          </div>
        </div>
      ) : (
        <div className="start-hero-grid">
          {volgende ? (
            <Link to={`/activiteiten/${volgende.id}`} className="uitgelicht-kaart">
              <div className="uitgelicht-badge">
                <span className="uitgelicht-stip" />
                {volgendeBadge ?? "Binnenkort"}
              </div>
              <div className="uitgelicht-titel">{volgende.title}</div>
              <div className="uitgelicht-sub">{volgende.location_name}</div>
              <div className="uitgelicht-footer">
                <AvatarStack participants={volgende.participants_preview} />
              </div>
            </Link>
          ) : (
            <div className="uitgelicht-kaart uitgelicht-leeg">
              <span className="uitgelicht-leeg-icoon">🎉</span>
              <div className="uitgelicht-titel">Nog geen activiteiten gepland</div>
              <div className="uitgelicht-sub">Schrijf je in voor een activiteit of maak er zelf een aan</div>
              <Link to="/activiteiten" className="uitgelicht-leeg-cta">
                Ontdek activiteiten →
              </Link>
            </div>
          )}

          <div className="start-stats-kolom">
            {stats.map((s) => (
              <StartStatKaart key={s.l} n={s.n} l={s.l} icoon={s.icoon} bg={s.bg} accent={s.accent} />
            ))}
          </div>
        </div>
      )}

      <div className="categorieen-sectiekop">
        <span>Waar heb je zin in?</span>
        <Link to="/activiteiten" className="activiteiten-link-button">
          Alles
        </Link>
      </div>

      <div className="categorie-grid">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="categorie-tile2" style={{ height: 96 }} />
            ))
          : CATEGORIES.map((cat) => {
              const aantal = activities.filter((a) => a.category === cat.value).length;
              return (
                <Link
                  key={cat.slug}
                  to={`/activiteiten/categorie/${cat.slug}`}
                  className="categorie-tile2"
                  style={{ "--tile-bg": cat.bg, "--tile-accent": cat.accent }}
                >
                  <div className="categorie-tile2-top">
                    <span className="categorie-icon" style={{ background: cat.bg }}>
                      {cat.icon}
                    </span>
                    <span className="categorie-tile2-count" style={{ color: cat.accent }}>
                      {aantal}
                    </span>
                  </div>
                  <span className="categorie-tile2-label">{cat.label}</span>
                </Link>
              );
            })}
      </div>

      {!loading && (
        <>
          <div className="categorieen-sectiekop">
            <span>Binnenkort op de campus</span>
            <Link to="/activiteiten" className="activiteiten-link-button">
              Alles
            </Link>
          </div>
          {binnenkort.length > 0 ? (
            <ul className="activiteiten-lijst">
              {binnenkort.map((a) => {
                const categorie = getCategoryByValue(a.category);
                const afstand =
                  userLocation && a.latitude && a.longitude
                    ? formatDistance(distanceInMeters(userLocation, { lat: a.latitude, lng: a.longitude }))
                    : null;
                return (
                  <li key={a.id}>
                    <ActiviteitRijKaart activiteit={a} categorie={categorie} afstand={afstand} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="activiteiten-empty">Er vinden momenteel geen activiteiten plaats op de campussen.</p>
          )}
        </>
      )}
    </div>
  );
}
