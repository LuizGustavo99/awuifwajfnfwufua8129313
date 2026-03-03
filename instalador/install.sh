#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════
#  FinControl – Instalador Automático para Linux / CasaOS
#  Requisitos: curl, git  (Docker será instalado se necessário)
# ══════════════════════════════════════════════════════════════

COLOR_GREEN="\033[1;32m"
COLOR_YELLOW="\033[1;33m"
COLOR_RED="\033[1;31m"
COLOR_RESET="\033[0m"

info()  { echo -e "${COLOR_GREEN}[✔]${COLOR_RESET} $*"; }
warn()  { echo -e "${COLOR_YELLOW}[!]${COLOR_RESET} $*"; }
error() { echo -e "${COLOR_RED}[✖]${COLOR_RESET} $*"; exit 1; }

INSTALL_DIR="${INSTALL_DIR:-$HOME/fincontrol}"
REPO_URL="${REPO_URL:-}"  # Será preenchido interativamente se vazio

# ─── 1. Verificar / instalar Docker ──────────────────────────
install_docker() {
  if command -v docker &>/dev/null; then
    info "Docker já instalado: $(docker --version)"
  else
    warn "Docker não encontrado. Instalando..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker "$USER"
    info "Docker instalado. Pode ser necessário reiniciar a sessão."
  fi

  if command -v docker compose &>/dev/null || docker compose version &>/dev/null 2>&1; then
    info "Docker Compose disponível."
  else
    warn "Instalando Docker Compose plugin..."
    sudo apt-get update -qq && sudo apt-get install -y docker-compose-plugin
    info "Docker Compose instalado."
  fi
}

# ─── 2. Verificar / instalar Node.js ─────────────────────────
install_node() {
  if command -v node &>/dev/null; then
    info "Node.js já instalado: $(node --version)"
  else
    warn "Node.js não encontrado. Instalando via NodeSource (LTS)..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    info "Node.js instalado: $(node --version)"
  fi
}

# ─── 3. Clonar ou atualizar repositório ──────────────────────
setup_repo() {
  if [ -d "$INSTALL_DIR/.git" ]; then
    info "Repositório encontrado em $INSTALL_DIR. Atualizando..."
    cd "$INSTALL_DIR"
    git pull --ff-only || warn "git pull falhou; usando versão atual."
  else
    if [ -z "$REPO_URL" ]; then
      read -rp "$(echo -e "${COLOR_YELLOW}Cole a URL do repositório Git:${COLOR_RESET} ")" REPO_URL
    fi
    [ -z "$REPO_URL" ] && error "URL do repositório é obrigatória."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    info "Repositório clonado em $INSTALL_DIR"
  fi
}

# ─── 4. Configurar variáveis ─────────────────────────────────
configure_env() {
  ENV_FILE="$INSTALL_DIR/instalador/.env"

  if [ -f "$ENV_FILE" ]; then
    info "Arquivo .env já existe. Pulando configuração."
    return
  fi

  echo ""
  warn "Configuração inicial (pressione Enter para usar os padrões)"

  read -rp "Senha do banco de dados [FinControl2026!]: " DB_PASS
  DB_PASS="${DB_PASS:-FinControl2026!}"

  read -rp "JWT Secret (mínimo 32 caracteres) [auto]: " JWT
  if [ -z "$JWT" ]; then
    JWT=$(openssl rand -base64 48 | tr -d '=/+' | head -c 64)
  fi

  # Detectar IP local
  LOCAL_IP=$(hostname -I | awk '{print $1}')
  read -rp "IP do servidor [$LOCAL_IP]: " SERVER_IP
  SERVER_IP="${SERVER_IP:-$LOCAL_IP}"

  cat > "$ENV_FILE" <<EOF
DB_PASSWORD=$DB_PASS
JWT_SECRET=$JWT
SITE_URL=http://$SERVER_IP:8080
API_EXTERNAL_URL=http://$SERVER_IP:8000
EOF

  info "Configuração salva em $ENV_FILE"
}

