import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, RefreshCw, Pencil, User, Lock, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

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

interface ManagedUser {
  id: string;
  email: string;
  display_name: string;
}

const SettingsPage = () => {
  const { user, signOut, isAdmin } = useAuth();
  const [entries, setEntries] = useState<FixedEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [categoryId, setCategoryId] = useState("");

  // User edit
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingUser, setUpdatingUser] = useState(false);

  // Admin: manage users
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserConfirmPassword, setNewUserConfirmPassword] = useState("");
  const [savingUser, setSavingUser] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    const [fRes, cRes] = await Promise.all([
      supabase.from("fixed_entries").select("*").order("day_of_month"),
      supabase.from("categories").select("*"),
    ]);
    setEntries(fRes.data || []);
    setCategories(cRes.data || []);
  };

  const fetchUsers = async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "list" },
    });
    if (!error && data?.users) {
      setManagedUsers(data.users);
    }
  };

  useEffect(() => {
    fetchData();
    if (user) setNewDisplayName(user.user_metadata?.display_name || "");
  }, [user]);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  const resetForm = () => {
    setDesc(""); setAmount(""); setType("expense"); setDayOfMonth("1"); setCategoryId(""); setEditingId(null);
  };

  const openEdit = (entry: FixedEntry) => {
    setEditingId(entry.id);
    setDesc(entry.description);
    setAmount(String(entry.amount));
    setType(entry.type as "income" | "expense");
    setDayOfMonth(String(entry.day_of_month));
    setCategoryId(entry.category_id || "");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!desc.trim() || !amount.trim()) { toast.error("Preencha todos os campos"); return; }
    const amountNum = parseFloat(amount.replace(",", "."));
    if (isNaN(amountNum)) { toast.error("Valor inválido"); return; }

    const payload = {
      description: desc.trim(),
      amount: amountNum,
      type,
      day_of_month: parseInt(dayOfMonth) || 1,
      category_id: categoryId || null,
    };

    if (editingId) {
      const { error } = await supabase.from("fixed_entries").update(payload).eq("id", editingId);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Lançamento fixo atualizado!");
    } else {
      const { error } = await supabase.from("fixed_entries").insert({ ...payload, user_id: user!.id });
      if (error) { toast.error("Erro ao salvar"); return; }
      toast.success("Lançamento fixo adicionado!");
    }
    setOpen(false);
    resetForm();
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

  const handleUpdateUser = async () => {
    setUpdatingUser(true);
    try {
      if (newPassword) {
        if (newPassword.length < 6) { toast.error("A senha deve ter no mínimo 6 caracteres"); return; }
        if (newPassword !== confirmPassword) { toast.error("As senhas não coincidem"); return; }
        const { error } = await supabase.auth.updateUser({ password: newPassword, data: { display_name: newDisplayName.trim() } });
        if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
        toast.success("Usuário e senha atualizados!");
      } else {
        const { error } = await supabase.auth.updateUser({ data: { display_name: newDisplayName.trim() } });
        if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
        toast.success("Nome atualizado!");
      }
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setUpdatingUser(false);
    }
  };

  // Admin: create or update user via edge function
  const handleSaveUser = async () => {
    if (!newUserName.trim()) { toast.error("Preencha o nome do usuário"); return; }
    
    if (editingUserId) {
      // Update existing user
      if (newUserPassword && newUserPassword !== newUserConfirmPassword) {
        toast.error("As senhas não coincidem"); return;
      }
      if (newUserPassword && newUserPassword.length < 6) {
        toast.error("A senha deve ter no mínimo 6 caracteres"); return;
      }
      setSavingUser(true);
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "update",
          user_id: editingUserId,
          display_name: newUserName.trim(),
          password: newUserPassword || undefined,
        },
      });
      setSavingUser(false);
      if (error || data?.error) { toast.error(data?.error || "Erro ao atualizar usuário"); return; }
      toast.success("Usuário atualizado!");
    } else {
      // Create new user
      if (!newUserPassword || newUserPassword.length < 6) {
        toast.error("A senha deve ter no mínimo 6 caracteres"); return;
      }
      if (newUserPassword !== newUserConfirmPassword) {
        toast.error("As senhas não coincidem"); return;
      }
      setSavingUser(true);
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "create",
          display_name: newUserName.trim(),
          password: newUserPassword,
        },
      });
      setSavingUser(false);
      if (error || data?.error) { toast.error(data?.error || "Erro ao criar usuário"); return; }
      toast.success("Usuário criado!");
    }
    setUserDialogOpen(false);
    resetUserForm();
    fetchUsers();
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === user?.id) { toast.error("Você não pode excluir seu próprio usuário"); return; }
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "delete", user_id: userId },
    });
    if (error || data?.error) { toast.error(data?.error || "Erro ao excluir"); return; }
    toast.success("Usuário removido");
    fetchUsers();
  };

  const openEditUser = (u: ManagedUser) => {
    setEditingUserId(u.id);
    setNewUserName(u.display_name);
    setNewUserPassword("");
    setNewUserConfirmPassword("");
    setUserDialogOpen(true);
  };

  const resetUserForm = () => {
    setEditingUserId(null);
    setNewUserName("");
    setNewUserPassword("");
    setNewUserConfirmPassword("");
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const filteredCats = categories.filter((c) => c.type === type);

  const fixedIncome = entries.filter((e) => e.type === "income" && e.is_active).reduce((s, e) => s + Number(e.amount), 0);
  const fixedExpense = entries.filter((e) => e.type === "expense" && e.is_active).reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-foreground">Configurações</h1>

      {/* User profile edit */}
      <div className="glass rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2"><User className="w-4 h-4" /> Minha Conta</h2>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nome de exibição</Label>
            <Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="Seu nome" className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Lock className="w-3 h-3" /> Nova senha (deixe em branco para manter)</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="bg-muted" />
          </div>
          {newPassword && (
            <div className="space-y-2">
              <Label>Confirmar nova senha</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="bg-muted" />
            </div>
          )}
          <Button onClick={handleUpdateUser} disabled={updatingUser} size="sm">
            {updatingUser ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </div>

      {/* Admin: User management */}
      {isAdmin && (
        <div className="glass rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="w-4 h-4" /> Gerenciar Usuários</h2>
            <Dialog open={userDialogOpen} onOpenChange={(v) => { setUserDialogOpen(v); if (!v) resetUserForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><UserPlus className="w-4 h-4 mr-1" />Novo</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle>{editingUserId ? "Editar Usuário" : "Novo Usuário"}</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Nome de usuário</Label>
                    <Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Ex: João" className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>{editingUserId ? "Nova senha (deixe em branco para manter)" : "Senha"}</Label>
                    <Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Min. 6 caracteres" className="bg-muted" />
                  </div>
                  {(newUserPassword || !editingUserId) && (
                    <div className="space-y-2">
                      <Label>Confirmar senha</Label>
                      <Input type="password" value={newUserConfirmPassword} onChange={(e) => setNewUserConfirmPassword(e.target.value)} placeholder="••••••••" className="bg-muted" />
                    </div>
                  )}
                  <Button onClick={handleSaveUser} className="w-full" disabled={savingUser}>
                    {savingUser ? "Salvando..." : editingUserId ? "Atualizar" : "Criar Usuário"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="space-y-2">
            {managedUsers.map((u) => (
              <div key={u.id} className="glass rounded-xl p-4 flex items-center justify-between glass-hover">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.display_name}</p>
                    <p className="text-xs text-muted-foreground">{u.id === user?.id ? "Você (admin)" : "Usuário"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEditUser(u)} className="text-muted-foreground hover:text-primary transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {u.id !== user?.id && (
                    <button onClick={() => handleDeleteUser(u.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" />Novo</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>{editingId ? "Editar Lançamento Fixo" : "Novo Lançamento Fixo"}</DialogTitle></DialogHeader>
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
              <Button onClick={handleSave} className="w-full">{editingId ? "Atualizar" : "Salvar"}</Button>
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
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => openEdit(entry)}>
                <RefreshCw className={`w-4 h-4 ${entry.type === "income" ? "text-income" : "text-expense"}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">{entry.description}</p>
                  <p className="text-xs text-muted-foreground">{cat?.name || "Sem cat."} · Dia {entry.day_of_month}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${entry.type === "income" ? "text-income" : "text-expense"}`}>{fmt(Number(entry.amount))}</span>
                <button onClick={() => openEdit(entry)} className="text-muted-foreground hover:text-primary transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
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
        <Button variant="outline" size="sm" onClick={signOut} className="text-destructive">Sair da conta</Button>
      </div>
    </div>
  );
};

export default SettingsPage;
