import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, PiggyBank, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

interface Saving {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string;
}

const Savings = () => {
  const { user } = useAuth();
  const [savings, setSavings] = useState<Saving[]>([]);
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"deposit" | "withdrawal">("deposit");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const fetchData = async () => {
    if (!user) return;
    const { data } = await supabase.from("savings").select("*").order("date", { ascending: true });
    setSavings(data || []);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleAdd = async () => {
    if (!desc.trim() || !amount.trim()) { toast.error("Preencha todos os campos"); return; }
    const amountNum = parseFloat(amount.replace(",", "."));
    if (isNaN(amountNum) || amountNum <= 0) { toast.error("Valor inválido"); return; }

    const { error } = await supabase.from("savings").insert({
      user_id: user!.id, description: desc.trim(), amount: amountNum, type, date,
    });
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success(type === "deposit" ? "Depósito registrado!" : "Retirada registrada!");
    setOpen(false);
    setDesc(""); setAmount("");
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("savings").delete().eq("id", id);
    toast.success("Removido");
    fetchData();
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const totalDeposits = savings.filter((s) => s.type === "deposit").reduce((sum, s) => sum + Number(s.amount), 0);
  const totalWithdrawals = savings.filter((s) => s.type === "withdrawal").reduce((sum, s) => sum + Number(s.amount), 0);
  const totalSaved = totalDeposits - totalWithdrawals;

  // Evolution chart - running balance over time
  const evolutionData = savings.reduce<{ date: string; balance: number; label: string }[]>((acc, s) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].balance : 0;
    const newBalance = s.type === "deposit" ? prev + Number(s.amount) : prev - Number(s.amount);
    acc.push({
      date: s.date,
      balance: newBalance,
      label: new Date(s.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    });
    return acc;
  }, []);

  // Monthly summary for bar chart
  const monthlyMap = new Map<string, { deposits: number; withdrawals: number }>();
  savings.forEach((s) => {
    const key = s.date.substring(0, 7);
    const entry = monthlyMap.get(key) || { deposits: 0, withdrawals: 0 };
    if (s.type === "deposit") entry.deposits += Number(s.amount);
    else entry.withdrawals += Number(s.amount);
    monthlyMap.set(key, entry);
  });
  const monthlyData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, val]) => {
      const [y, m] = key.split("-");
      return {
        month: new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("pt-BR", { month: "short" }),
        deposits: val.deposits,
        withdrawals: val.withdrawals,
      };
    });

  const sortedDesc = [...savings].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Poupança</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Nova Movimentação</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="flex gap-2">
                <Button variant={type === "deposit" ? "default" : "outline"} size="sm" onClick={() => setType("deposit")} className={type === "deposit" ? "gradient-income text-foreground" : ""}>
                  Depósito
                </Button>
                <Button variant={type === "withdrawal" ? "default" : "outline"} size="sm" onClick={() => setType("withdrawal")} className={type === "withdrawal" ? "gradient-expense text-foreground" : ""}>
                  Retirada
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Reserva de emergência" className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-muted" />
              </div>
              <Button onClick={handleAdd} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Guardado</span>
            <PiggyBank className={`w-4 h-4 ${totalSaved >= 0 ? "text-income" : "text-expense"}`} />
          </div>
          <p className={`text-2xl font-bold ${totalSaved >= 0 ? "text-income" : "text-expense"}`}>{fmt(totalSaved)}</p>
        </div>
        <div className="glass rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Depósitos</span>
            <TrendingUp className="w-4 h-4 text-income" />
          </div>
          <p className="text-2xl font-bold text-income">{fmt(totalDeposits)}</p>
        </div>
        <div className="glass rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Retiradas</span>
            <TrendingDown className="w-4 h-4 text-expense" />
          </div>
          <p className="text-2xl font-bold text-expense">{fmt(totalWithdrawals)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Evolução do saldo</h3>
          {evolutionData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={evolutionData}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(160 84% 39%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(160 84% 39%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "hsl(220 18% 12%)", border: "1px solid hsl(220 14% 18%)", borderRadius: "8px", color: "hsl(210 20% 92%)" }}
                  formatter={(value: number) => fmt(value)}
                />
                <Area type="monotone" dataKey="balance" stroke="hsl(160 84% 39%)" fill="url(#colorBalance)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm">Adicione movimentações para ver o gráfico</p>
          )}
        </div>

        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Movimentação mensal</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData}>
                <XAxis dataKey="month" tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "hsl(220 18% 12%)", border: "1px solid hsl(220 14% 18%)", borderRadius: "8px", color: "hsl(210 20% 92%)" }}
                  formatter={(value: number) => fmt(value)}
                />
                <Bar dataKey="deposits" fill="hsl(160 84% 39%)" radius={[4, 4, 0, 0]} name="Depósitos" />
                <Bar dataKey="withdrawals" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} name="Retiradas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm">Sem dados</p>
          )}
        </div>
      </div>

      {/* History */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Histórico</h3>
        {sortedDesc.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma movimentação</p>}
        <div className="space-y-2">
          {sortedDesc.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-lg">{s.type === "deposit" ? "💰" : "💸"}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{s.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.type === "deposit" ? "Depósito" : "Retirada"} · {new Date(s.date + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${s.type === "deposit" ? "text-income" : "text-expense"}`}>
                  {s.type === "deposit" ? "+" : "-"}{fmt(Number(s.amount))}
                </span>
                <button onClick={() => handleDelete(s.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Savings;
