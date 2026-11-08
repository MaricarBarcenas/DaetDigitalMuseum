import { useState, useMemo, useEffect, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Library, ChevronRight, ScanLine, MapPin, Clock,
  ArrowUpRight, Compass, Menu, X, ExternalLink, Smartphone, BookOpen,
  Landmark, Mail, Phone, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchArtifacts } from "@/lib/supabase-helpers";
import Askmuseum from "@/components/Askmuseum";

import heroImage from "@/assets/hero-museum.jpg";
import museumLogo from "@/assets/logo.png";

/* ------------------------------------------------------------------ */
/* Palette (for reference)                                             */
/* primary-blue #2563eb · deep-blue #1d4ed8 · indigo #4338ca           */
/* light-blue #dbeafe · page-bg #f1f6fd · white #ffffff                */
/* border-gray #e2e8f0 · dark-navy #0f172a · slate-gray #64748b        */
/* ------------------------------------------------------------------ */

const isVideoUrl = (url?: string | null) =>
  !!url && /\.(mp4|webm|ogg|mov|m4v|mkv)(\?.*)?$/i.test(url);

const getMedia = (a: any): string | undefined =>
  a?.image_url || a?.artifact_images?.[0]?.image_url;

const MUSEUM_ADDRESS = "Municipal Cultural Center, Daet, Camarines Norte, Philippines";
const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(MUSEUM_ADDRESS);
const MAPS_EMBED_URL =
  "https://www.google.com/maps?q=" + encodeURIComponent(MUSEUM_ADDRESS) + "&output=embed";

// Update these with your museum's real contact details.
const CONTACT = {
  email: "info@daetdigitalmuseum.ph",
  phone: "+63 000 000 0000",
};

const NAV = [
  { id: "hero", label: "Home" },
  { id: "about", label: "About" },
  { id: "artifacts", label: "Artifacts" },
  { id: "visit", label: "Visit Us" },
];

// Edit / extend with verified milestones of Daet.
const TIMELINE = [
  {
    year: "1898",
    title: "The Rizal Monument in Daet",
    text: "Widely recognized as one of the earliest monuments dedicated to José Rizal, a landmark of local pride.",
  },
  {
    year: "Heritage",
    title: "Traditions & Culture",
    text: "Festivals, livelihoods, and customs passed down through generations of Camarines Norte families.",
  },
  {
    year: "Today",
    title: "A Digital Home for Heritage",
    text: "Artifacts are cataloged and linked to QR tags so their stories reach every visitor.",
  },
];

const HOW_IT_WORKS = [
  { icon: Landmark, title: "Find the QR code", text: "Look for the QR tag displayed beside each artifact." },
  { icon: Smartphone, title: "Scan with your phone", text: "Use your camera app, or enter the Artifact ID manually." },
  { icon: BookOpen, title: "Discover its history", text: "Read its story, background, and significance instantly." },
];

const Media = ({ url, alt, className }: { url?: string; alt: string; className?: string }) => {
  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-[#dbeafe] ${className}`}>
        <Library className="h-10 w-10 text-[#2563eb]/60" />
      </div>
    );
  }
  return isVideoUrl(url) ? (
    <video src={url} className={`object-cover ${className}`} muted playsInline autoPlay loop />
  ) : (
    <img src={url} alt={alt} className={`object-cover ${className}`} />
  );
};

