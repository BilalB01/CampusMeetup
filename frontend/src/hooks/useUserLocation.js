import { useEffect, useState } from "react";
import { useConfirm } from "../components/ConfirmDialog";

// Vraagt eenmalig de locatie van de gebruiker op (voor de afstand-badge op
// activiteitenkaarten). Geeft null terug bij weigering/fout/geen
// ondersteuning — de UI toont dan gewoon geen afstand, geen foutmelding nodig.
// enabled=false (Instellingen > Locatie delen) roept navigator.geolocation
// helemaal niet aan
export function useUserLocation(enabled = true) {
  const [location, setLocation] = useState(null);
  const confirm = useConfirm();

  useEffect(() => {
    if (!enabled) {
      setLocation(null);
      return;
    }
    if (!navigator.geolocation) return;

    let cancelled = false;
    function vraagLocatieOp() {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!cancelled) setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          if (!cancelled) setLocation(null);
        },
        { maximumAge: 5 * 60 * 1000 },
      );
    }

    // Toont eerst onze eigen, gestylede uitleg vóór de niet-aanpasbare
    // native browserprompt -- enkel als de browser nog geen eerdere keuze
    // onthouden heeft, anders zou dit bij elk paginabezoek terugkomen
    // terwijl de browser zelf allang niets meer zou vragen
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          if (cancelled) return;
          if (status.state === "granted") {
            vraagLocatieOp();
          } else if (status.state === "prompt") {
            confirm({
              title: "Locatie delen?",
              message:
                "CampusMeetup gebruikt je locatie om de afstand tot activiteiten te tonen. Je browser vraagt hierna zelf nog om bevestiging.",
              confirmText: "Toestaan",
              cancelText: "Niet nu",
            }).then((ok) => {
              if (ok && !cancelled) vraagLocatieOp();
            });
          }
          // status.state === "denied": bewust stil niets doen, zelfde gedrag als voorheen
        })
        .catch(() => vraagLocatieOp()); // "geolocation" niet ondersteund door de Permissions API -- terugval op rechtstreeks vragen
    } else {
      vraagLocatieOp();
    }

    return () => {
      cancelled = true;
    };
  }, [enabled, confirm]);

  return location;
}
