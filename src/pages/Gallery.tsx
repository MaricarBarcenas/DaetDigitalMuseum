import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  QrCode,
  ArrowLeft,
  ImageOff,
  Sparkles,
  MapPin,
  Landmark,
  Search,
  X,
  Heart,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Share2,
  Images,
  Award,
  Check,
  Trash2,
} from "lucide-react";
import { fetchArtifacts, fetchCategories } from "@/lib/supabase-helpers";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// Shows only a short teaser of the description so visitors want to see the full story at the museum.
const makeTeaser = (text?: string | null, max = 90) => {
  if (!text) return null;
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean + "…";
  const cut = clean.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : max) + "…";
};

/* -------------------------------------------------------------------------- */
/*                               Small helpers                                */
/* -------------------------------------------------------------------------- */

// Persist simple state in localStorage (safe against private mode / blocked storage).
function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

// Turns an era / year / period value into a number so we can sort by age.
// Handles "1890", "1890s", "c. 1850", and "19th century".
const eraValue = (raw: unknown): number => {
  if (raw === null || raw === undefined || raw === "") return Number.POSITIVE_INFINITY;
  const s = String(raw);
  const century = s.match(/(\d{1,2})(st|nd|rd|th)\s*c/i);
  if (century) return (parseInt(century[1], 10) - 1) * 100 + 50;
  const year = s.match(/\d{3,4}/);
  if (year) return parseInt(year[0], 10);
  return Number.POSITIVE_INFINITY;
};

type SortKey = "default" | "az" | "oldest" | "newest";
type ViewMode = "grid" | "list";

/* -------------------------------------------------------------------------- */
/*                       Decorative sample QR (not scannable)                 */
/* -------------------------------------------------------------------------- */

const SampleQR = () => {
  const size = 21;
  const cells = useMemo(() => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const origins: [number, number][] = [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ];
    const rects: { r: number; c: number }[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        let finder: boolean | null = null;
        for (const [r0, c0] of origins) {
          const lr = r - r0;
          const lc = c - c0;
          if (lr >= -1 && lr <= 7 && lc >= -1 && lc <= 7) {
            const inside = lr >= 0 && lr <= 6 && lc >= 0 && lc <= 6;
            const border = lr === 0 || lr === 6 || lc === 0 || lc === 6;
            const center = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4;
            finder = inside && (border || center);
            break;
          }
        }
        const filled = finder !== null ? finder : rnd() > 0.52;
        if (filled) rects.push({ r, c });
      }
    }
    return rects;
  }, []);

  return (
    <svg viewBox={`-1 -1 ${size + 2} ${size + 2}`} className="h-full w-full" role="img" aria-label="Sample QR code">
      <rect x={-1} y={-1} width={size + 2} height={size + 2} fill="#ffffff" />
      {cells.map(({ r, c }) => (
        <rect key={`${r}-${c}`} x={c} y={r} width={1.02} height={1.02} fill="#111111" />
      ))}
    </svg>
  );
};

/* -------------------------------------------------------------------------- */
/*                                  Lightbox                                  */
/* -------------------------------------------------------------------------- */