const Reveal = ({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.55, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

const SectionHeading = ({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) => (
  <div className="mb-12 text-center">
    <div className="mx-auto mb-3 flex items-center justify-center gap-3 text-[#2563eb]">
      <span className="h-px w-10 bg-[#2563eb]/50" />
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em]">{kicker}</span>
      <span className="h-px w-10 bg-[#2563eb]/50" />
    </div>
    <h2 className="font-display text-3xl font-bold tracking-tight text-[#0f172a] sm:text-5xl">{title}</h2>
    {sub && <p className="mx-auto mt-3 max-w-xl text-sm text-[#64748b]">{sub}</p>}
  </div>
);

const Index = () => {
  const navigate = useNavigate();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [active, setActive] = useState("hero");
  const [scrolled, setScrolled] = useState(false);

  const { data: artifacts = [], isLoading } = useQuery({
    queryKey: ["artifacts_public"],
    queryFn: fetchArtifacts,
  });

  // Artifacts sorted by views (most viewed first)
  const sortedArtifacts = useMemo(
    () => [...artifacts].sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0)),
    [artifacts]
  );
  const topArtifacts = useMemo(() => sortedArtifacts.slice(0, 3), [sortedArtifacts]);
  const spotlight: any = sortedArtifacts[0];

  // Categories derived from the data, with counts and a cover image
  const categories = useMemo(() => {
    const map = new Map<string, { name: string; count: number; cover?: string }>();
    artifacts.forEach((a: any) => {
      const name = a.categories?.name || "Uncategorized";
      const entry = map.get(name) || { name, count: 0, cover: undefined };
      entry.count += 1;
      if (!entry.cover) entry.cover = getMedia(a);
      map.set(name, entry);
    });
    return Array.from(map.values());
  }, [artifacts]);

  // Featured artifact grid: top 3 most viewed
  const featuredArtifacts = topArtifacts;

  // Active nav highlighting + header state
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      let current = "hero";
      for (const n of NAV) {
        const el = document.getElementById(n.id);
        if (el && el.getBoundingClientRect().top <= 120) current = n.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const handleManualScan = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    setScannerOpen(false);
    navigate(`/artifact/${encodeURIComponent(code)}`);
  };

  const infoCardClass =
    "group block w-full rounded-xl border border-[#e2e8f0] bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-[#2563eb] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]";

  return (
    <div className="flex min-h-screen flex-col bg-[#f1f6fd] font-sans text-[#0f172a] antialiased selection:bg-[#2563eb]/20">
      {/* NAVIGATION */}
      <header
        className={`sticky top-0 z-50 w-full border-b transition-all ${
          scrolled
            ? "border-[#e2e8f0] bg-white/95 shadow-sm backdrop-blur-md"
            : "border-transparent bg-[#f1f6fd]/80 backdrop-blur-sm"
        }`}
      >
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <button onClick={() => scrollTo("hero")} className="flex items-center gap-3 text-left">
            <div className="h-10 w-10 overflow-hidden rounded-full border border-[#e2e8f0] bg-white p-1">
              <img src={museumLogo} alt="Daet Digital Museum logo" className="h-full w-full object-contain" />
            </div>
            <div className="leading-tight">
              <span className="block font-display text-base font-bold text-[#0f172a] sm:text-lg">Daet Digital Museum</span>
              <span className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-[#2563eb]">
                Historical Heritage
              </span>
            </div>
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                className={`relative px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors lg:px-4 ${
                  active === n.id ? "text-[#1d4ed8]" : "text-[#64748b] hover:text-[#0f172a]"
                }`}
              >
                {n.label}
                {active === n.id && <span className="absolute inset-x-3 -bottom-0.5 h-0.5 bg-[#2563eb] lg:inset-x-4" />}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/admin/login" className="hidden sm:block">
              <Button size="sm" className="rounded-full bg-[#2563eb] px-4 text-xs font-semibold text-white hover:bg-[#1d4ed8]">
                ADMIN LOGIN
              </Button>
            </Link>
            <Button
              onClick={() => setMenuOpen((v) => !v)}
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-[#0f172a] md:hidden"
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-[#e2e8f0] bg-white px-4 pb-4 md:hidden">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                className={`block w-full border-b border-[#e2e8f0] py-3 text-left text-sm font-bold uppercase tracking-widest ${
                  active === n.id ? "text-[#1d4ed8]" : "text-[#64748b]"
                }`}
              >
                {n.label}
              </button>
            ))}
            <div className="flex gap-2 pt-3">
              <Link to="/admin/login" className="flex-1">
                <Button className="w-full rounded-full bg-[#2563eb] text-xs text-white hover:bg-[#1d4ed8]">ADMIN LOGIN</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* 01 · HERO */}
        <section id="hero" className="relative flex min-h-[88vh] items-center justify-center overflow-hidden px-4 py-24">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImage})` }}>
            <div className="absolute inset-0 bg-[#0f172a]/75" />
            <div className="absolute inset-0 bg-gradient-to-br from-[#4338ca]/30 via-transparent to-[#2563eb]/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#f1f6fd] via-transparent to-transparent" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="relative z-10 mx-auto max-w-3xl text-center text-white"
          >
            <div className="mx-auto mb-6 h-px w-24 bg-[#dbeafe]/70" />
            <p className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.3em] text-[#dbeafe]">
              Daet Digital Museum
            </p>
            <h1 className="font-display text-5xl font-extrabold leading-tight tracking-tight sm:text-7xl">
              Discover the Heritage of Daet
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-200 sm:text-lg">
              Preserving our past, connecting our present, and inspiring our future. Explore the history,
              culture, and artifacts of Daet, Camarines Norte through an interactive digital museum.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 pt-8 sm:flex-row">
              <Link to="/gallery">
                <Button size="lg" className="h-12 rounded-full bg-[#2563eb] px-9 text-sm font-bold uppercase tracking-wider text-white shadow-lg hover:bg-[#1d4ed8]">
                  Explore the Museum <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                onClick={() => scrollTo("history")}
                className="h-12 rounded-full border-white/50 bg-white/10 px-9 text-sm font-bold uppercase tracking-wider text-white backdrop-blur hover:bg-white hover:text-[#0f172a]"
              >
                Discover Our Heritage
              </Button>
            </div>
          </motion.div>
        </section>

        {/* 02 · ABOUT THE MUSEUM */}
        <section id="about" className="px-4 py-24 md:px-8">
          <div className="container mx-auto max-w-5xl">
            <Reveal>
              <SectionHeading kicker="About Us" title="About Daet Digital Museum" />
              <div className="grid items-center gap-10 md:grid-cols-2">
                <div className="space-y-4 text-sm leading-relaxed text-[#64748b] sm:text-base">
                  <p>
                    The Daet Digital Museum is a digital platform dedicated to preserving, documenting, and
                    showcasing the historical artifacts and cultural heritage of Daet, Camarines Norte. Through
                    technology, visitors can explore meaningful collections and learn the stories behind every artifact.
                  </p>
                  <p>
                    With QR-enabled archives and mobile-friendly pages, we connect physical exhibits to modern
                    digital storytelling.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#e2e8f0] bg-white p-8 shadow-sm">
                  <span className="mb-3 inline-block rounded-full bg-[#dbeafe] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#1d4ed8]">
                    Our Mission
                  </span>
                  <p className="font-display text-xl font-semibold leading-snug text-[#0f172a] sm:text-2xl">
                    To make local heritage more accessible, engaging, and meaningful for everyone.
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#e2e8f0] pt-6 text-center">
                    <div>
                      <p className="font-display text-3xl font-extrabold text-[#2563eb]">{artifacts.length}</p>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">Artifacts</p>
                    </div>
                    <div>
                      <p className="font-display text-3xl font-extrabold text-[#4338ca]">{categories.length}</p>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">Collections</p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 03 · FEATURED ARTIFACTS */}
        <section id="artifacts" className="border-y border-[#e2e8f0] bg-white px-4 py-24 md:px-8">
          <div className="container mx-auto max-w-6xl">
            <SectionHeading
              kicker="Featured"
              title="Featured Artifacts"
              sub="Discover the objects that tell our stories."
            />

            {/* Most viewed spotlight */}
            {spotlight && (
              <Reveal className="mb-14">
                <div className="grid items-center overflow-hidden rounded-2xl border border-[#e2e8f0] bg-[#f1f6fd] shadow-lg md:grid-cols-2">
                  <div className="aspect-[4/3] w-full bg-[#dbeafe] p-3 md:aspect-auto md:h-full md:min-h-[340px]">
                    <Media url={getMedia(spotlight)} alt={spotlight.name} className="h-full w-full rounded-lg" />
                  </div>
                  <div className="space-y-4 p-8 sm:p-10">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#4338ca] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                      <Compass className="h-3.5 w-3.5" /> Most Viewed
                    </span>
                    <h3 className="font-display text-3xl font-bold text-[#0f172a]">{spotlight.name}</h3>
                    <p className="text-sm leading-relaxed text-[#64748b]">
                      Every artifact has a story waiting to be told. Visit the museum to uncover its history in person.
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-[#64748b]">
                      <Eye className="h-3.5 w-3.5" /> {spotlight.view_count || 0} views
                    </p>
                    <Button
                      onClick={() => scrollTo("visit")}
                      className="mt-2 rounded-full bg-[#2563eb] px-6 text-xs font-bold text-white hover:bg-[#1d4ed8]"
                    >
                      Plan Your Visit <ArrowUpRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Reveal>
            )}

            {isLoading ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-80 animate-pulse rounded-xl bg-[#dbeafe]" />
                ))}
              </div>
            ) : featuredArtifacts.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {featuredArtifacts.map((art: any, i: number) => (
                  <Reveal key={art.id} delay={i * 0.06}>
                    <div className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-[#2563eb] hover:shadow-lg">
                      <div className="relative aspect-[4/3] overflow-hidden bg-[#dbeafe]">
                        <Media
                          url={getMedia(art)}
                          alt={art.name}
                          className="h-full w-full transition-transform duration-700 group-hover:scale-105"
                        />
                        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1d4ed8] shadow">
                          {art.categories?.name || "Artifact"}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col p-5">
                        <h3 className="font-display text-lg font-bold text-[#0f172a]">{art.name}</h3>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[#4338ca]">
                          {art.view_count || 0} views
                        </p>
                        <p className="mt-3 flex-1 text-sm italic leading-relaxed text-[#64748b]">
                          Its story is best discovered in person. Visit the museum to see it up close.
                        </p>
                        <Button
                          onClick={() => scrollTo("visit")}
                          className="mt-4 w-full rounded-full bg-[#2563eb] text-xs font-bold text-white hover:bg-[#1d4ed8]"
                        >
                          Plan Your Visit <ArrowUpRight className="ml-1.5 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-[#dbeafe] py-16 text-center text-[#0f172a]">
                <Library className="mx-auto mb-2 h-10 w-10 text-[#2563eb]/70" />
                <p className="text-sm">No artifacts found yet.</p>
              </div>
            )}

            <div className="mt-12 text-center">
              <Link to="/gallery">
                <Button variant="outline" className="rounded-full border-[#2563eb] bg-transparent px-8 text-xs font-bold uppercase tracking-wider text-[#1d4ed8] hover:bg-[#2563eb] hover:text-white">
                  Browse Full Gallery <ChevronRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* 04 · EXPLORE THROUGH QR CODE */}
        <section id="qr" className="relative overflow-hidden bg-[#0f172a] px-4 py-24 text-white md:px-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#4338ca]/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#2563eb]/30 blur-3xl" />
          <div className="container relative mx-auto max-w-5xl">
            <Reveal>
              <div className="mb-12 text-center">
                <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-[#dbeafe]">
                  Scan · Discover · Learn
                </p>
                <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
                  Discover Every Artifact with a Scan
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-300">
                  Scan the QR code beside each artifact using your smartphone and instantly access its digital
                  information, historical background, descriptions, and images.
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                {HOW_IT_WORKS.map((step, i) => (
                  <div key={step.title} className="rounded-xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#2563eb] text-white">
                      <step.icon className="h-6 w-6" />
                    </div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#dbeafe]">Step {i + 1}</p>
                    <h3 className="mt-1 font-display text-lg font-bold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.text}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* 06 · DAET'S HISTORICAL BACKGROUND */}
        <section id="history" className="border-y border-[#e2e8f0] bg-white px-4 py-24 md:px-8">
          <div className="container mx-auto max-w-4xl">
            <SectionHeading
              kicker="History"
              title="Daet's Historical Background"
              sub="A short look at the history and cultural significance of Daet."
            />
            <div className="relative space-y-8 border-l-2 border-[#dbeafe] pl-8">
              {TIMELINE.map((t, i) => (
                <Reveal key={t.title} delay={i * 0.08}>
                  <div className="relative">
                    <span className="absolute -left-[41px] top-1 h-4 w-4 rounded-full border-4 border-white bg-[#2563eb] shadow" />
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#4338ca]">{t.year}</span>
                    <h3 className="mt-1 font-display text-xl font-bold text-[#0f172a]">{t.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[#64748b]">{t.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <div className="mt-12 text-center">
              <Link to="/gallery">
                <Button className="rounded-full bg-[#4338ca] px-8 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#3730a3]">
                  Read More About Daet <ArrowUpRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* 07 · VISIT THE MUSEUM */}
        <section id="visit" className="px-4 py-24 md:px-8">
          <div className="container mx-auto max-w-6xl">
            <SectionHeading kicker="Plan Your Trip" title="Visit the Museum" sub="Experience the heritage of Daet, Camarines Norte." />

            <div className="grid gap-6 md:grid-cols-2">
              <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" className={infoCardClass}>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#dbeafe]">
                  <MapPin className="h-5 w-5 text-[#2563eb]" />
                </div>
                <h4 className="text-sm font-bold uppercase tracking-wider">Location</h4>
                <p className="mt-1.5 text-xs leading-relaxed text-[#64748b]">
                  Municipal Cultural Center, Daet, Camarines Norte, Bicol Region, Philippines.
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#2563eb] group-hover:underline">
                  Open in Maps <ExternalLink className="h-3 w-3" />
                </span>
              </a>

              <button type="button" onClick={() => setHoursOpen(true)} className={infoCardClass}>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#dbeafe]">
                  <Clock className="h-5 w-5 text-[#2563eb]" />
                </div>
                <h4 className="text-sm font-bold uppercase tracking-wider">Visiting Hours</h4>
                <p className="mt-1.5 text-xs leading-relaxed text-[#64748b]">
                  Tuesday – Saturday: 9:00 AM – 4:30 PM<br />Sunday &amp; Monday: Closed
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#2563eb] group-hover:underline">
                  View schedule <ChevronRight className="h-3 w-3" />
                </span>
              </button>
            </div>

            {/* Embedded map */}
            <div className="mt-10 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
              <iframe
                title="Daet Digital Museum location"
                src={MAPS_EMBED_URL}
                className="h-72 w-full border-0 sm:h-96"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </section>
      </main>

      {/* 08 · FOOTER */}
      <footer className="bg-[#0f172a] px-4 py-14 text-xs text-slate-300 md:px-8">
        <div className="container mx-auto grid max-w-6xl gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <img src={museumLogo} alt="Logo" className="h-10 w-10 rounded-full bg-white object-contain p-1" />
              <div className="flex flex-col">
                <span className="font-display text-sm font-bold text-white">Daet Digital Museum</span>
                <span className="text-[10px]">Camarines Norte, Philippines</span>
              </div>
            </div>
            <p className="mt-4 max-w-xs leading-relaxed text-slate-400">
              Preserving our heritage, one artifact at a time.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white">Quick Links</h4>
            <ul className="grid grid-cols-2 gap-2 font-semibold">
              {NAV.map((n) => (
                <li key={n.id}>
                  <button onClick={() => scrollTo(n.id)} className="hover:text-white">{n.label}</button>
                </li>
              ))}
              <li><Link to="/gallery" className="hover:text-white">Exhibits Gallery</Link></li>
              <li><button onClick={() => setScannerOpen(true)} className="hover:text-white">Scan QR Code</button></li>
              <li><Link to="/admin/login" className="hover:text-white">Admin Login</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white">Contact</h4>
            <ul className="space-y-2">
              <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-[#2563eb]" /> {MUSEUM_ADDRESS}</li>
              <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-[#2563eb]" /> {CONTACT.email}</li>
              <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-[#2563eb]" /> {CONTACT.phone}</li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto mt-10 max-w-6xl border-t border-white/10 pt-6 text-center text-[11px] text-slate-400">
          © {new Date().getFullYear()} Daet Digital Museum System. All rights reserved.
        </div>
      </footer>

      {/* QR SCANNER */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="rounded-2xl border-[#e2e8f0] bg-white p-6 sm:max-w-[420px]">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#2563eb] text-white">
              <ScanLine className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center font-display text-lg">Scan Exhibit QR Tag</DialogTitle>
          </DialogHeader>
          <p className="text-center text-xs leading-relaxed text-[#64748b]">
            Point your camera app at the QR label beside any showcase, or enter the Artifact ID below.
          </p>
          <form onSubmit={handleManualScan} className="space-y-3">
            <Input
              placeholder="Enter Artifact ID"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="h-11 rounded-xl border-[#e2e8f0] bg-white text-xs"
            />
            <Button type="submit" className="h-11 w-full rounded-xl bg-[#2563eb] text-xs font-bold text-white hover:bg-[#1d4ed8]">
              Open Exhibit Story
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* VISITING HOURS */}
      <Dialog open={hoursOpen} onOpenChange={setHoursOpen}>
        <DialogContent className="rounded-2xl border-[#e2e8f0] bg-white p-6 sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Visiting Hours</DialogTitle>
          </DialogHeader>
          <ul className="divide-y divide-[#e2e8f0] text-sm">
            {[
              ["Monday", "Closed"],
              ["Tuesday – Saturday", "9:00 AM – 4:30 PM"],
              ["Sunday", "Closed"],
            ].map(([d, h]) => (
              <li key={d} className="flex justify-between py-2.5">
                <span className="font-semibold">{d}</span>
                <span className="text-[#64748b]">{h}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[#64748b]">Closed days are used for maintenance and cataloging.</p>
        </DialogContent>
      </Dialog>

      {/* AI GUIDE */}
      <Askmuseum />
    </div>
  );
};

export default Index;