#!/usr/bin/env bash

# ══════════════════════════════════════════════════════════════
#  FinControl – Instalador Automático v3.0 para Linux / CasaOS
#  Admin pré-configurado: luiz@fincontrol.local / LGP@ss6106
#  Requisitos: curl, git
# ══════════════════════════════════════════════════════════════

set -euo pipefail

COLOR_GREEN="\033[1;32m"
COLOR_YELLOW="\033[1;33m"
COLOR_RED="\033[1;31m"
COLOR_CYAN="\033[1;36m"
COLOR_RESET="\033[0m"

info()  { echo -e "${COLOR_GREEN}[✔]${COLOR_RESET} $*"; }
warn()  { echo -e "${COLOR_YELLOW}[!]${COLOR_RESET} $*"; }
fail()  { echo -e "${COLOR_RED}[✖]${COLOR_RESET} $*"; }
step()  { echo -e "\n${COLOR_CYAN}═══ $* ═══${COLOR_RESET}\n"; }

# ─── Admin pré-configurado ────────────────────────────────────
ADMIN_EMAIL="luiz@fincontrol.local"
ADMIN_PASSWORD="LGP@ss6106"
ADMIN_NAME="Luiz"

# ─── Diretórios ───────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ ! -f "$PROJECT_DIR/package.json" ]; then
  fail "Execute este script de dentro da pasta 'instalador/' do projeto clonado."
  exit 1
fi

# ─── ETAPA 1: Verificar root/sudo ────────────────────────────
check_sudo() {
  if [ "$EUID" -eq 0 ]; then
    SUDO=""
  elif command -v sudo &>/dev/null; then
    SUDO="sudo"
  else
    fail "Este script precisa de permissões de root. Execute com: sudo ./install.sh"
    exit 1
  fi
}

# ─── ETAPA 2: Instalar Docker ────────────────────────────────
install_docker() {
  step "ETAPA 1/8 — Docker"

  if command -v docker &>/dev/null; then
    info "Docker já instalado: $(docker --version)"
  else
    warn "Docker não encontrado. Instalando..."
    curl -fsSL https://get.docker.com | $SUDO sh
    $SUDO usermod -aG docker "$USER" 2>/dev/null || true
    info "Docker instalado com sucesso!"
  fi

  if docker compose version &>/dev/null 2>&1; then
    info "Docker Compose disponível."
  else
    warn "Instalando Docker Compose plugin..."
    $SUDO apt-get update -qq 2>/dev/null
    $SUDO apt-get install -y docker-compose-plugin 2>/dev/null
    if ! docker compose version &>/dev/null 2>&1; then
      fail "Docker Compose não pôde ser instalado. Instale manualmente."
      exit 1
    fi
    info "Docker Compose instalado!"
  fi

  if ! docker info &>/dev/null 2>&1; then
    warn "Iniciando Docker daemon..."
    $SUDO systemctl start docker 2>/dev/null || $SUDO service docker start 2>/dev/null || true
    sleep 3
    if ! docker info &>/dev/null 2>&1; then
      fail "Docker não está rodando. Tente: sudo systemctl start docker"
      exit 1
    fi
  fi
  info "Docker daemon rodando."
}

# ─── ETAPA 3: Instalar Node.js ───────────────────────────────
install_node() {
  step "ETAPA 2/8 — Node.js"

  if command -v node &>/dev/null; then
    NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ] && command -v npm &>/dev/null; then
      info "Node.js $(node --version) e npm $(npm --version) disponíveis."
      return 0
    fi
  fi

  warn "Instalando Node.js 20 LTS..."
  if command -v apt-get &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
    $SUDO apt-get install -y nodejs
  elif command -v dnf &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash -
    $SUDO dnf install -y nodejs
  elif command -v yum &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash -
    $SUDO yum install -y nodejs
  else
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    nvm install 20 && nvm use 20
  fi

  if ! command -v node &>/dev/null; then
    fail "Node.js não pôde ser instalado. Instale manualmente: https://nodejs.org/"
    exit 1
  fi
  info "Node.js $(node --version) instalado."
}

