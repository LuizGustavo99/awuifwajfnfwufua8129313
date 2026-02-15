import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string;
  category_id: string | null;
  card_id: string | null;
  is_installment: boolean;
  total_installments: number;
  current_installment: number;
  installment_group_id: string | null;
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
}

interface Card {
  id: string;
  name: string;
}

const Transactions = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [open, setOpen] = useState(false);
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Form state
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState("");
  const [cardId, setCardId] = useState("");
  const [isInstallment, setIsInstallment] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState("2");

  const fetchData = async () => {
    if (!user) return;
    const [y, m] = filterMonth.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString().split("T")[0];
    const end = new Date(y, m, 0).toISOString().split("T")[0];

    const [txRes, catRes, cardRes] = await Promise.all([
      supabase.from("transactions").select("*").gte("date", start).lte("date", end).order("date", { ascending: false }),
      supabase.from("categories").select("*"),
      supabase.from("cards").select("*"),
    ]);
    setTransactions(txRes.data || []);
    setCategories(catRes.data || []);
    setCards(cardRes.data || []);
  };

  useEffect(() => {
    fetchData();
  }, [user, filterMonth]);

  const handleAdd = async () => {
    if (!desc.trim() || !amount.trim()) {
      toast.error("Preencha descrição e valor");
      return;
    }
    const amountNum = parseFloat(amount.replace(",", "."));
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Valor inválido");
      return;
    }

    if (isInstallment && parseInt(totalInstallments) > 1) {
      const groupId = crypto.randomUUID();
      const total = parseInt(totalInstallments);
      const installmentAmount = amountNum / total;
      const baseDate = new Date(date + "T00:00:00");

      const rows = Array.from({ length: total }, (_, i) => {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + i);
        return {
          user_id: user!.id,
          description: `${desc} (${i + 1}/${total})`,
          amount: Math.round(installmentAmount * 100) / 100,
          type,
          date: d.toISOString().split("T")[0],
          category_id: categoryId || null,
          card_id: cardId || null,
          is_installment: true,
          total_installments: total,
          current_installment: i + 1,
          installment_group_id: groupId,
        };
      });

      const { error } = await supabase.from("transactions").insert(rows);
      if (error) {
        toast.error("Erro ao salvar");
        return;
      }
    } else {
      const { error } = await supabase.from("transactions").insert({
        user_id: user!.id,
        description: desc,
        amount: amountNum,
        type,
        date,
        category_id: categoryId || null,
        card_id: cardId || null,
      });
      if (error) {
        toast.error("Erro ao salvar");
        return;
      }
    }

    toast.success("Transação adicionada!");
    setOpen(false);
    resetForm();
    fetchData();
  };

  const resetForm = () => {
    setDesc("");
    setAmount("");
    setType("expense");
    setDate(new Date().toISOString().split("T")[0]);
    setCategoryId("");
    setCardId("");
    setIsInstallment(false);
    setTotalInstallments("2");
  };

  const handleDelete = async (id: string) => {
    await supabase.from("transactions").delete().eq("id", id);
    toast.success("Removida");
    fetchData();
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const filteredCats = categories.filter((c) => c.type === type);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Transações</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Transação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="flex gap-2">
                <Button variant={type === "expense" ? "default" : "outline"} size="sm" onClick={() => setType("expense")} className={type === "expense" ? "gradient-expense text-foreground" : ""}>
                  Despesa
                </Button>
                <Button variant={type === "income" ? "default" : "outline"} size="sm" onClick={() => setType("income")} className={type === "income" ? "gradient-income text-foreground" : ""}>
                  Receita
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Supermercado" className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-muted" />
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
              {type === "expense" && (
                <div className="space-y-2">
                  <Label>Cartão (opcional)</Label>
                  <Select value={cardId} onValueChange={setCardId}>
                    <SelectTrigger className="bg-muted"><SelectValue placeholder="Sem cartão" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem cartão</SelectItem>
                      {cards.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={isInstallment} onCheckedChange={setIsInstallment} />
                <Label>Parcelado</Label>
              </div>
              {isInstallment && (
                <div className="space-y-2">
                  <Label>Nº de parcelas</Label>
                  <Input type="number" min="2" max="48" value={totalInstallments} onChange={(e) => setTotalInstallments(e.target.value)} className="bg-muted" />
                </div>
              )}
              <Button onClick={handleAdd} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <Input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="bg-muted w-auto"
        />
      </div>

      <div className="space-y-2">
        {transactions.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma transação neste mês</p>}
        {transactions.map((tx) => {
          const cat = categories.find((c) => c.id === tx.category_id);
          const card = cards.find((c) => c.id === tx.card_id);
          return (
            <div key={tx.id} className="glass rounded-xl p-4 flex items-center justify-between glass-hover">
              <div className="flex items-center gap-3">
                <span className="text-lg">{cat?.icon || "📦"}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {cat?.name || "Sem cat."} {card ? `· ${card.name}` : ""} · {new Date(tx.date + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${tx.type === "income" ? "text-income" : "text-expense"}`}>
                  {tx.type === "income" ? "+" : "-"}{fmt(Number(tx.amount))}
                </span>
                <button onClick={() => handleDelete(tx.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Transactions;
