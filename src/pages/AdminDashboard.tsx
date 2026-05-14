import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Gauge,
  LogOut,
  RefreshCw,
  ShieldCheck,
  User as UserIcon,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StoredUser = {
  farmerName: string;
  username: string;
  farmLocation: string;
};

const USERS_KEY = "agri_users";

const SYSTEM_AVERAGES = {
  current: 1.45,
  voltage: 12.6,
  power: 18.3,
};

function jitter(baseline: number, spread: number) {
  return Math.max(0, baseline + (Math.random() - 0.5) * 2 * spread);
}

type Reading = { current: number; voltage: number; power: number };

function buildReadingForUser(): Reading {
  return {
    current: jitter(1.45, 0.9),
    voltage: jitter(12.6, 1.4),
    power: jitter(18.3, 7),
  };
}

function buildUserAverage(): Reading {
  // Slight variance per-user "average"
  return {
    current: jitter(1.45, 0.3),
    voltage: jitter(12.6, 0.5),
    power: jitter(18.3, 2.5),
  };
}

function loadUsers(): StoredUser[] {
  try {
    const raw = JSON.parse(localStorage.getItem(USERS_KEY) || "{}") as Record<
      string,
      StoredUser & { passwordHash: string }
    >;
    return Object.values(raw).map(({ farmerName, username, farmLocation }) => ({
      farmerName,
      username,
      farmLocation,
    }));
  } catch {
    return [];
  }
}

const formatInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

const AverageCard = ({
  label,
  value,
  unit,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number;
  unit: string;
  icon: LucideIcon;
  hint: string;
}) => (
  <article className="rounded-3xl border border-border/60 bg-card p-6 shadow-card transition-smooth hover:shadow-elevated hover:-translate-y-1">
    <div className="flex items-center gap-3">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-soft">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h3 className="font-display text-lg font-bold text-foreground">{label}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
    <p className="mt-5 font-display text-4xl font-extrabold tabular-nums tracking-tight text-foreground">
      {value.toFixed(2)}
      <span className="ml-1 text-base font-semibold text-muted-foreground">{unit}</span>
    </p>
    <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      System-wide average
    </p>
  </article>
);

const MetricMini = ({
  label,
  value,
  unit,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  unit: string;
  icon: LucideIcon;
  tone?: "default" | "low" | "high";
}) => (
  <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
    <div className="flex items-center gap-2.5">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-sm font-semibold text-foreground">{label}</p>
    </div>
    <p
      className={cn(
        "mt-3 font-display text-3xl font-extrabold tabular-nums tracking-tight",
        tone === "low" && "text-destructive",
        tone === "high" && "text-success",
        tone === "default" && "text-foreground",
      )}
    >
      {value.toFixed(2)}
      <span className="ml-1 text-sm font-semibold text-muted-foreground">{unit}</span>
    </p>
  </div>
);

