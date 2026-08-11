export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// AuthContext registreert hier zijn logout-functie zodat deze module (die
// geen React-hooks kan gebruiken) de sessie kan opruimen zodra de backend
// een meegestuurd token afwijst -- geldt voor élke aanroep, niet enkel de
// paginawissel-check in ProtectedRoute.jsx
let unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

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
    // Enkel als er een token meeging: een 401 op /auth/login zelf is een
    // gewoon "verkeerd wachtwoord"-antwoord, geen verlopen sessie
    if (response.status === 401 && token && unauthorizedHandler) unauthorizedHandler();
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

// Publieke, platform-brede tellingen voor het login/registreerscherm — geen
// token nodig, dit scherm bekijk je per definitie nog niet ingelogd
export function getPlatformStats() {
  return request("/stats");
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

// Logt in met een Microsoft-ID-token (opgehaald via MSAL in de browser) —
// de backend verifieert dit token zelf nog eens vóór het vertrouwd wordt
export function loginWithMicrosoft(idToken) {
  return request("/auth/microsoft", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken }),
  });
}

// Haalt de ingelogde gebruiker zelf op -- gebruikt om een opgeslagen token
// echt bij de backend te verifiëren (ProtectedRoute.jsx), niet enkel te
// controleren of er lokaal een token-string bestaat
export function getCurrentUser(token) {
  return request("/users/me", { token });
}

// Wijzigt de naam van de ingelogde gebruiker (Instellingen-scherm)
export function updateProfile(name, token) {
  return request("/users/me", { method: "PATCH", body: JSON.stringify({ name }), token });
}

// Wijzigt het wachtwoord — niet van toepassing op Microsoft-accounts
export function changePassword(payload, token) {
  return request("/users/me/password", { method: "PUT", body: JSON.stringify(payload), token });
}

// Verwijdert het account (en alles eraan gekoppeld) definitief
export function deleteAccount(token) {
  return request("/users/me", { method: "DELETE", token });
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

// Deelt een activiteit via e-mail met een willekeurig e-mailadres (geen account nodig om te bekijken)
export function shareActivityByEmail(id, payload, token) {
  return request(`/activities/${id}/share`, { method: "POST", body: JSON.stringify(payload), token });
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

// Haalt het chatoverzicht van de ingelogde gebruiker op: alle groepschats
// waar die aan deelneemt, met laatste bericht + ongelezen-teller
export function getConversations(token) {
  return request("/users/me/conversations", { token });
}

// Haalt het meldingencentrum van de ingelogde gebruiker op (nieuwe
// deelnemer/chatbericht/herinnering)
export function getNotifications(token) {
  return request("/users/me/notifications", { token });
}

// Markeert één melding als gelezen
export function markNotificationRead(id, token) {
  return request(`/users/me/notifications/${id}/read`, { method: "PUT", token });
}

// Markeert alle meldingen als gelezen
export function markAllNotificationsRead(token) {
  return request("/users/me/notifications/read-all", { method: "PUT", token });
}

// Wijzigt de meldingsvoorkeuren (in-app + e-mail samen per type)
export function updateNotificationPreferences(payload, token) {
  return request("/users/me/notification-preferences", { method: "PUT", body: JSON.stringify(payload), token });
}

// Zet locatie delen aan/uit -- stuurt useUserLocation() aan op elk scherm dat afstand toont
export function updateLocationPreference(shareLocation, token) {
  return request("/users/me/location-preference", {
    method: "PUT",
    body: JSON.stringify({ share_location: shareLocation }),
    token,
  });
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

// Verwijdert een eigen chatbericht — de backend weigert dit voor andermans berichten
export function deleteChatMessage(activityId, messageId, token) {
  return request(`/activities/${activityId}/messages/${messageId}`, { method: "DELETE", token });
}

// Admin: alle gebruikers ophalen (enkel voor beheerders, zie is_admin op user)
export function getAdminUsers(token) {
  return request("/admin/users", { token });
}

// Admin: detail van één gebruiker + zijn/haar activiteiten
export function getAdminUserDetail(userId, token) {
  return request(`/admin/users/${userId}`, { token });
}

// Admin: een gebruiker permanent verwijderen -- geen soft-delete, echt weg
export function deleteAdminUser(userId, token) {
  return request(`/admin/users/${userId}`, { method: "DELETE", token });
}

// Admin: alle activiteiten ophalen, optioneel gefilterd op categorie --
// i.t.t. listActivities() worden hier ook verlopen activiteiten getoond
export function getAdminActivities({ category } = {}, token) {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  return request(`/admin/activities${query}`, { token });
}

// Admin: een activiteit permanent verwijderen -- reason is verplicht en komt
// terecht in de melding die de deelnemers krijgen
export function deleteAdminActivity(activityId, reason, token) {
  return request(`/admin/activities/${activityId}`, {
    method: "DELETE",
    body: JSON.stringify({ reason }),
    token,
  });
}
