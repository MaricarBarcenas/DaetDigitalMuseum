import { useParams, useLocation, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Compass,
  ShieldCheck,
  Eye,
  Image as ImageIcon,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Share2,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
  Play,
  Link2,
  Check,
} from "lucide-react";
import { fetchArtifact, incrementViewCount, logQrScan } from "@/lib/supabase-helpers";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";

const isVideoUrl = (url?: string | null): boolean => {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov|m4v|mkv)(\?.*)?$/i.test(url) || url.includes("/video/");
};

const extractArtifactId = (rawInput?: string): string | undefined => {
  if (!rawInput) return undefined;
  const trimmed = rawInput.trim();
  if (!trimmed) return undefined;

  // Case 1: Scanned as absolute URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsedUrl = new URL(trimmed);
      const segments = parsedUrl.pathname.split("/").filter(Boolean);
      const artifactIndex = segments.lastIndexOf("artifact");
      if (artifactIndex !== -1 && segments[artifactIndex + 1]) {
        return decodeURIComponent(segments[artifactIndex + 1]).split(/[?#]/)[0];
      }
      if (segments.length > 0) {
        return decodeURIComponent(segments[segments.length - 1]).split(/[?#]/)[0];
      }
    } catch {
      // Fallback below
    }
  }

  // Case 2: Scanned as relative route or raw ID
  try {
    const clean = decodeURIComponent(trimmed).split(/[?#]/)[0].replace(/\/+$/, "");
    const match = clean.match(/(?:artifact\/)?([^/]+)$/i);
    return match ? match[1] : clean || undefined;
  } catch {
    return trimmed.split(/[?#]/)[0].trim() || undefined;
  }
};

const ArtifactView = () => {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  // Interactivity state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState("50% 50%");
  const [linkCopied, setLinkCopied] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);

  // Extract clean ID from params or URL path
  const cleanId = useMemo(() => {
    const rawTarget = params.id || (params as any)["*"] || location.pathname;
    return extractArtifactId(rawTarget);
  }, [params, location.pathname]);

  // Normalize URL only once when needed without creating loops
  useEffect(() => {
    if (params.id && cleanId && params.id !== cleanId) {
      navigate(`/artifact/${cleanId}`, { replace: true });
    }
  }, [params.id, cleanId, navigate]);

  useEffect(() => {
    setCurrentIndex(0);
    setLightboxOpen(false);
    setZoomed(false);
  }, [cleanId]);

  // Query with guaranteed resolution/rejection within 6 seconds
  const {
    data: artifact,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["artifact", cleanId],
    queryFn: async () => {
      if (!cleanId) {
        throw new Error("Missing artifact ID.");
      }

      console.log("[ArtifactView] Querying artifact ID:", cleanId);

      let timeoutHandle: any;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error("Database connection timed out. Check your connection or Supabase status."));
        }, 8000);
      });

      try {
        const fetchPromise = (async () => {
          const res = await fetchArtifact(cleanId);
          return res;
        })();

        const result = await Promise.race([fetchPromise, timeoutPromise]);
        clearTimeout(timeoutHandle);

        if (!result) {
          throw new Error(`Artifact "${cleanId}" not found in exhibition records.`);
        }
        return result as any;
      } catch (err: any) {
        clearTimeout(timeoutHandle);
        console.error("[ArtifactView] Query failed:", err);
        throw new Error(err?.message || "Failed to load exhibit record.");
      }
    },
    enabled: Boolean(cleanId),
    staleTime: 1000 * 60 * 5,
    retry: 0, // a retry on top of the timeout doubled the wait; the Retry button covers it
    refetchOnWindowFocus: false,
  });

  // Slow-connection hint so the spinner never looks frozen
  const [showSlowHint, setShowSlowHint] = useState(false);
  useEffect(() => {
    if (!isLoading) { setShowSlowHint(false); return; }
    const t = setTimeout(() => setShowSlowHint(true), 3000);
    return () => clearTimeout(t);
  }, [isLoading]);

  // Analytics: run AFTER the artifact has loaded so it never competes with the main fetch
  const trackedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!artifact || !cleanId || trackedIdRef.current === cleanId) return;
    trackedIdRef.current = cleanId;
    try {
      incrementViewCount?.(cleanId)?.catch(() => {});
      logQrScan?.(cleanId)?.catch(() => {});
    } catch {
      // Non-critical background telemetry
    }
  }, [artifact, cleanId]);

  const mediaList = useMemo(() => {
    if (!artifact) return [];
    const items: string[] = [];
    if (artifact.image_url) items.push(artifact.image_url);
    if (Array.isArray(artifact.artifact_images)) {
      [...artifact.artifact_images]
        .sort((a: any, b: any) => (a?.display_order ?? 0) - (b?.display_order ?? 0))
        .forEach((img: any) => {
        if (img?.image_url && !items.includes(img.image_url)) {
          items.push(img.image_url);
        }
      });
    }
    return items;
  }, [artifact]);

  const handleNext = useCallback(() => {
    if (!mediaList.length) return;
    setZoomed(false);
    setCurrentIndex((prev) => (prev + 1) % mediaList.length);
  }, [mediaList.length]);

  const handlePrev = useCallback(() => {
    if (!mediaList.length) return;
    setZoomed(false);
    setCurrentIndex((prev) => (prev - 1 + mediaList.length) % mediaList.length);
  }, [mediaList.length]);

  // Keyboard controls: arrows to browse, Escape to close the viewer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === "ArrowRight") handleNext();
      else if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "Escape") {
        setLightboxOpen(false);
        setZoomed(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNext, handlePrev]);

  // Lock page scroll while the full-screen viewer is open
  useEffect(() => {
    if (!lightboxOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxOpen]);

  const minSwipeDistance = 45;
  const onTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    setTouchEndX(null);
    setTouchStartX(clientX);
  };

  const onTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    setTouchEndX(clientX);
  };

  const onTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;
    const distance = touchStartX - touchEndX;
    if (distance > minSwipeDistance) handleNext();
    if (distance < -minSwipeDistance) handlePrev();
    setTouchStartX(null);
    setTouchEndX(null);
  };

  const handleShare = async () => {
    if (navigator.share && artifact) {
      try {
        await navigator.share({
          title: artifact.name,
          text: artifact.description?.slice(0, 100),
          url: window.location.href,
        });
      } catch {
        // Dismissed
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleLightboxImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomOrigin(`${x}% ${y}%`);
    setZoomed((z) => !z);
  };

  // 1. Invalid or missing ID
  if (!cleanId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F1E2] px-4 text-center">
        <div className="rounded-full bg-[#7A2E22]/10 p-4 ring-8 ring-[#7A2E22]/5">
          <AlertTriangle className="h-10 w-10 text-[#7A2E22]" />
        </div>
        <h1 className="mt-5 font-serif text-2xl font-semibold tracking-tight text-[#221C14]">
          Invalid exhibition code
        </h1>
        <p className="mt-2 max-w-sm text-sm text-[#6B6252]">
          The scanned code could not be verified. Please scan the QR code again.
        </p>
        <Link to="/">
          <Button className="mt-6 rounded-full bg-[#221C14] px-6 text-[#F6F1E2] hover:bg-[#382C1D]">
            Return home
          </Button>
        </Link>
      </div>
    );
  }

  // 2. Loading state (Guaranteed to end within 6s)
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F6F1E2]">
        <div className="relative flex items-center justify-center">
          <div className="h-14 w-14 animate-spin rounded-full border-2 border-[#93702E]/25 border-t-[#93702E]" />
          <ImageIcon className="absolute h-5 w-5 text-[#93702E]/70" />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#6B6252]">
          Opening exhibition archives...
        </p>
        {showSlowHint && (
          <p className="max-w-xs px-4 text-center text-xs text-[#6B6252]">
            Still connecting — the connection looks slow. Hang tight.
          </p>
        )}
      </div>
    );
  }

  // 3. Error state with actual error message from Supabase/Network
  if (isError || !artifact) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F1E2] px-4 text-center">
        <div className="rounded-full bg-[#7A2E22]/10 p-4 ring-8 ring-[#7A2E22]/5">
          <AlertTriangle className="h-10 w-10 text-[#7A2E22]" />
        </div>
        <h1 className="mt-5 font-serif text-2xl font-semibold tracking-tight text-[#221C14]">
          Catalog record unavailable
        </h1>
        <p className="mt-2 max-w-sm font-mono text-xs text-[#7A2E22] bg-[#7A2E22]/5 p-2 rounded border border-[#7A2E22]/20">
          {(error as any)?.message || "Record not found"}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="rounded-full bg-[#221C14] text-[#F6F1E2] hover:bg-[#382C1D]"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
            Retry connection
          </Button>
          <Link to="/gallery">
            <Button variant="outline" className="rounded-full border-[#DCCFAE] text-[#221C14] hover:bg-[#EDE4CC]">
              Return to gallery
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const currentMediaUrl = mediaList[currentIndex];
  const isCurrentMediaVideo = isVideoUrl(currentMediaUrl);

  const facts = [
    { icon: Calendar, label: "Origin era", value: artifact.date_origin },
    { icon: MapPin, label: "Origin / discovery", value: artifact.location_found },
    { icon: Compass, label: "Exhibition wing", value: artifact.display_location },
    { icon: ShieldCheck, label: "Condition", value: artifact.condition_status },
  ];

  return (
    <div className="min-h-screen bg-[#F6F1E2] text-[#221C14] selection:bg-[#93702E]/20">
      <header className="sticky top-0 z-50 border-b border-[#DCCFAE] bg-[#F6F1E2]/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link to="/gallery">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full border-[#DCCFAE] bg-transparent hover:bg-[#EDE4CC]"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex flex-col">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6B6252]">
                Exhibition item
              </span>
              <span className="max-w-[200px] truncate font-serif text-sm font-semibold sm:max-w-xs md:max-w-md">
                {artifact.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-[#DCCFAE] px-3 py-1 font-mono text-xs text-[#6B6252]">
              <Eye className="h-3.5 w-3.5" />
              <span>{artifact.view_count || 0}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyLink}
              className="h-9 w-9 rounded-full text-[#221C14] hover:bg-[#EDE4CC]"
              aria-label={linkCopied ? "Link copied" : "Copy link"}
              title={linkCopied ? "Link copied" : "Copy link"}
            >
              {linkCopied ? <Check className="h-4 w-4 text-[#93702E]" /> : <Link2 className="h-4 w-4" />}
            </Button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                className="h-9 w-9 rounded-full text-[#221C14] hover:bg-[#EDE4CC]"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            <div className="sticky top-24 space-y-4">
              <div
                className="group relative aspect-[4/3] w-full select-none overflow-hidden rounded-sm bg-[#17130E] shadow-[0_30px_60px_-25px_rgba(23,19,14,0.55)] sm:aspect-[16/10]"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_0%,rgba(255,247,225,0.08),transparent_60%)]" />

                {mediaList.length > 0 ? (
                  isCurrentMediaVideo ? (
                    <video
                      key={currentMediaUrl}
                      src={currentMediaUrl}
                      controls
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <img
                      key={currentMediaUrl}
                      src={currentMediaUrl}
                      alt={artifact.name}
                      className="h-full w-full cursor-zoom-in object-cover transition-opacity duration-500 ease-out"
                      draggable={false}
                      loading="eager"
                      decoding="async"
                      onClick={() => setLightboxOpen(true)}
                    />
                  )
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-[#8B8272]">
                    <ImageIcon className="mb-2 h-10 w-10 opacity-30" />
                    <p className="font-mono text-xs uppercase tracking-wider">No record visuals available</p>
                  </div>
                )}

                {mediaList.length > 0 && (
                  <button
                    onClick={() => setLightboxOpen(true)}
                    className="absolute right-3 top-3 rounded-full bg-[#F6F1E2]/90 p-2 text-[#221C14] opacity-100 transition-all hover:scale-110 active:scale-95 sm:right-4 sm:top-4 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="View full screen"
                    title="View full screen"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                )}

                {mediaList.length > 1 && (
                  <>
                    <button
                      onClick={handlePrev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-[#F6F1E2]/90 p-2 text-[#221C14] transition-transform hover:scale-110 active:scale-95 sm:left-4"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={handleNext}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[#F6F1E2]/90 p-2 text-[#221C14] transition-transform hover:scale-110 active:scale-95 sm:right-4"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>

                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#17130E]/60 px-3 py-1.5">
                      {mediaList.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setZoomed(false);
                            setCurrentIndex(i);
                          }}
                          aria-label={`Go to image ${i + 1}`}
                          className={`h-1 rounded-full transition-all duration-300 ${
                            i === currentIndex ? "w-6 bg-[#F6F1E2]" : "w-1 bg-[#F6F1E2]/40 hover:bg-[#F6F1E2]/70"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {mediaList.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {mediaList.map((url, i) => (
                    <button
                      key={url + i}
                      onClick={() => {
                        setZoomed(false);
                        setCurrentIndex(i);
                      }}
                      aria-label={`Show image ${i + 1}`}
                      className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-sm border-2 bg-[#17130E] transition-all ${
                        i === currentIndex
                          ? "border-[#93702E] opacity-100"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      {isVideoUrl(url) ? (
                        <div className="flex h-full w-full items-center justify-center text-[#F6F1E2]">
                          <Play className="h-5 w-5" />
                        </div>
                      ) : (
                        <img
                          src={url}
                          alt=""
                          className="h-full w-full object-cover"
                          draggable={false}
                          loading="lazy"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-sm border border-[#DCCFAE] bg-[#EDE4CC]/70 p-6 text-center sm:p-8">
              {artifact.categories?.name && (
                <span className="inline-block border-b-2 border-[#7A2E22] pb-0.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[#7A2E22]">
                  {artifact.categories.name}
                </span>
              )}
              <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                {artifact.name}
              </h1>

              <div className="mt-6 border-t border-[#DCCFAE] text-left">
                {facts.map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="flex items-baseline justify-between gap-4 border-b border-[#DCCFAE] py-3"
                  >
                    <span className="flex items-center gap-2 text-sm text-[#6B6252]">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-[#93702E]" />
                      {label}
                    </span>
                    <span className="text-right font-mono text-sm text-[#221C14]">
                      {value || "Unknown"}
                    </span>
                  </div>
                ))}
              </div>

              {artifact.description && (
                <div className="mt-7 space-y-2.5 text-left">
                  <button
                    type="button"
                    onClick={() => setOverviewOpen((o) => !o)}
                    aria-expanded={overviewOpen}
                    className="flex w-full items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-[#6B6252] hover:text-[#221C14]"
                  >
                    <h2>Overview</h2>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-300 ${overviewOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {overviewOpen && (
                    <p className="max-w-[62ch] font-serif text-[17px] leading-relaxed text-[#221C14]/90">
                      {artifact.description}
                    </p>
                  )}
                </div>
              )}

              {artifact.historical_background && (
                <div className="mt-7 space-y-2.5 text-left">
                  <button
                    type="button"
                    onClick={() => setHistoryOpen((o) => !o)}
                    aria-expanded={historyOpen}
                    className="flex w-full items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-[#6B6252] hover:text-[#221C14]"
                  >
                    <h2>Historical context</h2>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-300 ${historyOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {historyOpen && (
                    <p className="max-w-[62ch] font-serif text-[17px] leading-relaxed text-[#6B6252]">
                      {artifact.historical_background}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Full-screen viewer */}
      {lightboxOpen && currentMediaUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0E0B07]/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${artifact.name} viewer`}
          onClick={() => {
            setLightboxOpen(false);
            setZoomed(false);
          }}
        >
          <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-4 py-4 sm:px-6">
            <span className="font-mono text-xs text-[#F6F1E2]/70">
              {currentIndex + 1} / {mediaList.length}
            </span>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {!isCurrentMediaVideo && (
                <button
                  onClick={() => setZoomed((z) => !z)}
                  className="rounded-full bg-[#F6F1E2]/10 p-2.5 text-[#F6F1E2] transition-colors hover:bg-[#F6F1E2]/20"
                  aria-label={zoomed ? "Zoom out" : "Zoom in"}
                >
                  {zoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
                </button>
              )}
              <button
                onClick={() => {
                  setLightboxOpen(false);
                  setZoomed(false);
                }}
                className="rounded-full bg-[#F6F1E2]/10 p-2.5 text-[#F6F1E2] transition-colors hover:bg-[#F6F1E2]/20"
                aria-label="Close viewer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            className="flex h-full w-full items-center justify-center overflow-hidden px-4 py-16 sm:px-16"
            onClick={(e) => e.stopPropagation()}
          >
            {isCurrentMediaVideo ? (
              <video
                key={currentMediaUrl}
                src={currentMediaUrl}
                controls
                autoPlay
                muted
                loop
                playsInline
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <img
                key={currentMediaUrl}
                src={currentMediaUrl}
                alt={artifact.name}
                draggable={false}
                onClick={handleLightboxImageClick}
                style={{ transformOrigin: zoomOrigin }}
                className={`max-h-full max-w-full select-none object-contain transition-transform duration-300 ease-out ${
                  zoomed ? "scale-[2] cursor-zoom-out" : "scale-100 cursor-zoom-in"
                }`}
              />
            )}
          </div>

          {mediaList.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-[#F6F1E2]/10 p-3 text-[#F6F1E2] transition-colors hover:bg-[#F6F1E2]/20 sm:left-6"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[#F6F1E2]/10 p-3 text-[#F6F1E2] transition-colors hover:bg-[#F6F1E2]/20 sm:right-6"
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ArtifactView;