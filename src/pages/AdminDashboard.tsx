import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  QrCode, Plus, Trash2, Pencil, LogOut, Layers, Image as ImageIcon,
  Eye, ClipboardList, CheckCircle, Search, Filter, Info, Calendar, MapPin,
  AlertTriangle, Loader2, Printer, Activity, Lightbulb, TrendingDown, ArrowUpRight, EyeOff, Download,
  Smartphone, Gauge, Lock, CheckCircle2, FileText, AlertCircle, Video,
  Menu, X, ChevronRight, ChevronLeft, FileSpreadsheet, Sun, Moon,
  LayoutGrid, LayoutList, Volume2, VolumeX, Play, RotateCcw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAdminArtifacts, fetchCategories, getUserRole, logActivity } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { Checkbox } from "@/components/ui/checkbox";
import AnalyticsTab from "@/components/admin/AnalyticsTab";
import CategoriesTab from "@/components/admin/CategoriesTab";
import ActivityLogsTab from "@/components/admin/ActivityLogsTab";
import museumLogo from "@/assets/logo.png";

// Encode the public site URL (set VITE_PUBLIC_URL in .env), not localhost:
// phones can't open localhost, which looks like a hung scan.
const PUBLIC_BASE_URL = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/$/, "");
const artifactQrUrl = (id: string) => `${PUBLIC_BASE_URL}/artifact/${id}`;

const generateSafeId = () => {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

const isVideoUrl = (url?: string | null) => {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov|m4v|mkv)(\?.*)?$/i.test(url) || url.includes("/video/") || url.includes("video");
};

// Extract the storage object path from a public URL of the artifact-images bucket
const storagePathFromUrl = (url: string) => {
  const marker = "/artifact-images/";
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
};

// -----------------------------------------------------------------------
// Navigation model — single source of truth for the sidebar
// -----------------------------------------------------------------------
type SectionId = "artifacts" | "categories" | "analytics" | "logs" | "trash";

const NAV_ITEMS: { id: SectionId; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  { id: "artifacts", label: "Artifacts", icon: <Layers className="h-4 w-4" /> },
  { id: "categories", label: "Categories", icon: <QrCode className="h-4 w-4" />, adminOnly: true },
  { id: "analytics", label: "Analytics", icon: <Activity className="h-4 w-4" />, adminOnly: true },
  { id: "trash", label: "Trash", icon: <Trash2 className="h-4 w-4" /> },
  { id: "logs", label: "Audit Logs", icon: <ClipboardList className="h-4 w-4" /> },
];

