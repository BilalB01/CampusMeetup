import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MsalProvider } from "@azure/msal-react";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { msalInstance } from "./auth/msalInstance.js";
import { NotificationsProvider } from "./notifications/NotificationsContext.jsx";
import { ConfirmProvider } from "./components/ConfirmDialog.jsx";

// AuthProvider moet binnen BrowserRouter staan zodat login/logout kan navigeren.
// NotificationsProvider zit binnen AuthProvider, want die heeft het token nodig.
// ConfirmProvider heeft geen van beide nodig, maar staat er toch binnen zodat
// elke pagina die useConfirm() gebruikt vanzelf binnen bereik zit
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MsalProvider instance={msalInstance}>
      <BrowserRouter>
        <AuthProvider>
          <NotificationsProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </NotificationsProvider>
        </AuthProvider>
      </BrowserRouter>
    </MsalProvider>
  </StrictMode>,
);
