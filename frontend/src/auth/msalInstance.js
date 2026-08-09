import { PublicClientApplication } from "@azure/msal-browser";

// Eén gedeelde instantie voor de hele app (MSAL's eigen aanbevolen patroon —
// niet binnen een component aanmaken). "common"-authority: de app is
// multitenant geregistreerd, dus elk Microsoft-account kan inloggen; de
// echte @student.ehb.be-restrictie gebeurt server-side (zie backend/app/routers/auth.py)
export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
    authority: "https://login.microsoftonline.com/common",
    // Specifiek naar /login i.p.v. de kale basis-URL: die is niet beveiligd
    // door ProtectedRoute. Bij de kale basis-URL (/) stuurde ProtectedRoute
    // meteen door naar /login vóór MSAL het antwoord van Microsoft (in de
    // URL) kon verwerken, waardoor dat antwoord verloren ging
    redirectUri: `${window.location.origin}/login`,
  },
});
