# 🚀 FinControl — Guia Completo de Instalação no CasaOS

> **Pré-requisito:** CasaOS já instalado e acessível via navegador.
> Se ainda não instalou: `curl -fsSL https://get.casaos.io | sudo bash`

---

## 📑 Índice

1. [Preparar o Servidor](#1-preparar-o-servidor)
2. [Baixar o Projeto](#2-baixar-o-projeto)
3. [Executar o Instalador Automático](#3-executar-o-instalador-automático)
4. [O que o Instalador Faz (detalhes)](#4-o-que-o-instalador-faz)
5. [Testar o Acesso Local](#5-testar-o-acesso-local)
6. [Configurar Acesso Externo (fora da rede)](#6-configurar-acesso-externo)
7. [Gerenciar Backups](#7-gerenciar-backups)
8. [Atualizar a Aplicação](#8-atualizar-a-aplicação)
9. [Comandos Úteis](#9-comandos-úteis)
10. [Resolução de Problemas](#10-resolução-de-problemas)

---

## 1. Preparar o Servidor

### 1.1 Acessar o terminal do CasaOS

Você tem 3 opções para acessar o terminal do seu servidor:

**Opção A — SSH (recomendado):**
```bash
# Do seu computador, abra o terminal e conecte:
ssh seu_usuario@IP_DO_SERVIDOR

# Exemplo:
ssh luiz@192.168.1.100
```

> 💡 **Como descobrir o IP?** No CasaOS, o IP aparece na barra superior do painel web.
> Ou no terminal do servidor: `hostname -I | awk '{print $1}'`

**Opção B — Terminal do CasaOS:**
- Abra o painel do CasaOS no navegador (`http://IP_DO_SERVIDOR`)
- Vá em **Configurações → Terminal** (se disponível na sua versão)

**Opção C — Monitor + teclado:**
- Conecte monitor e teclado diretamente no servidor

### 1.2 Verificar requisitos mínimos

```bash
# Verificar memória (mínimo 2 GB)
free -h

# Verificar espaço em disco (mínimo 10 GB livres)
df -h /

# Verificar arquitetura (x86_64 ou aarch64)
uname -m
```

### 1.3 Instalar Git (se não tiver)

```bash
sudo apt update && sudo apt install -y git curl
```

> O instalador cuida de Docker e Node.js automaticamente, mas o **git** e **curl** são necessários antes.

---

## 2. Baixar o Projeto

### 2.1 Conectar ao GitHub (se repositório privado)

Se o repositório for **privado**, configure uma chave SSH:

```bash
# Gerar chave SSH (pressione Enter em tudo)
ssh-keygen -t ed25519 -C "seu@email.com"

# Copiar a chave pública
cat ~/.ssh/id_ed25519.pub
```

Copie o conteúdo exibido e adicione no GitHub:
1. Acesse [github.com/settings/keys](https://github.com/settings/keys)
2. Clique **"New SSH key"**
3. Cole a chave e salve

Se for **público**, pule este passo.

### 2.2 Clonar o repositório

```bash
# Navegue até onde deseja instalar
cd ~

# Clone o repositório (troque pela URL real)
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git fincontrol

# Entre na pasta do instalador
cd fincontrol/instalador
```

> 📁 Isso cria a pasta `~/fincontrol` com todo o código do projeto.

---

## 3. Executar o Instalador Automático

### 3.1 Dar permissão e executar

```bash
chmod +x install.sh backup.sh
./install.sh
```

### 3.2 O que será perguntado durante a instalação

O instalador faz 3 perguntas simples:

| Pergunta | O que informar | Padrão |
|----------|---------------|--------|
| **Senha do banco** | Uma senha forte para o PostgreSQL | `FinControl2026!` |
| **JWT Secret** | Chave de segurança para autenticação | Gerado automaticamente |
| **IP do servidor** | IP local do seu servidor | Detectado automaticamente |

> 💡 **Dica:** Na maioria dos casos, basta pressionar **Enter** em tudo para usar os padrões.

### 3.3 Acompanhar a instalação

A instalação leva de **3 a 10 minutos** dependendo da velocidade da internet. Você verá:

```
════════════════════════════════════════════════════
   FinControl – Instalador Automático v1.0
════════════════════════════════════════════════════

[✔] Docker já instalado: Docker version 24.x.x
[✔] Docker Compose disponível.
[✔] Node.js já instalado: v20.x.x
[✔] Repositório encontrado em /home/user/fincontrol
[!] Configuração inicial (pressione Enter para usar os padrões)
[✔] Configuração salva
[✔] init-db.sql gerado
[✔] Instalando dependências...
[✔] Fazendo build de produção...
[✔] Build concluído
[✔] Backup automático agendado: sábados às 12h
[✔] Subindo serviços Docker...

[✔] ═══════════════════════════════════════════════
[✔]   FinControl instalado com sucesso! 🎉
[✔] ═══════════════════════════════════════════════

[✔]   🌐 Aplicação:  http://192.168.1.100:8080
[✔]   🔌 API REST:   http://192.168.1.100:8000/rest/v1/
[✔]   🔐 Auth:       http://192.168.1.100:8000/auth/v1/
[✔]   🗄️  PostgreSQL: 192.168.1.100:5432
[✔]   💾 Backups:    Sábados às 12h (máx 3)
```

### 3.4 Verificar se tudo subiu

```bash
# Ver status dos containers
docker ps

# Deve mostrar 5 containers rodando:
# fincontrol-db       (PostgreSQL)
# fincontrol-auth     (Autenticação)
# fincontrol-rest     (API REST)
# fincontrol-gateway  (Kong API Gateway)
# fincontrol-app      (Nginx + React)
```

Se algum container não estiver rodando:
```bash
# Ver logs do container com problema
docker logs fincontrol-db
docker logs fincontrol-auth
docker logs fincontrol-rest
```

---

## 4. O que o Instalador Faz

Para referência, aqui está tudo que o `install.sh` configura automaticamente:

### Arquitetura dos serviços

```
  Navegador (porta 8080)
       │
  ┌────▼─────┐
  │  Nginx   │  ← Serve o frontend React
  └──────────┘
  
  Navegador (porta 8000)
       │
  ┌────▼─────┐
  │   Kong   │  ← API Gateway (roteia requisições)
  │ Gateway  │
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

| Serviço | Porta | Função |
|---------|-------|--------|
| **Nginx** | 8080 | Serve a aplicação web (HTML/JS/CSS) |
| **Kong** | 8000 | Roteia `/auth/v1/*` e `/rest/v1/*` |
| **GoTrue** | 9999 (interna) | Login, cadastro, sessões |
| **PostgREST** | 3000 (interna) | API REST automática sobre PostgreSQL |
| **PostgreSQL** | 5432 | Banco de dados com todas as tabelas |

### Tabelas criadas automaticamente

- `user_roles` — Controle de permissões (admin/user)
- `categories` — Categorias de receitas/despesas
- `cards` — Cartões de crédito
- `transactions` — Lançamentos financeiros
- `savings` — Poupança e reservas
- `fixed_entries` — Receitas e despesas fixas recorrentes

---

## 5. Testar o Acesso Local

### 5.1 Acessar pelo navegador (rede local)

Em qualquer dispositivo conectado à **mesma rede Wi-Fi/Ethernet** do servidor:

```
http://IP_DO_SERVIDOR:8080
```

Exemplo: `http://192.168.1.100:8080`

### 5.2 Testar a API

```bash
# Testar se a API REST responde
curl http://IP_DO_SERVIDOR:8000/rest/v1/

# Testar se a autenticação responde
curl http://IP_DO_SERVIDOR:8000/auth/v1/health
```

### 5.3 Criar o primeiro usuário

Como o signup público está desabilitado por segurança, crie o usuário via API:

```bash
# Substitua com seus dados reais
curl -X POST http://IP_DO_SERVIDOR:8000/auth/v1/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_JWT_SERVICE_ROLE_KEY" \
  -d '{
    "email": "seu@email.com",
    "password": "SuaSenhaForte123!",
    "email_confirm": true
  }'
```

> ⚠️ **Nota:** O `JWT_SERVICE_ROLE_KEY` precisa ser gerado a partir do `JWT_SECRET` que foi configurado na instalação. Veja a seção de resolução de problemas para instruções.

### 5.4 Acessar pelo celular (rede local)

1. Conecte o celular à **mesma rede Wi-Fi** do servidor
2. Abra o navegador do celular
3. Digite: `http://IP_DO_SERVIDOR:8080`
4. 💡 **Dica:** Adicione à tela inicial para funcionar como app nativo

---

## 6. Configurar Acesso Externo

Para acessar de **fora da rede local** (escritório, celular fora de casa, etc.), recomendo o **Cloudflare Tunnel** — é gratuito, seguro e não expõe portas no roteador.

### 6.1 Criar conta no Cloudflare

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com) e crie uma conta
2. Você precisará de um **domínio** (pode ser um barato, ~R$10/ano no [Registro.br](https://registro.br) ou [Namecheap](https://namecheap.com))
3. Adicione o domínio no Cloudflare e siga as instruções para apontar os nameservers

> 💡 **Por que um domínio?** O Cloudflare Tunnel precisa de um domínio para criar a URL segura (ex: `financeiro.seudominio.com`). É o único custo envolvido.

### 6.2 Criar o Tunnel no Cloudflare

1. No painel do Cloudflare, vá em **Zero Trust** (menu lateral)
2. Clique em **Networks → Tunnels**
3. Clique **"Create a tunnel"**
4. Escolha **"Cloudflared"** como tipo
5. Dê um nome ao tunnel (ex: `fincontrol`)
6. **Copie o token** que aparece na tela (é uma string longa)

### 6.3 Instalar o Cloudflared no servidor

No terminal do seu servidor (SSH ou direto):

```bash
# Instalar o cloudflared via Docker
docker run -d \
  --name cloudflare-tunnel \
  --restart always \
  --network host \
  cloudflare/cloudflared:latest \
  tunnel --no-autoupdate run \
  --token SEU_TOKEN_COPIADO_AQUI
```

> ⚠️ **Substitua** `SEU_TOKEN_COPIADO_AQUI` pelo token real que você copiou no passo anterior.

### 6.4 Configurar as rotas no Cloudflare

De volta ao painel do Cloudflare, na configuração do tunnel, adicione **2 rotas públicas**:

**Rota 1 — Aplicação web:**

| Campo | Valor |
|-------|-------|
| Subdomain | `financeiro` (ou o que preferir) |
| Domain | `seudominio.com` |
| Service Type | `HTTP` |
| URL | `localhost:8080` |

**Rota 2 — API (autenticação e dados):**

| Campo | Valor |
|-------|-------|
| Subdomain | `api-financeiro` |
| Domain | `seudominio.com` |
| Service Type | `HTTP` |
| URL | `localhost:8000` |

Clique **"Save tunnel"**.

### 6.5 Atualizar a aplicação para usar o domínio externo

Após configurar o tunnel, atualize o `.env` da aplicação para usar a URL externa:

```bash
cd ~/fincontrol

# Editar o .env.local
nano .env.local
```

Altere para:
```env
VITE_SUPABASE_URL=https://api-financeiro.seudominio.com
VITE_SUPABASE_PUBLISHABLE_KEY=local
VITE_SUPABASE_PROJECT_ID=local
```

Rebuild e reinicie:
```bash
npm run build
cp -r dist/ instalador/dist/
cd instalador
docker compose restart app
```

### 6.6 Testar o acesso externo

1. **Desconecte do Wi-Fi** do servidor (use dados móveis no celular)
2. Acesse: `https://financeiro.seudominio.com`
3. ✅ Deve abrir a aplicação com **HTTPS automático**

### Resultado final

| Acesso | URL |
|--------|-----|
| Dentro de casa | `http://192.168.1.100:8080` |
| Fora de casa | `https://financeiro.seudominio.com` |
| API interna | `http://192.168.1.100:8000` |
| API externa | `https://api-financeiro.seudominio.com` |

### Benefícios do Cloudflare Tunnel

- ✅ **HTTPS automático** — certificado SSL gratuito
- ✅ **Sem abrir portas** no roteador — zero configuração de firewall
- ✅ **IP dinâmico OK** — funciona mesmo que seu provedor mude o IP
- ✅ **Proteção DDoS** — tráfego filtrado pelo Cloudflare
- ✅ **Gratuito** — o tunnel em si é grátis, só o domínio tem custo

---

## 7. Gerenciar Backups

O instalador configura backup automático do banco de dados.

### Configuração padrão

| Parâmetro | Valor |
|-----------|-------|
| **Frequência** | Todo sábado às 12h |
| **Limite** | 3 backups (o mais antigo é apagado) |
| **Formato** | SQL comprimido (`.sql.gz`) |
| **Local** | `~/fincontrol/instalador/backups/` |

### Executar backup manual

```bash
cd ~/fincontrol/instalador
./backup.sh
```

### Ver backups existentes

```bash
ls -lh ~/fincontrol/instalador/backups/
```

Saída esperada:
```
-rw-r--r-- 1 user user 45K Mar 01 12:00 fincontrol_backup_20260301_120000.sql.gz
-rw-r--r-- 1 user user 47K Feb 22 12:00 fincontrol_backup_20260222_120000.sql.gz
-rw-r--r-- 1 user user 43K Feb 15 12:00 fincontrol_backup_20260215_120000.sql.gz
```

### Restaurar um backup

```bash
# Pare a aplicação primeiro (opcional, mas recomendado)
cd ~/fincontrol/instalador
docker compose stop rest auth

# Restaure o backup desejado
gunzip -c backups/fincontrol_backup_XXXXXXXX.sql.gz | \
  docker exec -i fincontrol-db psql -U fincontrol fincontrol

# Reinicie os serviços
docker compose start rest auth
```

### Verificar se o cron está ativo

```bash
crontab -l | grep fincontrol
```

Deve mostrar algo como:
```
0 12 * * 6 /home/user/fincontrol/instalador/backup.sh >> /home/user/fincontrol/instalador/backups/cron.log 2>&1
```

---

## 8. Atualizar a Aplicação

Quando houver novas versões no GitHub:

```bash
cd ~/fincontrol

# 1. Baixar atualizações
git pull

# 2. Reinstalar dependências (se mudaram)
npm install

# 3. Rebuild
npm run build

# 4. Copiar para o instalador
cp -r dist/ instalador/dist/

# 5. Reiniciar o container da aplicação
cd instalador
docker compose restart app
```

> 💡 Apenas o container `app` precisa reiniciar. O banco de dados e autenticação continuam funcionando.

---

## 9. Comandos Úteis

### Gerenciar serviços

```bash
cd ~/fincontrol/instalador

# Ver status de todos os containers
docker compose ps

# Ver logs em tempo real (Ctrl+C para sair)
docker compose logs -f

# Ver logs de um serviço específico
docker compose logs -f app
docker compose logs -f db
docker compose logs -f auth

# Parar todos os serviços
docker compose down

# Iniciar todos os serviços
docker compose up -d

# Reiniciar um serviço específico
docker compose restart app
docker compose restart db
```

### Acessar o banco de dados diretamente

```bash
# Abrir terminal SQL interativo
docker exec -it fincontrol-db psql -U fincontrol fincontrol

# Exemplos de consultas úteis:
# Ver todas as tabelas
\dt

# Ver usuários cadastrados
SELECT * FROM user_roles;

# Ver categorias
SELECT * FROM categories LIMIT 10;

# Sair do psql
\q
```

### Verificar uso de recursos

```bash
# Memória e CPU dos containers
docker stats --no-stream

# Espaço em disco
df -h /
du -sh ~/fincontrol/instalador/backups/
```

---

## 10. Resolução de Problemas

### ❌ "Container não sobe" ou "exit code 1"

```bash
# Ver o log detalhado
docker compose logs db    # Problemas de banco
docker compose logs auth  # Problemas de autenticação

# Causas comuns:
# - Porta já em uso: sudo lsof -i :5432
# - Memória insuficiente: free -h
# - Permissão de volume: ls -la /var/lib/docker/volumes/
```

### ❌ "Aplicação abre mas não carrega dados"

1. Verifique se a API está respondendo:
   ```bash
   curl http://localhost:8000/rest/v1/
   ```
2. Verifique se o `.env.local` tem o IP correto:
   ```bash
   cat ~/fincontrol/.env.local
   ```
3. Verifique se o Kong está roteando corretamente:
   ```bash
   docker compose logs gateway
   ```

### ❌ "Não consigo acessar de outro dispositivo na rede"

1. Verifique o IP do servidor:
   ```bash
   hostname -I
   ```
2. Verifique se o firewall não está bloqueando:
   ```bash
   sudo ufw status
   # Se ativo, libere as portas:
   sudo ufw allow 8080/tcp
   sudo ufw allow 8000/tcp
   ```
3. Teste conectividade do outro dispositivo:
   ```bash
   ping IP_DO_SERVIDOR
   ```

### ❌ "Cloudflare Tunnel não conecta"

1. Verifique se o container do cloudflared está rodando:
   ```bash
   docker logs cloudflare-tunnel
   ```
2. Verifique se o token está correto (sem espaços extras)
3. Certifique-se de que o servidor tem acesso à internet:
   ```bash
   curl -I https://cloudflare.com
   ```

### ❌ "Gerar JWT_SERVICE_ROLE_KEY"

Para criar usuários via API, você precisa de um token de serviço:

```bash
# Ler o JWT_SECRET configurado
cat ~/fincontrol/instalador/.env | grep JWT_SECRET

# Use um gerador JWT online (ex: jwt.io) com o payload:
# {
#   "role": "service_role",
#   "iss": "supabase",
#   "iat": 1735689600,
#   "exp": 2051222400
# }
# E assine com o JWT_SECRET usando HS256
```

Ou use o Node.js:
```bash
node -e "
const jwt = require('jsonwebtoken');
const secret = '$(grep JWT_SECRET ~/fincontrol/instalador/.env | cut -d= -f2)';
const token = jwt.sign(
  { role: 'service_role', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 315360000 },
  secret,
  { algorithm: 'HS256' }
);
console.log(token);
"
```

---

## ✅ Checklist Final

- [ ] CasaOS instalado e acessível
- [ ] Git e curl instalados
- [ ] Repositório clonado em `~/fincontrol`
- [ ] `install.sh` executado com sucesso
- [ ] 5 containers rodando (`docker ps`)
- [ ] Aplicação acessível em `http://IP:8080`
- [ ] API respondendo em `http://IP:8000/rest/v1/`
- [ ] Primeiro usuário criado
- [ ] Backup automático configurado (`crontab -l`)
- [ ] *(Opcional)* Cloudflare Tunnel configurado
- [ ] *(Opcional)* Acesso externo testado via HTTPS

---

*Documento atualizado em 07/03/2026 — FinControl v1.0*
