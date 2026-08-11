// Paden waarop de navigatie-chrome (BottomNav, Sidebar, TopBar) verborgen blijft
export function isAuthScreen(pathname) {
  return pathname === "/login" || pathname === "/register";
}

export const ICONS = {
  home: "M4 10.5L12 4l8 6.5V20H4zM9.5 20v-6h5v6",
  kompas: "M12 3a9 9 0 100 18 9 9 0 000-18zM15.5 8.5l-2 5-5 2 2-5z",
  plus: "M12 5v14M5 12h14",
  persoon: "M4.5 21a7.5 7.5 0 0115 0M12 12a4 4 0 100-8 4 4 0 000 8z",
  chat: "M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z",
  melding:
    "M12 3a5 5 0 00-5 5v3.2c0 .9-.34 1.76-.95 2.42L4.6 15.2A1 1 0 005.4 17h13.2a1 1 0 00.8-1.8l-1.45-1.58A3.3 3.3 0 0117 11.2V8a5 5 0 00-5-5zM9.5 20a2.5 2.5 0 005 0",
  tandwiel:
    "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V19a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H4a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H10a1.65 1.65 0 001-1.51V4a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V10a1.65 1.65 0 001.51 1H20a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z",
  schild: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z",
  lijst: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
};

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
