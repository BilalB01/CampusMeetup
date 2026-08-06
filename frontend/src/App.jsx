import { APIProvider } from "@vis.gl/react-google-maps";
import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Categorieen from "./pages/Categorieen";
import ActiviteitenLijst from "./pages/ActiviteitenLijst";
import ActiviteitAanmaken from "./pages/ActiviteitAanmaken";
import ActiviteitBewerken from "./pages/ActiviteitBewerken";
import ActiviteitDetail from "./pages/ActiviteitDetail";
import ActiviteitChat from "./pages/ActiviteitChat";
import Profiel from "./pages/Profiel";
import ProtectedRoute from "./auth/ProtectedRoute";
import BottomNav from "./components/BottomNav";
import { MAPS_API_KEY } from "./constants/maps";

function App() {
  return (
    <APIProvider apiKey={MAPS_API_KEY}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* Alle onderstaande schermen zijn beveiligd: zonder geldig token stuurt ProtectedRoute door naar /login */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Categorieen />
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
          path="/profiel"
          element={
            <ProtectedRoute>
              <Profiel />
            </ProtectedRoute>
          }
        />
      </Routes>
      <BottomNav />
    </APIProvider>
  );
}

export default App;
