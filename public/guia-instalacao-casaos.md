# 🚀 FinControl — Guia Completo de Instalação no CasaOS

> **Pré-requisito:** CasaOS já instalado e acessível via navegador.
> Se ainda não instalou: `curl -fsSL https://get.casaos.io | sudo bash`

---

## 📑 Índice

1. [Preparar o Servidor](#1-preparar-o-servidor)
2. [Baixar o Projeto](#2-baixar-o-projeto)
3. [Executar o Instalador](#3-executar-o-instalador)
4. [Verificar a Instalação](#4-verificar-a-instalação)
5. [Criar o Primeiro Usuário](#5-criar-o-primeiro-usuário)
6. [Acesso Externo (fora da rede)](#6-acesso-externo-fora-da-rede)
7. [Gerenciar Backups](#7-gerenciar-backups)
8. [Atualizar a Aplicação](#8-atualizar-a-aplicação)
9. [Comandos Úteis](#9-comandos-úteis)
10. [Resolução de Problemas](#10-resolução-de-problemas)

---

## 1. Preparar o Servidor

### 1.1 Acessar o terminal

**Via SSH (recomendado):**
```bash
ssh seu_usuario@IP_DO_SERVIDOR
# Exemplo: ssh luiz@192.168.1.100
```

> 💡 **Descobrir o IP:** No painel do CasaOS o IP aparece na barra superior, ou no terminal: `hostname -I`

**Via painel CasaOS:** Configurações → Terminal (se disponível)

### 1.2 Instalar pré-requisitos

O CasaOS já vem com Docker instalado. Precisamos apenas de **git** e **curl**:

```bash
sudo apt update && sudo apt install -y git curl
```

Confirme que o Docker funciona (o CasaOS já instala):
```bash
docker --version
docker compose version
```

Se aparecer a versão, está OK. Se der erro, o instalador vai tentar instalar automaticamente.

### 1.3 Verificar recursos mínimos

```bash
# Memória (mínimo 2 GB)
free -h

# Disco (mínimo 10 GB livres)
df -h /
```

---

## 2. Baixar o Projeto

### 2.1 Se o repositório for privado (GitHub)

```bash
# Gerar chave SSH
ssh-keygen -t ed25519 -C "seu@email.com"
# Pressione Enter em tudo

# Copiar a chave
cat ~/.ssh/id_ed25519.pub
```

Cole a chave em [github.com/settings/keys](https://github.com/settings/keys) → **New SSH key**

### 2.2 Clonar o repositório

```bash
cd ~
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git fincontrol
```

> 📁 Isso cria a pasta `~/fincontrol` com todo o código.

---

## 3. Executar o Instalador

### 3.1 Entrar na pasta e executar

```bash
cd ~/fincontrol/instalador
chmod +x install.sh backup.sh
sudo ./install.sh
```

> ⚠️ **IMPORTANTE:** Use `sudo` para garantir permissões de instalação de Docker e Node.js.

### 3.2 O que será perguntado

O instalador faz **3 perguntas** (pode pressionar Enter em todas para usar os padrões):

| # | Pergunta | Padrão | Observação |
|---|----------|--------|------------|
| 1 | Senha do banco | `FinControl2026!` | Pode alterar se preferir |
| 2 | JWT Secret | Gerado automaticamente | Pressione Enter |
| 3 | IP do servidor | Detectado automaticamente | Confirme se está correto |

### 3.3 O que o instalador faz (7 etapas)

```
════════════════════════════════════════════════════
   FinControl – Instalador Automático v2.0
════════════════════════════════════════════════════

═══ ETAPA 1/7 — Docker ═══
[✔] Docker já instalado: Docker version 24.x.x
[✔] Docker Compose disponível
[✔] Docker daemon rodando.

═══ ETAPA 2/7 — Node.js ═══
[✔] Node.js já instalado: v20.x.x
[✔] npm disponível: 10.x.x

═══ ETAPA 3/7 — Configuração ═══
[!] Configuração inicial (pressione Enter para usar os padrões)
[✔] Configuração salva

═══ ETAPA 4/7 — Schema do banco de dados ═══
[✔] init-db.sql gerado com sucesso.

═══ ETAPA 5/7 — Build da aplicação ═══
[✔] Dependências instaladas.
[✔] Build concluído.
[✔] Arquivos copiados para instalador/dist/

═══ ETAPA 6/7 — Backup automático ═══
[✔] Backup automático agendado: sábados às 12h (máx 3 backups)

═══ ETAPA 7/7 — Subindo serviços ═══
[✔] ✅ 5/5 containers rodando.

════════════════════════════════════════════════════
   FinControl instalado com sucesso! 🎉
════════════════════════════════════════════════════

  🌐 Aplicação:  http://192.168.1.100:8080
  🔌 API REST:   http://192.168.1.100:8000/rest/v1/
  🔐 Auth:       http://192.168.1.100:8000/auth/v1/
  🗄️  PostgreSQL: 192.168.1.100:5432
  💾 Backups:    Sábados às 12h (máx 3)
```

### 3.4 Se o instalador parar no meio

Se o script parar em alguma etapa, ele mostra exatamente qual etapa falhou e o que fazer. Você pode **executar novamente** sem problemas — ele pula etapas já completadas (se o `.env` e `init-db.sql` já existem, não pergunta de novo).

```bash
# Re-executar após corrigir o problema
sudo ./install.sh
```

> 💡 Se quiser **refazer** a configuração do zero, apague os arquivos gerados:
> ```bash
> rm -f .env init-db.sql
> sudo ./install.sh
> ```

---

## 4. Verificar a Instalação

### 4.1 Verificar containers

```bash
cd ~/fincontrol/instalador
docker compose ps
```

Deve mostrar **5 containers** com status "Up":

| Container | Serviço | Porta |
|-----------|---------|-------|
| `fincontrol-db` | PostgreSQL | 5432 |
| `fincontrol-auth` | Autenticação (GoTrue) | 9999 (interna) |
| `fincontrol-rest` | API REST (PostgREST) | 3000 (interna) |
| `fincontrol-gateway` | API Gateway (Kong) | 8000 |
| `fincontrol-app` | Frontend (Nginx) | 8080 |

### 4.2 Testar no navegador

Em qualquer dispositivo na **mesma rede Wi-Fi/Ethernet**:

```
http://IP_DO_SERVIDOR:8080
```

Exemplo: `http://192.168.1.100:8080`

### 4.3 Testar a API

```bash
# API REST
curl http://localhost:8000/rest/v1/

# Autenticação
curl http://localhost:8000/auth/v1/health
```

Se ambos retornarem uma resposta JSON, está funcionando.

### 4.4 Arquitetura dos serviços

```
  Navegador (porta 8080)
       │
  ┌────▼─────┐
  │  Nginx   │  ← Frontend React
  └──────────┘

  Navegador (porta 8000)
       │
  ┌────▼─────┐
  │   Kong   │  ← API Gateway (roteia requisições)
  └────┬─────┘
       │
  ┌────┼──────────────┐
  │    │               │
  ▼    ▼               │
┌────┐ ┌─────────┐    │
│Auth│ │PostgREST│    │
│9999│ │  3000   │    │
└──┬─┘ └────┬────┘    │
   │         │         │
   └────┬────┘         │
        │              │
   ┌────▼─────┐        │
   │PostgreSQL│        │
   │   5432   │        │
   └──────────┘        │
```

---

## 5. Criar o Primeiro Usuário

O signup público está desabilitado por segurança. Crie o primeiro usuário assim:

### 5.1 Gerar o token de serviço (Service Role Key)

```bash
cd ~/fincontrol

# Instalar jsonwebtoken se não tiver
npm list jsonwebtoken 2>/dev/null || npm install jsonwebtoken --no-save

# Gerar o token
JWT_SECRET=$(grep JWT_SECRET instalador/.env | cut -d= -f2)

node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { role: 'service_role', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 315360000 },
  '$JWT_SECRET',
  { algorithm: 'HS256' }
);
console.log('SERVICE_ROLE_KEY=' + token);
" | tee -a instalador/.env
```

Isso gera o token e **salva automaticamente** no arquivo `.env`.

### 5.2 Criar o usuário admin

```bash
# Carregar variáveis
source instalador/.env

# Criar usuário (substitua email e senha)
curl -X POST http://localhost:9999/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -d '{
    "email": "seu@email.com",
    "password": "SuaSenhaForte123!",
    "email_confirm": true
  }'
```

Se retornar um JSON com `"id"`, o usuário foi criado com sucesso!

### 5.3 Fazer login

1. Abra `http://IP_DO_SERVIDOR:8080` no navegador
2. Use o email e senha que acabou de criar
3. Pronto! 🎉

---

## 6. Acesso Externo (fora da rede)

Para acessar de **fora da rede local**, use o **Cloudflare Tunnel** — gratuito e seguro.

### 6.1 Pré-requisitos

1. Conta no [Cloudflare](https://dash.cloudflare.com) (gratuita)
2. Um domínio (a partir de ~R$10/ano no [Registro.br](https://registro.br))
3. Domínio configurado no Cloudflare (apontar nameservers)

### 6.2 Criar o Tunnel

1. Cloudflare → **Zero Trust** → **Networks → Tunnels**
2. **Create a tunnel** → tipo **Cloudflared**
3. Nome: `fincontrol`
4. **Copie o token** exibido

### 6.3 Instalar no servidor

```bash
docker run -d \
  --name cloudflare-tunnel \
  --restart always \
  --network host \
  cloudflare/cloudflared:latest \
  tunnel --no-autoupdate run \
  --token SEU_TOKEN_AQUI
```

### 6.4 Configurar rotas no Cloudflare

Adicione **2 rotas** no painel do tunnel:

| Subdomínio | Domínio | Tipo | URL |
|------------|---------|------|-----|
| `financeiro` | seudominio.com | HTTP | `localhost:8080` |
| `api-financeiro` | seudominio.com | HTTP | `localhost:8000` |

### 6.5 Atualizar a aplicação

```bash
cd ~/fincontrol

# Atualizar URL da API para o domínio externo
cat > .env.local <<EOF
VITE_SUPABASE_URL=https://api-financeiro.seudominio.com
VITE_SUPABASE_PUBLISHABLE_KEY=local
VITE_SUPABASE_PROJECT_ID=local
EOF

# Rebuild
npm run build
cp -r dist/ instalador/dist/
cd instalador && docker compose restart app
```

### 6.6 Testar

| Acesso | URL |
|--------|-----|
| Rede local | `http://192.168.1.100:8080` |
| Externo | `https://financeiro.seudominio.com` |

---

## 7. Gerenciar Backups

### Configuração automática

| Parâmetro | Valor |
|-----------|-------|
| Frequência | Todo **sábado às 12h** |
| Limite | **3 backups** (mais antigo é apagado) |
| Formato | `.sql.gz` (SQL comprimido) |
| Local | `~/fincontrol/instalador/backups/` |

### Comandos

```bash
cd ~/fincontrol/instalador

# Backup manual
./backup.sh

# Ver backups
ls -lh backups/

# Restaurar backup
docker compose stop rest auth
gunzip -c backups/fincontrol_backup_XXXXXXXX.sql.gz | \
  docker exec -i fincontrol-db psql -U fincontrol fincontrol
docker compose start rest auth

# Verificar cron
crontab -l | grep fincontrol
```

---

## 8. Atualizar a Aplicação

```bash
cd ~/fincontrol

# Baixar atualizações
git pull

# Reinstalar e rebuildar
npm install
npm run build

# Copiar e reiniciar
cp -r dist/ instalador/dist/
cd instalador && docker compose restart app
```

> 💡 Apenas o container `app` reinicia. Banco e autenticação continuam rodando.

---

## 9. Comandos Úteis

```bash
cd ~/fincontrol/instalador

# Status dos containers
docker compose ps

# Logs em tempo real
docker compose logs -f

# Logs de um serviço
docker compose logs -f db
docker compose logs -f auth
docker compose logs -f rest

# Parar tudo
docker compose down

# Reiniciar tudo
docker compose up -d

# Uso de recursos
docker stats --no-stream

# Terminal SQL
docker exec -it fincontrol-db psql -U fincontrol fincontrol
```

---

## 10. Resolução de Problemas

### ❌ Instalador para antes de instalar Docker

```bash
# Verificar se Docker está instalado (CasaOS já inclui)
docker --version

# Se não estiver, instalar manualmente:
curl -fsSL https://get.docker.com | sudo sh

# Re-executar o instalador
sudo ./install.sh
```

### ❌ Instalador para após configuração (etapa 3)

Provavelmente o Node.js não está instalado:

```bash
# Verificar
node --version

# Instalar manualmente se necessário
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar
node --version  # deve mostrar v20.x.x
npm --version   # deve mostrar 10.x.x

# Re-executar o instalador
sudo ./install.sh
```

### ❌ "npm: command not found" durante build

```bash
# Node.js não foi instalado corretamente
# Instalar via nvm (método alternativo):
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Verificar
node --version
npm --version

# Re-executar
sudo ./install.sh
```

### ❌ Container não sobe (exit code 1)

```bash
# Ver qual container falhou
docker compose ps

# Ver o log do container problemático
docker compose logs db     # Banco
docker compose logs auth   # Autenticação
docker compose logs rest   # API

# Causas comuns:
# Porta em uso: sudo lsof -i :5432
# Memória: free -h
```

### ❌ App abre mas não carrega dados

```bash
# Verificar se a API responde
curl http://localhost:8000/rest/v1/

# Verificar o .env.local
cat ~/fincontrol/.env.local
# O VITE_SUPABASE_URL deve apontar para o IP correto

# Verificar Kong
docker compose logs gateway
```

### ❌ Não acessa de outro dispositivo

```bash
# Verificar IP
hostname -I

# Verificar firewall
sudo ufw status
# Se ativo:
sudo ufw allow 8080/tcp
sudo ufw allow 8000/tcp
```

### ❌ Refazer a instalação do zero

```bash
cd ~/fincontrol/instalador

# Parar e remover tudo
docker compose down -v    # -v remove os volumes (APAGA O BANCO!)

# Remover arquivos gerados
rm -f .env init-db.sql
rm -rf dist/

# Re-executar
sudo ./install.sh
```

---

## ✅ Checklist Final

- [ ] CasaOS instalado e acessível
- [ ] Git e curl instalados (`sudo apt install -y git curl`)
- [ ] Repositório clonado em `~/fincontrol`
- [ ] `sudo ./install.sh` executado com sucesso (7 etapas)
- [ ] 5 containers rodando (`docker compose ps`)
- [ ] Aplicação acessível em `http://IP:8080`
- [ ] Primeiro usuário criado (seção 5)
- [ ] Login funcionando
- [ ] Backup automático ativo (`crontab -l`)
- [ ] *(Opcional)* Cloudflare Tunnel para acesso externo

---

*FinControl v2.0 — Atualizado em 07/03/2026*
