import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
}

const ICONS = [
  // Alimentação
  "🍔", "🍕", "🍜", "🛒", "☕", "🍷",
  // Casa & Moradia
  "🏠", "🪑", "🧹", "💡", "🔧", "🚿", "🏗️",
  // Contas & Utilidades
  "💧", "⚡", "📡", "🌐", "📞", "🔌",
  // Assinaturas & Streaming
  "📺", "🎵", "🎙️", "📰", "🎮", "🕹️",
  // Transporte
  "🚗", "🚌", "✈️", "⛽", "🅿️",
  // Saúde
  "💊", "🏥", "🦷", "🧬", "💪",
  // Educação
  "🎓", "📚", "✏️", "🖥️",
  // Lazer
  "🎬", "🏖️", "🎭", "🎯", "⚽",
  // Vestuário
  "👗", "👟", "👔",
  // Pets
  "🐕", "🐈",
  // Beleza
  "💇", "💄", "🪥",
  // Finanças
  "💰", "💳", "📈", "🏦", "💼",
  // Outros
  "📦", "🎁", "⭐", "📱",
];

const Categories = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [icon, setIcon] = useState("📦");
  const [color, setColor] = useState("#10b981");

  const fetchCategories = async () => {
    if (!user) return;
    const { data } = await supabase.from("categories").select("*").order("name");
    setCategories(data || []);
  };

  useEffect(() => { fetchCategories(); }, [user]);

  const resetForm = () => { setName(""); setType("expense"); setIcon("📦"); setColor("#10b981"); setEditingId(null); };

  const openEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setType(cat.type as "income" | "expense");
    setIcon(cat.icon);
    setColor(cat.color);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    if (editingId) {
      const { error } = await supabase.from("categories").update({ name: name.trim(), type, icon, color }).eq("id", editingId);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Categoria atualizada!");
    } else {
      const { error } = await supabase.from("categories").insert({ user_id: user!.id, name: name.trim(), type, icon, color });
      if (error) { toast.error("Erro ao salvar"); return; }
      toast.success("Categoria criada!");
    }
    setOpen(false);
    resetForm();
    fetchCategories();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("categories").delete().eq("id", id);
    toast.success("Removida");
    fetchCategories();
  };

  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Categorias</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>{editingId ? "Editar Categoria" : "Nova Categoria"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Alimentação" className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as any)}>
                  <SelectTrigger className="bg-muted"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ícone</Label>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                  {ICONS.map((ic) => (
                    <button key={ic} onClick={() => setIcon(ic)} className={`text-xl p-2 rounded-lg transition-colors ${icon === ic ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-muted"}`}>{ic}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-20 p-1 bg-muted" />
              </div>
              <Button onClick={handleSave} className="w-full">{editingId ? "Atualizar" : "Salvar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {[{ title: "Despesas", items: expenseCategories }, { title: "Receitas", items: incomeCategories }].map((section) => (
        <div key={section.title} className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">{section.title}</h2>
          {section.items.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma categoria</p>}
          {section.items.map((cat) => (
            <div key={cat.id} className="glass rounded-xl p-4 flex items-center justify-between glass-hover">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => openEdit(cat)}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ background: cat.color + "22" }}>{cat.icon}</div>
                <span className="text-sm font-medium text-foreground">{cat.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(cat)} className="text-muted-foreground hover:text-primary transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(cat.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default Categories;
