import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { deleteAdminUser, getAdminUsers } from "../api/client";
import Skeleton from "../components/Skeleton";
import { useAuth } from "../auth/AuthContext";
import "./Activiteiten.css";

// Beheerscherm: alle gebruikers -- enkel bereikbaar voor is_admin=True (zie
// ProtectedRoute adminOnly-prop in App.jsx). Eigen, losstaande pagina i.p.v.
// een tab binnen één gedeeld Admin-scherm, met een eigen link in de zijbalk
export default function AdminGebruikers() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zoekterm, setZoekterm] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getAdminUsers(token)
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Permanent, dus expliciete window.confirm-bevestiging -- zelfde patroon
  // als eigen account verwijderen (Instellingen.jsx)
  async function handleDeleteUser(target) {
    if (
      !window.confirm(
        `Weet je zeker dat je "${target.name}" permanent wil verwijderen? Dit account, zijn/haar activiteiten en berichten verdwijnen definitief. Dit kan niet ongedaan gemaakt worden.`,
      )
    )
      return;
    try {
      await deleteAdminUser(target.id, token);
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
    } catch (err) {
      setError(err.message);
    }
  }

  // Client-side filter op naam of e-mail -- beide schermen halen toch al de
  // volledige lijst op, dus geen apart zoek-endpoint nodig
  const term = zoekterm.trim().toLowerCase();
  const zichtbareUsers = term
    ? users.filter((u) => u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term))
    : users;

  return (
    <div className="activiteiten-screen">
      <header className="activiteiten-header">
        <button className="activiteiten-back" onClick={() => navigate("/profiel")}>
          &larr;
        </button>
        <h1 className="activiteiten-title">Gebruikers ({users.length})</h1>
      </header>

      <input
        type="text"
        className="admin-zoekbalk"
        placeholder="Zoek op naam of e-mailadres..."
        value={zoekterm}
        onChange={(e) => setZoekterm(e.target.value)}
      />

      {error && <div className="auth-error">{error}</div>}
      {loading ? (
        <ul className="activiteiten-lijst">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i}>
              <div className="profiel-item">
                <Skeleton style={{ width: 42, height: 42, borderRadius: 15, flexShrink: 0 }} />
                <div className="profiel-item-tekst">
                  <Skeleton style={{ height: 13, width: "60%", marginBottom: 6 }} />
                  <Skeleton style={{ height: 10, width: "40%" }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : zichtbareUsers.length === 0 ? (
        <p className="activiteiten-empty">{term ? "Geen gebruikers gevonden voor deze zoekopdracht." : "Geen gebruikers gevonden."}</p>
      ) : (
        <ul className="activiteiten-lijst">
          {zichtbareUsers.map((u) => (
            <li key={u.id}>
              <div className="profiel-item admin-item">
                <span className="profiel-item-icoon" style={{ background: "#ede8fb" }}>
                  {u.name?.[0]?.toUpperCase() ?? "?"}
                </span>
                <Link to={`/admin/gebruikers/${u.id}`} className="profiel-item-tekst">
                  <span className="profiel-item-titel">
                    {u.name} {u.is_admin && <span className="admin-badge">Beheerder</span>}
                  </span>
                  <span className="profiel-item-sub">{u.email}</span>
                </Link>
                {u.id === user?.id ? (
                  // Zelf-verwijderen kan hier niet (backend weigert dit ook
                  // met een 400) -- geen knop tonen i.p.v. een foutmelding
                  // laten opduiken
                  <span className="profiel-item-tag">Jij</span>
                ) : (
                  <button type="button" className="profiel-logout admin-delete-knop" onClick={() => handleDeleteUser(u)}>
                    Verwijderen
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
