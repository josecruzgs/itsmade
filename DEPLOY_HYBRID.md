# Despliegue híbrido — itsMade

Setup de producción: **Vercel hostea el Next.js, un VPS hostea Evolution API**.
Si ya operas TomaLab en el mismo VPS, ambos coexisten sin conflicto: nombres
de contenedor, network y volúmenes prefijados con `itsmade-`, puerto distinto
(8082 vs 8080 de TomaLab), instancia Evolution `itsmade`.

```
GitHub ──► Vercel (Next.js) ◄── HTTPS ── Cliente / panel admin
                │                              │
                │ /api/webhook/evolution       │ Login + acciones
                ▲                              ▼
                │                          Supabase (gestionado)
                │
HTTPS ──► reverse proxy del panel ──► Docker network (itsmade-net)
          (cloudflare/nginx)              │
                                          ├── itsmade-evolution-api      (puerto 8080 interno)
                                          ├── itsmade-evolution-postgres
                                          └── itsmade-evolution-redis
```

## Resumen de URLs

| Servicio | URL | Donde |
|---|---|---|
| Panel itsMade | `https://itsmade.vercel.app` (placeholder) | Vercel |
| Webhook | `https://itsmade.vercel.app/api/webhook/evolution` | Vercel |
| Evolution API | `https://evolution.itsmade.tudominio.com` (TBD) | VPS detrás de reverse proxy |
| Supabase | `https://<project>.supabase.co` | Supabase gestionado |

---

## Paso 1 — VPS: levantar Evolution

### 1.1 Verificar puertos disponibles

Si TomaLab ya corre en este VPS, los puertos 8080 y 8081 estarán ocupados.
Antes de continuar:

```bash
ssh user@tu-vps
ss -tlnp | grep -E ':(8080|8081|8082)'
```

itsMade usará 8082 internamente. Si por alguna razón está tomado, ajusta el
puerto en `docker-compose.evolution-only.yml` (bloque `ports` comentado).

### 1.2 Clonar el repo en un directorio dedicado

```bash
sudo mkdir -p /opt/itsmade-evolution
sudo chown $USER:$USER /opt/itsmade-evolution
cd /opt/itsmade-evolution
```

Solo necesitamos el `docker-compose.evolution-only.yml` y el `.env`. Puedes
clonarlo entero o copiar solo esos dos archivos:

```bash
# Opción A: clonar entero (recomendado para mantener actualizado)
git clone https://github.com/<tu-usuario>/itsmade.git .

# Opción B: copiar solo lo necesario
scp docker-compose.evolution-only.yml user@vps:/opt/itsmade-evolution/
scp .env.evolution.example user@vps:/opt/itsmade-evolution/.env
```

### 1.3 Configurar `.env`

```bash
cd /opt/itsmade-evolution
nano .env
```

Contenido (basado en `.env.evolution.example`):

```env
EVOLUTION_PUBLIC_URL=https://evolution.itsmade.tudominio.com
VERCEL_WEBHOOK_URL=https://itsmade.vercel.app/api/webhook/evolution

# Genera con: openssl rand -hex 32
EVOLUTION_API_KEY=<resultado-de-openssl>

# Genera con: openssl rand -hex 24
EVOLUTION_DB_PASSWORD=<resultado-de-openssl>
```

> **Importante**: guarda `EVOLUTION_API_KEY` — necesitarás pegarlo en Vercel
> (paso 2.2) y en el Evolution Manager para crear la instancia.

### 1.4 Configurar reverse proxy del panel

Dependiendo de tu panel (hPanel/CyberPanel/Plesk/cPanel) o nginx custom,
crea un subdominio `evolution.itsmade.tudominio.com` que haga proxy al
contenedor `itsmade-evolution-api` en el puerto 8080 de la red docker
`itsmade-net`.

**Ejemplo nginx** (si lo tienes raw):

```nginx
server {
    server_name evolution.itsmade.tudominio.com;
    listen 443 ssl http2;

    ssl_certificate     /etc/letsencrypt/live/evolution.itsmade.tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/evolution.itsmade.tudominio.com/privkey.pem;

    location / {
        proxy_pass http://itsmade-evolution-api:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

Si nginx no está en el mismo network docker, descomenta el bloque `ports`
en `docker-compose.evolution-only.yml` para publicar 8082 al host:

```yaml
ports:
  - "127.0.0.1:8082:8080"
```

Y apunta nginx a `127.0.0.1:8082`.

**Alternativa con Cloudflared** (mientras configuras Cloudflare DNS):
descomenta el bloque `cloudflared` del compose. Te dará una URL HTTPS
temporal.

### 1.5 Levantar el stack

```bash
cd /opt/itsmade-evolution
docker compose -p itsmade-evolution -f docker-compose.evolution-only.yml up -d
docker compose -p itsmade-evolution -f docker-compose.evolution-only.yml ps
```

El `-p itsmade-evolution` evita colisión con TomaLab si ambos viven aquí.

### 1.6 Crear la instancia en Evolution Manager

Abre `https://evolution.itsmade.tudominio.com/manager` (o la URL pública que
hayas configurado). Login con `EVOLUTION_API_KEY` como Global API Key.