const UserTabCard = ({
  user,
  active,
  onClick,
}: {
  user: StoredUser;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      "group w-full text-left rounded-3xl border bg-card p-6 shadow-card transition-smooth hover:shadow-elevated hover:-translate-y-1",
      active
        ? "border-primary ring-2 ring-primary/40 bg-primary/5"
        : "border-border/60",
    )}
  >
    <div className="flex items-center gap-3">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-primary font-display text-sm font-bold text-primary-foreground shadow-soft">
        {formatInitials(user.farmerName)}
      </span>
      <div className="min-w-0">
        <h3 className="font-display text-lg font-bold text-foreground truncate">
          @{user.username}
        </h3>
        <p className="text-xs text-muted-foreground truncate">{user.farmerName}</p>
      </div>
    </div>
    <p className="mt-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {user.farmLocation || "Unknown location"}
    </p>
    <p
      className={cn(
        "mt-1 text-xs font-semibold uppercase tracking-wider",
        active ? "text-primary" : "text-muted-foreground/70",
      )}
    >
      {active ? "Viewing" : "Tap to view"}
    </p>
  </button>
);

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [readings, setReadings] = useState<Record<string, Reading>>({});
  const [averages, setAverages] = useState<Record<string, Reading>>({});
  const [activeUsername, setActiveUsername] = useState<string | null>(null);

  const refresh = () => {
    const list = loadUsers();
    setUsers(list);
    const nextR: Record<string, Reading> = {};
    setAverages((prevAvg) => {
      const nextAvg: Record<string, Reading> = { ...prevAvg };
      for (const u of list) {
        const key = u.username.toLowerCase();
        nextR[key] = buildReadingForUser();
        if (!nextAvg[key]) nextAvg[key] = buildUserAverage();
      }
      return nextAvg;
    });
    setReadings(nextR);
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initials = useMemo(() => formatInitials(user?.farmerName ?? "Admin"), [user?.farmerName]);

  const activeUsers = useMemo(
    () => users.filter((u) => !u.username.toLowerCase().startsWith("admin")),
    [users],
  );

  useEffect(() => {
    if (activeUsers.length === 0) {
      setActiveUsername(null);
      return;
    }
    if (!activeUsername || !activeUsers.some((u) => u.username === activeUsername)) {
      setActiveUsername(activeUsers[0].username);
    }
  }, [activeUsers, activeUsername]);

  if (!user) return null;

  const selected = activeUsers.find((u) => u.username === activeUsername) ?? null;
  const selKey = selected?.username.toLowerCase() ?? "";
  const selLatest = selected ? readings[selKey] ?? buildReadingForUser() : null;
  const selAvg = selected ? averages[selKey] ?? buildUserAverage() : null;

  const tone = (val: number, avg: number) => (val < avg ? "low" : "high");

  return (
    <div className="min-h-screen bg-gradient-soft">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Logo size={36} withWordmark={false} />
            <div className="hidden sm:block">
              <h1 className="font-display text-lg font-bold leading-tight text-foreground">
                Smart Agri System
              </h1>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary">
                Admin Console
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 rounded-full border border-border/60 bg-card px-2 py-1 pr-4 shadow-soft">
              <span
                aria-hidden
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary font-display text-sm font-bold text-primary-foreground"
              >
                {initials}
              </span>
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-sm font-semibold text-foreground">{user.farmerName}</p>
                <p className="text-[11px] text-muted-foreground">@{user.username}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container space-y-8 py-8 animate-fade-in">
        {/* Hero */}
        <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-card sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <ShieldCheck className="h-4 w-4" /> Administrator
              </p>
              <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                System Overview
              </h2>
              <p className="mt-3 max-w-xl text-sm text-muted-foreground">
                Monitor global telemetry averages and inspect the latest sensor readings reported by
                every active farmer on the network.
              </p>
            </div>
            <Button variant="accent" size="sm" onClick={refresh}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        </section>

        {/* Centralized averages */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-xl font-bold text-foreground">System Averages</h3>
            <span className="text-xs text-muted-foreground">Auto-refreshes every 8s</span>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <AverageCard
              label="Current"
              value={SYSTEM_AVERAGES.current}
              unit="A"
              icon={Activity}
              hint="Network-wide draw"
            />
            <AverageCard
              label="Voltage"
              value={SYSTEM_AVERAGES.voltage}
              unit="V"
              icon={Gauge}
              hint="Battery / solar bus"
            />
            <AverageCard
              label="Power"
              value={SYSTEM_AVERAGES.power}
              unit="W"
              icon={Zap}
              hint="Aggregate consumption"
            />
          </div>
        </section>

        {/* User tabs */}
        <section>
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-soft">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-xl font-bold text-foreground">Active Users</h3>
              <p className="text-xs text-muted-foreground">
                Select a user to view their latest and average readings
              </p>
            </div>
          </div>

          {activeUsers.length === 0 ? (
            <div className="rounded-3xl border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground shadow-card">
              No active farmers registered yet.
            </div>
          ) : (
            <>
              <div
                role="tablist"
                aria-label="Active users"
                className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
              >
                {activeUsers.map((u) => (
                  <UserTabCard
                    key={u.username}
                    user={u}
                    active={u.username === activeUsername}
                    onClick={() => setActiveUsername(u.username)}
                  />
                ))}
              </div>

              {/* Selected user's panel */}
              {selected && selLatest && selAvg && (
                <div
                  role="tabpanel"
                  className="mt-8 rounded-3xl border border-border/60 bg-card p-6 shadow-card sm:p-8 animate-fade-in"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary font-display text-base font-bold text-primary-foreground shadow-soft">
                        {formatInitials(selected.farmerName)}
                      </span>
                      <div>
                        <h4 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
                          @{selected.username}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {selected.farmerName} · {selected.farmLocation || "Unknown location"}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-secondary/60 px-3 py-1 text-xs font-semibold text-foreground sm:self-auto">
                      <UserIcon className="h-3.5 w-3.5" /> Individual telemetry
                    </span>
                  </div>

                  {/* Latest Data */}
                  <div className="mt-8">
                    <div className="mb-3 flex items-baseline justify-between">
                      <h5 className="font-display text-lg font-bold text-foreground">Latest Data</h5>
                      <span className="text-xs text-muted-foreground">Most recent reading</span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <MetricMini
                        label="Current"
                        value={selLatest.current}
                        unit="A"
                        icon={Activity}
                        tone={tone(selLatest.current, selAvg.current)}
                      />
                      <MetricMini
                        label="Voltage"
                        value={selLatest.voltage}
                        unit="V"
                        icon={Gauge}
                        tone={tone(selLatest.voltage, selAvg.voltage)}
                      />
                      <MetricMini
                        label="Power"
                        value={selLatest.power}
                        unit="W"
                        icon={Zap}
                        tone={tone(selLatest.power, selAvg.power)}
                      />
                    </div>
                  </div>

                  {/* Average Data */}
                  <div className="mt-8">
                    <div className="mb-3 flex items-baseline justify-between">
                      <h5 className="font-display text-lg font-bold text-foreground">Average Data</h5>
                      <span className="text-xs text-muted-foreground">User 7-day mean</span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <MetricMini label="Current" value={selAvg.current} unit="A" icon={Activity} />
                      <MetricMini label="Voltage" value={selAvg.voltage} unit="V" icon={Gauge} />
                      <MetricMini label="Power" value={selAvg.power} unit="W" icon={Zap} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <footer className="pb-8 pt-2 text-center text-xs text-muted-foreground">
          Smart Agri System · Admin console
        </footer>
      </main>
    </div>
  );
};

export default AdminDashboard;
