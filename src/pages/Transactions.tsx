import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, Search, Filter, Download, Upload, Pencil, AlertTriangle, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { exportTransactionsCSV, parseNubankCSV } from "@/lib/csv-utils";
import { useNavigate } from "react-router-dom";

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

const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const Transactions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [open, setOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Checkup state
  const [checkupOpen, setCheckupOpen] = useState(false);
  const [checkupMessage, setCheckupMessage] = useState("");
  const [checkupTarget, setCheckupTarget] = useState<"categories" | "cards" | null>(null);

  // Import card selection
  const [importCardId, setImportCardId] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Filters
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterCard, setFilterCard] = useState("all");
  const [searchText, setSearchText] = useState("");

  // Form state
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState("");
  const [cardId, setCardId] = useState("");
  const [isInstallment, setIsInstallment] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState("2");

  // Month navigation helpers
  const [filterYear, filterMonthNum] = filterMonth.split("-").map(Number);
  const currentMonthLabel = `${monthNames[filterMonthNum - 1]} ${filterYear}`;

  const navigateMonth = (delta: number) => {
    const d = new Date(filterYear, filterMonthNum - 1 + delta, 1);
    setFilterMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

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

    const cats = catRes.data || [];
    const cds = cardRes.data || [];
    if (cats.length === 0) {
      setCheckupMessage("Você ainda não tem categorias cadastradas. Recomendamos criar categorias antes de adicionar transações para uma melhor organização.");
      setCheckupTarget("categories");
      setCheckupOpen(true);
    } else if (cds.length === 0) {
      setCheckupMessage("Você ainda não tem cartões cadastrados. Deseja cadastrar um cartão antes de registrar transações?");
      setCheckupTarget("cards");
      setCheckupOpen(true);
    }
  };

  useEffect(() => { fetchData(); }, [user, filterMonth]);

  const filtered = transactions.filter((tx) => {
    if (filterType !== "all" && tx.type !== filterType) return false;
    if (filterCategory !== "all" && tx.category_id !== filterCategory) return false;
    if (filterCard !== "all") {
      if (filterCard === "none" && tx.card_id !== null) return false;
      if (filterCard !== "none" && tx.card_id !== filterCard) return false;
    }
    if (searchText && !tx.description.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const filteredTotal = filtered.reduce((sum, tx) => {
    return sum + (tx.type === "income" ? Number(tx.amount) : -Number(tx.amount));
  }, 0);

  const resetForm = () => {
    setDesc(""); setAmount(""); setType("expense");
    setDate(new Date().toISOString().split("T")[0]);
    setCategoryId(""); setCardId("");
    setIsInstallment(false); setTotalInstallments("2");
    setEditingId(null);
  };

  const openEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setDesc(tx.description);
    setAmount(String(tx.amount));
    setType(tx.type as "income" | "expense");
    setDate(tx.date);
    setCategoryId(tx.category_id || "");
    setCardId(tx.card_id || "");
    setIsInstallment(tx.is_installment || false);
    setTotalInstallments(String(tx.total_installments || 2));
    setOpen(true);
  };

  const handleSave = async () => {
    if (!desc.trim() || !amount.trim()) { toast.error("Preencha descrição e valor"); return; }
    const amountNum = parseFloat(amount.replace(",", "."));
    if (isNaN(amountNum) || amountNum <= 0) { toast.error("Valor inválido"); return; }

    if (editingId) {
      const { error } = await supabase.from("transactions").update({
        description: desc.trim(), amount: amountNum, type, date,
        category_id: categoryId || null, card_id: cardId || null,
      }).eq("id", editingId);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Transação atualizada!");
    } else {
      if (isInstallment && parseInt(totalInstallments) > 1) {
        const groupId = crypto.randomUUID();
        const total = parseInt(totalInstallments);
        const installmentAmount = amountNum / total;
        const baseDate = new Date(date + "T00:00:00");
        const rows = Array.from({ length: total }, (_, i) => {
          const d = new Date(baseDate);
          d.setMonth(d.getMonth() + i);
          return {
            user_id: user!.id, description: `${desc} (${i + 1}/${total})`,
            amount: Math.round(installmentAmount * 100) / 100, type,
            date: d.toISOString().split("T")[0], category_id: categoryId || null,
            card_id: cardId || null, is_installment: true,
            total_installments: total, current_installment: i + 1,
            installment_group_id: groupId,
          };
        });
        const { error } = await supabase.from("transactions").insert(rows);
        if (error) { toast.error("Erro ao salvar"); return; }
      } else {
        const { error } = await supabase.from("transactions").insert({
          user_id: user!.id, description: desc, amount: amountNum, type, date,
          category_id: categoryId || null, card_id: cardId || null,
        });
        if (error) { toast.error("Erro ao salvar"); return; }
      }
      toast.success("Transação adicionada!");
    }
    setOpen(false);
    resetForm();
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("transactions").delete().eq("id", id);
    toast.success("Removida");
    fetchData();
  };

  const handleExport = () => {
    const data = filtered.map((tx) => ({
      ...tx,
      categoryName: categories.find((c) => c.id === tx.category_id)?.name || "",
      cardName: cards.find((c) => c.id === tx.card_id)?.name || "",
    }));
    const [y, m] = filterMonth.split("-");
    exportTransactionsCSV(data, `transacoes_${y}-${m}.csv`);
    toast.success("Relatório exportado!");
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setPendingFile(file);
    setImportCardId("");
    setImportDialogOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };


  const executeImport = async () => {
    if (!pendingFile || !user) return;
    setImporting(true);
    setImportDialogOpen(false);
    try {
      const text = await pendingFile.text();
      const parsedRows = parseNubankCSV(text);

      if (parsedRows.length === 0) {
        toast.error("Nenhuma transação encontrada no arquivo");
        return;
      }

      const selectedCardId = importCardId && importCardId !== "none" ? importCardId : null;
      const rows = parsedRows.map((row) => ({
        user_id: user.id, description: row.description, amount: row.amount,
        type: "expense" as const, date: row.date,
        category_id: null, card_id: selectedCardId,
      }));

      let inserted = 0;
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase.from("transactions").insert(batch);
        if (error) { toast.error(`Erro ao importar lote ${Math.floor(i / 50) + 1}`); break; }
        inserted += batch.length;
      }
      toast.success(`${inserted} transações importadas!`);
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao processar arquivo";
      toast.error(message);
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const filteredCats = categories.filter((c) => c.type === type);
  const activeFilters = [filterType !== "all", filterCategory !== "all", filterCard !== "all", searchText !== ""].filter(Boolean).length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Checkup Dialog */}
      <Dialog open={checkupOpen} onOpenChange={setCheckupOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <DialogTitle>Configuração recomendada</DialogTitle>
            </div>
            <DialogDescription className="text-muted-foreground pt-1">{checkupMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setCheckupOpen(false)} className="flex-1">Continuar assim</Button>
            <Button onClick={() => { setCheckupOpen(false); navigate(checkupTarget === "categories" ? "/categories" : "/cards"); }} className="flex-1">
              {checkupTarget === "categories" ? "Ir para Categorias" : "Ir para Cartões"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import card selection dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Importar CSV
            </DialogTitle>
            <DialogDescription>Selecione o cartão ao qual estas transações pertencem (opcional).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Cartão de crédito</Label>
            <Select value={importCardId} onValueChange={setImportCardId}>
              <SelectTrigger className="bg-muted"><SelectValue placeholder="Sem cartão (nenhum)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem cartão</SelectItem>
                {cards.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
            {pendingFile && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                <Upload className="w-4 h-4 shrink-0" />
                <span className="truncate">{pendingFile.name}</span>
                <span className="shrink-0 text-primary font-medium">CSV</span>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => { setImportDialogOpen(false); setPendingFile(null); }}>Cancelar</Button>
            <Button onClick={executeImport}>Importar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Transações</h1>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />
          <Button variant="outline" size="sm" onClick={handleImportClick} disabled={importing}>
            <Upload className="w-4 h-4 mr-1" />{importing ? "..." : "Importar"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-1" />Exportar
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? "Editar Transação" : "Nova Transação"}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="flex gap-2">
                  <Button variant={type === "expense" ? "default" : "outline"} size="sm" onClick={() => setType("expense")} className={type === "expense" ? "gradient-expense text-foreground" : ""}>Despesa</Button>
                  <Button variant={type === "income" ? "default" : "outline"} size="sm" onClick={() => setType("income")} className={type === "income" ? "gradient-income text-foreground" : ""}>Receita</Button>
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
                        {cards.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {!editingId && (
                  <>
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
                  </>
                )}
                <Button onClick={handleSave} className="w-full">{editingId ? "Atualizar" : "Salvar"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Month Selector — styled */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="glass rounded-xl flex items-center gap-1 px-1 py-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <button
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
            onClick={() => {
              const now = new Date();
              setFilterMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
            }}
            title="Ir para mês atual"
          >
            <CalendarDays className="w-4 h-4 text-primary" />
            <span>{currentMonthLabel}</span>
          </button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => navigateMonth(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className={activeFilters > 0 ? "border-primary text-primary" : ""}>
          <Filter className="w-4 h-4 mr-1" />Filtros{activeFilters > 0 ? ` (${activeFilters})` : ""}
        </Button>
      </div>

      {showFilters && (
        <div className="glass rounded-xl p-4 space-y-3 animate-fade-in">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por descrição..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="bg-muted pl-9" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="bg-muted"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="bg-muted"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filterCard} onValueChange={setFilterCard}>
              <SelectTrigger className="bg-muted"><SelectValue placeholder="Cartão" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos cartões</SelectItem>
                <SelectItem value="none">Sem cartão</SelectItem>
                {cards.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterType("all"); setFilterCategory("all"); setFilterCard("all"); setSearchText(""); }}>Limpar filtros</Button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{filtered.length} transações</span>
        <span className={`font-semibold ${filteredTotal >= 0 ? "text-income" : "text-expense"}`}>Saldo: {fmt(filteredTotal)}</span>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma transação encontrada</p>}
        {filtered.map((tx) => {
          const cat = categories.find((c) => c.id === tx.category_id);
          const card = cards.find((c) => c.id === tx.card_id);
          return (
            <div key={tx.id} className="glass rounded-xl p-4 flex items-center justify-between glass-hover">
              <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => openEdit(tx)}>
                <span className="text-lg shrink-0">{cat?.icon || "📦"}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {cat?.name || "Sem cat."} {card ? `· ${card.name}` : ""} · {new Date(tx.date + "T00:00:00").toLocaleDateString("pt-BR")}
                    {tx.is_installment && ` · ${tx.current_installment}/${tx.total_installments}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-sm font-semibold ${tx.type === "income" ? "text-income" : "text-expense"}`}>
                  {tx.type === "income" ? "+" : "-"}{fmt(Number(tx.amount))}
                </span>
                <button onClick={() => openEdit(tx)} className="text-muted-foreground hover:text-primary transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
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
