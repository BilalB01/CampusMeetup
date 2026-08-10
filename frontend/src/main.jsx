import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MsalProvider } from "@azure/msal-react";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { msalInstance } from "./auth/msalInstance.js";
import { NotificationsProvider } from "./notifications/NotificationsContext.jsx";

// AuthProvider moet binnen BrowserRouter staan zodat login/logout kan navigeren.
// NotificationsProvider zit binnen AuthProvider, want die heeft het token nodig
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MsalProvider instance={msalInstance}>
      <BrowserRouter>
        <AuthProvider>
          <NotificationsProvider>
            <App />
          </NotificationsProvider>
        </AuthProvider>
      </BrowserRouter>
    </MsalProvider>
  </StrictMode>,
);
