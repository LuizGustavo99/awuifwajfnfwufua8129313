# 📦 Guia Completo: Deploy do Sistema Financeiro no CasaOS

## Índice
1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Instalação do CasaOS](#3-instalação-do-casaos)
4. [Configuração do Banco de Dados Local (PostgreSQL)](#4-configuração-do-banco-de-dados-local-postgresql)
5. [Build da Aplicação](#5-build-da-aplicação)
6. [Deploy com Docker no CasaOS](#6-deploy-com-docker-no-casaos)
7. [Acesso Externo (fora da rede local)](#7-acesso-externo-fora-da-rede-local)
8. [Manutenção e Backups](#8-manutenção-e-backups)

---

## 1. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────┐
│                  CasaOS                      │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐ │
│  │  Nginx   │  │  Supabase │  │ PostgreSQL│ │
│  │ (proxy)  │──│  (API +   │──│ (banco de │ │
│  │          │  │  Auth)    │  │  dados)   │ │
│  └──────────┘  └───────────┘  └──────────┘ │
│       │                                      │
│  ┌──────────┐                               │
│  │  App     │                               │
│  │ (React)  │                               │
│  └──────────┘                               │
└─────────────────────────────────────────────┘
         │
    ┌────────────┐
    │ Cloudflare │  ← Acesso externo (Tunnel)
    │   Tunnel   │
    └────────────┘
```

### Componentes necessários:
| Componente | Função | Imagem Docker |
|---|---|---|
| **PostgreSQL 15** | Banco de dados relacional | `postgres:15-alpine` |
| **Supabase** (Self-hosted) | API REST, autenticação, RLS | `supabase/` stack |
| **Nginx** | Servidor web + proxy reverso | `nginx:alpine` |
| **Cloudflare Tunnel** | Acesso externo seguro | `cloudflare/cloudflared` |

---

## 2. Pré-requisitos

- **Hardware mínimo**: 2 GB RAM, 20 GB disco, processador x86_64 ou ARM64
- **Sistema operacional**: Debian 11/12, Ubuntu 20.04/22.04 (ou qualquer distro suportada pelo CasaOS)
- **Rede**: IP fixo local (recomendado) ou DHCP reservado no roteador
- **Domínio** (opcional): para acesso externo com HTTPS via Cloudflare

---

## 3. Instalação do CasaOS

Se ainda não tem o CasaOS instalado:

```bash
# Instalação oficial (uma linha)
curl -fsSL https://get.casaos.io | sudo bash
```

Após instalação, acesse: `http://<IP_DO_SERVIDOR>:80`

---

## 4. Configuração do Banco de Dados Local (PostgreSQL)

### Opção A: Supabase Self-Hosted (Recomendado)

O Supabase Self-Hosted fornece PostgreSQL + API REST + Auth tudo integrado.

#### Passo 1: Clone o repositório do Supabase

```bash
cd /DATA  # ou onde preferir armazenar no CasaOS
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
```

#### Passo 2: Configure as variáveis de ambiente

```bash
cp .env.example .env
nano .env
```

Altere as seguintes variáveis:

```env
# Gere chaves JWT em https://supabase.com/docs/guides/self-hosting#api-keys
POSTGRES_PASSWORD=SuaSenhaSegura123!
JWT_SECRET=super-secret-jwt-token-com-pelo-menos-32-caracteres
ANON_KEY=eyJ... (gere com o JWT_SECRET)
SERVICE_ROLE_KEY=eyJ... (gere com o JWT_SECRET)

# URL do site
SITE_URL=http://192.168.1.100:3000
API_EXTERNAL_URL=http://192.168.1.100:8000

# Desabilitar signup público (como configuramos no Lovable Cloud)
ENABLE_SIGNUP=false
ENABLE_EMAIL_AUTOCONFIRM=false
```

> 💡 **Para gerar as chaves JWT**, use: https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys

#### Passo 3: Inicie o Supabase

```bash
docker compose up -d
```

Isso sobe:
- PostgreSQL na porta **5432**
- Supabase Studio na porta **3000**
- API REST na porta **8000**

#### Passo 4: Execute as migrações do banco

Conecte ao PostgreSQL e execute os SQLs de migração do projeto:

```bash
# Acesse o container do PostgreSQL
docker exec -it supabase-db psql -U postgres

# Ou use o Supabase Studio em http://192.168.1.100:3000
```

Copie e execute todos os arquivos SQL da pasta `supabase/migrations/` do projeto, em ordem cronológica.

---

### Opção B: PostgreSQL Standalone (Mais simples, menos funcionalidades)

Se preferir apenas o banco, sem o Supabase:

```bash
docker run -d \
  --name financeiro-db \
  --restart always \
  -e POSTGRES_USER=financeiro \
  -e POSTGRES_PASSWORD=SuaSenhaSegura123! \
  -e POSTGRES_DB=financeiro \
  -p 5432:5432 \
  -v /DATA/postgresql:/var/lib/postgresql/data \
  postgres:15-alpine
```

> ⚠️ **Nota**: Sem o Supabase, você perde: autenticação integrada, API REST automática e RLS. Teria que reimplementar o backend.

---

## 5. Build da Aplicação

### No seu computador de desenvolvimento:

```bash
# Clone o repositório
git clone <URL_DO_SEU_REPOSITORIO>
cd <NOME_DO_PROJETO>

# Instale as dependências
npm install

# Configure o .env para apontar ao Supabase local
cat > .env << 'EOF'
VITE_SUPABASE_URL=http://192.168.1.100:8000
VITE_SUPABASE_PUBLISHABLE_KEY=<SUA_ANON_KEY_LOCAL>
EOF

# Build de produção
npm run build
```

A pasta `dist/` conterá os arquivos estáticos prontos para deploy.

---

## 6. Deploy com Docker no CasaOS

### Passo 1: Crie o Dockerfile

Na raiz do projeto, crie:

```dockerfile
FROM nginx:alpine

# Copie os arquivos do build
COPY dist/ /usr/share/nginx/html/

# Configuração do Nginx para SPA (React Router)
RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # Cache de assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback - todas as rotas para index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF
```

### Passo 2: Build e deploy da imagem Docker

```bash
# Build da imagem
docker build -t financeiro-app .

# Execute o container
docker run -d \
  --name financeiro-web \
  --restart always \
  -p 8080:80 \
  financeiro-app
```

### Passo 3: Acesse no CasaOS

A aplicação estará disponível em:
- **Rede local**: `http://192.168.1.100:8080`

---

## 7. Acesso Externo (fora da rede local)

Existem **3 opções** para acessar de fora da sua rede:

### Opção A: Cloudflare Tunnel (⭐ Recomendado - Grátis e Seguro)

O Cloudflare Tunnel cria um túnel seguro sem abrir portas no roteador.

#### Passo 1: Crie uma conta no Cloudflare
- Acesse https://dash.cloudflare.com
- Adicione um domínio (pode ser um domínio barato de ~R$10/ano)

#### Passo 2: Instale o Cloudflared no CasaOS

```bash
docker run -d \
  --name cloudflare-tunnel \
  --restart always \
  --network host \
  cloudflare/cloudflared:latest \
  tunnel --no-autoupdate run \
  --token <SEU_TOKEN_DO_TUNNEL>
```

#### Passo 3: Configure o Tunnel no Dashboard do Cloudflare

1. Vá em **Zero Trust → Networks → Tunnels**
2. Crie um novo tunnel
3. Copie o token gerado (use no passo anterior)
4. Adicione as rotas:
   - `financeiro.seudominio.com` → `http://localhost:8080` (app)
   - `api.financeiro.seudominio.com` → `http://localhost:8000` (Supabase API)

#### Resultado:
- ✅ HTTPS automático
- ✅ Sem abrir portas no roteador
- ✅ Proteção DDoS do Cloudflare
- ✅ Funciona mesmo com IP dinâmico
- 🌐 Acesse de qualquer lugar via `https://financeiro.seudominio.com`

---

### Opção B: Tailscale (Grátis - VPN pessoal)

Ideal se só você e pessoas de confiança precisam acessar.

```bash
# Instale no CasaOS
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Instale também no celular/notebook
# Acesse pelo IP do Tailscale: http://100.x.x.x:8080
```

**Vantagens**: Zero configuração de DNS, seguro, grátis para até 100 dispositivos.

---

### Opção C: Port Forwarding + DynDNS (⚠️ Menos seguro)

Se não quiser usar serviços externos:

1. **No roteador**: redirecione a porta 443 → 192.168.1.100:8080
2. **DynDNS**: Use No-IP ou DuckDNS para ter um domínio apontando ao seu IP
3. **SSL**: Use Let's Encrypt com Certbot para HTTPS

```bash
# Instale Certbot
docker run -d \
  --name nginx-proxy \
  -p 443:443 -p 80:80 \
  -v /DATA/certs:/etc/letsencrypt \
  nginxproxy/nginx-proxy
```

> ⚠️ **Riscos**: expõe seu IP real, requer manutenção de certificados, vulnerável se mal configurado.

---

## 8. Manutenção e Backups

### Backup automático do banco de dados

Crie um script de backup:

```bash
#!/bin/bash
# /DATA/scripts/backup-db.sh

BACKUP_DIR="/DATA/backups/postgresql"
mkdir -p $BACKUP_DIR
DATE=$(date +%Y-%m-%d_%H-%M)

docker exec supabase-db pg_dump -U postgres \
  --format=custom \
  --compress=9 \
  -f /tmp/backup_$DATE.dump

docker cp supabase-db:/tmp/backup_$DATE.dump $BACKUP_DIR/

# Manter apenas últimos 30 backups
ls -t $BACKUP_DIR/*.dump | tail -n +31 | xargs rm -f 2>/dev/null

echo "Backup concluído: $BACKUP_DIR/backup_$DATE.dump"
```

Configure no cron:

```bash
# Backup diário às 3h da manhã
crontab -e
0 3 * * * /DATA/scripts/backup-db.sh >> /DATA/logs/backup.log 2>&1
```

### Restaurar um backup

```bash
docker exec -i supabase-db pg_restore -U postgres -d postgres < /DATA/backups/postgresql/backup_XXXX.dump
```

### Atualizar a aplicação

```bash
cd /DATA/financeiro
git pull origin main
npm install
npm run build
docker build -t financeiro-app .
docker stop financeiro-web && docker rm financeiro-web
docker run -d --name financeiro-web --restart always -p 8080:80 financeiro-app
```

---

## Resumo dos Comandos Principais

| Ação | Comando |
|---|---|
| Iniciar Supabase | `cd /DATA/supabase/docker && docker compose up -d` |
| Parar Supabase | `cd /DATA/supabase/docker && docker compose down` |
| Ver logs da app | `docker logs financeiro-web` |
| Ver logs do banco | `docker logs supabase-db` |
| Reiniciar app | `docker restart financeiro-web` |
| Backup manual | `/DATA/scripts/backup-db.sh` |
| Atualizar app | Ver seção "Atualizar a aplicação" |

---

## Checklist Final

- [ ] CasaOS instalado e funcionando
- [ ] PostgreSQL/Supabase rodando em Docker
- [ ] Migrações do banco executadas
- [ ] Usuários criados (Luiz e Bruna)
- [ ] Aplicação buildada e servida via Nginx
- [ ] Acesso local funcionando (http://IP:8080)
- [ ] Cloudflare Tunnel ou Tailscale configurado
- [ ] Backup automático configurado
- [ ] Teste de acesso externo realizado

---

*Documento gerado em 01/03/2026 — Sistema Financeiro Pessoal*