const Lightbox = ({
  artifact,
  index,
  setIndex,
  onClose,
}: {
  artifact: any;
  index: number;
  setIndex: (i: number) => void;
  onClose: () => void;
}) => {
  const images: any[] = artifact.artifact_images ?? [];
  const total = images.length;

  const go = (dir: 1 | -1) => {
    if (total < 2) return;
    setIndex((index + dir + total) % total);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, total]);

  const current = images[index]?.image_url;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`${artifact.name} photos`}
      onClick={onClose}
    >
      <div className="flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold">{artifact.name}</p>
          <p className="text-xs text-white/70">
            Photo {index + 1} of {total}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo viewer"
          className="rounded-full bg-white/10 p-2 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2 sm:px-16">
        {total > 1 && (
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-2 z-10 rounded-full bg-white/10 p-2 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-4"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.img
            key={index}
            src={current}
            alt={`${artifact.name} – photo ${index + 1}`}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            drag={total > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.4}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) go(1);
              else if (info.offset.x > 60) go(-1);
            }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full select-none rounded-lg object-contain"
            draggable={false}
          />
        </AnimatePresence>

        {total > 1 && (
          <button
            type="button"
            aria-label="Next photo"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-2 z-10 rounded-full bg-white/10 p-2 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      <div className="space-y-3 p-4 text-center" onClick={(e) => e.stopPropagation()}>
        {total > 1 && (
          <div className="flex items-center justify-center gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to photo ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-2 bg-white/40"}`}
              />
            ))}
          </div>
        )}
        <p className="flex items-center justify-center gap-1 text-xs font-semibold text-amber-300">
          <Sparkles className="h-3 w-3" />
          The full story is waiting at the museum
        </p>
      </div>
    </motion.div>
  );
};

/* -------------------------------------------------------------------------- */
/*                                   Gallery                                  */
/* -------------------------------------------------------------------------- */

const Gallery = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { data: artifacts, isLoading } = useQuery({ queryKey: ["artifacts"], queryFn: fetchArtifacts });
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  // New interactive state
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("default");
  const [viewMode, setViewMode] = usePersistedState<ViewMode>("daet-gallery-view", "grid");
  const [saved, setSaved] = usePersistedState<string[]>("daet-visit-list", []);
  const [peeked, setPeeked] = usePersistedState<string[]>("daet-peeked", []);
  const [scanned, setScanned] = usePersistedState<string[]>("daet-scanned", []);
  const [visitListOpen, setVisitListOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [passportOpen, setPassportOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ artifact: any; index: number } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deepLinkHandled = useRef(false);

  const getCategoryName = (id: string) => categories?.find((c: any) => c.id === id)?.name;

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // Existing category filter (unchanged behavior)
  const filtered = selectedCategory
    ? artifacts?.filter((a: any) => a.category_id === selectedCategory)
    : artifacts;

  // Search + sort layered on top of the category filter
  const visible = useMemo(() => {
    if (!filtered) return filtered;
    const q = search.trim().toLowerCase();
    let list = filtered as any[];
    if (q) {
      list = list.filter((a: any) => {
        const haystack = [
          a.name,
          a.period,
          a.era,
          a.year,
          a.origin,
          a.location,
          a.description,
          getCategoryName(a.category_id),
        ]
          .filter((v) => v !== null && v !== undefined)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    if (sortBy === "az") {
      list = [...list].sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
    } else if (sortBy === "oldest" || sortBy === "newest") {
      const dir = sortBy === "oldest" ? 1 : -1;
      list = [...list].sort((a, b) => {
        const av = eraValue(a.period || a.era || a.year);
        const bv = eraValue(b.period || b.era || b.year);
        // Artifacts without a readable date always go last
        if (av === bv) return 0;
        if (!Number.isFinite(av)) return 1;
        if (!Number.isFinite(bv)) return -1;
        return (av - bv) * dir;
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, search, sortBy, categories]);

  /* ----------------------------- Peek tracking ----------------------------- */
  // Every time a teaser opens, remember that the artifact was peeked at.
  useEffect(() => {
    if (activeId) setPeeked((p) => (p.includes(activeId) ? p : [...p, activeId]));
  }, [activeId, setPeeked]);

  const explored = useMemo(() => new Set([...peeked, ...scanned]), [peeked, scanned]);
  const exploredCount = useMemo(
    () => (artifacts ?? []).filter((a: any) => explored.has(String(a.id))).length,
    [artifacts, explored]
  );
  const totalCount = artifacts?.length ?? 0;
  const progressPct = totalCount ? Math.round((exploredCount / totalCount) * 100) : 0;

  /* ------------------------------ Passport data ----------------------------- */
  const passport = useMemo(() => {
    return (categories ?? []).map((c: any) => {
      const items = (artifacts ?? []).filter((a: any) => a.category_id === c.id);
      const done = items.filter((a: any) => explored.has(String(a.id))).length;
      return { id: c.id, name: c.name, total: items.length, done, earned: items.length > 0 && done === items.length };
    });
  }, [categories, artifacts, explored]);
  const stampsEarned = passport.filter((p) => p.earned).length;
  const passportActive = passport.filter((p) => p.total > 0);
  const passportComplete = passportActive.length > 0 && passportActive.every((p) => p.earned);

  /* ------------------------------- Visit list ------------------------------- */
  const savedArtifacts = useMemo(
    () => (artifacts ?? []).filter((a: any) => saved.includes(String(a.id))),
    [artifacts, saved]
  );

  const toggleSaved = (artifact: any) => {
    const id = String(artifact.id);
    if (saved.includes(id)) {
      setSaved((s) => s.filter((x) => x !== id));
      showToast("Removed from your visit list");
    } else {
      setSaved((s) => [...s, id]);
      showToast("Added to your visit list");
    }
  };

  /* ------------------------- Scroll / surprise / deep link ------------------------- */
  const focusArtifact = (id: string) => {
    setActiveId(id);
    setHighlightId(id);
    setTimeout(() => {
      document.getElementById(`artifact-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    setTimeout(() => setHighlightId((h) => (h === id ? null : h)), 2600);
  };

  const surpriseMe = () => {
    if (!visible?.length) return;
    const pool = visible.length > 1 ? visible.filter((a: any) => a.id !== activeId) : visible;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    focusArtifact(pick.id);
  };

  // Open a specific artifact from a shared link like /gallery#artifact-<id>
  useEffect(() => {
    if (deepLinkHandled.current || !artifacts?.length) return;
    deepLinkHandled.current = true;
    const match = window.location.hash.match(/^#artifact-(.+)$/);
    if (!match) return;
    const id = decodeURIComponent(match[1]);
    const found = artifacts.find((a: any) => String(a.id) === id);
    if (found) {
      setSelectedCategory(null);
      setSearch("");
      setTimeout(() => focusArtifact(found.id), 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifacts]);

  // On-site QR hook: a museum QR can link to /gallery?scan=<artifactId> to collect a passport stamp progress.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("scan");
      if (id) {
        setScanned((s) => (s.includes(id) ? s : [...s, id]));
        params.delete("scan");
        const qs = params.toString();
        window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash);
        showToast("Museum scan recorded in your passport!");
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------ Share an artifact ------------------------------ */
  const shareArtifact = async (artifact: any) => {
    const url = `${window.location.origin}${window.location.pathname}#artifact-${artifact.id}`;
    const data = {
      title: artifact.name,
      text: `Take a look at "${artifact.name}" in the Daet Museum Collection`,
      url,
    };
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share(data);
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard");
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        showToast("Link copied to clipboard");
      } catch {
        showToast("Couldn't share this link");
      }
    }
  };

  /* --------------------------- Overlay housekeeping --------------------------- */
  const anyOverlayOpen = visitListOpen || qrOpen || passportOpen || !!lightbox;
  useEffect(() => {
    if (!anyOverlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [anyOverlayOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setVisitListOpen(false);
      setQrOpen(false);
      setPassportOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isList = viewMode === "list";
  const gridClass = isList ? "grid gap-4" : "grid gap-6 md:grid-cols-2 lg:grid-cols-3";
  const stopKeys = (e: React.KeyboardEvent) => e.stopPropagation();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="font-display text-lg font-bold">Daet Museum Collection</span>
          </Link>
        </div>
      </header>

      <main className="container py-12">
        <h1 className="mb-2 font-display text-4xl font-bold">Artifact Gallery</h1>
        <p className="mb-8 text-muted-foreground">Browse the cultural treasures of Daet.</p>

        {/* Reveal progress + Museum Passport entry */}
        {totalCount > 0 && (
          <div className="mb-8 rounded-xl border border-border bg-card p-4 shadow-museum">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  You've peeked at {exploredCount} of {totalCount} artifacts
                </p>
                <div
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPct}
                  aria-label="Artifacts explored"
                >
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={false}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setPassportOpen(true)}
              >
                <Award className="mr-1.5 h-4 w-4 text-primary" />
                Museum Passport
                {passport.length > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {stampsEarned}/{passportActive.length}
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Search, sort, view toggle and Surprise Me */}
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, era, or origin…"
              aria-label="Search artifacts"
              className="h-10 w-full rounded-full border border-border bg-background pl-10 pr-10 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              aria-label="Sort artifacts"
              className="h-10 rounded-full border border-border bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="default">Sort: Default</option>
              <option value="az">A to Z</option>
              <option value="oldest">Oldest first</option>
              <option value="newest">Newest first</option>
            </select>

            <div className="flex items-center rounded-full border border-border bg-background p-0.5" role="group" aria-label="View mode">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-pressed={!isList}
                aria-label="Grid view"
                className={`rounded-full p-2 transition ${!isList ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-pressed={isList}
                aria-label="List view"
                className={`rounded-full p-2 transition ${isList ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-full px-4"
              onClick={surpriseMe}
              disabled={!visible?.length}
            >
              <Shuffle className="mr-1.5 h-4 w-4 text-primary" />
              Surprise me
            </Button>
          </div>
        </div>

        {/* Category filters - RESPONSIVE: flex-wrap ensures buttons drop to the next line on mobile */}
        {categories && categories.length > 0 && (
          <div className="mb-8 flex flex-wrap items-center gap-2 overflow-x-auto pb-2 sm:overflow-visible sm:pb-0">
            <Button
              variant={!selectedCategory ? "default" : "outline"}
              size="sm"
              className="rounded-full px-4"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Button>
            {categories.map((cat: any) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                size="sm"
                className="rounded-full px-4 whitespace-nowrap"
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </Button>
            ))}
          </div>
        )}

        {search.trim() && !isLoading && (
          <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
            Showing {visible?.length ?? 0} of {filtered?.length ?? 0} artifacts for "{search.trim()}"
          </p>
        )}

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : !visible?.length ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <ImageOff className="mb-4 h-12 w-12" />
            <p>No artifacts found. Check back soon!</p>
            {search.trim() && (
              <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={() => setSearch("")}>
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className={gridClass}>
            {visible.map((artifact: any, i: number) => {
              const mainImage = artifact.artifact_images?.[0]?.image_url;
              const imageCount: number = artifact.artifact_images?.length ?? 0;
              const isActive = activeId === artifact.id;
              const isSaved = saved.includes(String(artifact.id));
              const teaser = makeTeaser(artifact.description);
              const categoryName = getCategoryName(artifact.category_id);
              const era = artifact.period || artifact.era || artifact.year;
              const origin = artifact.origin || artifact.location;

              return (
                <motion.div
                  key={artifact.id}
                  id={`artifact-${artifact.id}`}
                  className="scroll-mt-24"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                >
                  {/* Not a link (not clickable to a detail page). Interactive: hover on desktop, tap on mobile to reveal a teaser. */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isActive}
                    onClick={() => setActiveId(isActive ? null : artifact.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveId(isActive ? null : artifact.id);
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (window.matchMedia("(hover: hover)").matches) setActiveId(artifact.id);
                    }}
                    onMouseLeave={() => {
                      if (window.matchMedia("(hover: hover)").matches) setActiveId(null);
                    }}
                    className={`group block cursor-pointer overflow-hidden rounded-xl border border-border bg-card shadow-museum transition-all hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      isList ? "flex flex-row" : ""
                    } ${highlightId === artifact.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                  >
                    <div
                      className={`relative overflow-hidden bg-muted ${
                        isList ? "aspect-[4/3] w-36 shrink-0 sm:w-64" : "aspect-[4/3]"
                      }`}
                    >
                      {mainImage ? (
                        <img src={mainImage} alt={artifact.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <ImageOff className="h-10 w-10" />
                        </div>
                      )}

                      {/* Quick actions: save to visit list + share */}
                      <div className="absolute right-2 top-2 z-10 flex flex-col gap-2">
                        <button
                          type="button"
                          aria-label={isSaved ? `Remove ${artifact.name} from visit list` : `Save ${artifact.name} to visit list`}
                          aria-pressed={isSaved}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSaved(artifact);
                          }}
                          onKeyDown={stopKeys}
                          className="rounded-full bg-background/80 p-2 backdrop-blur-sm transition hover:scale-110 hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Heart className={`h-4 w-4 ${isSaved ? "fill-red-500 text-red-500" : "text-foreground"}`} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Share ${artifact.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            shareArtifact(artifact);
                          }}
                          onKeyDown={stopKeys}
                          className="rounded-full bg-background/80 p-2 backdrop-blur-sm transition hover:scale-110 hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Share2 className="h-4 w-4 text-foreground" />
                        </button>
                      </div>

                      {/* Photo count badge opens the lightbox */}
                      {imageCount > 0 && (
                        <button
                          type="button"
                          aria-label={`View ${imageCount > 1 ? `${imageCount} photos` : "photo"} of ${artifact.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightbox({ artifact, index: 0 });
                          }}
                          onKeyDown={stopKeys}
                          className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium backdrop-blur-sm transition hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Images className="h-3 w-3 text-primary" />
                          <span>{imageCount > 1 ? `1/${imageCount} photos` : "View photo"}</span>
                        </button>
                      )}

                      {/* Hint badge shown while the teaser is hidden */}
                      {!isActive && !isList && (
                        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                          <Sparkles className="h-3 w-3 text-primary" />
                          <span>Peek inside</span>
                        </div>
                      )}

                      {/* Teaser overlay */}
                      <AnimatePresence>
                        {isActive && !isList && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/60 to-black/10 p-4 text-left text-white"
                          >
                            <motion.div
                              initial={{ y: 12, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{ delay: 0.05, duration: 0.3 }}
                              className="space-y-2"
                            >
                              {(categoryName || era || origin) && (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-wide text-white/80">
                                  {categoryName && (
                                    <span className="flex items-center gap-1">
                                      <Landmark className="h-3 w-3" />
                                      {categoryName}
                                    </span>
                                  )}
                                  {era && <span>{String(era)}</span>}
                                  {origin && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {String(origin)}
                                    </span>
                                  )}
                                </div>
                              )}
                              {teaser && <p className="text-sm leading-snug text-white/95">{teaser}</p>}
                              <p className="flex items-center gap-1 text-xs font-semibold text-amber-300">
                                <Sparkles className="h-3 w-3" />
                                The full story is waiting at the museum
                              </p>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Title and prompt */}
                    <div
                      className={
                        isList
                          ? "flex min-w-0 flex-1 flex-col justify-center p-4 text-left"
                          : "p-5 text-center"
                      }
                    >
                      <h3 className="font-display text-lg font-semibold">{artifact.name}</h3>

                      {/* List view: teaser expands inline instead of overlaying the small thumbnail */}
                      {isList && (
                        <AnimatePresence initial={false}>
                          {isActive ? (
                            <motion.div
                              key="inline-teaser"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 space-y-1.5">
                                {(categoryName || era || origin) && (
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                                    {categoryName && (
                                      <span className="flex items-center gap-1">
                                        <Landmark className="h-3 w-3" />
                                        {categoryName}
                                      </span>
                                    )}
                                    {era && <span>{String(era)}</span>}
                                    {origin && (
                                      <span className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {String(origin)}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {teaser && <p className="text-sm leading-snug text-foreground/90">{teaser}</p>}
                                <p className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                                  <Sparkles className="h-3 w-3" />
                                  The full story is waiting at the museum
                                </p>
                              </div>
                            </motion.div>
                          ) : (
                            <motion.p
                              key="inline-hint"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"
                            >
                              <Sparkles className="h-3 w-3 text-primary" />
                              Tap to peek inside
                            </motion.p>
                          )}
                        </AnimatePresence>
                      )}

                      {/* Tapping the QR strip explains how the on-site scan works */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQrOpen(true);
                        }}
                        onKeyDown={stopKeys}
                        className={`mt-3 flex w-full items-center gap-1 rounded-md bg-secondary/50 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          isList ? "justify-start px-2" : "justify-center"
                        }`}
                      >
                        <QrCode className="h-3.5 w-3.5 text-primary" />
                        <span>Scan QR at the museum for details</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating "My Visit List" button */}
      <button
        type="button"
        onClick={() => setVisitListOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label={`Open my visit list, ${savedArtifacts.length} saved`}
      >
        <Heart className={`h-4 w-4 ${savedArtifacts.length ? "fill-current" : ""}`} />
        My Visit List ({savedArtifacts.length})
      </button>

      {/* Visit list drawer */}
      <AnimatePresence>
        {visitListOpen && (
          <motion.div
            className="fixed inset-0 z-[90] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setVisitListOpen(false)}
          >
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="My visit list"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-border p-4">
                <div>
                  <h2 className="font-display text-lg font-bold">My Visit List</h2>
                  <p className="text-xs text-muted-foreground">Artifacts you plan to see at the museum</p>
                </div>
                <button
                  type="button"
                  onClick={() => setVisitListOpen(false)}
                  aria-label="Close visit list"
                  className="rounded-full p-2 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {savedArtifacts.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                    <Heart className="mb-3 h-10 w-10" />
                    <p className="text-sm">Tap the heart on any artifact to add it here.</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {savedArtifacts.map((a: any) => {
                      const img = a.artifact_images?.[0]?.image_url;
                      return (
                        <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                            {img ? (
                              <img src={img} alt={a.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-muted-foreground">
                                <ImageOff className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{a.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {getCategoryName(a.category_id) ?? "Artifact"}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() => {
                              setVisitListOpen(false);
                              setSelectedCategory(null);
                              setSearch("");
                              setTimeout(() => focusArtifact(a.id), 250);
                            }}
                          >
                            Show
                          </Button>
                          <button
                            type="button"
                            aria-label={`Remove ${a.name}`}
                            onClick={() => setSaved((s) => s.filter((x) => x !== String(a.id)))}
                            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {savedArtifacts.length > 0 && (
                <div className="border-t border-border p-4">
                  <Button variant="outline" className="w-full" onClick={() => setSaved([])}>
                    Clear visit list
                  </Button>
                </div>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How the QR scan works */}
      <AnimatePresence>
        {qrOpen && (
          <motion.div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setQrOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="How QR scanning works"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl"
            >
              <button
                type="button"
                onClick={() => setQrOpen(false)}
                aria-label="Close"
                className="absolute right-3 top-3 rounded-full p-2 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="mb-1 font-display text-xl font-bold">How the QR scan works</h2>
              <p className="mb-4 text-sm text-muted-foreground">Unlock the full story of every artifact.</p>

              <div className="mx-auto mb-1 h-40 w-40 overflow-hidden rounded-lg border border-border bg-white p-1">
                <SampleQR />
              </div>
              <p className="mb-4 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
                Sample only. Real codes are beside each artifact.
              </p>

              <ol className="space-y-3 text-sm">
                {[
                  "Find the QR code on the label next to the artifact.",
                  "Open your phone camera and point it at the code.",
                  "Tap the link to read the full story, history and more photos.",
                ].map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {idx + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>

              <Button className="mt-5 w-full" onClick={() => setQrOpen(false)}>
                Got it
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Museum Passport */}
      <AnimatePresence>
        {passportOpen && (
          <motion.div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPassportOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Museum Passport"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl"
            >
              <button
                type="button"
                onClick={() => setPassportOpen(false)}
                aria-label="Close"
                className="absolute right-3 top-3 rounded-full p-2 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="mb-1 font-display text-xl font-bold">Museum Passport</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Peek at every artifact in a category, or scan its QR code at the museum, to earn that category's stamp.
              </p>

              {passportActive.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No categories to explore yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {passportActive.map((p) => (
                    <div
                      key={p.id}
                      className={`flex flex-col items-center rounded-xl border p-4 text-center transition ${
                        p.earned ? "border-primary bg-primary/5" : "border-dashed border-border"
                      }`}
                    >
                      <div
                        className={`mb-2 flex h-14 w-14 items-center justify-center rounded-full border-2 ${
                          p.earned
                            ? "-rotate-6 border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {p.earned ? <Check className="h-6 w-6" /> : <Landmark className="h-6 w-6" />}
                      </div>
                      <p className="text-sm font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.done}/{p.total} explored
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {passportComplete && (
                <div className="mt-5 rounded-xl bg-amber-100 p-4 text-center text-sm font-medium text-amber-900">
                  Passport complete! Thank you for exploring every part of the collection. Show this screen at the
                  museum desk to say hello.
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo lightbox */}
      <AnimatePresence>
        {lightbox && (
          <Lightbox
            key="lightbox"
            artifact={lightbox.artifact}
            index={lightbox.index}
            setIndex={(idx) => setLightbox((l) => (l ? { ...l, index: idx } : l))}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="pointer-events-none fixed bottom-20 left-1/2 z-[120] -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg"
            role="status"
            aria-live="polite"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Gallery;