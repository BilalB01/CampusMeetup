// Paden waarop de navigatie-chrome (BottomNav, Sidebar, TopBar) verborgen blijft
export function isAuthScreen(pathname) {
  return pathname === "/login" || pathname === "/register" || pathname === "/verifieer";
}

// Lucide-componenten i.p.v. eigen SVG-paden -- Sidebar.jsx/BottomNav.jsx
// renderen deze rechtstreeks als <tab.Icon size={..} />
import { Bell, Compass, Home, ListChecks, MessageCircle, Plus, Settings, User } from "lucide-react";

export const ICONS = {
  home: Home,
  kompas: Compass,
  plus: Plus,
  persoon: User,
  chat: MessageCircle,
  melding: Bell,
  tandwiel: Settings,
  lijst: ListChecks,
};

// True als er binnen deze SPA-sessie een vorige pagina is om naar terug te
// navigeren. location.key is "default" bij een verse paginalading (rechtstreekse
// URL, gedeelde link, bookmark, of een herlaad) -- dan heeft navigate(-1) niets
// om naar terug te gaan en moet een vaste terugvalbestemming gebruikt worden
export function heeftTerugGeschiedenis(location) {
  return location.key !== "default";
}

// Generieke actief-check voor navigatietabs, gedeeld tussen BottomNav en Sidebar
export function isNavActive(pathname, tab) {
  if (tab.key === "home") return pathname === "/";
  if (tab.key === "nieuw") return pathname.endsWith("/nieuw");
  if (tab.key === "ontdek") {
    if (pathname.endsWith("/nieuw")) return false;
    return pathname === "/activiteiten" || pathname.startsWith("/activiteiten/categorie");
  }
  if (tab.key === "chats") return pathname === "/chats" || pathname.endsWith("/chat");
  if (tab.key === "meldingen") return pathname === "/meldingen";
  return pathname.startsWith(tab.to);
}
