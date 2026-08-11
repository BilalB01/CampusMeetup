import { APIProvider } from "@vis.gl/react-google-maps";
import { Routes, Route, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Categorieen from "./pages/Categorieen";
import ActiviteitenLijst from "./pages/ActiviteitenLijst";
import ActiviteitAanmaken from "./pages/ActiviteitAanmaken";
import ActiviteitBewerken from "./pages/ActiviteitBewerken";
import ActiviteitDetail from "./pages/ActiviteitDetail";
import ActiviteitChat from "./pages/ActiviteitChat";
import ChatOverzicht from "./pages/ChatOverzicht";
import MeldingenOverzicht from "./pages/MeldingenOverzicht";
import Profiel from "./pages/Profiel";
import Instellingen from "./pages/Instellingen";
import AdminGebruikers from "./pages/AdminGebruikers";
import AdminGebruikerDetail from "./pages/AdminGebruikerDetail";
import AdminActiviteiten from "./pages/AdminActiviteiten";
import AdminOverzicht from "./pages/AdminOverzicht";
import ProtectedRoute from "./auth/ProtectedRoute";
import BottomNav from "./components/BottomNav";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import NotificationToasts from "./components/NotificationToasts";
import { useAuth } from "./auth/AuthContext";
import { MAPS_API_KEY } from "./constants/maps";
import { isAuthScreen } from "./utils/nav";

// Landingspagina op "/" -- een beheerder ziet daar het beheerdersoverzicht
// i.p.v. de normale Start-pagina (categorietegels/"Binnenkort op de
// campus" gaan over zelf deelnemen, niet van toepassing voor een admin)
function StartScherm() {
  const { user } = useAuth();
  return user?.is_admin ? <AdminOverzicht /> : <Categorieen />;
}

function App() {
  const { pathname } = useLocation();
  // Op auth-schermen (login/register) reserveert de schil geen ruimte voor
  // Sidebar/TopBar — die renderen daar toch niet (zie isAuthScreen-check
  // in beide componenten)
  const toonChrome = !isAuthScreen(pathname);

  return (
    <APIProvider apiKey={MAPS_API_KEY}>
      <div className={`app-shell${toonChrome ? " app-shell--chrome" : ""}`}>
        <Sidebar />
        <TopBar />
        <NotificationToasts />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          {/* Alle onderstaande schermen zijn beveiligd: zonder geldig token stuurt ProtectedRoute door naar /login */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <StartScherm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activiteiten"
            element={
              <ProtectedRoute>
                <ActiviteitenLijst />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activiteiten/categorie/:slug"
            element={
              <ProtectedRoute>
                <ActiviteitenLijst />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activiteiten/categorie/:slug/nieuw"
            element={
              <ProtectedRoute>
                <ActiviteitAanmaken />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activiteiten/:id"
            element={
              <ProtectedRoute>
                <ActiviteitDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activiteiten/:id/bewerken"
            element={
              <ProtectedRoute>
                <ActiviteitBewerken />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activiteiten/:id/chat"
            element={
              <ProtectedRoute>
                <ActiviteitChat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chats"
            element={
              <ProtectedRoute>
                <ChatOverzicht />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meldingen"
            element={
              <ProtectedRoute>
                <MeldingenOverzicht />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profiel"
            element={
              <ProtectedRoute>
                <Profiel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/instellingen"
            element={
              <ProtectedRoute>
                <Instellingen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/gebruikers"
            element={
              <ProtectedRoute adminOnly>
                <AdminGebruikers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/gebruikers/:id"
            element={
              <ProtectedRoute adminOnly>
                <AdminGebruikerDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/activiteiten"
            element={
              <ProtectedRoute adminOnly>
                <AdminActiviteiten />
              </ProtectedRoute>
            }
          />
        </Routes>
        <BottomNav />
      </div>
    </APIProvider>
  );
}

export default App;