- **Crear instancia**: nombre = `itsmade` (debe coincidir exactamente con
  `EVOLUTION_INSTANCE_NAME` del `.env` de Vercel — paso 2.2).
- En la ficha de la instancia recién creada, copia el campo "Token"
  (lo necesitarás como `EVOLUTION_INSTANCE_TOKEN` en Vercel — opcional pero
  recomendado para Evolution v2).

---

## Paso 2 — Vercel: deploy del Next.js

### 2.1 Push a GitHub

```powershell
git add .
git commit -m "Initial deploy"
git push origin main
```

En Vercel:
- New Project → Import desde GitHub.
- Framework: Next.js (autodetectado).
- Root directory: `/`.
- Build: defaults.

### 2.2 Configurar variables de entorno

En Vercel Dashboard → tu proyecto → Settings → Environment Variables, agrega
**todas las variables** de `.env.example` con sus valores reales:

```
NEXT_PUBLIC_APP_URL          https://itsmade.vercel.app   # o tu dominio
NEXT_PUBLIC_SUPABASE_URL     https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY <anon key de Supabase>
SUPABASE_SERVICE_ROLE_KEY    <service role key de Supabase>
SUPABASE_STORAGE_BUCKET      feedback
ANTHROPIC_API_KEY            sk-ant-...
ANTHROPIC_MODEL              claude-sonnet-4-6
EVOLUTION_API_URL            https://evolution.itsmade.tudominio.com
EVOLUTION_API_KEY            <mismo valor que en el VPS>
EVOLUTION_INSTANCE_NAME      itsmade
EVOLUTION_INSTANCE_TOKEN     <token de la instancia que creaste en Manager>
CRON_SECRET                  <openssl rand -hex 32>
CONVERSATION_AUTO_CLOSE_HOURS 72
FEEDBACK_REQUEST_EXPIRY_HOURS 48
```

> **Importante**: `EVOLUTION_API_KEY` debe ser **idéntico** al del VPS.
> `EVOLUTION_INSTANCE_NAME` debe coincidir exactamente con la instancia que
> creaste en el Manager (paso 1.6).

Tras guardar, haz **Redeploy** desde el dashboard.

### 2.3 Aplicar migraciones a Supabase (una sola vez)

En Supabase Dashboard → SQL Editor, ejecuta en orden:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_auth_profiles.sql`
3. `supabase/migrations/0003_feedback_requests_fk.sql`
4. `supabase/seed.sql`

### 2.4 Crear primer admin

Localmente (con `.env.local` apuntando al Supabase de producción):

```powershell
node scripts/create-admin.mjs admin@itsmade.com.mx "tuPassword123" "Admin"
```

### 2.5 Conectar WhatsApp

- Entra a `https://itsmade.vercel.app/login` con esas credenciales.
- Ve a `/settings`. El componente Evolution mostrará el QR.
- Escanea desde el WhatsApp del número que va a operar itsMade.
- ⚠️ **Debe ser un número distinto al de TomaLab** — WhatsApp no permite
  vincular el mismo número a dos instancias diferentes simultáneamente.

---

## Monitoreo

### Logs Evolution (VPS)

```bash
docker compose -p itsmade-evolution -f docker-compose.evolution-only.yml logs -f evolution-api
```

### Logs Next.js (Vercel)

Vercel Dashboard → tu proyecto → Logs.

Los crons aparecen como `cron` en la columna "Type" cada día a las 09:00
y 10:00 UTC.

### Health check

```bash
curl https://itsmade.vercel.app/api/health
# {"status":"ok","service":"itsmade","timestamp":"..."}
```

---

## Rollback

### Vercel
- Deployments tab → cualquier deploy previo → "Promote to Production".

### VPS
```bash
cd /opt/itsmade-evolution
docker compose -p itsmade-evolution -f docker-compose.evolution-only.yml down
git checkout <commit-anterior>
docker compose -p itsmade-evolution -f docker-compose.evolution-only.yml up -d
```

### Supabase
Las migraciones no son reversibles automáticamente. Antes de aplicar
cambios destructivos a producción, exporta el schema con
`pg_dump --schema-only` desde el dashboard.

---

## Troubleshooting

| Síntoma | Causa probable | Acción |
|---|---|---|
| Webhook 401 en Vercel logs | `EVOLUTION_API_KEY` no coincide entre VPS y Vercel | Sincronizar y redeploy |
| Webhook 401 + payload con apikey raro | Evolution v2 firma con instance token | Setear `EVOLUTION_INSTANCE_TOKEN` en Vercel |
| QR no aparece en `/settings` | Reverse proxy no llega al contenedor | `docker compose ps` + revisar nginx config |
| Bot no responde tras escanear | Evolution no envía webhook | Verificar `WEBHOOK_GLOBAL_URL` en `docker-compose.evolution-only.yml` apunta a Vercel |
| Bot responde dos veces el mismo mensaje | El `evolution_message_id` no llegó como UNIQUE en DB | Revisar migración 0001 — la columna debe tener UNIQUE |
| Cron 401 | `CRON_SECRET` mal configurado | Vercel envía `Authorization: Bearer <CRON_SECRET>` automáticamente cuando la var está seteada |
