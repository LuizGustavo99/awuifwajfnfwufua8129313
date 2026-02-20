import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Card {
  id: string;
  name: string;
  last_digits: string | null;
  brand: string | null;
  credit_limit: number;
  closing_day: number;
  due_day: number;
  color: string;
  usedAmount?: number;
}

const COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#06b6d4", "#ef4444", "#6366f1",
  "#6b7280", "#f8fafc",
];

const Cards = () => {
  const { user } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [lastDigits, setLastDigits] = useState("");
  const [brand, setBrand] = useState("");
  const [limit, setLimit] = useState("");
  const [closingDay, setClosingDay] = useState("1");
  const [dueDay, setDueDay] = useState("10");
  const [color, setColor] = useState("#3b82f6");

  const fetchCards = async () => {
    if (!user) return;
    const { data: cardsData } = await supabase.from("cards").select("*").order("name");
    if (!cardsData) { setCards([]); return; }

    // Get current month's expenses per card
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    const { data: txData } = await supabase
      .from("transactions")
      .select("card_id, amount")
      .eq("type", "expense")
      .not("card_id", "is", null)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth);

    const usedByCard: Record<string, number> = {};
    (txData || []).forEach((tx) => {
      if (tx.card_id) {
        usedByCard[tx.card_id] = (usedByCard[tx.card_id] || 0) + Number(tx.amount);
      }
    });

    setCards(cardsData.map((c) => ({ ...c, usedAmount: usedByCard[c.id] || 0 })));
  };

  useEffect(() => { fetchCards(); }, [user]);

  const resetForm = () => {
    setName(""); setLastDigits(""); setBrand(""); setLimit("");
    setClosingDay("1"); setDueDay("10"); setColor("#3b82f6"); setEditingId(null);
  };

  const openEdit = (card: Card) => {
    setEditingId(card.id);
    setName(card.name);
    setLastDigits(card.last_digits || "");
    setBrand(card.brand || "");
    setLimit(String(card.credit_limit || ""));
    setClosingDay(String(card.closing_day));
    setDueDay(String(card.due_day));
    setColor(card.color);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    const payload = {
      name: name.trim(),
      last_digits: lastDigits || null,
      brand: brand || null,
      credit_limit: parseFloat(limit.replace(",", ".")) || 0,
      closing_day: parseInt(closingDay) || 1,
      due_day: parseInt(dueDay) || 10,
      color,
    };
    if (editingId) {
      const { error } = await supabase.from("cards").update(payload).eq("id", editingId);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Cartão atualizado!");
    } else {
      const { error } = await supabase.from("cards").insert({ ...payload, user_id: user!.id });
      if (error) { toast.error("Erro ao salvar"); return; }
      toast.success("Cartão adicionado!");
    }
    setOpen(false);
    resetForm();
    fetchCards();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("cards").delete().eq("id", id);
    toast.success("Removido");
    fetchCards();
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Determine if a color is light (for text contrast)
  const isLight = (hex: string) => {
    const c = hex.replace("#", "");
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 160;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Cartões</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>{editingId ? "Editar Cartão" : "Novo Cartão"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank" className="bg-muted" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Últimos 4 dígitos</Label>
                  <Input value={lastDigits} onChange={(e) => setLastDigits(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Bandeira</Label>
                  <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Visa" className="bg-muted" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Limite (R$)</Label>
                <Input value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="5000" className="bg-muted" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Dia fechamento</Label>
                  <Input type="number" min="1" max="31" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Dia vencimento</Label>
                  <Input type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} className="bg-muted" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full transition-transform border ${color === c ? "scale-110 ring-2 ring-foreground" : "border-border"}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <Button onClick={handleSave} className="w-full">{editingId ? "Atualizar" : "Salvar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {cards.length === 0 && <p className="text-muted-foreground text-sm">Nenhum cartão cadastrado</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((card) => {
          const used = card.usedAmount || 0;
          const limitVal = Number(card.credit_limit) || 0;
          const available = Math.max(0, limitVal - used);
          const usedPct = limitVal > 0 ? Math.min(100, (used / limitVal) * 100) : 0;
          const textColor = isLight(card.color) ? "#1e293b" : "#f8fafc";
          const barBg = isLight(card.color) ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.2)";
          const barFill = usedPct > 80 ? "#ef4444" : usedPct > 50 ? "#f59e0b" : isLight(card.color) ? "#1e293b" : "#ffffff";

          return (
            <div
              key={card.id}
              className="rounded-xl p-5 relative overflow-hidden border border-white/10"
              style={{ background: `linear-gradient(135deg, ${card.color}, ${card.color}cc)`, color: textColor }}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-bold text-base">{card.name}</p>
                  <p className="text-xs opacity-70">{card.brand || "Cartão"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(card)} style={{ color: textColor }} className="opacity-60 hover:opacity-100 transition-opacity">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(card.id)} style={{ color: textColor }} className="opacity-60 hover:opacity-100 transition-opacity">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-lg tracking-widest font-mono mb-4">•••• {card.last_digits || "0000"}</p>

              {/* Limit bar */}
              {limitVal > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1 opacity-80">
                    <span>Usado: {fmt(used)}</span>
                    <span>Disponível: {fmt(available)}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: barBg }}>
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${usedPct}%`, background: barFill }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-between text-xs opacity-70">
                <span>Limite: {fmt(limitVal)}</span>
                <span>Fecha: {card.closing_day} | Vence: {card.due_day}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Cards;
