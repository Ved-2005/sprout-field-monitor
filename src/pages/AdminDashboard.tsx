import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Gauge,
  LogOut,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
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

type Reading = { current: number; voltage: number; power: number };

function jitter(baseline: number, spread: number) {
  return Math.max(0, baseline + (Math.random() - 0.5) * 2 * spread);
}

function buildReadingForUser(): Reading {
  return {
    current: jitter(1.45, 0.9),
    voltage: jitter(12.6, 1.4),
    power: jitter(18.3, 7),
  };
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Deterministic-ish 7-day history per user (varies a bit each refresh)
function buildHistory(): { day: string; current: number; voltage: number; power: number }[] {
  return DAYS.map((day) => ({
    day,
    current: +jitter(1.45, 0.7).toFixed(2),
    voltage: +jitter(12.6, 1.2).toFixed(2),
    power: +jitter(18.3, 6).toFixed(2),
  }));
}

function average(history: ReturnType<typeof buildHistory>): Reading {
  const sum = history.reduce(
    (acc, r) => ({
      current: acc.current + r.current,
      voltage: acc.voltage + r.voltage,
      power: acc.power + r.power,
    }),
    { current: 0, voltage: 0, power: 0 },
  );
  const n = history.length;
  return { current: sum.current / n, voltage: sum.voltage / n, power: sum.power / n };
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
  </article>
);

const MetricMiniCard = ({
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
  tone?: "default" | "success" | "destructive";
}) => (
  <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-foreground/80">
        <Icon className="h-4 w-4" />
      </span>
    </div>
    <p
      className={cn(
        "mt-3 font-display text-3xl font-extrabold tabular-nums tracking-tight",
        tone === "success" && "text-success",
        tone === "destructive" && "text-destructive",
        tone === "default" && "text-foreground",
      )}
    >
      {value.toFixed(2)}
      <span className="ml-1 text-sm font-semibold text-muted-foreground">{unit}</span>
    </p>
  </div>
);

const UserPanel = ({
  user,
  latest,
  history,
}: {
  user: StoredUser;
  latest: Reading;
  history: ReturnType<typeof buildHistory>;
}) => {
  const avg = useMemo(() => average(history), [history]);

  const tone = (val: number, baseline: number): "success" | "destructive" =>
    val < baseline ? "destructive" : "success";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* User header */}
      <div className="flex flex-col gap-3 rounded-3xl border border-border/60 bg-card p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary font-display text-base font-bold text-primary-foreground shadow-soft">
            {formatInitials(user.farmerName)}
          </span>
          <div>
            <h3 className="font-display text-xl font-bold text-foreground">{user.farmerName}</h3>
            <p className="text-xs text-muted-foreground">@{user.username}</p>
          </div>
        </div>
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          {user.farmLocation}
        </p>
      </div>

      {/* Latest data */}
      <section>
        <h4 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Latest Data
        </h4>
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricMiniCard
            label="Current"
            value={latest.current}
            unit="A"
            icon={Activity}
            tone={tone(latest.current, SYSTEM_AVERAGES.current)}
          />
          <MetricMiniCard
            label="Voltage"
            value={latest.voltage}
            unit="V"
            icon={Gauge}
            tone={tone(latest.voltage, SYSTEM_AVERAGES.voltage)}
          />
          <MetricMiniCard
            label="Power"
            value={latest.power}
            unit="W"
            icon={Zap}
            tone={tone(latest.power, SYSTEM_AVERAGES.power)}
          />
        </div>
      </section>

      {/* Average data (per user, 7-day) */}
      <section>
        <h4 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Average Data (7-day)
        </h4>
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricMiniCard label="Current" value={avg.current} unit="A" icon={Activity} />
          <MetricMiniCard label="Voltage" value={avg.voltage} unit="V" icon={Gauge} />
          <MetricMiniCard label="Power" value={avg.power} unit="W" icon={Zap} />
        </div>
      </section>

      {/* 7-day history chart */}
      <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h4 className="font-display text-lg font-bold text-foreground">7-Day History</h4>
            <p className="text-xs text-muted-foreground">
              Daily readings for {user.farmerName.split(" ")[0]}
            </p>
          </div>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="current"
                name="Current (A)"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="voltage"
                name="Voltage (V)"
                stroke="hsl(var(--accent))"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="power"
                name="Power (W)"
                stroke="hsl(var(--success))"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [readings, setReadings] = useState<Record<string, Reading>>({});
  const [histories, setHistories] = useState<Record<string, ReturnType<typeof buildHistory>>>({});
  const [activeTab, setActiveTab] = useState<string>("");

  const refresh = () => {
    const list = loadUsers().filter((u) => !u.username.toLowerCase().startsWith("admin"));
    setUsers(list);
    const nextR: Record<string, Reading> = {};
    const nextH: Record<string, ReturnType<typeof buildHistory>> = {};
    for (const u of list) {
      const key = u.username.toLowerCase();
      nextR[key] = buildReadingForUser();
      nextH[key] = buildHistory();
    }
    setReadings(nextR);
    setHistories(nextH);
    setActiveTab((prev) => {
      if (prev && list.some((u) => u.username.toLowerCase() === prev)) return prev;
      return list[0]?.username.toLowerCase() ?? "";
    });
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initials = useMemo(() => formatInitials(user?.farmerName ?? "Admin"), [user?.farmerName]);

  if (!user) return null;

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
                Monitor global telemetry averages and inspect each farmer's latest readings,
                averages, and 7-day history.
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
            <h3 className="font-display text-xl font-bold text-foreground">Overall Averages</h3>
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

        {/* Per-user tabs */}
        <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-card">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-soft">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">Active Users</h3>
                <p className="text-xs text-muted-foreground">
                  Select a farmer to inspect their telemetry
                </p>
              </div>
            </div>
            <span className="rounded-full bg-secondary/60 px-3 py-1 text-xs font-semibold text-foreground">
              {users.length} {users.length === 1 ? "user" : "users"}
            </span>
          </div>

          {users.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              No active farmers registered yet.
            </p>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="-mx-2 mb-6 overflow-x-auto px-2 pb-1 [scrollbar-width:thin]">
                <TabsList className="inline-flex h-auto w-max gap-1 bg-secondary/60 p-1">
                  {users.map((u) => {
                    const key = u.username.toLowerCase();
                    return (
                      <TabsTrigger
                        key={key}
                        value={key}
                        className="gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-soft"
                      >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/30 text-[10px] font-bold">
                          {formatInitials(u.farmerName)}
                        </span>
                        {u.farmerName.split(" ")[0]}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {users.map((u) => {
                const key = u.username.toLowerCase();
                return (
                  <TabsContent key={key} value={key} className="mt-0 focus-visible:ring-0">
                    <UserPanel
                      user={u}
                      latest={readings[key] ?? buildReadingForUser()}
                      history={histories[key] ?? buildHistory()}
                    />
                  </TabsContent>
                );
              })}
            </Tabs>
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
