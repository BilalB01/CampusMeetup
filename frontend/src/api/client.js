const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Kleine fetch-wrapper: voegt JSON-headers toe en gooit een Error bij een foutstatus.
// Een optioneel token wordt omgezet naar een Authorization-header — register/login
// geven nooit een token door, dus hun gedrag blijft ongewijzigd.
async function request(path, { token, ...options } = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractErrorMessage(data);
    throw new Error(message);
  }

  return data;
}

// Vertaalt FastAPI/Pydantic-foutformaten naar een leesbare boodschap voor de gebruiker
function extractErrorMessage(data) {
  if (!data) return "Er ging iets mis. Probeer het opnieuw.";
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail) && data.detail[0]?.msg) {
    return data.detail[0].msg.replace(/^Value error,\s*/, "");
  }
  return "Er ging iets mis. Probeer het opnieuw.";
}

export function register({ name, email, password }) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export function login({ email, password }) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// Haalt de activiteitenlijst op, optioneel gefilterd op categorie
export function listActivities({ category } = {}) {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  return request(`/activities${query}`);
}

// Haalt het detail van één activiteit op; token is optioneel (bepaalt is_joined)
export function getActivity(id, { token } = {}) {
  return request(`/activities/${id}`, { token });
}

// Maakt een nieuwe activiteit aan, vereist een ingelogde gebruiker
export function createActivity(payload, token) {
  return request("/activities", {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}

// Schrijft de ingelogde gebruiker in voor een activiteit
export function joinActivity(id, token) {
  return request(`/activities/${id}/join`, { method: "POST", token });
}

// Schrijft de ingelogde gebruiker uit voor een activiteit
export function leaveActivity(id, token) {
  return request(`/activities/${id}/join`, { method: "DELETE", token });
}

// Haalt de activiteiten van de ingelogde gebruiker op voor het
// profielscherm, opgesplitst in georganiseerd en (elders) deelgenomen
export function getMyActivities(token) {
  return request("/users/me/activities", { token });
}
