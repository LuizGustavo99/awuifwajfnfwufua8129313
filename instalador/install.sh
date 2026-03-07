#!/usr/bin/env bash

# ══════════════════════════════════════════════════════════════
#  FinControl – Instalador Automático v2.0 para Linux / CasaOS
#  Requisitos: curl, git
# ══════════════════════════════════════════════════════════════

COLOR_GREEN="\033[1;32m"
COLOR_YELLOW="\033[1;33m"
COLOR_RED="\033[1;31m"
COLOR_CYAN="\033[1;36m"
COLOR_RESET="\033[0m"

info()  { echo -e "${COLOR_GREEN}[✔]${COLOR_RESET} $*"; }
warn()  { echo -e "${COLOR_YELLOW}[!]${COLOR_RESET} $*"; }
fail()  { echo -e "${COLOR_RED}[✖]${COLOR_RESET} $*"; }
step()  { echo -e "\n${COLOR_CYAN}═══ $* ═══${COLOR_RESET}\n"; }

# Detectar diretório do projeto (pai do instalador)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Verificar se estamos executando de dentro do repositório clonado
if [ ! -f "$PROJECT_DIR/package.json" ]; then
  fail "Erro: execute este script de dentro da pasta 'instalador/' do projeto clonado."
  fail "Exemplo: cd ~/fincontrol/instalador && ./install.sh"
  exit 1
fi

# ─── Verificar se roda como root ou com sudo ─────────────────
check_sudo() {
  if [ "$EUID" -eq 0 ]; then
    SUDO=""
  elif command -v sudo &>/dev/null; then
    SUDO="sudo"
  else
    fail "Este script precisa de permissões de root."
    fail "Execute com: sudo ./install.sh"
    exit 1
  fi
}

