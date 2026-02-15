import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface FixedEntry {
  id: string;
  description: string;
  amount: number;
  type: string;
  day_of_month: number;
  is_active: boolean;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
}

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const [entries, setEntries] = useState<FixedEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [categoryId, setCategoryId] = useState("");

  const fetchData = async () => {
    if (!user) return;
    const [fRes, cRes] = await Promise.all([
      supabase.from("fixed_entries").select("*").order("day_of_month"),
      supabase.from("categories").select("*"),
    ]);
    setEntries(fRes.data || []);
    setCategories(cRes.data || []);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleAdd = async () => {
    if (!desc.trim() || !amount.trim()) { toast.error("Preencha todos os campos"); return; }
    const amountNum = parseFloat(amount.replace(",", "."));
    if (isNaN(amountNum)) { toast.error("Valor inválido"); return; }

    const { error } = await supabase.from("fixed_entries").insert({
      user_id: user!.id,
      description: desc.trim(),
      amount: amountNum,
      type,
      day_of_month: parseInt(dayOfMonth) || 1,
      category_id: categoryId || null,
    });
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Lançamento fixo adicionado!");
    setOpen(false);
    setDesc(""); setAmount("");
    fetchData();
  };

  const toggleActive = async (entry: FixedEntry) => {
    await supabase.from("fixed_entries").update({ is_active: !entry.is_active }).eq("id", entry.id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("fixed_entries").delete().eq("id", id);
    toast.success("Removido");
    fetchData();
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const filteredCats = categories.filter((c) => c.type === type);

  const fixedIncome = entries.filter((e) => e.type === "income" && e.is_active).reduce((s, e) => s + Number(e.amount), 0);
  const fixedExpense = entries.filter((e) => e.type === "expense" && e.is_active).reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-foreground">Configurações</h1>

      {/* Fixed summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Receita fixa mensal</p>
          <p className="text-lg font-bold text-income">{fmt(fixedIncome)}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Despesa fixa mensal</p>
          <p className="text-lg font-bold text-expense">{fmt(fixedExpense)}</p>
        </div>
      </div>

      {/* Fixed entries */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Lançamentos Fixos</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" />Novo</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Novo Lançamento Fixo</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="flex gap-2">
                <Button variant={type === "expense" ? "default" : "outline"} size="sm" onClick={() => setType("expense")} className={type === "expense" ? "gradient-expense text-foreground" : ""}>Despesa</Button>
                <Button variant={type === "income" ? "default" : "outline"} size="sm" onClick={() => setType("income")} className={type === "income" ? "gradient-income text-foreground" : ""}>Receita</Button>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Aluguel" className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Dia do mês</Label>
                <Input type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="bg-muted"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {filteredCats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {entries.length === 0 && <p className="text-muted-foreground text-xs">Nenhum lançamento fixo</p>}
        {entries.map((entry) => {
          const cat = categories.find((c) => c.id === entry.category_id);
          return (
            <div key={entry.id} className={`glass rounded-xl p-4 flex items-center justify-between glass-hover ${!entry.is_active ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-3">
                <RefreshCw className={`w-4 h-4 ${entry.type === "income" ? "text-income" : "text-expense"}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">{entry.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {cat?.name || "Sem cat."} · Dia {entry.day_of_month}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${entry.type === "income" ? "text-income" : "text-expense"}`}>
                  {fmt(Number(entry.amount))}
                </span>
                <Switch checked={entry.is_active} onCheckedChange={() => toggleActive(entry)} />
                <button onClick={() => handleDelete(entry.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Account */}
      <div className="pt-4 border-t border-border">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Conta</h2>
        <p className="text-sm text-foreground mb-3">{user?.email}</p>
        <Button variant="outline" size="sm" onClick={signOut} className="text-destructive">Sair da conta</Button>
      </div>
    </div>
  );
};

export default SettingsPage;
