import { createContext, useContext, useState } from "react";
import { msalInstance } from "./msalInstance";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Token/user worden bij het opstarten uit localStorage gelezen, zodat je
  // ingelogd blijft na een herlaad van de pagina
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  function saveSession({ access_token, user }) {
    localStorage.setItem("token", access_token);
    localStorage.setItem("user", JSON.stringify(user));
    setToken(access_token);
    setUser(user);
  }

  // Wist de MSAL-cache en het eigen token/user uit localStorage
  async function logout() {
    try {
      await msalInstance.clearCache();
    } catch {
      // negeert fouten bij het wissen van de MSAL-cache
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }

  // Past de opgeslagen gebruiker gedeeltelijk aan (bv. na een naamswijziging
  // op het Instellingen-scherm) zonder opnieuw te moeten inloggen
  function updateUser(partial) {
    setUser((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  }

  return (
    <AuthContext.Provider value={{ token, user, saveSession, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
