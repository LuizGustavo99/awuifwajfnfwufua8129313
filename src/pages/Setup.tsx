import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, UserPlus } from "lucide-react";
import { toast } from "sonner";

const toEmail = (username: string) =>
  `${username.toLowerCase().replace(/\s+/g, ".")}@fincontrol.local`;

const Setup = () => {
  const [users, setUsers] = useState([
    { name: "", password: "" },
    { name: "", password: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(0);

  const handleCreate = async () => {
    for (const u of users) {
      if (!u.name.trim() || !u.password.trim()) {
        toast.error("Preencha todos os campos dos 2 usuários");
        return;
      }
      if (u.password.length < 6) {
        toast.error("A senha deve ter no mínimo 6 caracteres");
        return;
      }
    }

    if (users[0].name.trim().toLowerCase() === users[1].name.trim().toLowerCase()) {
      toast.error("Os nomes de usuário devem ser diferentes");
      return;
    }

    setLoading(true);
    let count = 0;
    for (const u of users) {
      const email = toEmail(u.name.trim());
      const { error } = await supabase.auth.signUp({
        email,
        password: u.password,
        options: { data: { display_name: u.name.trim() } },
      });
      if (error) {
        toast.error(`Erro ao criar ${u.name}: ${error.message}`);
      } else {
        count++;
      }
    }
    setCreated(count);
    if (count === 2) {
      toast.success("Usuários criados! Faça login para continuar.");
      await supabase.auth.signOut();
    }
    setLoading(false);
  };

  if (created === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="mx-auto w-16 h-16 rounded-2xl gradient-accent flex items-center justify-center">
            <Wallet className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Usuários criados com sucesso!</h2>
          <p className="text-muted-foreground">Recarregue a página e faça login.</p>
          <Button onClick={() => window.location.reload()}>Ir para Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-2xl gradient-accent flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Configuração Inicial</h1>
          <p className="text-muted-foreground text-sm">Crie os 2 usuários que usarão o sistema</p>
        </div>

        <div className="space-y-4">
          {users.map((user, i) => (
            <div key={i} className="glass rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <UserPlus className="w-4 h-4 text-primary" />
                Usuário {i + 1}
              </div>
              <div className="space-y-2">
                <Label>Nome de usuário</Label>
                <Input
                  placeholder="Ex: Luiz"
                  value={user.name}
                  onChange={(e) => {
                    const copy = [...users];
                    copy[i].name = e.target.value;
                    setUsers(copy);
                  }}
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input
                  type="password"
                  placeholder="Min. 6 caracteres"
                  value={user.password}
                  onChange={(e) => {
                    const copy = [...users];
                    copy[i].password = e.target.value;
                    setUsers(copy);
                  }}
                  className="bg-muted border-border"
                />
              </div>
            </div>
          ))}
        </div>

        <Button onClick={handleCreate} className="w-full" disabled={loading}>
          {loading ? "Criando..." : "Criar Usuários"}
        </Button>
      </div>
    </div>
  );
};

export default Setup;