# ─── 5. Build da aplicação ────────────────────────────────────
build_app() {
  cd "$INSTALL_DIR"

  # Ler IP do .env
  source "$INSTALL_DIR/instalador/.env" 2>/dev/null || true

  # Criar .env para o Vite
  cat > .env.local <<EOF
VITE_SUPABASE_URL=${API_EXTERNAL_URL:-http://localhost:8000}
VITE_SUPABASE_PUBLISHABLE_KEY=local
VITE_SUPABASE_PROJECT_ID=local
EOF

  info "Instalando dependências..."
  npm ci --silent

  info "Fazendo build de produção..."
  npm run build

  # Copiar dist para pasta do instalador
  rm -rf "$INSTALL_DIR/instalador/dist"
  cp -r "$INSTALL_DIR/dist" "$INSTALL_DIR/instalador/dist"

  info "Build concluído e copiado para instalador/dist"
}

# ─── 6. Gerar SQL de inicialização ───────────────────────────
generate_init_sql() {
  INIT_SQL="$INSTALL_DIR/instalador/init-db.sql"

  if [ -f "$INIT_SQL" ]; then
    info "init-db.sql já existe. Pulando."
    return
  fi

  info "Gerando script SQL de inicialização..."

  cat > "$INIT_SQL" <<'SQLEOF'
-- FinControl – Schema Inicial
-- Executado automaticamente na primeira inicialização do PostgreSQL

-- Roles para PostgREST
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Enum de roles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

-- Tabela de roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Tabela de categorias
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de cartões
CREATE TABLE IF NOT EXISTS public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  last_digits TEXT,
  credit_limit NUMERIC,
  closing_day INTEGER,
  due_day INTEGER,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de transações
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID REFERENCES public.categories(id),
  card_id UUID REFERENCES public.cards(id),
  is_recurring BOOLEAN DEFAULT false,
  is_installment BOOLEAN DEFAULT false,
  current_installment INTEGER,
  total_installments INTEGER,
  installment_group_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de poupança
CREATE TABLE IF NOT EXISTS public.savings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de lançamentos fixos
CREATE TABLE IF NOT EXISTS public.fixed_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  day_of_month INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Função has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

SQLEOF

  info "init-db.sql gerado."
}

# ─── 7. Configurar backup automático ─────────────────────────
setup_backup() {
  BACKUP_SCRIPT="$INSTALL_DIR/instalador/backup.sh"
  chmod +x "$BACKUP_SCRIPT"

  # Verificar se o cron já existe
  if crontab -l 2>/dev/null | grep -q "fincontrol.*backup.sh"; then
    info "Cron de backup já configurado."
  else
    # Agendar para sábado às 12h
    (crontab -l 2>/dev/null; echo "0 12 * * 6 $BACKUP_SCRIPT >> $INSTALL_DIR/instalador/backups/cron.log 2>&1") | crontab -
    info "Backup automático agendado: sábados às 12h (máx 3 backups)"
  fi

  mkdir -p "$INSTALL_DIR/instalador/backups"
  info "Diretório de backups: $INSTALL_DIR/instalador/backups/"
}

# ─── 8. Subir containers ─────────────────────────────────────
start_services() {
  cd "$INSTALL_DIR/instalador"

  info "Subindo serviços Docker..."
  docker compose --env-file .env up -d

  echo ""
  info "═══════════════════════════════════════════════════"
  info "  FinControl instalado com sucesso! 🎉"
  info "═══════════════════════════════════════════════════"
  echo ""
  info "  🌐 Aplicação:  http://$SERVER_IP:8080"
  info "  🔌 API REST:   http://$SERVER_IP:8000/rest/v1/"
  info "  🔐 Auth:       http://$SERVER_IP:8000/auth/v1/"
  info "  🗄️  PostgreSQL: $SERVER_IP:5432"
  info "  💾 Backups:    Sábados às 12h (máx 3)"
  echo ""
  warn "  Para acesso externo, configure Cloudflare Tunnel"
  warn "  ou Tailscale. Veja o guia em public/guia-deploy-casaos.md"
  echo ""
}

# ─── MAIN ─────────────────────────────────────────────────────
main() {
  echo ""
  echo "════════════════════════════════════════════════════"
  echo "   FinControl – Instalador Automático v1.0"
  echo "════════════════════════════════════════════════════"
  echo ""

  install_docker
  install_node
  setup_repo
  configure_env
  generate_init_sql
  build_app
  setup_backup
  start_services
}

main "$@"
