import { useEffect, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

// Live adressuggesties voor het "Locatie"-veld, via Google's Places API
// (New). De oude Autocomplete-widget bestaat niet meer voor nieuwe
// Cloud-projecten (sinds maart 2025), dus dit gebruikt de programmatische
// AutocompleteSuggestion-API zodat de suggestielijst er zelf uitziet zoals
// de rest van de app. search() debounced met 300ms; selectSuggestion()
// zet een suggestie om naar {name, lat, lng}.
export function useAddressAutocomplete() {
  const placesLib = useMapsLibrary("places");
  const [suggestions, setSuggestions] = useState([]);
  const sessionTokenRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  function getSessionToken() {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
    }
    return sessionTokenRef.current;
  }

  function search(input) {
    clearTimeout(debounceRef.current);
    if (!placesLib || !input.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const { suggestions: result } =
        await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: getSessionToken(),
          includedRegionCodes: ["be"],
        });
      setSuggestions(result ?? []);
    }, 300);
  }

  async function selectSuggestion(suggestion) {
    const place = suggestion.placePrediction.toPlace();
    await place.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
    sessionTokenRef.current = null; // sessie afgerond, volgende zoekopdracht krijgt een nieuw token
    setSuggestions([]);
    return {
      name: place.displayName ?? place.formattedAddress,
      lat: place.location.lat(),
      lng: place.location.lng(),
    };
  }

  return { suggestions, search, selectSuggestion };
}
