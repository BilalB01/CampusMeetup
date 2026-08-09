// Paden waarop de navigatie-chrome (BottomNav, Sidebar, TopBar) verborgen blijft
export function isAuthScreen(pathname) {
  return pathname === "/login" || pathname === "/register";
}

export const ICONS = {
  home: "M4 10.5L12 4l8 6.5V20H4zM9.5 20v-6h5v6",
  kompas: "M12 3a9 9 0 100 18 9 9 0 000-18zM15.5 8.5l-2 5-5 2 2-5z",
  plus: "M12 5v14M5 12h14",
  persoon: "M4.5 21a7.5 7.5 0 0115 0M12 12a4 4 0 100-8 4 4 0 000 8z",
};

// Generieke actief-check voor navigatietabs, gedeeld tussen BottomNav en Sidebar
export function isNavActive(pathname, tab) {
  if (tab.key === "home") return pathname === "/";
  if (tab.key === "nieuw") return pathname.endsWith("/nieuw");
  if (tab.key === "ontdek") {
    if (pathname.endsWith("/nieuw")) return false;
    return pathname === "/activiteiten" || pathname.startsWith("/activiteiten/categorie");
  }
  return pathname.startsWith(tab.to);
}
