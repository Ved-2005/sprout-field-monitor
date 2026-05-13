import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type FarmerProfile = {
  farmerName: string;
  username: string;
  farmLocation: string;
};

type StoredUser = FarmerProfile & {
  passwordHash: string;
};

type AuthUser = FarmerProfile & {
  id: string;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (data: FarmerProfile & { password: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USERS_KEY = "agri_users";
const SESSION_KEY = "agri_session";

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getUsers(): Record<string, StoredUser> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
  } catch {
    return {};
  }
}

function setUsers(users: Record<string, StoredUser>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSession(): AuthUser | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function setSession(user: AuthUser | null) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    setUser(session);
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const users = getUsers();
    const stored = users[username.toLowerCase()];
    if (!stored) throw new Error("Username not found.");
    const hash = await sha256(password);
    if (hash !== stored.passwordHash) throw new Error("Incorrect password.");
    const authUser: AuthUser = {
      id: username.toLowerCase(),
      farmerName: stored.farmerName,
      username: stored.username,
      farmLocation: stored.farmLocation,
    };
    setSession(authUser);
    setUser(authUser);
  }, []);

  const signup = useCallback(async (data: FarmerProfile & { password: string }) => {
    const users = getUsers();
    const key = data.username.toLowerCase();
    if (users[key]) throw new Error("Username already taken.");
    const passwordHash = await sha256(data.password);
    users[key] = {
      farmerName: data.farmerName,
      username: data.username,
      farmLocation: data.farmLocation,
      passwordHash,
    };
    setUsers(users);
    const authUser: AuthUser = {
      id: key,
      farmerName: data.farmerName,
      username: data.username,
      farmLocation: data.farmLocation,
    };
    setSession(authUser);
    setUser(authUser);
  }, []);

  const logout = useCallback(async () => {
    setSession(null);
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
