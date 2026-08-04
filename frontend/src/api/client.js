const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Kleine fetch-wrapper: voegt JSON-headers toe en gooit een Error bij een foutstatus
async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
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