# ─── ETAPA 1: Instalar Docker ────────────────────────────────
install_docker() {
  step "ETAPA 1/7 — Docker"

  if command -v docker &>/dev/null; then
    info "Docker já instalado: $(docker --version)"
  else
    warn "Docker não encontrado. Instalando..."
    curl -fsSL https://get.docker.com | $SUDO sh
    if [ $? -ne 0 ]; then
      fail "Falha ao instalar Docker."
      fail "Tente manualmente: curl -fsSL https://get.docker.com | sudo sh"
      exit 1
    fi
    $SUDO usermod -aG docker "$USER" 2>/dev/null || true
    info "Docker instalado com sucesso!"
    warn "Se der erro de permissão depois, execute: newgrp docker"
  fi

  # Verificar Docker Compose
  if docker compose version &>/dev/null 2>&1; then
    info "Docker Compose disponível: $(docker compose version --short 2>/dev/null || echo 'ok')"
  else
    warn "Instalando Docker Compose plugin..."
    $SUDO apt-get update -qq 2>/dev/null
    $SUDO apt-get install -y docker-compose-plugin 2>/dev/null
    if ! docker compose version &>/dev/null 2>&1; then
      fail "Docker Compose não pôde ser instalado automaticamente."
      fail "Instale manualmente: https://docs.docker.com/compose/install/"
      exit 1
    fi
    info "Docker Compose instalado!"
  fi

  # Garantir que Docker daemon está rodando
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

# ─── ETAPA 2: Instalar Node.js ───────────────────────────────
install_node() {
  step "ETAPA 2/7 — Node.js"

  if command -v node &>/dev/null; then
    NODE_VERSION=$(node --version)
    info "Node.js já instalado: $NODE_VERSION"

    # Verificar se é versão 18+
    NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
      warn "Versão do Node.js ($NODE_VERSION) é antiga. Recomendado v18+."
      warn "Tentando atualizar..."
    else
      # Verificar npm
      if command -v npm &>/dev/null; then
        info "npm disponível: $(npm --version)"
        return 0
      fi
    fi
  fi

  warn "Instalando Node.js 20 LTS..."

  # Detectar gerenciador de pacotes
  if command -v apt-get &>/dev/null; then
    # Debian/Ubuntu
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
    $SUDO apt-get install -y nodejs
  elif command -v dnf &>/dev/null; then
    # Fedora/RHEL
    curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash -
    $SUDO dnf install -y nodejs
  elif command -v yum &>/dev/null; then
    # CentOS
    curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash -
    $SUDO yum install -y nodejs
  else
    # Fallback: instalar via nvm
    warn "Gerenciador de pacotes não detectado. Usando método alternativo..."
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
  fi

  # Verificar instalação
  if command -v node &>/dev/null; then
    info "Node.js instalado: $(node --version)"
    info "npm instalado: $(npm --version)"
  else
    fail "Node.js não pôde ser instalado."
    fail "Instale manualmente: https://nodejs.org/en/download/"
    exit 1
  fi
}

# ─── ETAPA 3: Configurar variáveis ──────────────────────────
configure_env() {
  step "ETAPA 3/7 — Configuração"

  ENV_FILE="$SCRIPT_DIR/.env"

  if [ -f "$ENV_FILE" ]; then
    info "Arquivo .env já existe. Usando configuração existente."
    source "$ENV_FILE"
    info "  IP configurado: $(grep SERVER_IP "$ENV_FILE" 2>/dev/null | head -1 || echo 'padrão')"
    return
  fi

  echo ""
  warn "Configuração inicial (pressione Enter para usar os padrões)"
  echo ""

  # Senha do banco
  read -rp "$(echo -e "  ${COLOR_YELLOW}Senha do banco de dados${COLOR_RESET} [FinControl2026!]: ")" DB_PASS
  DB_PASS="${DB_PASS:-FinControl2026!}"

  # JWT Secret
  read -rp "$(echo -e "  ${COLOR_YELLOW}JWT Secret (mín 32 chars)${COLOR_RESET} [auto]: ")" JWT
  if [ -z "$JWT" ]; then
    if command -v openssl &>/dev/null; then
      JWT=$(openssl rand -base64 48 | tr -d '=/+' | head -c 64)
    else
      JWT=$(head -c 64 /dev/urandom | base64 | tr -d '=/+' | head -c 64)
    fi
    info "  JWT Secret gerado automaticamente."
  fi

  # Detectar IP local
  LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}')
  fi
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

# ─── ETAPA 4: Gerar SQL de inicialização ─────────────────────
generate_init_sql() {
  step "ETAPA 4/7 — Schema do banco de dados"

  INIT_SQL="$SCRIPT_DIR/init-db.sql"

  if [ -f "$INIT_SQL" ]; then
    info "init-db.sql já existe. Pulando."
    return
  fi

  info "Gerando script SQL de inicialização..."

  cat > "$INIT_SQL" <<'SQLEOF'
-- FinControl – Schema Inicial
-- Executado automaticamente na primeira inicialização do PostgreSQL

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Roles para PostgREST
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

-- Schema auth simulado para GoTrue
CREATE SCHEMA IF NOT EXISTS auth;

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
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

SQLEOF

  info "init-db.sql gerado com sucesso."
}

# ─── ETAPA 5: Build da aplicação ─────────────────────────────
build_app() {
  step "ETAPA 5/7 — Build da aplicação"

  cd "$PROJECT_DIR"

  # Ler configuração
  source "$SCRIPT_DIR/.env" 2>/dev/null || true

  # Criar .env para o Vite
  cat > .env.local <<EOF
VITE_SUPABASE_URL=${API_EXTERNAL_URL:-http://localhost:8000}
VITE_SUPABASE_PUBLISHABLE_KEY=local
VITE_SUPABASE_PROJECT_ID=local
EOF

  info "Arquivo .env.local criado para o build."

  # Instalar dependências
  info "Instalando dependências (npm install)..."
  npm install 2>&1 | tail -3
  if [ $? -ne 0 ]; then
    fail "Falha ao instalar dependências."
    fail "Tente manualmente: cd $PROJECT_DIR && npm install"
    exit 1
  fi
  info "Dependências instaladas."

  # Build
  info "Fazendo build de produção (npm run build)..."
  npm run build 2>&1 | tail -5
  if [ ! -d "$PROJECT_DIR/dist" ]; then
    fail "Build falhou — pasta 'dist' não foi criada."
    fail "Tente manualmente: cd $PROJECT_DIR && npm run build"
    exit 1
  fi
  info "Build concluído."

  # Copiar dist para pasta do instalador
  rm -rf "$SCRIPT_DIR/dist"
  cp -r "$PROJECT_DIR/dist" "$SCRIPT_DIR/dist"
  info "Arquivos copiados para instalador/dist/"
}

# ─── ETAPA 6: Configurar backup automático ───────────────────
setup_backup() {
  step "ETAPA 6/7 — Backup automático"

  BACKUP_SCRIPT="$SCRIPT_DIR/backup.sh"

  if [ -f "$BACKUP_SCRIPT" ]; then
    chmod +x "$BACKUP_SCRIPT"
  else
    warn "Script de backup não encontrado. Pulando configuração de cron."
    return
  fi

  mkdir -p "$SCRIPT_DIR/backups"

  # Verificar se o cron já existe
  if crontab -l 2>/dev/null | grep -q "fincontrol.*backup.sh"; then
    info "Cron de backup já configurado."
  else
    (crontab -l 2>/dev/null; echo "0 12 * * 6 $BACKUP_SCRIPT >> $SCRIPT_DIR/backups/cron.log 2>&1") | crontab -
    info "Backup automático agendado: sábados às 12h (máx 3 backups)"
  fi

  info "Diretório de backups: $SCRIPT_DIR/backups/"
}

# ─── ETAPA 7: Subir containers ───────────────────────────────
start_services() {
  step "ETAPA 7/7 — Subindo serviços"

  cd "$SCRIPT_DIR"

  # Carregar variáveis
  source "$SCRIPT_DIR/.env" 2>/dev/null || true

  info "Iniciando containers Docker..."
  docker compose --env-file .env up -d 2>&1

  if [ $? -ne 0 ]; then
    fail "Erro ao iniciar containers."
    fail "Verifique os logs: docker compose logs"
    exit 1
  fi

  # Aguardar containers ficarem prontos
  info "Aguardando serviços iniciarem (30 segundos)..."
  sleep 10

  # Verificar containers
  echo ""
  RUNNING=$(docker compose ps --format '{{.Name}} {{.Status}}' 2>/dev/null | grep -c "Up" || echo "0")
  TOTAL=$(docker compose ps --format '{{.Name}}' 2>/dev/null | wc -l || echo "0")

  if [ "$RUNNING" -ge 4 ]; then
    info "✅ $RUNNING/$TOTAL containers rodando."
  else
    warn "⚠️  Apenas $RUNNING/$TOTAL containers estão rodando."
    warn "Verificando logs..."
    docker compose ps 2>/dev/null
    echo ""
    warn "Execute 'docker compose logs' para ver detalhes."
  fi

  SERVER_IP="${SERVER_IP:-localhost}"

  echo ""
  echo -e "${COLOR_GREEN}════════════════════════════════════════════════════${COLOR_RESET}"
  echo -e "${COLOR_GREEN}   FinControl instalado com sucesso! 🎉${COLOR_RESET}"
  echo -e "${COLOR_GREEN}════════════════════════════════════════════════════${COLOR_RESET}"
  echo ""
  echo -e "  🌐 Aplicação:  ${COLOR_CYAN}http://$SERVER_IP:8080${COLOR_RESET}"
  echo -e "  🔌 API REST:   ${COLOR_CYAN}http://$SERVER_IP:8000/rest/v1/${COLOR_RESET}"
  echo -e "  🔐 Auth:       ${COLOR_CYAN}http://$SERVER_IP:8000/auth/v1/${COLOR_RESET}"
  echo -e "  🗄️  PostgreSQL: ${COLOR_CYAN}$SERVER_IP:5432${COLOR_RESET}"
  echo -e "  💾 Backups:    Sábados às 12h (máx 3)"
  echo ""
  echo -e "  ${COLOR_YELLOW}Próximo passo: criar o primeiro usuário.${COLOR_RESET}"
  echo -e "  ${COLOR_YELLOW}Veja o guia completo: public/guia-instalacao-casaos.md${COLOR_RESET}"
  echo ""
}

# ─── MAIN ─────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${COLOR_CYAN}════════════════════════════════════════════════════${COLOR_RESET}"
  echo -e "${COLOR_CYAN}   FinControl – Instalador Automático v2.0${COLOR_RESET}"
  echo -e "${COLOR_CYAN}════════════════════════════════════════════════════${COLOR_RESET}"
  echo ""
  echo -e "  Diretório do projeto: ${COLOR_GREEN}$PROJECT_DIR${COLOR_RESET}"
  echo -e "  Diretório instalador: ${COLOR_GREEN}$SCRIPT_DIR${COLOR_RESET}"
  echo ""

  check_sudo
  install_docker
  install_node
  configure_env
  generate_init_sql
  build_app
  setup_backup
  start_services
}

main "$@"
