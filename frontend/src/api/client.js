export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Kleine fetch-wrapper: voegt JSON-headers toe en gooit een Error bij een foutstatus.
// Een optioneel token wordt omgezet naar een Authorization-header — register/login
// geven nooit een token door, dus hun gedrag blijft ongewijzigd. Bij een FormData-body
// (bestand-uploads) mag Content-Type NIET zelf gezet worden — de browser moet daar
// zelf de multipart/form-data; boundary=...-header voor zetten
async function request(path, { token, ...options } = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
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

// Werkt een bestaande activiteit bij, enkel toegelaten voor de organisator
export function updateActivity(id, payload, token) {
  return request(`/activities/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    token,
  });
}

// Verwijdert een activiteit, enkel toegelaten voor de organisator
export function deleteActivity(id, token) {
  return request(`/activities/${id}`, { method: "DELETE", token });
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

// Haalt de badges van de ingelogde gebruiker op voor het profielscherm
export function getMyBadges(token) {
  return request("/users/me/badges", { token });
}

// Haalt de chatgeschiedenis van een activiteit op (enkel voor deelnemers)
export function getMessages(activityId, token) {
  return request(`/activities/${activityId}/messages`, { token });
}

// Uploadt een afbeelding naar de chat van een activiteit — de backend slaat
// ze op, maakt er een bericht van, en broadcast die meteen naar elke open
// WebSocket-verbinding in die activiteit (ook de eigen)
export function uploadChatImage(activityId, file, token) {
  const formData = new FormData();
  formData.append("file", file);
  return request(`/activities/${activityId}/messages/image`, {
    method: "POST",
    body: formData,
    token,
  });
}
