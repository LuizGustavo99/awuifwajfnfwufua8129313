import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, TrendingDown, Wallet, CreditCard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      const [txRes, catRes] = await Promise.all([
        supabase.from("transactions").select("*").gte("date", startOfMonth).lte("date", endOfMonth).order("date", { ascending: false }),
        supabase.from("categories").select("*"),
      ]);
      setTransactions(txRes.data || []);
      setCategories(catRes.data || []);
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
      value: transactions
        .filter((t) => t.type === "expense" && t.category_id === cat.id)
        .reduce((s, t) => s + Number(t.amount), 0),
      color: cat.color,
    }))
    .filter((c) => c.value > 0);

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

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const cards = [
    { label: "Receitas", value: totalIncome, icon: TrendingUp, className: "text-income" },
    { label: "Despesas", value: totalExpense, icon: TrendingDown, className: "text-expense" },
    { label: "Saldo", value: balance, icon: Wallet, className: balance >= 0 ? "text-income" : "text-expense" },
  ];

  const recentTx = transactions.slice(0, 5);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="glass rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className={`w-4 h-4 ${c.className}`} />
            </div>
            <p className={`text-2xl font-bold ${c.className}`}>{fmt(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Últimos 7 dias</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={last7Days}>
              <XAxis dataKey="day" tick={{ fill: "hsl(215 12% 50%)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "hsl(220 18% 12%)", border: "1px solid hsl(220 14% 18%)", borderRadius: "8px", color: "hsl(210 20% 92%)" }}
                formatter={(value: number) => fmt(value)}
              />
              <Bar dataKey="income" fill="hsl(160 84% 39%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
            </BarChart>
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
                  <Tooltip formatter={(value: number) => fmt(value)} contentStyle={{ background: "hsl(220 18% 12%)", border: "1px solid hsl(220 14% 18%)", borderRadius: "8px", color: "hsl(210 20% 92%)" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {expenseByCategory.map((c) => (
                  <div key={c.name} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full" style={{ background: c.color }} />
                    <span className="text-muted-foreground">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Sem dados este mês</p>
          )}
        </div>
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
