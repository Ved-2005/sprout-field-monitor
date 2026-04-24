import { ChangeEvent, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sampleReadings, SensorReading } from "@/data/sampleReadings";
import { ArrowDown, ArrowUp, LogOut, RefreshCw, Upload, Zap, Activity, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Row = SensorReading & { power: number };

const fmt = (n: number, digits = 2) => n.toFixed(digits);

const ComparisonValue = ({
  value,
  average,
  unit,
  digits = 2,
}: {
  value: number;
  average: number;
  unit: string;
  digits?: number;
}) => {
  const isBelow = value < average;
  const Icon = isBelow ? ArrowDown : ArrowUp;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold tabular-nums",
        isBelow ? "text-destructive" : "text-success",
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={3} />
      {fmt(value, digits)}
      <span className="text-xs font-medium opacity-70">{unit}</span>
    </span>
  );
};

const StatCard = ({
  label,
  value,
  unit,
  icon: Icon,
  accent = "primary",
}: {
  label: string;
  value: string;
  unit: string;
  icon: typeof Zap;
  accent?: "primary" | "accent" | "success";
}) => {
  const accentClasses = {
    primary: "bg-gradient-primary text-primary-foreground",
    accent: "bg-accent/20 text-accent-foreground",
    success: "bg-success/15 text-success",
  };
  return (
    <div className="group rounded-3xl border border-border/60 bg-card p-6 shadow-card transition-smooth hover:shadow-elevated hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-2xl",
            accentClasses[accent],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 font-display text-4xl font-extrabold tracking-tight text-foreground">
        {value}
        <span className="ml-1 text-base font-semibold text-muted-foreground">{unit}</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Average across {label.toLowerCase()} readings</p>
    </div>
  );
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [readings, setReadings] = useState<SensorReading[]>(sampleReadings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rows: Row[] = useMemo(
    () => readings.map((r) => ({ ...r, power: r.current * r.voltage })),
    [readings],
  );

  const averages = useMemo(() => {
    if (rows.length === 0) return { current: 0, voltage: 0, power: 0 };
    const sum = rows.reduce(
      (acc, r) => ({
        current: acc.current + r.current,
        voltage: acc.voltage + r.voltage,
        power: acc.power + r.power,
      }),
      { current: 0, voltage: 0, power: 0 },
    );
    return {
      current: sum.current / rows.length,
      voltage: sum.voltage / rows.length,
      power: sum.power / rows.length,
    };
  }, [rows]);

  const handleCsvUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = String(evt.target?.result || "");
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) throw new Error("CSV is empty.");
        const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const ci = header.indexOf("current");
        const vi = header.indexOf("voltage");
        const ti = header.findIndex((h) => h === "timestamp" || h === "time");
        if (ci === -1 || vi === -1) throw new Error("CSV must have 'current' and 'voltage' columns.");
        const parsed: SensorReading[] = lines.slice(1).map((line, idx) => {
          const cells = line.split(",");
          return {
            id: idx + 1,
            timestamp: ti >= 0 ? cells[ti]?.trim() ?? String(idx + 1) : String(idx + 1),
            current: Number(cells[ci]),
            voltage: Number(cells[vi]),
          };
        }).filter((r) => Number.isFinite(r.current) && Number.isFinite(r.voltage));
        if (parsed.length === 0) throw new Error("No valid rows found.");
        setReadings(parsed);
        toast.success(`Loaded ${parsed.length} readings.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not read CSV.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const resetSample = () => {
    setReadings(sampleReadings);
    toast.success("Reverted to sample dataset.");
  };

  return (
    <div className="min-h-screen bg-gradient-soft">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Logo size={36} />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Signed in as <span className="font-semibold text-foreground">{user}</span>
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="container space-y-8 py-8 animate-fade-in">
        {/* Hero */}
        <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-card sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Field Telemetry
              </p>
              <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Hello, {user} 🌱
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Live overview of your sensor network. Power is computed as{" "}
                <span className="font-mono text-foreground">Current × Voltage</span>. Values below the
                average are flagged in red, equal-or-above in green.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleCsvUpload}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" /> Upload CSV
              </Button>
              <Button variant="accent" size="sm" onClick={resetSample}>
                <RefreshCw className="h-4 w-4" /> Use sample
              </Button>
            </div>
          </div>
        </section>

        {/* Average stat cards */}
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Current"
            value={fmt(averages.current)}
            unit="A"
            icon={Activity}
            accent="primary"
          />
          <StatCard
            label="Voltage"
            value={fmt(averages.voltage)}
            unit="V"
            icon={Gauge}
            accent="accent"
          />
          <StatCard
            label="Power"
            value={fmt(averages.power)}
            unit="W"
            icon={Zap}
            accent="success"
          />
        </section>

        {/* Readings table */}
        <section className="rounded-3xl border border-border/60 bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">Sensor Readings</h2>
              <p className="text-xs text-muted-foreground">
                {rows.length} rows · compared against the dataset average
              </p>
            </div>
            <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-success" /> ≥ avg
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-destructive" /> &lt; avg
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Current (A)</TableHead>
                  <TableHead className="text-right">Voltage (V)</TableHead>
                  <TableHead className="text-right">Power (W)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="transition-smooth hover:bg-secondary/50">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {String(r.id).padStart(2, "0")}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{r.timestamp}</TableCell>
                    <TableCell className="text-right">
                      <ComparisonValue value={r.current} average={averages.current} unit="A" />
                    </TableCell>
                    <TableCell className="text-right">
                      <ComparisonValue value={r.voltage} average={averages.voltage} unit="V" />
                    </TableCell>
                    <TableCell className="text-right">
                      <ComparisonValue value={r.power} average={averages.power} unit="W" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <footer className="pb-8 pt-2 text-center text-xs text-muted-foreground">
          SproutSense · Smart Agriculture Monitoring
        </footer>
      </main>
    </div>
  );
};

export default Dashboard;
