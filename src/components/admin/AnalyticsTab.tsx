import { useQuery } from "@tanstack/react-query";
import { fetchScanAnalytics, fetchArtifacts } from "@/lib/supabase-helpers";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COLORS = ["hsl(42, 55%, 55%)", "hsl(15, 60%, 50%)", "hsl(30, 25%, 40%)", "hsl(200, 40%, 50%)", "hsl(140, 40%, 45%)"];
const GRID = "hsl(30, 15%, 85%)";

type ChartType = "bar" | "line" | "area" | "pie";

const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: "bar", label: "Bar" },
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
  { id: "pie", label: "Pie" },
];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Small description box shown under each graph
const SimpleDescription = ({ text }: { text: string }) => (
  <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3">
    <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
    <p className="text-sm leading-relaxed text-foreground/80">{text}</p>
  </div>
);

// Button group that lets the admin change how a graph is drawn
const ChartTypeSwitcher = ({ value, onChange }: { value: ChartType; onChange: (t: ChartType) => void }) => (
  <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
    {CHART_TYPES.map((t) => (
      <Button
        key={t.id}
        type="button"
        size="sm"
        variant={value === t.id ? "secondary" : "ghost"}
        className="h-7 px-2.5 text-xs"
        onClick={() => onChange(t.id)}
        aria-pressed={value === t.id}
      >
        {t.label}
      </Button>
    ))}
  </div>
);

