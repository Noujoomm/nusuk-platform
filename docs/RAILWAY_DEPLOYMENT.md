# Railway Deployment Guide — NUSUK Platform

## Architecture

```
Railway Project
├── PostgreSQL (managed)
├── api (NestJS)     → https://nusuk-api-production-XXXX.up.railway.app
└── web (Next.js)    → https://nusuk-web-production-XXXX.up.railway.app
```

---

## Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click **New Project** → **Empty Project**
3. Name it `nusuk-platform`

---

## Step 2: Add PostgreSQL

1. Inside the project, click **New** → **Database** → **Add PostgreSQL**
2. Railway auto-provisions the database
3. Click the PostgreSQL service → **Variables** tab
4. Copy the `DATABASE_URL` value (you'll need it for the API service)

---

## Step 3: Deploy API Service

1. Click **New** → **GitHub Repo** → Select `Noujoomm/nusuk-platform`
2. In the service settings:
   - **Service Name**: `api`
   - **Root Directory**: `apps/api`
   - **Build Command**:
     ```
     npm ci && npx prisma generate && npm run build
     ```
   - **Start Command**:
     ```
     npx prisma migrate deploy && node dist/main.js
     ```
3. Go to **Settings** → **Networking** → **Generate Domain** (creates public HTTPS URL)
4. Note the generated URL: `https://api-production-XXXX.up.railway.app`

### API Environment Variables

Go to the **Variables** tab and add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (use Railway reference) |
| `JWT_SECRET` | Generate: `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET` | Generate: `openssl rand -base64 32` |
| `JWT_ACCESS_EXPIRES` | `15m` |
| `JWT_REFRESH_EXPIRES` | `7d` |
| `NODE_ENV` | `production` |
| `CORS_ORIGINS` | `https://web-production-XXXX.up.railway.app` (your web URL) |
| `PORT` | `4000` |

---

## Step 4: Deploy Web Service

1. Click **New** → **GitHub Repo** → Select `Noujoomm/nusuk-platform` (same repo)
2. In the service settings:
   - **Service Name**: `web`
   - **Root Directory**: `apps/web`
   - **Build Command**:
     ```
     npm ci && npm run build && cp -r .next/static .next/standalone/apps/web/.next/static && cp -r public .next/standalone/apps/web/public
     ```
   - **Start Command**:
     ```
     node .next/standalone/apps/web/server.js
     ```
3. Go to **Settings** → **Networking** → **Generate Domain**
4. Note the generated URL: `https://web-production-XXXX.up.railway.app`

### Web Environment Variables

Go to the **Variables** tab and add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api-production-XXXX.up.railway.app` (your API URL) |
| `NEXT_PUBLIC_SOCKET_URL` | `https://api-production-XXXX.up.railway.app` (same as API URL) |
| `PORT` | `3000` |
| `NODE_ENV` | `production` |

---

## Step 5: Cross-Reference URLs

After both services have generated their domains:

1. **Update API `CORS_ORIGINS`** with the actual web URL
2. **Update Web `NEXT_PUBLIC_API_BASE_URL`** with the actual API URL
3. **Update Web `NEXT_PUBLIC_SOCKET_URL`** with the actual API URL

---

## Step 6: Redeploy

1. After setting all variables, click **Deploy** on both services
2. Railway will rebuild and redeploy automatically
3. Wait for both services to show **Active** status

---

## Step 7: Seed the Database

Option A — Using Railway CLI:

```bash
npm install -g @railway/cli
railway login
railway link  # select your project
railway run -s api -- npx prisma db seed
```

Option B — Using Railway Shell:

1. Go to the **api** service → **Settings** → open the **Shell** tab
2. Run:
   ```bash
   npx prisma db seed
   ```

---

## Step 8: Import Excel Data (Optional)

If you need to import the Excel data:

```bash
railway run -s api -- npx ts-node scripts/import_excel.py
```

Or use the Railway shell to run the import script.

---

## WebSocket Configuration

Socket.IO works over HTTPS automatically on Railway:

- Transport: `websocket` with `polling` fallback
- No special port configuration needed
- Railway handles WebSocket upgrades via the same HTTPS URL
- Client connects to: `https://api-production-XXXX.up.railway.app`

---

## Custom Domain (Optional)

1. Go to service **Settings** → **Networking** → **Custom Domain**
2. Enter your domain (e.g., `api.nusuk.sa`, `app.nusuk.sa`)
3. Add the CNAME record to your DNS:
   ```
   CNAME  api  →  api-production-XXXX.up.railway.app
   CNAME  app  →  web-production-XXXX.up.railway.app
   ```
4. Railway auto-provisions SSL certificates
5. Update `CORS_ORIGINS` and `NEXT_PUBLIC_*` vars with the custom domains

---

## Verification Checklist

After deployment, verify:

- [ ] `https://API_URL/health` returns `{ "status": "ok" }`
- [ ] Login works at `https://WEB_URL/login` (admin@nusuk.sa / admin123)
- [ ] Dashboard loads with track statistics
- [ ] CRUD operations work (create/edit/delete records)
- [ ] Real-time updates work (open 2 browsers, edit in one, see update in other)
- [ ] Audit logs are saved (check /audit page)
- [ ] HTTPS working (no mixed content warnings)
- [ ] No CORS errors in browser console

---

## Troubleshooting

### CORS Errors
- Ensure `CORS_ORIGINS` on API matches the exact web URL (including `https://`, no trailing slash)
- Redeploy the API after changing `CORS_ORIGINS`

### Database Connection
- Use `${{Postgres.DATABASE_URL}}` Railway reference instead of hardcoded URL
- Check PostgreSQL service is running

### WebSocket Not Connecting
- Ensure `NEXT_PUBLIC_SOCKET_URL` points to the API URL
- Check browser console for connection errors
- Verify API service is running

### Build Failures
- Check build logs in Railway dashboard
- Ensure `prisma generate` runs before `npm run build` in API
- For web, ensure `NEXT_PUBLIC_*` vars are set as build-time variables

### Prisma Migration Fails
- Check `DATABASE_URL` is set correctly
- Ensure PostgreSQL service is healthy
- Try running migrations manually via Railway shell
