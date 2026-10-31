import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { QrCode, ArrowLeft, ImageOff } from "lucide-react";
import { fetchArtifacts, fetchCategories } from "@/lib/supabase-helpers";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const Gallery = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { data: artifacts, isLoading } = useQuery({ queryKey: ["artifacts"], queryFn: fetchArtifacts });
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const filtered = selectedCategory
    ? artifacts?.filter((a: any) => a.category_id === selectedCategory)
    : artifacts;

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
              return (
                <motion.div
                  key={artifact.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                >
                  {/* Pinalitan ang <Link> ng <div> para hindi ma-click */}
                  <div className="group block overflow-hidden rounded-xl border border-border bg-card shadow-museum transition-all hover:-translate-y-1 hover:shadow-lg">
                    <div className="aspect-[4/3] overflow-hidden bg-muted">
                      {mainImage ? (
                        <img src={mainImage} alt={artifact.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <ImageOff className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    
                    {/* Title and prompt na lang ang iniwan natin */}
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