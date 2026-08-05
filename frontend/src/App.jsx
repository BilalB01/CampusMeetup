import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Categorieen from "./pages/Categorieen";
import ActiviteitenLijst from "./pages/ActiviteitenLijst";
import ActiviteitAanmaken from "./pages/ActiviteitAanmaken";
import ActiviteitDetail from "./pages/ActiviteitDetail";
import ProtectedRoute from "./auth/ProtectedRoute";

function App() {
  return (
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
    </Routes>
  );
}

export default App;
