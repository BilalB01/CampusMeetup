import { useEffect, useState } from "react";

// Vraagt eenmalig de locatie van de gebruiker op (voor de afstand-badge op
// activiteitenkaarten). Geeft null terug bij weigering/fout/geen
// ondersteuning — de UI toont dan gewoon geen afstand, geen foutmelding nodig.
// enabled=false (Instellingen > Locatie delen) roept navigator.geolocation
// helemaal niet aan
export function useUserLocation(enabled = true) {
  const [location, setLocation] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setLocation(null);
      return;
    }
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocation(null),
      { maximumAge: 5 * 60 * 1000 },
    );
  }, [enabled]);

  return location;
}
