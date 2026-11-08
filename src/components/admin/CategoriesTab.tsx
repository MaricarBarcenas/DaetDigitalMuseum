import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategories } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CategoriesTab = () => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [updating, setUpdating] = useState(false);
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("categories").insert({ name: name.trim() });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setName("");
    queryClient.invalidateQueries({ queryKey: ["categories"] });
    toast({ title: "Category added" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    await supabase.from("categories").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["categories"] });
    toast({ title: "Category deleted" });
  };

  const startEdit = (cat: any) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleUpdate = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    const current = categories?.find((c: any) => c.id === id);
    if (current && current.name === trimmed) {
      cancelEdit();
      return;
    }
    setUpdating(true);
    const { error } = await supabase.from("categories").update({ name: trimmed }).eq("id", id);
    setUpdating(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    cancelEdit();
    queryClient.invalidateQueries({ queryKey: ["categories"] });
    toast({ title: "Category updated", className: "border-green-600 bg-green-600 text-white" });
  };

  return (
    <div>
      <div className="mb-6 flex gap-2">
        <Input placeholder="New category name…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} className="max-w-xs" />
        <Button onClick={handleAdd} disabled={loading} size="sm"><Plus className="mr-1 h-4 w-4" />Add</Button>
      </div>
      <div className="space-y-2">
        {categories?.map((cat: any) => (
          <div key={cat.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
            {editingId === cat.id ? (
              <>
                <Input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdate(cat.id);
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="mr-2 max-w-xs"
                />
                <div className="flex items-center">
                  <Button variant="ghost" size="icon" onClick={() => handleUpdate(cat.id)} disabled={updating}>
                    <Check className="h-4 w-4 text-primary" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={cancelEdit} disabled={updating}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <span className="font-medium">{cat.name}</span>
                <div className="flex items-center">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(cat)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
        {(!categories || categories.length === 0) && (
          <p className="py-8 text-center text-sm text-muted-foreground">No categories yet. Add one above.</p>
        )}
      </div>
    </div>
  );
};

export default CategoriesTab;