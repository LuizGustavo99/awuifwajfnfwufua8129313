#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════
#  FinControl – Backup Semanal do PostgreSQL
#  Mantém no máximo 3 backups, apagando o mais antigo.
#  Agendar via cron: 0 12 * * 6 /caminho/backup.sh
# ══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/backups"
MAX_BACKUPS=3
CONTAINER_NAME="fincontrol-db"
DB_USER="fincontrol"
DB_NAME="fincontrol"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/fincontrol_backup_${TIMESTAMP}.sql.gz"

COLOR_GREEN="\033[1;32m"
COLOR_YELLOW="\033[1;33m"
COLOR_RED="\033[1;31m"
COLOR_RESET="\033[0m"

info()  { echo -e "${COLOR_GREEN}[✔]${COLOR_RESET} $*"; }
warn()  { echo -e "${COLOR_YELLOW}[!]${COLOR_RESET} $*"; }
error() { echo -e "${COLOR_RED}[✖]${COLOR_RESET} $*"; exit 1; }

# Criar diretório de backups
mkdir -p "$BACKUP_DIR"

# Verificar se o container está rodando
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  error "Container ${CONTAINER_NAME} não está rodando."
fi

# Executar backup
info "Iniciando backup do banco de dados..."
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ -s "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  info "Backup criado: ${BACKUP_FILE} (${SIZE})"
else
  rm -f "$BACKUP_FILE"
  error "Backup falhou – arquivo vazio."
fi

# Rotação: manter apenas os últimos MAX_BACKUPS
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/fincontrol_backup_*.sql.gz 2>/dev/null | wc -l)

if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
  EXCESS=$((BACKUP_COUNT - MAX_BACKUPS))
  ls -1t "${BACKUP_DIR}"/fincontrol_backup_*.sql.gz | tail -n "$EXCESS" | while read -r old; do
    warn "Removendo backup antigo: $(basename "$old")"
    rm -f "$old"
  done
fi

info "Backups atuais (máx ${MAX_BACKUPS}):"
ls -1th "${BACKUP_DIR}"/fincontrol_backup_*.sql.gz 2>/dev/null | head -n "$MAX_BACKUPS" | while read -r f; do
  echo "  📦 $(basename "$f") ($(du -h "$f" | cut -f1))"
done

info "Backup concluído com sucesso!"
