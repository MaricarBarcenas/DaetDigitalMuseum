import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Library, ChevronRight, ScanLine, MapPin, Clock, Ticket, Search,
  ArrowUpRight, Compass, Menu, X, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchArtifacts } from "@/lib/supabase-helpers";

import heroImage from "@/assets/hero-museum.jpg";
import museumLogo from "@/assets/logo.png";

const isVideoUrl = (url?: string | null) =>
  !!url && /\.(mp4|webm|ogg|mov|m4v|mkv)(\?.*)?$/i.test(url);

const getMedia = (a: any): string | undefined =>
  a?.image_url || a?.artifact_images?.[0]?.image_url;

const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=" +
  encodeURIComponent("Municipal Cultural Center, Daet, Camarines Norte, Philippines");

const NAV = [
  { id: "hero", label: "Home" },
  { id: "collections", label: "Collections" },
  { id: "exhibitions", label: "Exhibits" },
  { id: "about", label: "About" },
];

const Media = ({ url, alt, className }: { url?: string; alt: string; className?: string }) => {
  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-[#efe6d2] ${className}`}>
        <Library className="h-10 w-10 text-[#a8967a]" />
      </div>
    );
  }
  return isVideoUrl(url) ? (
    <video src={url} className={`object-cover ${className}`} muted playsInline autoPlay loop />
  ) : (
    <img src={url} alt={alt} className={`object-cover ${className}`} />
  );
};

const SectionHeading = ({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) => (
  <div className="mb-12 text-center">
    <div className="mx-auto mb-3 flex items-center justify-center gap-3 text-[#9a6b2f]">
      <span className="h-px w-10 bg-[#9a6b2f]/50" />
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em]">{kicker}</span>
      <span className="h-px w-10 bg-[#9a6b2f]/50" />
    </div>
    <h2 className="font-display text-3xl font-bold tracking-tight text-[#1c3a4b] sm:text-5xl">{title}</h2>
    {sub && <p className="mx-auto mt-3 max-w-xl text-sm text-[#5d6b70]">{sub}</p>}
  </div>
);

