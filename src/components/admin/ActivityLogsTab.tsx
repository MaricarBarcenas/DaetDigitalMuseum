import { useQuery } from "@tanstack/react-query";
import { fetchActivityLogs } from "@/lib/supabase-helpers";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PAGE_SIZE = 25;

type RoleFilter = "all" | "admin-login" | "staff-login";
type DateRange = "all" | "today" | "7d" | "30d";
type SortOrder = "desc" | "asc";

// ---------- helpers ----------

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min > 1 ? "s" : ""} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr > 1 ? "s" : ""} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day > 1 ? "s" : ""} ago`;
  return new Date(dateStr).toLocaleDateString();
};

const actionColor = (action: string) => {
  const a = (action || "").toLowerCase();
  if (a.includes("delete") || a.includes("remove")) return "bg-red-100 text-red-700";
  if (a.includes("update") || a.includes("edit")) return "bg-amber-100 text-amber-700";
  if (a.includes("create") || a.includes("add")) return "bg-blue-100 text-blue-700";
  if (a.includes("login")) return "bg-green-100 text-green-700";
  if (a.includes("logout")) return "bg-slate-100 text-slate-700";
  return "bg-secondary text-muted-foreground";
};

const escapeCsv = (value: unknown) => {
  const str = String(value ?? "").replace(/"/g, '""');
  return `"${str}"`;
};

const exportToCsv = (rows: any[]) => {
  const header = ["Date", "Action", "User", "Role", "Details"];
  const lines = rows.map((log: any) =>
    [
      new Date(log.created_at).toLocaleString(),
      log.action,
      log.user_email,
      log.role,
      log.details,
    ]
      .map(escapeCsv)
      .join(",")
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

// ---------- component ----------

const ActivityLogsTab = () => {
  const [live, setLive] = useState(false);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["activity_logs"],
    queryFn: fetchActivityLogs,
    refetchInterval: live ? 10000 : false, // auto-refresh every 10s when Live is on
  });

  const [filter, setFilter] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // Reset pagination whenever the result set changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, search, dateRange, actionFilter, userFilter, sortOrder]);

  // Unique action types for the dropdown
  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    (logs ?? []).forEach((log: any) => log.action && set.add(log.action));
    return Array.from(set).sort();
  }, [logs]);

  // Summary stats
  const stats = useMemo(() => {
    const today = startOfToday().getTime();
    const todays = (logs ?? []).filter((log: any) => new Date(log.created_at).getTime() >= today);
    const loginsToday = todays.filter((log: any) => log.action === "Login").length;

    const counts: Record<string, number> = {};
    todays.forEach((log: any) => {
      if (log.user_email) counts[log.user_email] = (counts[log.user_email] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

    return {
      totalToday: todays.length,
      loginsToday,
      topUser: top ? `${top[0]} (${top[1]})` : "—",
    };
  }, [logs]);

  // Activity per day for the last 7 days
  const chartData = useMemo(() => {
    const days: { label: string; key: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        key: d.toDateString(),
        count: 0,
      });
    }
    (logs ?? []).forEach((log: any) => {
      const key = new Date(log.created_at).toDateString();
      const day = days.find((x) => x.key === key);
      if (day) day.count += 1;
    });
    const max = Math.max(1, ...days.map((d) => d.count));
    return { days, max };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    let cutoff = 0;
    if (dateRange === "today") cutoff = startOfToday().getTime();
    if (dateRange === "7d") cutoff = now - 7 * 24 * 60 * 60 * 1000;
    if (dateRange === "30d") cutoff = now - 30 * 24 * 60 * 60 * 1000;

    const result = (logs ?? []).filter((log: any) => {
      // existing role/login filter
      if (filter === "admin-login" && !(log.role === "admin" && log.action === "Login")) return false;
      if (filter === "staff-login" && !(log.role === "staff" && log.action === "Login")) return false;

      // new filters
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (userFilter && log.user_email !== userFilter) return false;
      if (cutoff && new Date(log.created_at).getTime() < cutoff) return false;
      if (q) {
        const haystack = `${log.user_email ?? ""} ${log.action ?? ""} ${log.details ?? ""} ${log.role ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...result].sort((a: any, b: any) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortOrder === "desc" ? -diff : diff;
    });
  }, [logs, filter, search, dateRange, actionFilter, userFilter, sortOrder]);

  const hasActiveFilters =
    filter !== "all" || search !== "" || dateRange !== "all" || actionFilter !== "all" || userFilter !== null;

  const clearFilters = () => {
    setFilter("all");
    setSearch("");
    setDateRange("all");
    setActionFilter("all");
    setUserFilter(null);
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading logs...</div>;

  const visibleLogs = filteredLogs.slice(0, visibleCount);

  return (
    <div className="space-y-4">
      {/* Summary stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border bg-card p-3">
          <p className="text-xs text-muted-foreground">Total activity today</p>
          <p className="text-2xl font-semibold">{stats.totalToday}</p>
        </div>
        <div className="rounded-md border bg-card p-3">
          <p className="text-xs text-muted-foreground">Logins today</p>
          <p className="text-2xl font-semibold">{stats.loginsToday}</p>
        </div>
        <div className="rounded-md border bg-card p-3">
          <p className="text-xs text-muted-foreground">Most active user today</p>
          <p className="truncate text-sm font-semibold" title={stats.topUser}>{stats.topUser}</p>
        </div>
      </div>

      {/* Mini activity chart (last 7 days) */}
      <div className="rounded-md border bg-card p-3">
        <p className="mb-2 text-xs text-muted-foreground">Activity — last 7 days</p>
        <div className="flex h-24 items-end gap-2">
          {chartData.days.map((d) => (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground">{d.count}</span>
              <div
                className="w-full rounded-t bg-primary/80 transition-all"
                style={{ height: `${Math.max(4, (d.count / chartData.max) * 64)}px` }}
                title={`${d.label}: ${d.count} log${d.count === 1 ? "" : "s"}`}
              />
              <span className="text-[10px] text-muted-foreground">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Existing role filter buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>All Activity</Button>
        <Button variant={filter === "admin-login" ? "default" : "outline"} size="sm" onClick={() => setFilter("admin-login")}>Admin Logins</Button>
        <Button variant={filter === "staff-login" ? "default" : "outline"} size="sm" onClick={() => setFilter("staff-login")}>Staff Logins</Button>
      </div>

      {/* Search, date, action, sort, live, export, clear */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search email, action, or details..."
          className="h-9 w-full sm:w-64"
        />

        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>

        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="Action type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actionOptions.map((action) => (
              <SelectItem key={action} value={action}>{action}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
        >
          {sortOrder === "desc" ? "Newest first ↓" : "Oldest first ↑"}
        </Button>

        <Button variant={live ? "default" : "outline"} size="sm" onClick={() => setLive((v) => !v)}>
          <span
            className={`mr-2 inline-block h-2 w-2 rounded-full ${live ? "animate-pulse bg-green-400" : "bg-muted-foreground"}`}
          />
          {live ? "Live" : "Live off"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToCsv(filteredLogs)}
          disabled={!filteredLogs.length}
        >
          Export CSV
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Active per-user filter chip */}
      {userFilter && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Showing activity for</span>
          <button
            type="button"
            onClick={() => setUserFilter(null)}
            className="rounded-full bg-secondary px-3 py-0.5 text-xs font-medium hover:bg-secondary/70"
            title="Click to remove user filter"
          >
            {userFilter} ✕
          </button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {Math.min(visibleCount, filteredLogs.length)} of {filteredLogs.length} log
        {filteredLogs.length === 1 ? "" : "s"}
      </p>

      <ScrollArea className="h-[500px] rounded-md border bg-card p-4">
        <div className="space-y-4">
          {visibleLogs.map((log: any) => (
            <div
              key={log.id}
              onClick={() => setSelectedLog(log)}
              className="flex cursor-pointer justify-between gap-4 border-b pb-2 text-sm transition-colors hover:bg-muted/50"
            >
              <div>
                <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${actionColor(log.action)}`}>
                  {log.action}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUserFilter(log.user_email);
                  }}
                  className="ml-2 font-medium hover:underline"
                  title="Show only this user's activity"
                >
                  {log.user_email}
                </button>
                <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{log.role}</span>
                <p className="mt-1 text-muted-foreground">{log.details}</p>
              </div>
              <div
                className="shrink-0 text-xs text-muted-foreground"
                title={new Date(log.created_at).toLocaleString()}
              >
                {timeAgo(log.created_at)}
              </div>
            </div>
          ))}
          {!filteredLogs.length && <p className="text-center text-muted-foreground">No logs found.</p>}

          {filteredLogs.length > visibleCount && (
            <div className="pt-2 text-center">
              <Button variant="outline" size="sm" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                Load more ({filteredLogs.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Click-to-expand details dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log details</DialogTitle>
            <DialogDescription>Full record of this activity entry.</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Action</dt>
                <dd>
                  <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${actionColor(selectedLog.action)}`}>
                    {selectedLog.action}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">User</dt>
                <dd className="font-medium">{selectedLog.user_email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Role</dt>
                <dd>{selectedLog.role}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Details</dt>
                <dd className="whitespace-pre-wrap break-words">{selectedLog.details || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Timestamp</dt>
                <dd>
                  {new Date(selectedLog.created_at).toLocaleString()} ({timeAgo(selectedLog.created_at)})
                </dd>
              </div>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActivityLogsTab;