import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, CreditCard } from "lucide-react";
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
}

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#ef4444", "#6366f1"];

const Cards = () => {
  const { user } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [lastDigits, setLastDigits] = useState("");
  const [brand, setBrand] = useState("");
  const [limit, setLimit] = useState("");
  const [closingDay, setClosingDay] = useState("1");
  const [dueDay, setDueDay] = useState("10");
  const [color, setColor] = useState("#3b82f6");

  const fetchCards = async () => {
    if (!user) return;
    const { data } = await supabase.from("cards").select("*").order("name");
    setCards(data || []);
  };

  useEffect(() => { fetchCards(); }, [user]);

  const handleAdd = async () => {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    const { error } = await supabase.from("cards").insert({
      user_id: user!.id,
      name: name.trim(),
      last_digits: lastDigits || null,
      brand: brand || null,
      credit_limit: parseFloat(limit.replace(",", ".")) || 0,
      closing_day: parseInt(closingDay) || 1,
      due_day: parseInt(dueDay) || 10,
      color,
    });
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Cartão adicionado!");
    setOpen(false);
    setName(""); setLastDigits(""); setBrand(""); setLimit("");
    fetchCards();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("cards").delete().eq("id", id);
    toast.success("Removido");
    fetchCards();
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Cartões</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Novo Cartão</DialogTitle></DialogHeader>
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
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full transition-transform ${color === c ? "scale-110 ring-2 ring-foreground" : ""}`} style={{ background: c }} />
                  ))}
                </div>
              </div>
              <Button onClick={handleAdd} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {cards.length === 0 && <p className="text-muted-foreground text-sm">Nenhum cartão cadastrado</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((card) => (
          <div key={card.id} className="rounded-xl p-5 text-foreground relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${card.color}, ${card.color}88)` }}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="font-bold">{card.name}</p>
                <p className="text-xs opacity-80">{card.brand || "Cartão"}</p>
              </div>
              <button onClick={() => handleDelete(card.id)} className="opacity-60 hover:opacity-100 transition-opacity">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-lg tracking-widest font-mono mb-4">•••• {card.last_digits || "0000"}</p>
            <div className="flex justify-between text-xs opacity-80">
              <span>Limite: {fmt(Number(card.credit_limit))}</span>
              <span>Fecha: {card.closing_day} | Vence: {card.due_day}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Cards;
