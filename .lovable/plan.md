

## Plan: Rewrite Installer with Pre-configured Admin User

### Problem
GoTrue ignores environment variable changes unless the container is fully recreated. Previous attempts to toggle signup on/off failed because of cached container state.

### Solution
Rewrite the installer with a **two-phase startup**: first boot GoTrue with signup enabled, create the admin user automatically via API, then restart with signup disabled. Everything happens automatically -- no manual steps.

### Files to modify

**1. `instalador/docker-compose.yml`**
- Add `search_path=auth` to GoTrue DB URL (fixes schema issues)
- Set GoTrue to log level DEBUG for troubleshooting
- Add `GOTRUE_MAILER_AUTOCONFIRM: "true"` and `GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"`
- Keep `GOTRUE_DISABLE_SIGNUP: "false"` (will be toggled by the installer)

**2. `instalador/install.sh` (full rewrite of Etapa 7)**
- After `docker compose up -d`, add a new **Etapa 7.5: Create Admin User**:
  - Wait loop (up to 60s) checking `curl http://localhost:9999/health` until GoTrue is healthy
  - Call `POST http://localhost:9999/signup` with Luiz's credentials (email: `luiz@fincontrol.local`, password: `LGP@ss6106`, display_name: `Luiz`)
  - Extract the returned user UUID
  - Insert admin role via `docker exec psql`: `INSERT INTO public.user_roles (user_id, role) VALUES ('<UUID>', 'admin')`
  - Then update `docker-compose.yml` in-place to set `GOTRUE_DISABLE_SIGNUP: "true"`
  - Run `docker compose up -d --force-recreate --no-deps auth` to lock down signup
  - Update final success message to show login credentials

**3. `instalador/init-db.sql` (regenerated in install.sh)**
- Add `CREATE SCHEMA IF NOT EXISTS auth` with proper grants
- Add `supabase_auth_admin` role creation and grants on `auth` schema
- Set `search_path` for the `fincontrol` user to `public, auth`

### Key technical decisions
- GoTrue's `/signup` endpoint on port 9999 (direct, not via Kong) is the most reliable path
- `GOTRUE_MAILER_AUTOCONFIRM: "true"` ensures the user is immediately confirmed without email verification
- `sed -i` is used to flip `DISABLE_SIGNUP` to `"true"` after admin creation, then `--force-recreate` ensures the change takes effect
- Admin credentials are hardcoded as requested: `luiz` / `LGP@ss6106`

### What the user needs to do
1. `docker compose down -v` (clean slate)
2. `rm -f init-db.sql .env` (remove old configs)
3. `./install.sh` (everything automated)
4. Open `http://IP:8080` and login with `luiz` / `LGP@ss6106`