// One component that can draw the same data as bar, line, area or pie
const ChartView = ({
  type, data, xKey, yKey, color, horizontal = false, donut = false, height = 250,
}: {
  type: ChartType;
  data: any[];
  xKey: string;
  yKey: string;
  color: string;
  horizontal?: boolean;
  donut?: boolean;
  height?: number;
}) => {
  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={donut ? 60 : 0}
            outerRadius={100}
            nameKey={xKey}
            dataKey={yKey}
            label={data.length <= 6 ? ({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%` : false}
          >
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey={xKey} tick={{ fontSize: 12 }} interval={0} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === "area") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey={xKey} tick={{ fontSize: 12 }} interval={0} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Area type="monotone" dataKey={yKey} stroke={color} fill={color} fillOpacity={0.3} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // bar
  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis dataKey={xKey} type="category" width={120} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey={yKey} fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

const AnalyticsTab = () => {
  const { data: scans } = useQuery({ queryKey: ["scan-analytics"], queryFn: fetchScanAnalytics });
  const { data: artifacts } = useQuery({ queryKey: ["artifacts"], queryFn: fetchArtifacts });

  // Interactive controls
  const [dailyType, setDailyType] = useState<ChartType>("bar");
  const [deviceType, setDeviceType] = useState<ChartType>("pie");
  const [topType, setTopType] = useState<ChartType>("bar");
  const [dailyRange, setDailyRange] = useState<string>("14");

  const dailyScans = useMemo(() => {
    if (!scans) return [];
    const counts: Record<string, number> = {};
    scans.forEach((s: any) => {
      const day = new Date(s.scanned_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      counts[day] = (counts[day] || 0) + 1;
    });
    const entries = Object.entries(counts);
    const limited = dailyRange === "all" ? entries : entries.slice(-Number(dailyRange));
    return limited.map(([date, count]) => ({ date, scans: count }));
  }, [scans, dailyRange]);

  const deviceData = useMemo(() => {
    if (!scans) return [];
    const counts: Record<string, number> = {};
    scans.forEach((s: any) => {
      const device = s.device_type || "Unknown";
      counts[device] = (counts[device] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [scans]);

  const topArtifacts = useMemo(() => {
    if (!artifacts) return [];
    return [...artifacts].sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 5).map((a: any) => ({ name: a.name?.substring(0, 20), views: a.view_count || 0 }));
  }, [artifacts]);

  // ---------------------------------------------------------------------
  // Automated plain-language descriptions (change with the data AND the chart type)
  // ---------------------------------------------------------------------
  const dailyDescription = useMemo(() => {
    if (dailyScans.length === 0) return "";
    const total = dailyScans.reduce((sum, d) => sum + d.scans, 0);
    const busiest = dailyScans.reduce((best, d) => (d.scans > best.scans ? d : best), dailyScans[0]);

    const howToRead: Record<ChartType, string> = {
      bar: "Each bar is one day. The taller the bar, the more people scanned the QR codes that day.",
      line: "The line goes up on days with more scans and goes down on days with fewer scans.",
      area: "The shaded area gets higher on days with more scans and lower on days with fewer scans.",
      pie: "Each slice is one day. A bigger slice means more people scanned the QR codes that day.",
    };

    let text = `${howToRead[dailyType]} In the days shown, there were ${plural(total, "scan")} in total. The busiest day was ${busiest.date} with ${plural(busiest.scans, "scan")}.`;

    if (dailyScans.length >= 4) {
      const half = Math.floor(dailyScans.length / 2);
      const earlier = dailyScans.slice(0, half);
      const later = dailyScans.slice(half);
      const avg = (arr: { scans: number }[]) => arr.reduce((s, d) => s + d.scans, 0) / arr.length;
      const earlierAvg = avg(earlier);
      const laterAvg = avg(later);

      if (laterAvg > earlierAvg * 1.15) text += " Scans are going up lately. More visitors are using the QR codes.";
      else if (laterAvg < earlierAvg * 0.85) text += " Scans are going down lately. Visitors may need a reminder to scan the QR codes.";
      else text += " The number of scans stays about the same from day to day.";
    }
    return text;
  }, [dailyScans, dailyType]);

  const deviceDescription = useMemo(() => {
    if (deviceData.length === 0) return "";
    const total = deviceData.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return "";
    const sorted = [...deviceData].sort((a, b) => b.value - a.value);
    const pct = (v: number) => Math.round((v / total) * 100);
    const top = sorted[0];

    const howToRead: Record<ChartType, string> = {
      bar: "This shows what kind of device visitors use to scan. Each bar is one device type. The taller the bar, the more visitors use it.",
      line: "This shows what kind of device visitors use to scan. Each point is one device type. The higher the point, the more visitors use it.",
      area: "This shows what kind of device visitors use to scan. The shaded area is higher for device types that more visitors use.",
      pie: "This circle shows what kind of device visitors use to scan. Each color is one device type.",
    };

    let text = `${howToRead[deviceType]} Most visitors (${pct(top.value)}%) scan using a ${top.name.toLowerCase()}.`;

    if (sorted.length > 1) {
      const others = sorted.slice(1).map((d) => `${capitalize(d.name)} ${pct(d.value)}%`).join(", ");
      text += ` The rest: ${others}.`;
    }
    return text;
  }, [deviceData, deviceType]);

  const topDescription = useMemo(() => {
    if (topArtifacts.length === 0) return "";
    const first = topArtifacts[0];
    if (first.views === 0) return "None of the artifacts have been viewed yet. Once visitors start scanning, the most popular ones will show here.";

    const howToRead: Record<ChartType, string> = {
      bar: "This shows the 5 artifacts that visitors open the most. The longer the bar, the more views it has.",
      line: "This shows the 5 artifacts that visitors open the most. The higher the point, the more views it has.",
      area: "This shows the 5 artifacts that visitors open the most. The higher the shaded area, the more views it has.",
      pie: "This shows the 5 artifacts that visitors open the most. A bigger slice means more views.",
    };

    let text = `${howToRead[topType]} The most popular is "${first.name}" with ${plural(first.views, "view")}.`;

    if (topArtifacts.length > 1 && topArtifacts[1].views > 0) {
      text += ` Next is "${topArtifacts[1].name}" with ${plural(topArtifacts[1].views, "view")}.`;
    }

    const last = topArtifacts[topArtifacts.length - 1];
    if (topArtifacts.length >= 3 && last.views < first.views / 2) {
      text += ` "${last.name}" has much fewer views than the top one. You can place it in a more visible spot so more people see it.`;
    }
    return text;
  }, [topArtifacts, topType]);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Scans Chart */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold">Daily QR Scans</h3>
            <div className="flex items-center gap-2">
              <Select value={dailyRange} onValueChange={setDailyRange}>
                <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7" className="text-xs">Last 7 days</SelectItem>
                  <SelectItem value="14" className="text-xs">Last 14 days</SelectItem>
                  <SelectItem value="30" className="text-xs">Last 30 days</SelectItem>
                  <SelectItem value="all" className="text-xs">All days</SelectItem>
                </SelectContent>
              </Select>
              <ChartTypeSwitcher value={dailyType} onChange={setDailyType} />
            </div>
          </div>
          {dailyScans.length > 0 ? (
            <>
              <ChartView type={dailyType} data={dailyScans} xKey="date" yKey="scans" color="hsl(42, 55%, 55%)" />
              <SimpleDescription text={dailyDescription} />
            </>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">No scan data yet</p>
          )}
        </div>

        {/* Device Distribution */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold">Device Distribution</h3>
            <ChartTypeSwitcher value={deviceType} onChange={setDeviceType} />
          </div>
          {deviceData.length > 0 ? (
            <>
              <ChartView type={deviceType} data={deviceData} xKey="name" yKey="value" color="hsl(200, 40%, 50%)" donut />
              <SimpleDescription text={deviceDescription} />
            </>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">No device data yet</p>
          )}
        </div>
      </div>

      {/* Top Artifacts */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold">Most Viewed Artifacts</h3>
          <ChartTypeSwitcher value={topType} onChange={setTopType} />
        </div>
        {topArtifacts.length > 0 ? (
          <>
            <ChartView type={topType} data={topArtifacts} xKey="name" yKey="views" color="hsl(15, 60%, 50%)" horizontal />
            <SimpleDescription text={topDescription} />
          </>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">No artifact data yet</p>
        )}
      </div>

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        Total scans recorded: <strong>{scans?.length || 0}</strong>
      </div>
    </div>
  );
};

export default AnalyticsTab;