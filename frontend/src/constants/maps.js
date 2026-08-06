export const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Middelpunt van de EhB-campus — standaardpositie voor elke kaart, dezelfde
// coördinaat die vroeger hardcoded in ActiviteitAanmaken.jsx stond
export const EHB_CAMPUS_CENTER = { lat: 50.8466, lng: 4.3528 };

// Klein violet rond pinnetje als SVG data-URI, i.p.v. het standaard rode
// Google-pinnetje — past bij het kleurenpalet van de rest van de app.
// Bewust GEEN google.maps.SymbolPath gebruikt: die bestaat pas nadat de
// Maps-library geladen is, een data-URI werkt meteen bij module-load
export const PIN_ICON = {
  url:
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">' +
        '<circle cx="14" cy="14" r="10" fill="#6c4ff5" stroke="white" stroke-width="3"/>' +
        "</svg>"
    ),
};