# ─── ETAPA 4: Configurar variáveis ──────────────────────────
configure_env() {
  step "ETAPA 3/8 — Configuração"

  ENV_FILE="$SCRIPT_DIR/.env"

  if [ -f "$ENV_FILE" ]; then
    info "Arquivo .env já existe. Usando configuração existente."
    source "$ENV_FILE"
    return
  fi

  echo ""
  warn "Configuração inicial (pressione Enter para usar os padrões)"
  echo ""

  read -rp "$(echo -e "  ${COLOR_YELLOW}Senha do banco de dados${COLOR_RESET} [FinControl2026!]: ")" DB_PASS
  DB_PASS="${DB_PASS:-FinControl2026!}"

  read -rp "$(echo -e "  ${COLOR_YELLOW}JWT Secret (mín 32 chars)${COLOR_RESET} [auto]: ")" JWT
  if [ -z "$JWT" ]; then
    if command -v openssl &>/dev/null; then
      JWT=$(openssl rand -base64 48 | tr -d '=/+' | head -c 64)
    else
      JWT=$(head -c 64 /dev/urandom | base64 | tr -d '=/+' | head -c 64)
    fi
    info "JWT Secret gerado automaticamente."
  fi

  LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  [ -z "$LOCAL_IP" ] && LOCAL_IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}')
  LOCAL_IP="${LOCAL_IP:-localhost}"

  read -rp "$(echo -e "  ${COLOR_YELLOW}IP do servidor${COLOR_RESET} [$LOCAL_IP]: ")" SERVER_IP
  SERVER_IP="${SERVER_IP:-$LOCAL_IP}"

  cat > "$ENV_FILE" <<EOF
DB_PASSWORD=$DB_PASS
JWT_SECRET=$JWT
SITE_URL=http://$SERVER_IP:8080
API_EXTERNAL_URL=http://$SERVER_IP:8000
SERVER_IP=$SERVER_IP
EOF

  info "Configuração salva em $ENV_FILE"
}

# ─── ETAPA 5: Gerar SQL de inicialização ─────────────────────
generate_init_sql() {
  step "ETAPA 4/8 — Schema do banco de dados"

  INIT_SQL="$SCRIPT_DIR/init-db.sql"

  if [ -f "$INIT_SQL" ]; then
    info "init-db.sql já existe. Pulando."
    return
  fi

  info "Gerando script SQL de inicialização..."

  cat > "$INIT_SQL" <<'SQLEOF'
-- FinControl – Schema Inicial v3.0
-- Executado automaticamente na primeira inicialização do PostgreSQL

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══ Schema auth para GoTrue ═══
CREATE SCHEMA IF NOT EXISTS auth;

-- Role supabase_auth_admin (usada pelo GoTrue)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT;
  END IF;
END $$;

-- Permissões do schema auth
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO fincontrol;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON FUNCTIONS TO supabase_auth_admin;

-- Permitir que fincontrol use o schema auth
ALTER USER fincontrol SET search_path TO public, auth;

-- ═══ Roles para PostgREST ═══
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ═══ Enum de roles ═══
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

-- ═══ Tabelas ═══
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.savings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- ═══ Função has_role ═══
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

-- ═══ Permissões ═══
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

SQLEOF

  info "init-db.sql gerado com sucesso."
}

