# 🚀 FinControl – Instalador Local para Linux

## Instalação Rápida

```bash
# 1. Clone o repositório
git clone <URL_DO_SEU_REPOSITORIO>
cd <NOME_DO_PROJETO>/instalador

# 2. Dê permissão e execute
chmod +x install.sh
./install.sh
```

O script irá:
1. ✅ Instalar Docker e Docker Compose (se necessário)
2. ✅ Instalar Node.js 20 LTS (se necessário)
3. ✅ Configurar banco de dados (senhas, JWT, IP)
4. ✅ Fazer build de produção da aplicação
5. ✅ Gerar schema SQL completo
6. ✅ Subir todos os serviços via Docker Compose

## Após Instalação

| Serviço | URL |
|---|---|
| Aplicação | `http://SEU_IP:8080` |
| API REST | `http://SEU_IP:8000/rest/v1/` |
| Auth | `http://SEU_IP:8000/auth/v1/` |
| PostgreSQL | `SEU_IP:5432` |

## Backup Automático

O instalador configura backup semanal automático via cron:
- **Quando:** Sábados às 12h
- **Limite:** 3 backups (o mais antigo é apagado automaticamente)
- **Onde:** `instalador/backups/`

```bash
# Executar backup manual
./backup.sh

# Ver backups existentes
ls -lh backups/

# Restaurar um backup
gunzip -c backups/fincontrol_backup_XXXXXXXX.sql.gz | docker exec -i fincontrol-db psql -U fincontrol fincontrol
```

## Comandos Úteis

```bash
# Ver logs
docker compose logs -f

# Parar tudo
docker compose down

# Reiniciar
docker compose up -d
```

## Acesso Externo

Consulte `public/guia-deploy-casaos.md` para configurar Cloudflare Tunnel ou Tailscale.
