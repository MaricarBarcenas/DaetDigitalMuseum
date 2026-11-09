import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, ArrowLeft, ImageOff, Sparkles, MapPin, Landmark } from "lucide-react";
import { fetchArtifacts, fetchCategories } from "@/lib/supabase-helpers";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// Shows only a short teaser of the description so visitors want to see the full story at the museum.
const makeTeaser = (text?: string | null, max = 90) => {
  if (!text) return null;
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean + "…";
  const cut = clean.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : max) + "…";
};

const Gallery = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { data: artifacts, isLoading } = useQuery({ queryKey: ["artifacts"], queryFn: fetchArtifacts });
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const filtered = selectedCategory
    ? artifacts?.filter((a: any) => a.category_id === selectedCategory)
    : artifacts;

  const getCategoryName = (id: string) => categories?.find((c: any) => c.id === id)?.name;

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

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : !filtered?.length ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <ImageOff className="mb-4 h-12 w-12" />
            <p>No artifacts found. Check back soon!</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((artifact: any, i: number) => {
              const mainImage = artifact.artifact_images?.[0]?.image_url;
              const isActive = activeId === artifact.id;
              const teaser = makeTeaser(artifact.description);
              const categoryName = getCategoryName(artifact.category_id);
              const era = artifact.period || artifact.era || artifact.year;
              const origin = artifact.origin || artifact.location;

              return (
                <motion.div
                  key={artifact.id}
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
                    className="group block cursor-pointer overflow-hidden rounded-xl border border-border bg-card shadow-museum transition-all hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                      {mainImage ? (
                        <img src={mainImage} alt={artifact.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <ImageOff className="h-10 w-10" />
                        </div>
                      )}

                      {/* Hint badge shown while the teaser is hidden */}
                      {!isActive && (
                        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                          <Sparkles className="h-3 w-3 text-primary" />
                          <span>Peek inside</span>
                        </div>
                      )}

                      {/* Teaser overlay */}
                      <AnimatePresence>
                        {isActive && (
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
                    <div className="p-5 text-center">
                      <h3 className="font-display text-lg font-semibold">{artifact.name}</h3>
                      <div className="mt-3 flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground bg-secondary/50 py-1.5 rounded-md">
                        <QrCode className="h-3.5 w-3.5 text-primary" />
                        <span>Scan QR at the museum for details</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Gallery;