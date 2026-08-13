import { PublicClientApplication } from "@azure/msal-browser";

// Eén gedeelde instantie voor de hele app (MSAL's eigen aanbevolen patroon —
// niet binnen een component aanmaken). "common"-authority: de app is
// multitenant geregistreerd, dus elk Microsoft-account kan inloggen; de
// echte @student.ehb.be-restrictie gebeurt server-side (zie backend/app/routers/auth.py)
export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
    authority: "https://login.microsoftonline.com/common",
    // Specifiek naar /login i.p.v. de kale basis-URL: /login is de enige
    // route die niet achter ProtectedRoute zit. Stond hier de kale
    // basis-URL (/), dan zou ProtectedRoute een niet-ingelogde gebruiker
    // daar al naar /login doorsturen vóór MSAL het antwoord van Microsoft
    // (verwerkt via de URL) kan afhandelen, en zou dat antwoord verloren gaan
    redirectUri: `${window.location.origin}/login`,
  },
});
