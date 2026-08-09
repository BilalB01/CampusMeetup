import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { changePassword, deleteAccount, updateProfile } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import "./Activiteiten.css";

export default function Instellingen() {
  const navigate = useNavigate();
  const { user, token, updateUser, logout } = useAuth();

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
    if (
      !window.confirm(
        "Weet je zeker dat je je account wil verwijderen? Je eigen georganiseerde activiteiten verdwijnen ook. Dit kan niet ongedaan gemaakt worden.",
      )
    )
      return;
    setVerwijderFout("");
    setVerwijderBezig(true);
    try {
      await deleteAccount(token);
      await logout();
      navigate("/login");
    } catch (err) {
      setVerwijderFout(err.message);
      setVerwijderBezig(false);
    }
  }

  return (
    <div className="activiteiten-screen">
      <header className="activiteiten-header">
        <button className="activiteiten-back" onClick={() => navigate("/profiel")}>
          &larr;
        </button>
        <h1 className="activiteiten-title">Instellingen</h1>
      </header>

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
              value={nieuwWachtwoord}
              onChange={(e) => setNieuwWachtwoord(e.target.value)}
            />
            <span className="auth-hint">Minstens 8 tekens</span>
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
    </div>
  );
}