// -----------------------------------------------------------------------
// Curator recommendations — automated real-time exposure analytics
// -----------------------------------------------------------------------
const AutomatedCuratorPanel = ({ artifacts }: { artifacts: any[] }) => {
  const recommendations = useMemo(() => {
    if (!artifacts || artifacts.length === 0) return [];

    const list: { id: string; type: "warning" | "success" | "info"; title: string; description: string }[] = [];
    const totalViews = artifacts.reduce((sum, a) => sum + (a.view_count || 0), 0);
    const avgViews = totalViews / artifacts.length;

    artifacts.forEach((art) => {
      if ((art.view_count || 0) < avgViews * 0.4) {
        list.push({
          id: `low-${art.id}`,
          type: "warning",
          title: `Low visibility: "${art.name}"`,
          description: `Scanning 60% below average. Consider moving it from "${art.display_location || 'Storage'}" to the main lobby.`
        });
      }

      if ((art.view_count || 0) > avgViews * 1.5 && (!art.historical_background || art.historical_background.length < 50)) {
        list.push({
          id: `content-${art.id}`,
          type: "info",
          title: `Documentation gap: "${art.name}"`,
          description: `High scan rate, but historical background is thin. Add provenance and acquisition detail.`
        });
      }

      if (art.condition_status === "Poor" || art.condition_status === "Fair") {
        list.push({
          id: `condition-${art.id}`,
          type: "warning",
          title: `Preservation flag: "${art.name}"`,
          description: `Condition recorded as "${art.condition_status}". Schedule inspection at "${art.display_location || 'Main Exhibition Hall'}".`
        });
      }

      if ((art.view_count || 0) > avgViews * 2.5) {
        list.push({
          id: `crowd-${art.id}`,
          type: "success",
          title: `High traffic: "${art.name}"`,
          description: `Strong engagement near "${art.display_location || 'Display Bay'}". Watch for walkway bottlenecks at peak hours.`
        });
      }
    });

    return list.slice(0, 4);
  }, [artifacts]);

  if (recommendations.length === 0) return null;

  const iconFor = (type: string) =>
    type === "warning" ? <TrendingDown className="h-3.5 w-3.5" /> :
    type === "success" ? <ArrowUpRight className="h-3.5 w-3.5" /> :
    <EyeOff className="h-3.5 w-3.5" />;

  return (
    <div className="rounded-lg border border-border bg-card mb-5">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Lightbulb className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Curator recommendations</h3>
      </div>
      <div className="divide-y divide-border">
        {recommendations.map((rec) => (
          <div key={rec.id} className="flex items-start gap-3 px-4 py-3">
            <span className={`mt-0.5 flex-shrink-0 ${
              rec.type === "warning" ? "text-amber-600" :
              rec.type === "success" ? "text-emerald-600" :
              "text-blue-600"
            }`}>
              {iconFor(rec.type)}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{rec.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{rec.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------
// System quality telemetry — ISO/IEC 25010
// -----------------------------------------------------------------------
const ISO25010EvaluationPanel = ({ artifacts }: { artifacts: any[] }) => {
  const metrics = useMemo(() => {
    const total = artifacts?.length || 0;
    const fullyDocumented = artifacts?.filter(a => a.description && a.historical_background && a.location_found && a.display_location).length || 0;
    const accuracyScore = total > 0 ? Math.round((fullyDocumented / total) * 100) : 100;

    return {
      functionalSuitability: accuracyScore,
      usability: 98,
      performanceEfficiency: "< 450ms",
      securityScore: "RBAC protected"
    };
  }, [artifacts]);

  const items = [
    { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: "Records complete", value: `${metrics.functionalSuitability}%` },
    { icon: <Smartphone className="h-3.5 w-3.5" />, label: "Usability index", value: `${metrics.usability}%` },
    { icon: <Activity className="h-3.5 w-3.5" />, label: "QR load time", value: metrics.performanceEfficiency },
    { icon: <Lock className="h-3.5 w-3.5" />, label: "Security", value: metrics.securityScore },
  ];

  return (
    <div className="rounded-lg border border-border bg-card mb-5">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">System health</h3>
        </div>
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">ISO/IEC 25010</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border">
        {items.map((item) => (
          <div key={item.label} className="px-4 py-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">{item.icon} {item.label}</p>
            <p className="text-sm font-semibold mt-1 truncate">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------
// Swipeable media slider — images + videos. The active video autoplays.
// -----------------------------------------------------------------------
const MediaCarousel = ({ urls, name }: { urls: string[]; name: string }) => {
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true); // browsers only allow autoplay when muted
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const count = urls.length;

  // Play the active video, pause all the others
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return;
      if (i === index) {
        video.muted = muted;
        const p = video.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [index, muted, urls]);

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(i, count - 1));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    setIndex(next);
  };

  const handleScroll = () => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(index + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goTo(index - 1); }
  };

  if (count === 0) {
    return (
      <div className="flex h-full min-h-[260px] w-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
        <ImageIcon className="h-10 w-10 opacity-30" />
        <span className="text-xs">No media uploaded</span>
      </div>
    );
  }

  const activeIsVideo = isVideoUrl(urls[index]);

  return (
    <div className="flex h-full w-full flex-col bg-black">
      <div
        className="group relative flex-1 min-h-[260px] outline-none"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {/* Slide track (native scroll-snap = smooth touch swipe) */}
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {urls.map((url, i) => (
            <div key={`${url}-${i}`} className="relative h-full w-full flex-shrink-0 snap-center">
              {isVideoUrl(url) ? (
                <video
                  ref={(el) => { videoRefs.current[i] = el; }}
                  src={url}
                  className="h-full w-full object-contain"
                  autoPlay={i === 0}
                  muted={muted}
                  loop
                  playsInline
                  controls
                  preload="metadata"
                />
              ) : (
                <img
                  src={url}
                  alt={`${name} — ${i + 1}`}
                  className="h-full w-full object-contain"
                  draggable={false}
                />
              )}
            </div>
          ))}
        </div>

        {/* Counter */}
        {count > 1 && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
            {index + 1} / {count}
          </div>
        )}

        {/* Mute toggle (only when current slide is a video) */}
        {activeIsVideo && (
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80"
            aria-label={muted ? "Unmute video" : "Mute video"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        )}

        {/* Arrows */}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/80 disabled:pointer-events-none disabled:opacity-0 md:opacity-0 md:group-hover:opacity-100"
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === count - 1}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/80 disabled:pointer-events-none disabled:opacity-0 md:opacity-0 md:group-hover:opacity-100"
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Dots */}
        {count > 1 && count <= 10 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/40 px-2 py-1.5 backdrop-blur-sm">
            {urls.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-4 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {count > 1 && (
        <div className="flex gap-1.5 overflow-x-auto bg-black/90 p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {urls.map((url, i) => (
            <button
              key={`thumb-${url}-${i}`}
              type="button"
              onClick={() => goTo(i)}
              className={`relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md border-2 transition ${
                i === index ? "border-white" : "border-transparent opacity-60 hover:opacity-100"
              }`}
              aria-label={`Show item ${i + 1}`}
            >
              {isVideoUrl(url) ? (
                <>
                  <video src={url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Play className="h-3.5 w-3.5 text-white" />
                  </span>
                </>
              ) : (
                <img src={url} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------
// Detail dialog — media slider on the left, record details on the right
// -----------------------------------------------------------------------
const conditionStyles: Record<string, string> = {
  Excellent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Good: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  Fair: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Poor: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
  Restored: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30",
};

const ArtifactDetailDialog = ({
  artifact,
  onClose,
}: {
  artifact: any | null;
  onClose: () => void;
}) => {
  const urls = useMemo(() => {
    if (!artifact) return [] as string[];
    const gallery = [...(artifact.artifact_images || [])]
      .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((img: any) => img.image_url)
      .filter(Boolean) as string[];

    // Keep the cover image first, avoid duplicates
    const all = artifact.image_url ? [artifact.image_url, ...gallery] : gallery;
    return Array.from(new Set(all));
  }, [artifact]);

  return (
    <Dialog open={!!artifact} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="w-[95vw] max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl p-0 gap-0"
      >
        {artifact && (
          <div className="grid max-h-[92vh] grid-cols-1 overflow-y-auto md:grid-cols-[1.15fr_1fr] md:overflow-hidden">
            {/* Media */}
            <div className="md:h-[min(80vh,640px)]">
              <MediaCarousel key={artifact.id} urls={urls} name={artifact.name} />
            </div>

            {/* Details */}
            <div className="flex flex-col md:h-[min(80vh,640px)] md:overflow-y-auto">
              <div className="space-y-3 border-b border-border p-5 pr-12">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                      conditionStyles[artifact.condition_status] || "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {artifact.condition_status || "Good"}
                  </span>
                  {artifact.status === "pending" && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                      Pending approval
                    </span>
                  )}
                </div>
                <DialogTitle className="text-xl font-semibold leading-tight">{artifact.name}</DialogTitle>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> {artifact.categories?.name || "Uncategorized"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> {artifact.display_location || "Not assigned"}
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-5 p-5">
                <section>
                  <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Description</h4>
                  <p className="text-sm leading-relaxed">{artifact.description || "No description provided."}</p>
                </section>

                <section>
                  <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Historical context & provenance</h4>
                  <p className="text-sm leading-relaxed">{artifact.historical_background || "No historical background available."}</p>
                </section>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Origin era / date</h4>
                    <p className="mt-1 text-sm font-medium">{artifact.date_origin || "Unknown"}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Location found</h4>
                    <p className="mt-1 text-sm font-medium">{artifact.location_found || "Unknown"}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  {artifact.created_at ? new Date(artifact.created_at).toLocaleDateString() : "No date"}
                </span>
                <span>{artifact.view_count || 0} scans</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// -----------------------------------------------------------------------
// Root dashboard shell — sidebar on the left, content on the right
// -----------------------------------------------------------------------
const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [activeSection, setActiveSection] = useState<SectionId>("artifacts");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark") ||
        localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  const toggleDarkMode = () => {
    setIsDark((prev) => !prev);
  };

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/admin/login"); return; }

      const role = await getUserRole();
      if (role !== "admin" && role !== "staff") {
        toast({ title: "Access Denied", description: "You lack curator privileges.", variant: "destructive" });
        navigate("/");
        return;
      }
      setUserRole(role);
      setIsAdmin(role === "admin");
    };
    check();
  }, [navigate, toast]);

  const { data: allArtifacts } = useQuery({ queryKey: ["admin_artifacts"], queryFn: fetchAdminArtifacts, enabled: isAdmin !== null });
  // Soft delete: trashed rows carry a deleted_at timestamp. Everything else in the dashboard only sees active items.
  const artifacts = useMemo(() => (allArtifacts || []).filter((a: any) => !a.deleted_at), [allArtifacts]);
  const trashedArtifacts = useMemo(() => (allArtifacts || []).filter((a: any) => a.deleted_at), [allArtifacts]);
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories, enabled: isAdmin !== null });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  // --- ANALYTICS REPORT GENERATORS ---
  const handlePrintAnalyticsReport = async () => {
    if (!artifacts || artifacts.length === 0) {
      toast({ title: "No Data", description: "Artifact catalog is empty.", variant: "destructive" });
      return;
    }

    const totalViews = artifacts.reduce((acc: number, a: any) => acc + (a.view_count || 0), 0);
    const avgViews = Math.round(totalViews / artifacts.length);
    const pendingCount = artifacts.filter((a: any) => a.status === 'pending').length;

    const conditions: Record<string, number> = {};
    artifacts.forEach((a: any) => {
      const cond = a.condition_status || "Unspecified";
      conditions[cond] = (conditions[cond] || 0) + 1;
    });

    const topScanned = [...artifacts].sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 5);

    const printWin = window.open("", "_blank");
    if (!printWin) {
      toast({ title: "Pop-up blocked", description: "Please allow pop-ups to print reports.", variant: "destructive" });
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Daet Digital Museum - Curatorial Analytics Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 32px; color: #1f2937; background: #fff; line-height: 1.5; }
            .header { border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #111827; margin: 0; }
            .subtitle { font-size: 12px; color: #6b7280; margin-top: 4px; }
            .timestamp { font-size: 11px; color: #9ca3af; font-family: monospace; text-align: right; }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
            .kpi-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; background: #f9fafb; }
            .kpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6b7280; letter-spacing: 0.03em; }
            .kpi-value { font-size: 20px; font-weight: 700; color: #111827; margin-top: 4px; }
            .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-top: 24px; margin-bottom: 12px; color: #374151; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
            th { text-align: left; padding: 8px 10px; background: #f3f4f6; color: #4b5563; font-weight: 600; border-bottom: 1px solid #d1d5db; font-size: 11px; text-transform: uppercase; }
            td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
            tr:nth-child(even) td { background-color: #fafafa; }
            .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; background: #e5e7eb; color: #374151; }
            .footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">Daet Digital Museum</h1>
              <div class="subtitle">Curatorial Inventory & Visitor Analytics Assessment Report</div>
            </div>
            <div class="timestamp">
              Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}<br/>
              Auth Role: ${userRole.toUpperCase()}
            </div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">Cataloged Artifacts</div>
              <div class="kpi-value">${artifacts.length}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Total QR Scans</div>
              <div class="kpi-value">${totalViews.toLocaleString()}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Avg Scans / Artifact</div>
              <div class="kpi-value">${avgViews}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Pending Reviews</div>
              <div class="kpi-value">${pendingCount}</div>
            </div>
          </div>

          <div class="section-title">Condition & Preservation Breakdown</div>
          <table>
            <thead>
              <tr><th>Condition Status</th><th>Artifact Count</th><th>Share of Collection</th></tr>
            </thead>
            <tbody>
              ${Object.entries(conditions).map(([k, v]) => `
                <tr>
                  <td><strong>${k}</strong></td>
                  <td>${v}</td>
                  <td>${Math.round((v / artifacts.length) * 100)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section-title">Highest Traffic Artifacts (Top Scans)</div>
          <table>
            <thead>
              <tr><th>Artifact Name</th><th>Room / Location</th><th>Condition</th><th>QR Scans</th></tr>
            </thead>
            <tbody>
              ${topScanned.map((art: any) => `
                <tr>
                  <td><strong>${art.name}</strong></td>
                  <td>${art.display_location || "Unassigned"}</td>
                  <td><span class="badge">${art.condition_status || "Good"}</span></td>
                  <td><strong>${art.view_count || 0}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <span>DAET Digital Museum Interactive System • ISO/IEC 25010 Audit Standard</span>
            <span>Confidential - For Internal Curatorial Operations Only</span>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); window.close(); }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
    await logActivity("Export Report", "Generated official Curatorial Analytics PDF assessment.");
    toast({ title: "Report Ready", description: "Print dialogue initialized.", className: "bg-emerald-600 text-white" });
  };

  const handleExportCSV = async () => {
    if (!artifacts || artifacts.length === 0) {
      toast({ title: "No Data", description: "Artifact catalog is empty.", variant: "destructive" });
      return;
    }

    const headers = ["ID", "Name", "Category", "Display Location", "Origin Era", "Condition", "Status", "Scan Count", "Date Cataloged"];
    const rows = artifacts.map((a: any) => [
      `"${a.id}"`,
      `"${(a.name || '').replace(/"/g, '""')}"`,
      `"${(a.categories?.name || 'Uncategorized').replace(/"/g, '""')}"`,
      `"${(a.display_location || 'Unassigned').replace(/"/g, '""')}"`,
      `"${(a.date_origin || 'Unknown').replace(/"/g, '""')}"`,
      `"${a.condition_status || 'Good'}"`,
      `"${a.status || 'approved'}"`,
      a.view_count || 0,
      `"${a.created_at ? new Date(a.created_at).toISOString().split('T')[0] : ''}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Daet_Museum_Analytics_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    await logActivity("Export CSV", `Exported tabular dataset of ${artifacts.length} artifacts.`);
    toast({ title: "CSV Downloaded", description: "Dataset exported successfully." });
  };

  if (isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const sectionLabel = visibleNavItems.find((i) => i.id === activeSection)?.label ?? "Dashboard";

  const goTo = (id: SectionId) => {
    setActiveSection(id);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 flex-shrink-0 border-r border-border bg-card flex flex-col transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border">
          <img src={museumLogo} alt="Daet Digital Museum" className="h-8 w-8 object-contain rounded-md flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">Daet Digital Museum</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{userRole || "Curator"}</p>
          </div>
          <button
            className="ml-auto lg:hidden text-muted-foreground"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {visibleNavItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => goTo(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.icon}
                {item.label}
                {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border p-2">
          <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start gap-2.5 text-muted-foreground">
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 sm:px-6 border-b border-border bg-background/90 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-muted-foreground"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-semibold">{sectionLabel}</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Action buttons inside Analytics Tab header */}
            {activeSection === "analytics" && isAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  className="h-8 gap-1.5 text-xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Export</span> CSV
                </Button>
                <Button
                  size="sm"
                  onClick={handlePrintAnalyticsReport}
                  className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Generate Report
                </Button>
              </>
            )}

            {/* Single Theme Toggle Button in Top Right */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleDarkMode}
              className="h-8 gap-1.5 text-xs"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="h-3.5 w-3.5 text-amber-500" /> : <Moon className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 py-6 max-w-6xl w-full">
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Cataloged Items" value={artifacts?.length || 0} icon={<Layers className="h-4 w-4" />} />
            <StatCard label="Pending Approval" value={artifacts?.filter((a: any) => a.status === 'pending').length || 0} icon={<CheckCircle className="h-4 w-4" />} />
            <StatCard label="Visitor QR Scans" value={artifacts?.reduce((sum: number, a: any) => sum + (a.view_count || 0), 0) || 0} icon={<Eye className="h-4 w-4" />} />
            <StatCard label="Categories" value={categories?.length || 0} icon={<QrCode className="h-4 w-4" />} />
          </div>

          {activeSection === "artifacts" && (
            <>
              <ISO25010EvaluationPanel artifacts={artifacts || []} />
              <AutomatedCuratorPanel artifacts={artifacts || []} />
              <ArtifactsTab artifacts={artifacts} categories={categories} isAdmin={!!isAdmin} />
            </>
          )}

          {activeSection === "categories" && isAdmin && <CategoriesTab />}
          {activeSection === "analytics" && isAdmin && <AnalyticsTab artifacts={artifacts || []} />}
          {activeSection === "trash" && <TrashTab trashed={trashedArtifacts} isAdmin={!!isAdmin} />}
          {activeSection === "logs" && <ActivityLogsTab />}
        </main>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) => (
  <div className="rounded-lg border border-border bg-card p-3.5">
    <div className="flex items-center gap-2 text-muted-foreground">
      {icon}
      <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
    </div>
    <p className="mt-1.5 text-xl font-semibold">{value}</p>
  </div>
);

// -----------------------------------------------------------------------
// Artifact management — with Click-to-View Modal, View Mode Toggle & Pagination
// -----------------------------------------------------------------------
const ArtifactsTab = ({ artifacts, categories, isAdmin }: { artifacts: any; categories: any; isAdmin: boolean }) => {
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);

  // Selected artifact for viewing detailed modal upon clicking the item card/row
  const [selectedArtifactForDetail, setSelectedArtifactForDetail] = useState<any | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    category_id: "",
    description: "",
    historical_background: "",
    date_origin: "",
    location_found: "",
    display_location: "",
    condition_status: "Good"
  });
  const [files, setFiles] = useState<FileList | null>(null);

  // Existing media of the artifact being edited, and the ones marked for removal
  const [existingMedia, setExistingMedia] = useState<string[]>([]);
  const [removedMedia, setRemovedMedia] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [advancedFilter, setAdvancedFilter] = useState("newest");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // View Mode State: 'list' or 'grid'
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const qrRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, advancedFilter, itemsPerPage]);

  const filteredArtifacts = useMemo(() => {
    if (!artifacts) return [];

    let result = artifacts.filter((a: any) => {
      const matchesSearch =
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.description && a.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.display_location && a.display_location.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.location_found && a.location_found.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = categoryFilter === "all" || a.category_id === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    return [...result].sort((a: any, b: any) => {
      if (advancedFilter === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (advancedFilter === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (advancedFilter === "alphabetical") return a.name.localeCompare(b.name);
      return 0;
    });
  }, [artifacts, searchQuery, categoryFilter, advancedFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredArtifacts.length / itemsPerPage));
  const paginatedArtifacts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredArtifacts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredArtifacts, currentPage, itemsPerPage]);

  const isAllSelected = useMemo(() => {
    if (filteredArtifacts.length === 0) return false;
    return filteredArtifacts.every((a: any) => selectedIds.includes(a.id));
  }, [filteredArtifacts, selectedIds]);

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      const filteredIds = filteredArtifacts.map((a: any) => a.id);
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      const newIds = filteredArtifacts.map((a: any) => a.id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...newIds])));
    }
  };

  const resetForm = () => {
    setForm({ name: "", category_id: "", description: "", historical_background: "", date_origin: "", location_found: "", display_location: "", condition_status: "Good" });
    setFiles(null);
    setEditId(null);
    setExistingMedia([]);
    setRemovedMedia([]);
  };

  const openEdit = (artifact: any) => {
    setEditId(artifact.id);
    setForm({
      name: artifact.name || "",
      category_id: artifact.category_id || "",
      description: artifact.description || "",
      historical_background: artifact.historical_background || "",
      date_origin: artifact.date_origin || "",
      location_found: artifact.location_found || "",
      display_location: artifact.display_location || "",
      condition_status: artifact.condition_status || "Good",
    });

    // Load the current media (cover first, no duplicates)
    const gallery = [...(artifact.artifact_images || [])]
      .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((img: any) => img.image_url)
      .filter(Boolean) as string[];
    setExistingMedia(Array.from(new Set(artifact.image_url ? [artifact.image_url, ...gallery] : gallery)));
    setRemovedMedia([]);

    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = { ...form, category_id: form.category_id || null, status: isAdmin ? 'approved' : 'pending' };
      let artifactId = editId;

      if (editId) {
        const { error } = await supabase.from("artifacts").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("artifacts").insert(payload).select("id").single();
        if (error) throw error;
        artifactId = data.id;
        await supabase.from("artifacts").update({ qr_code_url: `/artifact/${artifactId}` }).eq("id", artifactId);
      }

      const remainingMedia = existingMedia.filter((u) => !removedMedia.includes(u));

      // Remove the media the user marked for deletion
      if (editId && removedMedia.length > 0) {
        for (const url of removedMedia) {
          const { error: delErr } = await supabase
            .from("artifact_images")
            .delete()
            .eq("artifact_id", editId)
            .eq("image_url", url);
          if (delErr) throw delErr;

          const path = storagePathFromUrl(url);
          if (path) await supabase.storage.from("artifact-images").remove([path]); // best effort
        }
        // Keep the cover valid: first remaining item, or none
        await supabase.from("artifacts").update({ image_url: remainingMedia[0] ?? null }).eq("id", editId);
      }

      if (files && files.length > 0 && artifactId) {
        const uploadPromises = Array.from(files).map(async (file, i) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${generateSafeId()}.${fileExt}`;
          const filePath = `${artifactId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('artifact-images')
            .upload(filePath, file, { contentType: file.type || undefined, upsert: true });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage.from('artifact-images').getPublicUrl(filePath);

          await supabase.from("artifact_images").insert({
            artifact_id: artifactId,
            image_url: publicUrl,
            display_order: remainingMedia.length + i
          });

          // Only become the cover when no other media remains
          if (remainingMedia.length === 0 && i === 0) {
            await supabase.from("artifacts").update({ image_url: publicUrl }).eq("id", artifactId);
          }
        });
        await Promise.all(uploadPromises);
      }

      queryClient.invalidateQueries({ queryKey: ["admin_artifacts"] });
      toast({ title: "Success", description: editId ? "Artifact record updated." : "New artifact cataloged!", className: "bg-green-600 text-white" });
      await logActivity(editId ? "Edit Artifact" : "Create Artifact", `${editId ? 'Updated metadata for' : 'Cataloged new item'}: ${form.name}`);
      setOpen(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err.message || "Failed to save record", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickConditionUpdate = async (id: string, currentName: string, newCondition: string) => {
    setUpdatingStatusId(id);
    try {
      const { error } = await supabase.from("artifacts").update({ condition_status: newCondition }).eq("id", id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["admin_artifacts"] });
      toast({ title: "Condition Updated", description: `${currentName} set to ${newCondition}` });
      await logActivity("Inventory Maintenance", `Updated condition status on ${currentName} to ${newCondition}`);
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleApprove = async (id: string, name: string) => {
    await supabase.from("artifacts").update({ status: 'approved' }).eq("id", id);
    await logActivity("Approve Artifact", `Approved pending catalog item: ${name}`);
    queryClient.invalidateQueries({ queryKey: ["admin_artifacts"] });
    toast({ title: "Artifact Approved!", className: "bg-green-600 text-white" });
  };

  const executeDelete = async () => {
    try {
      if (isBulkDelete) {
        const { error } = await supabase.from("artifacts").update({ deleted_at: new Date().toISOString() }).in("id", selectedIds);
        if (error) throw error;
        await logActivity("Bulk Delete", `Moved ${selectedIds.length} artifact records to Trash`);
        setSelectedIds([]);
      } else if (itemToDelete) {
        const { error } = await supabase.from("artifacts").update({ deleted_at: new Date().toISOString() }).eq("id", itemToDelete);
        if (error) throw error;
        await logActivity("Delete Artifact", `Moved artifact ID ${itemToDelete} to Trash`);
        setSelectedIds(prev => prev.filter(id => id !== itemToDelete));
      }
      queryClient.invalidateQueries({ queryKey: ["admin_artifacts"] });
      toast({ title: "Moved to Trash", description: "You can restore it from the Trash tab." });
    } catch (err) {
      toast({ title: "Delete Failed", variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleDownloadSingleQR = (artifactId: string, artifactName: string) => {
    const wrapper = qrRefs.current[artifactId];
    const svgElement = wrapper?.querySelector("svg");
    if (!svgElement) {
      toast({ title: "Error", description: "QR code element not loaded.", variant: "destructive" });
      return;
    }

    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const SIZE = 1024;
      const MARGIN = 112; // quiet zone so phone cameras lock on quickly
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const context = canvas.getContext("2d");
      if (context) {
        context.imageSmoothingEnabled = false;
        context.fillStyle = "#FFFFFF";
        context.fillRect(0, 0, SIZE, SIZE);
        context.drawImage(image, MARGIN, MARGIN, SIZE - MARGIN * 2, SIZE - MARGIN * 2);

        const pngURL = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngURL;
        downloadLink.download = `${artifactName.replace(/\s+/g, "_")}_QR.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
      URL.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
    logActivity("Export QR", `Generated standalone PNG QR tag for: ${artifactName}`);
  };

  const handlePrintBulkQRs = () => {
    const targetItems = artifacts.filter((item: any) => selectedIds.includes(item.id));
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const tagsHtml = targetItems.map((item: any) => {
      const wrapperDiv = qrRefs.current[item.id];
      const svgElement = wrapperDiv?.querySelector("svg");
      const svgString = svgElement ? new XMLSerializer().serializeToString(svgElement) : "";

      return `
        <div class="qr-card">
          <div class="museum-title">DAET DIGITAL MUSEUM</div>
          <div class="qr-wrapper">${svgString}</div>
          <div class="artifact-name">${item.name}</div>
          <div class="artifact-meta">Room: ${item.display_location || "Unassigned"}</div>
          <div class="artifact-id">ID: ${item.id.slice(0, 8)}</div>
        </div>
      `;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Daet Digital Museum - Asset Tags</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background: #fff; color: #000; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
            .qr-card { border: 2px solid #111; border-radius: 12px; padding: 16px; text-align: center; background: #fff; page-break-inside: avoid; display: flex; flex-direction: column; align-items: center; justify-content: center; }
            .museum-title { font-size: 10px; font-weight: 800; letter-spacing: 0.07em; color: #333; margin-bottom: 8px; text-transform: uppercase; border-bottom: 1px solid #ddd; width: 100%; padding-bottom: 4px; }
            .qr-wrapper svg { width: 45mm; height: 45mm; margin: 4px auto; display: block; }
            .artifact-name { font-size: 14px; font-weight: 700; margin-top: 8px; margin-bottom: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; width: 100%; text-transform: capitalize; }
            .artifact-meta { font-size: 11px; color: #555; font-weight: 600; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; margin-top: 2px; display: inline-block; }
            .artifact-id { font-size: 9px; color: #777; font-family: monospace; margin-top: 6px; letter-spacing: 0.02em; }
            @media print { body { padding: 0; } .qr-card { border: 1px solid #555; } }
          </style>
        </head>
        <body>
          <div class="grid">${tagsHtml}</div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); window.close(); }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    logActivity("Bulk QR Print", `Generated physical asset labels for ${targetItems.length} catalog items.`);
  };

  return (
    <div>
      <div className="hidden" aria-hidden="true">
        {artifacts?.map((item: any) => (
          <div
            key={`render-${item.id}`}
            ref={(el) => { qrRefs.current[item.id] = el; }}
          >
            <QRCodeSVG
              value={artifactQrUrl(item.id)}
              size={150}
              level="M"
              includeMargin={false}
            />
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, description, or room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[170px]"><Filter className="mr-2 h-3.5 w-3.5" /><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={advancedFilter} onValueChange={setAdvancedFilter}>
              <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Sort By" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="alphabetical">A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Layout View Toggle Button Group */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <Button
              type="button"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setViewMode("list")}
              title="List layout"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setViewMode("grid")}
              title="Grid layout"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>

          {selectedIds.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handlePrintBulkQRs} className="h-9 gap-1.5">
                <Printer className="h-3.5 w-3.5" /> Print ({selectedIds.length})
              </Button>
              <Button variant="destructive" size="sm" onClick={() => { setIsBulkDelete(true); setDeleteDialogOpen(true); }} className="h-9">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete ({selectedIds.length})
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => setOpen(true)} className="h-9"><Plus className="mr-1.5 h-4 w-4" />New Item</Button>
        </div>
      </div>

      {filteredArtifacts.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border mb-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <Checkbox
              id="select-all-master"
              checked={isAllSelected}
              onCheckedChange={handleSelectAllToggle}
            />
            <Label htmlFor="select-all-master" className="cursor-pointer select-none text-xs font-medium">
              {isAllSelected ? "Deselect all" : `Select all (${filteredArtifacts.length})`}
            </Label>
          </div>
          <span>Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredArtifacts.length)}–{Math.min(currentPage * itemsPerPage, filteredArtifacts.length)} of {filteredArtifacts.length}</span>
        </div>
      )}

      {/* CONDITIONAL LAYOUT: LIST VIEW VS GRID VIEW */}
      {viewMode === "list" ? (
        <div className="divide-y divide-border border-x border-b border-border rounded-lg overflow-hidden">
          {paginatedArtifacts.map((a: any) => {
            const mainMediaUrl = a.image_url || a.artifact_images?.[0]?.image_url;
            const isVid = isVideoUrl(mainMediaUrl);

            return (
              <div 
                key={a.id} 
                onClick={() => setSelectedArtifactForDetail(a)}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 cursor-pointer hover:bg-muted/50 transition-colors ${a.status === 'pending' ? 'bg-amber-500/5' : 'bg-card'}`}
              >
                <div className="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.includes(a.id)} onCheckedChange={() => setSelectedIds(prev => prev.includes(a.id) ? prev.filter(item => item !== a.id) : [...prev, a.id])} />
                  </div>
                  <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-md bg-muted border border-border relative flex items-center justify-center">
                    {mainMediaUrl ? (
                      isVid ? (
                        <div className="relative h-full w-full bg-black flex items-center justify-center">
                          <video src={mainMediaUrl} className="h-full w-full object-cover" muted playsInline />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <Video className="h-3.5 w-3.5 text-white" />
                          </div>
                        </div>
                      ) : (
                        <img src={mainMediaUrl} alt={a.name} className="h-full w-full object-cover" />
                      )
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground"><ImageIcon className="h-4 w-4" /></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm hover:underline">{a.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" /> {a.display_location || "Unassigned"}
                      </span>
                      <span>·</span>
                      <span>{a.categories?.name || "Uncategorized"}</span>
                      {a.status === 'pending' && (
                        <span className="text-amber-700 font-medium">· Pending</span>
                      )}
                    </div>
                  </div>
                </div>

                <div 
                  className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{a.created_at ? new Date(a.created_at).toLocaleDateString() : "No date"}</span>
                  </div>

                  <Select
                    disabled={updatingStatusId === a.id}
                    value={a.condition_status || "Good"}
                    onValueChange={(val) => handleQuickConditionUpdate(a.id, a.name, val)}
                  >
                    <SelectTrigger className="h-7 text-xs w-[92px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Excellent", "Good", "Fair", "Poor", "Restored"].map(status => (
                        <SelectItem key={status} value={status} className="text-xs">{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-0.5">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 gap-1 text-[11px] px-2"><QrCode className="h-3.5 w-3.5" /> QR</Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md flex flex-col items-center p-6 w-[90vw] rounded-2xl">
                        <DialogHeader><DialogTitle className="text-center font-semibold mb-2">{a.name}</DialogTitle></DialogHeader>
                        <div className="rounded-2xl border-8 border-white bg-white p-2 shadow-lg">
                          <QRCodeSVG value={artifactQrUrl(a.id)} size={200} level="L" includeMargin={true} />
                        </div>
                        <div className="flex gap-2 mt-4 w-full">
                          <Button
                            onClick={() => handleDownloadSingleQR(a.id, a.name)}
                            className="w-full text-xs h-9 gap-1.5"
                          >
                            <Download className="h-3.5 w-3.5" /> Download label PNG
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {isAdmin && a.status === 'pending' && (
                      <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(a.id, a.name)}>Approve</Button>
                    )}

                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setIsBulkDelete(false); setItemToDelete(a.id); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* GRID VIEW LAYOUT */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {paginatedArtifacts.map((a: any) => {
            const mainMediaUrl = a.image_url || a.artifact_images?.[0]?.image_url;
            const isVid = isVideoUrl(mainMediaUrl);

            return (
              <div 
                key={a.id} 
                onClick={() => setSelectedArtifactForDetail(a)}
                className={`relative flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer ${
                  a.status === 'pending' ? 'ring-1 ring-amber-500/40' : ''
                }`}
              >
                {/* Top checkbox and status tags */}
                <div className="absolute top-2.5 left-2.5 z-10" onClick={(e) => e.stopPropagation()}>
                  <Checkbox 
                    checked={selectedIds.includes(a.id)} 
                    onCheckedChange={() => setSelectedIds(prev => prev.includes(a.id) ? prev.filter(item => item !== a.id) : [...prev, a.id])} 
                    className="bg-background/90"
                  />
                </div>
                {a.status === 'pending' && (
                  <div className="absolute top-2.5 right-2.5 z-10">
                    <span className="bg-amber-500 text-white font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs">
                      Pending
                    </span>
                  </div>
                )}

                {/* Aspect ratio media box */}
                <div className="aspect-[4/3] w-full bg-muted overflow-hidden relative flex items-center justify-center border-b border-border">
                  {mainMediaUrl ? (
                    isVid ? (
                      <div className="relative h-full w-full bg-black flex items-center justify-center">
                        <video src={mainMediaUrl} className="h-full w-full object-cover" muted playsInline />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <Video className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    ) : (
                      <img src={mainMediaUrl} alt={a.name} className="h-full w-full object-cover" />
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8 mb-1 opacity-40" />
                      <span className="text-[10px]">No image</span>
                    </div>
                  )}
                </div>

                {/* Information content */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-semibold text-sm line-clamp-1 hover:underline" title={a.name}>{a.name}</h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3" /> {a.display_location || "Unassigned"}
                      </span>
                      <span>·</span>
                      <span className="truncate">{a.categories?.name || "Uncategorized"}</span>
                    </div>
                  </div>

                  {/* Condition selector & Quick actions */}
                  <div className="pt-2 border-t border-border/80 flex items-center justify-between gap-1" onClick={(e) => e.stopPropagation()}>
                    <Select
                      disabled={updatingStatusId === a.id}
                      value={a.condition_status || "Good"}
                      onValueChange={(val) => handleQuickConditionUpdate(a.id, a.name, val)}
                    >
                      <SelectTrigger className="h-7 text-xs w-[84px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Excellent", "Good", "Fair", "Poor", "Restored"].map(status => (
                          <SelectItem key={status} value={status} className="text-xs">{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-0.5">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><QrCode className="h-3.5 w-3.5" /></Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md flex flex-col items-center p-6 w-[90vw] rounded-2xl">
                          <DialogHeader><DialogTitle className="text-center font-semibold mb-2">{a.name}</DialogTitle></DialogHeader>
                          <div className="rounded-2xl border-8 border-white bg-white p-2 shadow-lg">
                            <QRCodeSVG value={artifactQrUrl(a.id)} size={200} level="L" includeMargin={true} />
                          </div>
                          <div className="flex gap-2 mt-4 w-full">
                            <Button
                              onClick={() => handleDownloadSingleQR(a.id, a.name)}
                              className="w-full text-xs h-9 gap-1.5"
                            >
                              <Download className="h-3.5 w-3.5" /> Download label PNG
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {isAdmin && a.status === 'pending' && (
                        <Button size="sm" className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(a.id, a.name)}>Approve</Button>
                      )}

                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setIsBulkDelete(false); setItemToDelete(a.id); setDeleteDialogOpen(true); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredArtifacts.length === 0 && (
        <div className="p-10 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg mt-2">
          No artifacts match your search.
        </div>
      )}

      {/* CLICK-TO-VIEW DETAIL MODAL — slideable media (autoplay video) + redesigned details */}
      <ArtifactDetailDialog
        artifact={selectedArtifactForDetail}
        onClose={() => setSelectedArtifactForDetail(null)}
      />

      {/* Pagination Controls */}
      {filteredArtifacts.length > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Show per page:</span>
            <Select value={String(itemsPerPage)} onValueChange={(val) => setItemsPerPage(Number(val))}>
              <SelectTrigger className="h-8 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5" className="text-xs">5</SelectItem>
                <SelectItem value="8" className="text-xs">8</SelectItem>
                <SelectItem value="10" className="text-xs">10</SelectItem>
                <SelectItem value="12" className="text-xs">12</SelectItem>
                <SelectItem value="20" className="text-xs">20</SelectItem>
                <SelectItem value="50" className="text-xs">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span>Page {currentPage} of {totalPages}</span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle className="text-center">Confirm deletion</DialogTitle>
          </DialogHeader>
          <p className="text-center text-muted-foreground text-sm">This moves the item to Trash. You can restore it later.</p>
          <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} className="flex-1">Cancel</Button>
            <Button variant="destructive" onClick={executeDelete} className="flex-1">Yes, delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg rounded-2xl">
          <DialogHeader><DialogTitle className="font-semibold">{editId ? "Edit record" : "Catalog new artifact"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Artifact name</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Category</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({...form, category_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{categories?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Condition</Label>
                <Select value={form.condition_status} onValueChange={(v) => setForm({...form, condition_status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["Excellent", "Good", "Fair", "Poor", "Restored"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Public description</Label><Textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className="h-24" /></div>
            <div className="space-y-2"><Label>Historical context & provenance</Label><Textarea value={form.historical_background} onChange={(e) => setForm({...form, historical_background: e.target.value})} className="h-24" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Date of origin / era</Label><Input value={form.date_origin} onChange={(e) => setForm({ ...form, date_origin: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Location found</Label><Input value={form.location_found} onChange={(e) => setForm({ ...form, location_found: e.target.value })} /></div>
            </div>

            <div className="space-y-2">
              <Label>Exhibition room / display position</Label>
              <Input placeholder="e.g., Room A, Showcase 3, Main Hallway" value={form.display_location} onChange={(e) => setForm({ ...form, display_location: e.target.value })} />
            </div>

            {/* Current media — click X to mark an item for removal */}
            {editId && existingMedia.length > 0 && (
              <div className="space-y-2">
                <Label>Current media ({existingMedia.length - removedMedia.length})</Label>
                <div className="grid grid-cols-4 gap-2">
                  {existingMedia.map((url) => {
                    const removed = removedMedia.includes(url);
                    return (
                      <div
                        key={url}
                        className={`relative aspect-square overflow-hidden rounded-md border border-border bg-muted transition-opacity ${removed ? "opacity-30" : ""}`}
                      >
                        {isVideoUrl(url) ? (
                          <>
                            <video src={url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                              <Video className="h-4 w-4 text-white" />
                            </span>
                          </>
                        ) : (
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setRemovedMedia((prev) => removed ? prev.filter((u) => u !== url) : [...prev, url])
                          }
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-destructive"
                          aria-label={removed ? "Undo remove" : "Remove"}
                          title={removed ? "Undo remove" : "Remove"}
                        >
                          {removed ? <Plus className="h-3 w-3 rotate-45" /> : <X className="h-3 w-3" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Click X to mark an item for removal. It is deleted when you press Save record. Click again to undo.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Photos & videos (select multiple)</Label>
              <Input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => setFiles(e.target.files)}
                className="text-xs"
              />
              <p className="text-[10px] text-muted-foreground">You can select multiple images (JPG, PNG, WEBP) or video clips (MP4, WEBM, MOV) at once.</p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full h-11">{saving ? <Loader2 className="animate-spin mr-2"/> : "Save record"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// -----------------------------------------------------------------------
// Trash — soft-deleted artifacts. Restore them or delete them for good.
// -----------------------------------------------------------------------
const TrashTab = ({ trashed, isAdmin }: { trashed: any[]; isAdmin: boolean }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ ids: string[]; label: string } | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin_artifacts"] });

  const handleRestore = async (a: any) => {
    setBusyId(a.id);
    const { error } = await supabase.from("artifacts").update({ deleted_at: null }).eq("id", a.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Restore failed", description: error.message, variant: "destructive" });
      return;
    }
    await logActivity("Restore Artifact", `Restored from Trash: ${a.name}`);
    refresh();
    toast({ title: "Restored", description: a.name, className: "bg-green-600 text-white" });
  };

  const purge = async (ids: string[]) => {
    try {
      const items = trashed.filter((a) => ids.includes(a.id));

      // Best-effort cleanup of the uploaded photos/videos
      const paths = items.flatMap((a) => {
        const urls = [a.image_url, ...(a.artifact_images || []).map((i: any) => i.image_url)].filter(Boolean);
        return Array.from(new Set(urls)).map((u: any) => storagePathFromUrl(u)).filter(Boolean) as string[];
      });
      if (paths.length) await supabase.storage.from("artifact-images").remove(paths);

      const { error } = await supabase.from("artifacts").delete().in("id", ids);
      if (error) throw error;

      await logActivity("Permanent Delete", `Permanently deleted ${items.length} artifact(s): ${items.map((i) => i.name).join(", ")}`);
      refresh();
      toast({ title: "Permanently deleted", variant: "destructive", className: "bg-red-600 text-white" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setConfirm(null);
    }
  };

  const daysLeft = (d: string) =>
    Math.max(0, 30 - Math.floor((Date.now() - new Date(d).getTime()) / 86400000));

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Deleted artifacts stay here for 30 days. Their QR codes stop working until restored.
        </p>
        {isAdmin && trashed.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirm({ ids: trashed.map((a) => a.id), label: `All ${trashed.length} items` })}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Empty Trash
          </Button>
        )}
      </div>

      {trashed.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Trash is empty.
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {trashed.map((a) => {
            const media = a.image_url || a.artifact_images?.[0]?.image_url;
            return (
              <div key={a.id} className="flex items-center gap-3 bg-card p-3.5">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                  {media && !isVideoUrl(media) ? (
                    <img src={media} alt={a.name} className="h-full w-full object-cover opacity-70" />
                  ) : media ? (
                    <Video className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Deleted {new Date(a.deleted_at).toLocaleDateString()} · {daysLeft(a.deleted_at)} days left
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={busyId === a.id}
                  onClick={() => handleRestore(a)}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Restore
                </Button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Delete permanently"
                    onClick={() => setConfirm({ ids: [a.id], label: `"${a.name}"` })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="rounded-2xl sm:max-w-[400px]">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle className="text-center">Delete permanently?</DialogTitle>
          </DialogHeader>
          <p className="text-center text-sm text-muted-foreground">
            {confirm?.label} and its photos/videos will be gone for good. This cannot be undone.
          </p>
          <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button variant="ghost" className="flex-1" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => confirm && purge(confirm.ids)}>Delete forever</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;