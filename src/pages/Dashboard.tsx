import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string;
  category_id: string | null;
  card_id: string | null;
}

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface Card {
  id: string;
  name: string;
  credit_limit: number;
  color: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [savingsTotal, setSavingsTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split("T")[0];

      const [txRes, allTxRes, catRes, savRes, cardRes] = await Promise.all([
        supabase.from("transactions").select("*").gte("date", startOfMonth).lte("date", endOfMonth).order("date", { ascending: false }),
        supabase.from("transactions").select("*").gte("date", sixMonthsAgo).order("date", { ascending: false }),
        supabase.from("categories").select("*"),
        supabase.from("savings").select("amount, type"),
        supabase.from("cards").select("id, name, credit_limit, color"),
      ]);
      setTransactions(txRes.data || []);
      setAllTransactions(allTxRes.data || []);
      setCategories(catRes.data || []);
      setCards(cardRes.data || []);

      const savData = savRes.data || [];
      const total = savData.reduce((sum, s) => sum + (s.type === "deposit" ? Number(s.amount) : -Number(s.amount)), 0);
      setSavingsTotal(total);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  const expenseByCategory = categories
    .map((cat) => ({
      name: cat.name,
      value: transactions.filter((t) => t.type === "expense" && t.category_id === cat.id).reduce((s, t) => s + Number(t.amount), 0),
      color: cat.color,
    }))
    .filter((c) => c.value > 0);

  // Card limit usage (current month)
  const cardLimitData = cards
    .filter((c) => Number(c.credit_limit) > 0)
    .map((card) => {
      const used = transactions
        .filter((t) => t.type === "expense" && t.card_id === card.id)
        .reduce((s, t) => s + Number(t.amount), 0);
      const limit = Number(card.credit_limit);
      const available = Math.max(0, limit - used);
      return { name: card.name, usado: used, disponível: available, color: card.color };
    });

  // Monthly evolution (last 6 months)
  const now = new Date();
  const monthlyEvolution = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthTx = allTransactions.filter((t) => t.date.startsWith(monthKey));
    const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return {
      month: d.toLocaleDateString("pt-BR", { month: "short" }),
      income,
      expense,
      balance: income - expense,
    };
  });

  // Last 7 days chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split("T")[0];
    const dayTx = transactions.filter((t) => t.date === dateStr);
    return {
      day: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      income: dayTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
      expense: dayTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0),
    };
  });

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const tooltipStyle = { background: "hsl(220 18% 12%)", border: "1px solid hsl(220 14% 18%)", borderRadius: "8px", color: "hsl(210 20% 92%)" };

  const summaryCards = [
    { label: "Receitas", value: totalIncome, icon: TrendingUp, className: "text-income" },
    { label: "Despesas", value: totalExpense, icon: TrendingDown, className: "text-expense" },
    { label: "Saldo", value: balance, icon: Wallet, className: balance >= 0 ? "text-income" : "text-expense" },
    { label: "Guardado", value: savingsTotal, icon: PiggyBank, className: "text-accent" },
  ];

  const recentTx = transactions.slice(0, 5);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass rounded-xl p-5 h-24 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-foreground">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {summaryCards.map((c) => (
          <div key={c.label} className="glass rounded-xl p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm text-muted-foreground">{c.label}</span>
              <c.icon className={`w-4 h-4 ${c.className}`} />
            </div>
            <p className={`text-lg sm:text-2xl font-bold ${c.className}`}>{fmt(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Evolução mensal (6 meses)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyEvolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
              <XAxis dataKey="month" tick={{ fill: "hsl(215 12% 50%)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => fmt(value)} />
              <Line type="monotone" dataKey="income" stroke="hsl(160 84% 39%)" strokeWidth={2} dot={{ r: 4, fill: "hsl(160 84% 39%)" }} name="Receitas" />
              <Line type="monotone" dataKey="expense" stroke="hsl(0 72% 51%)" strokeWidth={2} dot={{ r: 4, fill: "hsl(0 72% 51%)" }} name="Despesas" />
              <Line type="monotone" dataKey="balance" stroke="hsl(200 80% 50%)" strokeWidth={2} dot={{ r: 4, fill: "hsl(200 80% 50%)" }} name="Saldo" strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Despesas por categoria</h3>
          {expenseByCategory.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                    {expenseByCategory.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => fmt(value)} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {expenseByCategory.map((c) => (
                  <div key={c.name} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full" style={{ background: c.color }} />
                    <span className="text-muted-foreground">{c.name}</span>
                    <span className="text-foreground font-medium">{fmt(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Sem dados este mês</p>
          )}
        </div>
      </div>

      {/* Card limit usage chart */}
      {cardLimitData.length > 0 && (
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Limite dos cartões (este mês)</h3>
          <ResponsiveContainer width="100%" height={cardLimitData.length * 60 + 20}>
            <BarChart data={cardLimitData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fill: "hsl(215 12% 50%)", fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => fmt(value)} />
              <Bar dataKey="usado" name="Usado" stackId="a" radius={[0, 0, 0, 0]} fill="hsl(0 72% 51%)" />
              <Bar dataKey="disponível" name="Disponível" stackId="a" radius={[4, 4, 4, 4]} fill="hsl(160 84% 39%)" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-sm bg-expense" />Usado
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-sm bg-income" />Disponível
            </div>
          </div>
        </div>
      )}

      {/* Charts row 2 */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Últimos 7 dias</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={last7Days}>
            <XAxis dataKey="day" tick={{ fill: "hsl(215 12% 50%)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => fmt(value)} />
            <Bar dataKey="income" fill="hsl(160 84% 39%)" radius={[4, 4, 0, 0]} name="Receitas" />
            <Bar dataKey="expense" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} name="Despesas" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent transactions */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Transações recentes</h3>
        {recentTx.length > 0 ? (
          <div className="space-y-3">
            {recentTx.map((tx) => {
              const cat = categories.find((c) => c.id === tx.category_id);
              return (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{cat?.icon || "📦"}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {cat?.name || "Sem categoria"} · {new Date(tx.date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${tx.type === "income" ? "text-income" : "text-expense"}`}>
                    {tx.type === "income" ? "+" : "-"}{fmt(Number(tx.amount))}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Nenhuma transação este mês</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
