import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type FarmerProfile = {
  farmerName: string;
  username: string;
  farmLocation: string;
};

type StoredUser = FarmerProfile & { passwordHash: string };

type AuthContextType = {
  user: FarmerProfile | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (data: FarmerProfile & { password: string }) => Promise<void>;
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
function toProfile(u: StoredUser): FarmerProfile {
  return { farmerName: u.farmerName, username: u.username, farmLocation: u.farmLocation };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FarmerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      const u = readUsers().find((x) => x.username.toLowerCase() === session.toLowerCase());
      if (u) setUser(toProfile(u));
      else localStorage.removeItem(SESSION_KEY);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const users = readUsers();
    const u = users.find((x) => x.username.toLowerCase() === username.toLowerCase());
    if (!u) throw new Error("No farm account found with that username.");
    const ph = await hash(password);
    if (u.passwordHash !== ph) throw new Error("Incorrect password.");
    localStorage.setItem(SESSION_KEY, u.username);
    setUser(toProfile(u));
  }, []);

  const signup = useCallback(async (data: FarmerProfile & { password: string }) => {
    const users = readUsers();
    if (users.some((x) => x.username.toLowerCase() === data.username.toLowerCase())) {
      throw new Error("That farm username is already taken.");
    }
    const passwordHash = await hash(data.password);
    const newUser: StoredUser = {
      farmerName: data.farmerName,
      username: data.username,
      farmLocation: data.farmLocation,
      passwordHash,
    };
    users.push(newUser);
    writeUsers(users);
    localStorage.setItem(SESSION_KEY, newUser.username);
    setUser(toProfile(newUser));
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
