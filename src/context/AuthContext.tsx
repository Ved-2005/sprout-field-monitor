import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";

type StoredUser = { username: string; passwordHash: string };
type AuthContextType = {
  user: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USERS_KEY = "sproutsense.users";
const SESSION_KEY = "sproutsense.session";

async function hash(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = localStorage.getItem(SESSION_KEY);
    if (session) setUser(session);
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const users = readUsers();
    const u = users.find((x) => x.username.toLowerCase() === username.toLowerCase());
    if (!u) throw new Error("No account found with that username.");
    const ph = await hash(password);
    if (u.passwordHash !== ph) throw new Error("Incorrect password.");
    localStorage.setItem(SESSION_KEY, u.username);
    setUser(u.username);
  }, []);

  const signup = useCallback(async (username: string, password: string) => {
    const users = readUsers();
    if (users.some((x) => x.username.toLowerCase() === username.toLowerCase())) {
      throw new Error("That username is already taken.");
    }
    const passwordHash = await hash(password);
    users.push({ username, passwordHash });
    writeUsers(users);
    localStorage.setItem(SESSION_KEY, username);
    setUser(username);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, signup, logout }), [user, loading, login, signup, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