# ─── ETAPA 6: Build da aplicação ─────────────────────────────
build_app() {
  step "ETAPA 5/8 — Build da aplicação"

  cd "$PROJECT_DIR"
  source "$SCRIPT_DIR/.env" 2>/dev/null || true

  cat > .env.local <<EOF
VITE_SUPABASE_URL=${API_EXTERNAL_URL:-http://localhost:8000}
VITE_SUPABASE_PUBLISHABLE_KEY=local
VITE_SUPABASE_PROJECT_ID=local
EOF

  info "Arquivo .env.local criado."

  info "Instalando dependências (npm install)..."
  npm install 2>&1 | tail -3
  info "Dependências instaladas."

  info "Fazendo build de produção..."
  npm run build 2>&1 | tail -5
  if [ ! -d "$PROJECT_DIR/dist" ]; then
    fail "Build falhou — pasta 'dist' não foi criada."
    exit 1
  fi
  info "Build concluído."

  rm -rf "$SCRIPT_DIR/dist"
  cp -r "$PROJECT_DIR/dist" "$SCRIPT_DIR/dist"
  info "Arquivos copiados para instalador/dist/"
}

# ─── ETAPA 7: Configurar backup automático ───────────────────
setup_backup() {
  step "ETAPA 6/8 — Backup automático"

  BACKUP_SCRIPT="$SCRIPT_DIR/backup.sh"
  if [ -f "$BACKUP_SCRIPT" ]; then
    chmod +x "$BACKUP_SCRIPT"
  else
    warn "Script de backup não encontrado. Pulando."
    return
  fi

  mkdir -p "$SCRIPT_DIR/backups"

  if crontab -l 2>/dev/null | grep -q "fincontrol.*backup.sh"; then
    info "Cron de backup já configurado."
  else
    (crontab -l 2>/dev/null; echo "0 12 * * 6 $BACKUP_SCRIPT >> $SCRIPT_DIR/backups/cron.log 2>&1") | crontab -
    info "Backup automático agendado: sábados às 12h"
  fi
}

# ─── ETAPA 8: Subir containers ───────────────────────────────
start_services() {
  step "ETAPA 7/8 — Subindo serviços"

  cd "$SCRIPT_DIR"
  source "$SCRIPT_DIR/.env" 2>/dev/null || true

  info "Iniciando containers Docker..."
  docker compose --env-file .env up -d 2>&1

  if [ $? -ne 0 ]; then
    fail "Erro ao iniciar containers."
    exit 1
  fi

  info "Containers iniciados. Aguardando serviços..."
  sleep 5
}

# ─── ETAPA 9: Criar usuário admin automaticamente ────────────
provision_admin() {
  step "ETAPA 8/8 — Provisionando admin ($ADMIN_EMAIL)"

  # Aguardar GoTrue ficar saudável (máx 90s)
  info "Aguardando serviço de autenticação..."
  RETRIES=0
  MAX_RETRIES=18
  while [ $RETRIES -lt $MAX_RETRIES ]; do
    if curl -sf http://localhost:9999/health > /dev/null 2>&1; then
      info "Serviço de autenticação está pronto!"
      break
    fi
    RETRIES=$((RETRIES + 1))
    if [ $RETRIES -eq $MAX_RETRIES ]; then
      fail "Serviço de autenticação não respondeu em 90s."
      fail "Verifique: docker logs fincontrol-auth"
      exit 1
    fi
    echo -n "."
    sleep 5
  done

  # Criar usuário via GoTrue API (porta direta 9999)
  info "Criando usuário admin..."
  SIGNUP_RESPONSE=$(curl -s -X POST http://localhost:9999/signup \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$ADMIN_EMAIL\",
      \"password\": \"$ADMIN_PASSWORD\",
      \"data\": {\"display_name\": \"$ADMIN_NAME\"}
    }" 2>&1)

  # Extrair UUID do usuário
  USER_ID=$(echo "$SIGNUP_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -z "$USER_ID" ]; then
    warn "Resposta do signup: $SIGNUP_RESPONSE"

    # Tentar extrair ID mesmo de resposta de erro (usuário já existe)
    if echo "$SIGNUP_RESPONSE" | grep -q "already registered\|already exists\|duplicate"; then
      warn "Usuário já existe. Buscando ID no banco..."
      USER_ID=$(docker exec fincontrol-db psql -U fincontrol -d fincontrol -t -A \
        -c "SELECT id FROM auth.users WHERE email='$ADMIN_EMAIL' LIMIT 1;" 2>/dev/null | tr -d '[:space:]')
    fi

    if [ -z "$USER_ID" ]; then
      fail "Não foi possível criar ou encontrar o usuário admin."
      fail "Tente manualmente após a instalação."
      return 1
    fi
  fi

  info "Usuário criado com ID: $USER_ID"

  # Atribuir role admin
  info "Atribuindo role admin..."
  docker exec fincontrol-db psql -U fincontrol -d fincontrol -c \
    "INSERT INTO public.user_roles (user_id, role) VALUES ('$USER_ID', 'admin') ON CONFLICT (user_id, role) DO NOTHING;" 2>/dev/null

  if [ $? -eq 0 ]; then
    info "✅ Role admin atribuída com sucesso!"
  else
    warn "Falha ao atribuir role. Tente manualmente."
  fi

  # ─── Lockdown: desativar signup público ───────────────────
  info "Desativando cadastro público..."
  sed -i 's/GOTRUE_DISABLE_SIGNUP: "false"/GOTRUE_DISABLE_SIGNUP: "true"/' "$SCRIPT_DIR/docker-compose.yml"

  docker compose --env-file .env up -d --force-recreate --no-deps auth 2>&1
  info "Cadastro público desativado. Sistema seguro."

  # Resultado final
  SERVER_IP="${SERVER_IP:-localhost}"

  echo ""
  echo -e "${COLOR_GREEN}════════════════════════════════════════════════════${COLOR_RESET}"
  echo -e "${COLOR_GREEN}   FinControl instalado com sucesso! 🎉${COLOR_RESET}"
  echo -e "${COLOR_GREEN}════════════════════════════════════════════════════${COLOR_RESET}"
  echo ""
  echo -e "  🌐 Aplicação:   ${COLOR_CYAN}http://$SERVER_IP:8080${COLOR_RESET}"
  echo -e "  🔌 API REST:    ${COLOR_CYAN}http://$SERVER_IP:8000/rest/v1/${COLOR_RESET}"
  echo -e "  🔐 Auth:        ${COLOR_CYAN}http://$SERVER_IP:8000/auth/v1/${COLOR_RESET}"
  echo -e "  🗄️  PostgreSQL:  ${COLOR_CYAN}$SERVER_IP:5432${COLOR_RESET}"
  echo -e "  💾 Backups:     Sábados às 12h (máx 3)"
  echo ""
  echo -e "  ${COLOR_CYAN}╔══════════════════════════════════════════╗${COLOR_RESET}"
  echo -e "  ${COLOR_CYAN}║  Login Admin                             ║${COLOR_RESET}"
  echo -e "  ${COLOR_CYAN}║  Usuário: luiz                           ║${COLOR_RESET}"
  echo -e "  ${COLOR_CYAN}║  Senha:   LGP@ss6106                     ║${COLOR_RESET}"
  echo -e "  ${COLOR_CYAN}╚══════════════════════════════════════════╝${COLOR_RESET}"
  echo ""
}

# ─── MAIN ─────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${COLOR_CYAN}════════════════════════════════════════════════════${COLOR_RESET}"
  echo -e "${COLOR_CYAN}   FinControl – Instalador Automático v3.0${COLOR_RESET}"
  echo -e "${COLOR_CYAN}   Admin pré-configurado: $ADMIN_NAME${COLOR_RESET}"
  echo -e "${COLOR_CYAN}════════════════════════════════════════════════════${COLOR_RESET}"
  echo ""

  check_sudo
  install_docker
  install_node
  configure_env
  generate_init_sql
  build_app
  setup_backup
  start_services
  provision_admin
}

main "$@"
