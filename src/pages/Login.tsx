import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

const toEmail = (username: string) =>
  `${username.toLowerCase().replace(/\s+/g, ".")}@fincontrol.local`;

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    setLoading(true);
    const email = toEmail(username.trim());
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error("Usuário ou senha inválidos");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-2xl gradient-accent flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">FinControl</h1>
          <p className="text-muted-foreground text-sm">Controle financeiro pessoal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 glass rounded-xl p-6">
          <div className="space-y-2">
            <Label htmlFor="username">Usuário</Label>
            <Input
              id="username"
              type="text"
              placeholder="Seu nome de usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-muted border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-muted border-border"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