const Index = () => {
  const navigate = useNavigate();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [admissionOpen, setAdmissionOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [active, setActive] = useState("hero");
  const [scrolled, setScrolled] = useState(false);

  const { data: artifacts = [], isLoading } = useQuery({
    queryKey: ["artifacts_public"],
    queryFn: fetchArtifacts,
  });

  // Top 3 most viewed
  const topArtifacts = useMemo(
    () => [...artifacts].sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 3),
    [artifacts]
  );
  const spotlight: any = topArtifacts[0];

  const searchResults = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const list = q
      ? artifacts.filter(
          (a: any) =>
            a.name?.toLowerCase().includes(q) ||
            a.description?.toLowerCase().includes(q) ||
            a.location_found?.toLowerCase().includes(q)
        )
      : topArtifacts;
    return list.slice(0, 5);
  }, [artifacts, keyword, topArtifacts]);

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

  const aboutCardClass =
    "group block w-full rounded-sm border border-[#d9ccb0] bg-[#fffdf7] p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-[#9a6b2f] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1c3a4b]";

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f0e1] font-sans text-[#1b3644] antialiased selection:bg-[#1c3a4b]/20">
      {/* NAVIGATION */}
      <header
        className={`sticky top-0 z-50 w-full border-b transition-all ${
          scrolled ? "border-[#d9ccb0] bg-[#f6f0e1]/95 shadow-sm backdrop-blur-md" : "border-transparent bg-[#f6f0e1]/80 backdrop-blur-sm"
        }`}
      >
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <button onClick={() => scrollTo("hero")} className="flex items-center gap-3 text-left">
            <div className="h-10 w-10 overflow-hidden rounded-full border border-[#d9ccb0] bg-white p-1">
              <img src={museumLogo} alt="Daet Digital Museum logo" className="h-full w-full object-contain" />
            </div>
            <div className="leading-tight">
              <span className="block font-display text-base font-bold text-[#1c3a4b] sm:text-lg">Daet Digital Museum</span>
              <span className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-[#9a6b2f]">
                Historical Heritage
              </span>
            </div>
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                className={`relative px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                  active === n.id ? "text-[#1c3a4b]" : "text-[#6b7a7f] hover:text-[#1c3a4b]"
                }`}
              >
                {n.label}
                {active === n.id && <span className="absolute inset-x-4 -bottom-0.5 h-0.5 bg-[#9a6b2f]" />}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button onClick={() => setSearchOpen(true)} variant="ghost" size="icon" className="h-9 w-9 rounded-full text-[#1c3a4b] hover:bg-white" aria-label="Search">
              <Search className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setScannerOpen(true)}
              variant="outline"
              size="sm"
              className="hidden gap-1.5 rounded-full border-[#d9ccb0] bg-white text-xs font-semibold text-[#1c3a4b] sm:inline-flex"
            >
              <ScanLine className="h-3.5 w-3.5" /> Scan QR
            </Button>
            <Link to="/admin/login" className="hidden sm:block">
              <Button size="sm" className="rounded-full bg-[#1c3a4b] px-4 text-xs font-semibold text-white hover:bg-[#2d5266]">
                LOGIN
              </Button>
            </Link>
            <Button
              onClick={() => setMenuOpen((v) => !v)}
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-[#1c3a4b] md:hidden"
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-[#d9ccb0] bg-[#f6f0e1] px-4 pb-4 md:hidden">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                className={`block w-full border-b border-[#e6dcc4] py-3 text-left text-sm font-bold uppercase tracking-widest ${
                  active === n.id ? "text-[#1c3a4b]" : "text-[#6b7a7f]"
                }`}
              >
                {n.label}
              </button>
            ))}
            <div className="flex gap-2 pt-3">
              <Button onClick={() => { setMenuOpen(false); setScannerOpen(true); }} variant="outline" className="flex-1 rounded-full border-[#d9ccb0] bg-white text-xs">
                <ScanLine className="mr-1.5 h-3.5 w-3.5" /> Scan QR
              </Button>
              <Link to="/admin/login" className="flex-1">
                <Button className="w-full rounded-full bg-[#1c3a4b] text-xs text-white hover:bg-[#2d5266]">LOGIN</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* HERO: title, short bio, button only */}
        <section id="hero" className="relative flex min-h-[88vh] items-center justify-center overflow-hidden px-4 py-24">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImage})` }}>
            <div className="absolute inset-0 bg-[#0f2430]/70" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#f6f0e1] via-transparent to-transparent" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="relative z-10 mx-auto max-w-3xl text-center text-white"
          >
            <div className="mx-auto mb-6 h-px w-24 bg-amber-300/70" />
            <h1 className="font-display text-5xl font-extrabold leading-tight tracking-tight sm:text-7xl">
              Daet Digital Museum
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-200 sm:text-lg">
              A digital home for the ancestral heirlooms, milestones, and treasures of Camarines Norte.
            </p>
            <div className="pt-8">
              <Link to="/gallery">
                <Button size="lg" className="h-12 rounded-full border border-amber-200/40 bg-[#9a6b2f] px-9 text-sm font-bold uppercase tracking-wider text-white shadow-lg hover:bg-[#b27c37]">
                  Explore Museum <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* FEATURED COLLECTION: top 3 most viewed, tri-fold brochure */}
        <section id="collections" className="px-4 py-24 md:px-8">
          <div className="container mx-auto max-w-6xl">
            {isLoading ? (
              <div className="h-[600px] animate-pulse bg-[#1c3a4b]" />
            ) : topArtifacts.length > 0 ? (
              <div className="grid overflow-hidden bg-[#1c3a4b] text-[#f6f0e1] shadow-2xl md:min-h-[780px] md:grid-cols-3">
                {/* LEFT PANEL */}
                <div className="flex flex-col">
                  <div className="flex-1 px-8 py-12 text-center">
                    <h2 className="font-display text-3xl font-bold uppercase leading-tight tracking-tight sm:text-4xl">
                      Why Visit Our Top Treasures?
                    </h2>
                    <div className="mt-10 space-y-8 font-serif">
                      <div>
                        <h3 className="text-lg font-bold">Rich History and Culture</h3>
                        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-[#f6f0e1]/85">
                          Each artifact carries the story of Camarines Norte, from ancestral heirlooms to milestones that shaped the region.
                        </p>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">Preserved Digitally</h3>
                        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-[#f6f0e1]/85">
                          Scan the QR tag beside any exhibit to open its full story on your phone.
                        </p>
                      </div>
                    </div>
                  </div>
                  <Link to="/gallery" className="group relative block h-64 overflow-hidden md:h-72">
                    <img src={heroImage} alt="" className="h-full w-full object-cover sepia-[.1] transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <span className="absolute inset-x-0 bottom-5 text-center font-mono text-xs tracking-wider underline-offset-4 group-hover:underline">
                      Explore Museum for more info
                    </span>
                  </Link>
                </div>

                {/* CENTER: three stacked photos */}
                <div className="grid grid-rows-3">
                  {topArtifacts.map((art: any, i: number) => (
                    <Link
                      key={art.id}
                      to="/gallery"
                      className="group relative block h-64 overflow-hidden border-y border-[#1c3a4b] md:h-auto"
                    >
                      <Media
                        url={getMedia(art)}
                        alt={art.name}
                        className="absolute inset-0 h-full w-full sepia-[.05] transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-[#0f2430]/45 transition-colors group-hover:bg-[#0f2430]/30" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                        <span className="font-display text-2xl font-light uppercase tracking-[0.35em] sm:text-3xl">
                          Artifact 0{i + 1}
                        </span>
                        <span className="mt-2 max-w-[90%] truncate font-serif text-sm font-semibold">{art.name}</span>
                        <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[#e0b070]">
                          {art.date_origin || "Historical"} · {art.view_count || 0} views
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* RIGHT PANEL */}
                <div className="flex flex-col">
                  <h2 className="px-6 pt-12 text-center font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
                    Featured Collection
                  </h2>
                  <div className="mx-4 mt-6 h-64 overflow-hidden md:h-80">
                    <img src={heroImage} alt="" className="h-full w-full object-cover sepia-[.15]" />
                  </div>
                  <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
                    <span className="font-display text-7xl font-extrabold uppercase leading-none tracking-tight sm:text-8xl">
                      Top 3
                    </span>
                    <p className="mt-6 max-w-xs font-serif text-sm leading-relaxed text-[#f6f0e1]/90">
                      The most viewed treasures in our vault. Visit the museum to uncover the full story behind each one.
                    </p>
                    <Link to="/gallery" className="mt-6">
                      <Button className="rounded-full bg-[#e0b070] px-7 text-xs font-bold uppercase tracking-wider text-[#0f2430] hover:bg-[#ecc388]">
                        Explore Museum <ArrowUpRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#1c3a4b] py-16 text-center text-[#f6f0e1]">
                <Library className="mx-auto mb-2 h-10 w-10 opacity-70" />
                <p className="text-sm">No artifacts have been added yet.</p>
              </div>
            )}
          </div>
        </section>

        {/* EXPLORE EXHIBITIONS: top viewed only */}
        <section id="exhibitions" className="border-y border-[#d9ccb0] bg-[#ece3cd] px-4 py-24 md:px-8">
          <div className="container mx-auto max-w-6xl">
            <SectionHeading kicker="Exhibit Spotlight" title="Explore Exhibitions" sub="Our most viewed exhibit right now." />
            {spotlight && (
              <div className="grid items-center gap-0 overflow-hidden rounded-sm border-2 border-[#1c3a4b] bg-[#fffdf7] shadow-xl md:grid-cols-2">
                <div className="aspect-[4/3] w-full bg-[#efe6d2] p-3 md:aspect-auto md:h-full md:min-h-[360px]">
                  <Media url={getMedia(spotlight)} alt={spotlight.name} className="h-full w-full border border-[#d9ccb0]" />
                </div>
                <div className="space-y-4 p-8 sm:p-10">
                  <span className="inline-flex items-center gap-1.5 bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                    <Compass className="h-3.5 w-3.5" /> Most Viewed
                  </span>
                  <h3 className="font-display text-3xl font-bold text-[#1c3a4b]">{spotlight.name}</h3>
                  <p className="text-sm leading-relaxed text-[#5d6b70] line-clamp-3">
                    {spotlight.description || "A key piece from the Daet Digital Museum collection."}
                  </p>
                  <p className="text-xs italic text-[#6b7a7f]">Explore Museum for the full story.</p>
                  <Link to="/gallery">
                    <Button className="mt-2 rounded-full bg-[#1c3a4b] px-6 text-xs font-bold text-white hover:bg-[#2d5266]">
                      Explore Museum <ArrowUpRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ABOUT: every card is clickable */}
        <section id="about" className="px-4 py-24 md:px-8">
          <div className="container mx-auto max-w-5xl">
            <SectionHeading kicker="About Us" title="About the Museum" />
            <p className="mx-auto mb-12 max-w-3xl text-center text-sm leading-relaxed text-[#5d6b70] sm:text-base">
              The Daet Digital Museum is an interactive repository for collecting, cataloging, and safeguarding the
              cultural artifacts and historical chronicles of Camarines Norte. With QR-enabled archives and mobile-friendly
              pages, we connect physical exhibits to modern digital storytelling.
            </p>

            <div className="grid gap-6 md:grid-cols-3">
              <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" className={aboutCardClass}>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#efe6d2]">
                  <MapPin className="h-5 w-5 text-[#1c3a4b]" />
                </div>
                <h4 className="text-sm font-bold uppercase tracking-wider">Location</h4>
                <p className="mt-1.5 text-xs leading-relaxed text-[#5d6b70]">
                  Municipal Cultural Center, Daet, Camarines Norte, Bicol Region, Philippines.
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#9a6b2f] group-hover:underline">
                  Open in Maps <ExternalLink className="h-3 w-3" />
                </span>
              </a>

              <button type="button" onClick={() => setHoursOpen(true)} className={aboutCardClass}>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#efe6d2]">
                  <Clock className="h-5 w-5 text-[#1c3a4b]" />
                </div>
                <h4 className="text-sm font-bold uppercase tracking-wider">Visiting Hours</h4>
                <p className="mt-1.5 text-xs leading-relaxed text-[#5d6b70]">
                  Tuesday – Saturday: 9:00 AM – 4:30 PM<br />Sunday &amp; Monday: Closed
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#9a6b2f] group-hover:underline">
                  View schedule <ChevronRight className="h-3 w-3" />
                </span>
              </button>

              <button type="button" onClick={() => setAdmissionOpen(true)} className={aboutCardClass}>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#efe6d2]">
                  <Ticket className="h-5 w-5 text-[#1c3a4b]" />
                </div>
                <h4 className="text-sm font-bold uppercase tracking-wider">Admission</h4>
                <p className="mt-1.5 text-xs leading-relaxed text-[#5d6b70]">
                  Free public admission. Digital guide available on mobile devices.
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#9a6b2f] group-hover:underline">
                  Learn more <ChevronRight className="h-3 w-3" />
                </span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t-2 border-[#1c3a4b] bg-[#1c3a4b] px-4 py-12 text-xs text-slate-300 md:px-8">
        <div className="container mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
          <div className="flex items-center gap-3">
            <img src={museumLogo} alt="Logo" className="h-9 w-9 rounded-full bg-white object-contain p-1" />
            <div className="flex flex-col">
              <span className="font-display text-sm font-bold text-white">Daet Digital Museum</span>
              <span className="text-[10px]">Camarines Norte, Philippines</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 font-semibold">
            <Link to="/gallery" className="hover:text-white">Exhibits Gallery</Link>
            <Link to="/admin/login" className="hover:text-white">Curator Login</Link>
            <button onClick={() => setScannerOpen(true)} className="hover:text-white">Scan QR Code</button>
          </div>
          <p className="text-[11px]">© {new Date().getFullYear()} Daet Digital Museum System.</p>
        </div>
      </footer>

      {/* QR SCANNER */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="rounded-2xl border-[#d9ccb0] bg-[#fffdf7] p-6 sm:max-w-[420px]">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#1c3a4b] text-white">
              <ScanLine className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center font-display text-lg">Scan Exhibit QR Tag</DialogTitle>
          </DialogHeader>
          <p className="text-center text-xs leading-relaxed text-[#5d6b70]">
            Point your camera app at the QR label beside any showcase, or enter the Artifact ID below.
          </p>
          <form onSubmit={handleManualScan} className="space-y-3">
            <Input
              placeholder="Enter Artifact ID"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="h-11 rounded-xl border-[#d9ccb0] bg-white text-xs"
            />
            <Button type="submit" className="h-11 w-full rounded-xl bg-[#1c3a4b] text-xs font-bold text-white hover:bg-[#2d5266]">
              Open Exhibit Story
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* SEARCH */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="rounded-2xl border-[#d9ccb0] bg-[#fffdf7] p-6 sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-display text-base">Search Museum Artifacts</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7a7f]" />
            <Input
              placeholder="Search by name, description, or location..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="h-11 rounded-xl border-[#d9ccb0] bg-white pl-10 text-xs"
              autoFocus
            />
          </div>
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {searchResults.length === 0 && <p className="py-4 text-center text-xs text-[#6b7a7f]">No results found.</p>}
            {searchResults.map((a: any) => (
              <Link
                key={a.id}
                to={`/artifact/${a.id}`}
                onClick={() => setSearchOpen(false)}
                className="flex items-center justify-between rounded-xl border border-transparent p-2.5 hover:border-[#d9ccb0] hover:bg-[#f6f0e1]"
              >
                <div>
                  <p className="text-xs font-bold">{a.name}</p>
                  <p className="text-[10px] text-[#6b7a7f]">{a.categories?.name || "Artifact"} • {a.date_origin || "Undated"}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-[#6b7a7f]" />
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* VISITING HOURS */}
      <Dialog open={hoursOpen} onOpenChange={setHoursOpen}>
        <DialogContent className="rounded-2xl border-[#d9ccb0] bg-[#fffdf7] p-6 sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Visiting Hours</DialogTitle>
          </DialogHeader>
          <ul className="divide-y divide-[#e6dcc4] text-sm">
            {[
              ["Monday", "Closed"],
              ["Tuesday – Saturday", "9:00 AM – 4:30 PM"],
              ["Sunday", "Closed"],
            ].map(([d, h]) => (
              <li key={d} className="flex justify-between py-2.5">
                <span className="font-semibold">{d}</span>
                <span className="text-[#5d6b70]">{h}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[#6b7a7f]">Closed days are used for maintenance and cataloging.</p>
        </DialogContent>
      </Dialog>

      {/* ADMISSION */}
      <Dialog open={admissionOpen} onOpenChange={setAdmissionOpen}>
        <DialogContent className="rounded-2xl border-[#d9ccb0] bg-[#fffdf7] p-6 sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Admission</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-[#5d6b70]">
            Entry to the Daet Digital Museum is free for everyone. Scan the QR tag beside any exhibit with your phone
            to open its digital guide, or browse the full collection online.
          </p>
          <div className="flex gap-2 pt-2">
            <Link to="/gallery" className="flex-1" onClick={() => setAdmissionOpen(false)}>
              <Button className="w-full rounded-full bg-[#1c3a4b] text-xs font-bold text-white hover:bg-[#2d5266]">Explore Museum</Button>
            </Link>
            <Button
              variant="outline"
              className="flex-1 rounded-full border-[#d9ccb0] text-xs font-semibold"
              onClick={() => { setAdmissionOpen(false); setScannerOpen(true); }}
            >
              <ScanLine className="mr-1.5 h-3.5 w-3.5" /> Scan QR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;