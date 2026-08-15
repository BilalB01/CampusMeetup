import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  changePassword,
  deleteAccount,
  updateLocationPreference,
  updateNotificationPreferences,
  updateProfile,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useConfirm } from "../components/ConfirmDialog";
import "./Activiteiten.css";

// Kleine herbruikbare toggle-switch, gebruikt door de meldingen- en
// privacy-secties hieronder — een <button role="switch"> i.p.v. de
// gebruikelijke verborgen-checkbox-truc, consistent met de andere
// knop-gebaseerde controls in de app
function InstellingToggle({ label, sub, checked, onChange }) {
  return (
    <div className="instellingen-toggle-rij">
      <span className="instellingen-toggle-tekst">
        <span className="instellingen-toggle-label">{label}</span>
        <span className="instellingen-toggle-sub">{sub}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`instellingen-toggle${checked ? " aan" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="instellingen-toggle-knop" />
      </button>
    </div>
  );
}

// De eigenlijke instellingen-secties, los van de paginaschil (header/terug-
// knop) -- zo kan Profiel.jsx dit ook binnen zijn eigen schil hergebruiken
// voor een beheerder (zie aldaar). Meldingen/Privacy gaan volledig over
// deelname aan activiteiten, dus die secties slaan we voor een beheerder over
export function InstellingenSecties() {
  const navigate = useNavigate();
  const { user, token, updateUser, logout } = useAuth();
  const confirm = useConfirm();

  const [naam, setNaam] = useState(user?.name ?? "");
  const [naamOpslaan, setNaamOpslaan] = useState(false);
  const [naamFout, setNaamFout] = useState("");
  const [naamGelukt, setNaamGelukt] = useState(false);

  async function handleNaamOpslaan(e) {
    e.preventDefault();
    setNaamFout("");
    setNaamGelukt(false);
    setNaamOpslaan(true);
    try {
      await updateProfile(naam, token);
      updateUser({ name: naam });
      setNaamGelukt(true);
    } catch (err) {
      setNaamFout(err.message);
    } finally {
      setNaamOpslaan(false);
    }
  }

  const [voorkeuren, setVoorkeuren] = useState({
    notify_new_participant: user?.notify_new_participant ?? true,
    notify_chat_messages: user?.notify_chat_messages ?? true,
    notify_reminder: user?.notify_reminder ?? true,
    notify_activity_updates: user?.notify_activity_updates ?? true,
  });
  const [voorkeurenFout, setVoorkeurenFout] = useState("");

  async function handleVoorkeurWijzigen(key, waarde) {
    const vorige = voorkeuren;
    const nieuwe = { ...voorkeuren, [key]: waarde };
    setVoorkeuren(nieuwe);
    setVoorkeurenFout("");
    try {
      const bijgewerkt = await updateNotificationPreferences(nieuwe, token);
      updateUser(bijgewerkt);
    } catch (err) {
      setVoorkeuren(vorige);
      setVoorkeurenFout(err.message);
    }
  }

  const [shareLocation, setShareLocation] = useState(user?.share_location ?? true);
  const [locatieFout, setLocatieFout] = useState("");

  async function handleLocatieWijzigen(waarde) {
    setShareLocation(waarde);
    setLocatieFout("");
    try {
      const bijgewerkt = await updateLocationPreference(waarde, token);
      updateUser(bijgewerkt);
    } catch (err) {
      setShareLocation(!waarde);
      setLocatieFout(err.message);
    }
  }

  const [huidigWachtwoord, setHuidigWachtwoord] = useState("");
  const [nieuwWachtwoord, setNieuwWachtwoord] = useState("");
  const [bevestigWachtwoord, setBevestigWachtwoord] = useState("");
  const [wachtwoordOpslaan, setWachtwoordOpslaan] = useState(false);
  const [wachtwoordFout, setWachtwoordFout] = useState("");
  const [wachtwoordGelukt, setWachtwoordGelukt] = useState(false);

  async function handleWachtwoordOpslaan(e) {
    e.preventDefault();
    setWachtwoordFout("");
    setWachtwoordGelukt(false);
    if (nieuwWachtwoord !== bevestigWachtwoord) {
      setWachtwoordFout("De nieuwe wachtwoorden komen niet overeen.");
      return;
    }
    setWachtwoordOpslaan(true);
    try {
      await changePassword({ current_password: huidigWachtwoord, new_password: nieuwWachtwoord }, token);
      setWachtwoordGelukt(true);
      setHuidigWachtwoord("");
      setNieuwWachtwoord("");
      setBevestigWachtwoord("");
    } catch (err) {
      setWachtwoordFout(err.message);
    } finally {
      setWachtwoordOpslaan(false);
    }
  }

  const [verwijderBezig, setVerwijderBezig] = useState(false);
  const [verwijderFout, setVerwijderFout] = useState("");

  async function handleVerwijderen() {
    const ok = await confirm({
      title: "Account verwijderen?",
      message:
        "Weet je zeker dat je je account wil verwijderen? Je eigen georganiseerde activiteiten verdwijnen ook. Dit kan niet ongedaan gemaakt worden.",
      confirmText: "Verwijderen",
      danger: true,
    });
    if (!ok) return;
    setVerwijderFout("");
    setVerwijderBezig(true);
    try {
      await deleteAccount(token);
      // Eerst wegnavigeren, dan pas uitloggen: zolang deze pagina nog
      // gemount is wanneer token null wordt, ziet ProtectedRoute dat ook en
      // stuurt zelf óók naar /login, maar dan met "/instellingen" als
      // terugkeer-bestemming (zie ProtectedRoute.jsx) -- een race die een
      // volgende Microsoft-/wachtwoord-login soms naar de verwijderde
      // instellingenpagina i.p.v. de startpagina stuurde
      navigate("/login", { replace: true });
      await logout();
    } catch (err) {
      setVerwijderFout(err.message);
      setVerwijderBezig(false);
    }
  }

  return (
    <>
      <form className="instellingen-sectie" onSubmit={handleNaamOpslaan}>
        <h2 className="instellingen-sectie-titel">Naam</h2>
        <div className="auth-field">
          <label htmlFor="naam">Naam</label>
          <input id="naam" required value={naam} onChange={(e) => setNaam(e.target.value)} />
        </div>
        {naamFout && <div className="auth-error">{naamFout}</div>}
        {naamGelukt && <div className="instellingen-gelukt">Naam bijgewerkt.</div>}
        <button className="auth-submit" type="submit" disabled={naamOpslaan}>
          {naamOpslaan ? "Bezig..." : "Opslaan"}
        </button>
      </form>

      {!user?.is_admin && (
        <div className="instellingen-sectie">
          <h2 className="instellingen-sectie-titel">Meldingen</h2>
          {voorkeurenFout && <div className="auth-error">{voorkeurenFout}</div>}
          <InstellingToggle
            label="Nieuwe deelnemer"
            sub="Wanneer iemand zich aanmeldt voor jouw activiteit"
            checked={voorkeuren.notify_new_participant}
            onChange={(waarde) => handleVoorkeurWijzigen("notify_new_participant", waarde)}
          />
          <InstellingToggle
            label="Chatberichten"
            sub="Nieuw bericht in een groepschat waar je in zit"
            checked={voorkeuren.notify_chat_messages}
            onChange={(waarde) => handleVoorkeurWijzigen("notify_chat_messages", waarde)}
          />
          <InstellingToggle
            label="Herinnering"
            sub="Vlak voor een activiteit waar je aan deelneemt begint"
            checked={voorkeuren.notify_reminder}
            onChange={(waarde) => handleVoorkeurWijzigen("notify_reminder", waarde)}
          />
          <InstellingToggle
            label="Activiteit bijgewerkt of verwijderd"
            sub="Wanneer de organisator iets wijzigt aan een activiteit waar je aan deelneemt"
            checked={voorkeuren.notify_activity_updates}
            onChange={(waarde) => handleVoorkeurWijzigen("notify_activity_updates", waarde)}
          />
        </div>
      )}

      {!user?.is_admin && (
        <div className="instellingen-sectie">
          <h2 className="instellingen-sectie-titel">Privacy</h2>
          {locatieFout && <div className="auth-error">{locatieFout}</div>}
          <InstellingToggle
            label="Locatie delen"
            sub="Nodig om de afstand tot activiteiten te tonen — staat dit uit, dan wordt je locatie nooit opgevraagd"
            checked={shareLocation}
            onChange={handleLocatieWijzigen}
          />
        </div>
      )}

      {user?.auth_provider === "password" ? (
        <form className="instellingen-sectie" onSubmit={handleWachtwoordOpslaan}>
          <h2 className="instellingen-sectie-titel">Wachtwoord wijzigen</h2>
          <div className="auth-field">
            <label htmlFor="huidig_wachtwoord">Huidig wachtwoord</label>
            <input
              id="huidig_wachtwoord"
              type="password"
              required
              value={huidigWachtwoord}
              onChange={(e) => setHuidigWachtwoord(e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="nieuw_wachtwoord">Nieuw wachtwoord</label>
            <input
              id="nieuw_wachtwoord"
              type="password"
              required
              minLength={8}
              pattern="(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}"
              title="Minstens 8 tekens, met een hoofdletter, een cijfer en een speciaal teken"
              value={nieuwWachtwoord}
              onChange={(e) => setNieuwWachtwoord(e.target.value)}
            />
            <span className="auth-hint">Minstens 8 tekens, met een hoofdletter, een cijfer en een speciaal teken</span>
          </div>
          <div className="auth-field">
            <label htmlFor="bevestig_wachtwoord">Bevestig nieuw wachtwoord</label>
            <input
              id="bevestig_wachtwoord"
              type="password"
              required
              value={bevestigWachtwoord}
              onChange={(e) => setBevestigWachtwoord(e.target.value)}
            />
          </div>
          {wachtwoordFout && <div className="auth-error">{wachtwoordFout}</div>}
          {wachtwoordGelukt && <div className="instellingen-gelukt">Wachtwoord gewijzigd.</div>}
          <button className="auth-submit" type="submit" disabled={wachtwoordOpslaan}>
            {wachtwoordOpslaan ? "Bezig..." : "Wachtwoord wijzigen"}
          </button>
        </form>
      ) : (
        <div className="instellingen-sectie">
          <h2 className="instellingen-sectie-titel">Wachtwoord wijzigen</h2>
          <p className="auth-hint">Dit account gebruikt Microsoft om in te loggen — hier is geen wachtwoord voor.</p>
        </div>
      )}

      {!user?.is_admin && (
        <div className="instellingen-sectie">
          <h2 className="instellingen-sectie-titel">Account verwijderen</h2>
          <p className="auth-hint">
            Verwijdert je account definitief, inclusief je eigen georganiseerde activiteiten. Dit kan niet ongedaan
            gemaakt worden.
          </p>
          {verwijderFout && <div className="auth-error">{verwijderFout}</div>}
          <button type="button" className="profiel-logout" onClick={handleVerwijderen} disabled={verwijderBezig}>
            {verwijderBezig ? "Bezig..." : "Account verwijderen"}
          </button>
        </div>
      )}
    </>
  );
}

// Eigen route /instellingen -- gewone paginaschil rond InstellingenSecties.
// Voor een beheerder wordt diezelfde inhoud ook binnen Profiel.jsx getoond
// (zie aldaar), zodat "profiel" en "instellingen" voor een beheerder één en
// hetzelfde scherm zijn i.p.v. een profielscherm vol niet-toepasselijke info
export default function Instellingen() {
  const navigate = useNavigate();
  return (
    <div className="activiteiten-screen">
      <header className="activiteiten-header">
        <button className="activiteiten-back" onClick={() => navigate("/profiel")}>
          <ArrowLeft size={18} strokeWidth={2.3} />
        </button>
        <h1 className="activiteiten-title">Instellingen</h1>
      </header>
      <InstellingenSecties />
    </div>
  );
}
