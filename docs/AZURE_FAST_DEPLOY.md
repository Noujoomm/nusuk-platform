# النشر السريع على Azure — منصة نُسُك
# Azure Fast Deploy — NUSUK Platform

نشر كامل باستخدام ACR + App Service + PostgreSQL.
5 أوامر فقط من الصفر إلى الإنتاج.

---

## المتطلبات

```bash
# تأكد من تثبيت Azure CLI
az --version

# تسجيل الدخول
az login
```

---

## الخطوة 1: إنشاء مجموعة الموارد

```bash
az group create --name rg-nusuk --location westeurope
```

---

## الخطوة 2: نشر البنية التحتية بالكامل (Bicep)

أمر واحد ينشئ: ACR + PostgreSQL + App Service Plan + API App + Web App

```bash
az deployment group create \
  --resource-group rg-nusuk \
  --template-file infra/main.bicep \
  --parameters \
    pgPassword='Nusuk@Str0ng!2024' \
    jwtSecret='$(openssl rand -base64 32)' \
    jwtRefreshSecret='$(openssl rand -base64 32)'
```

> احفظ المخرجات — ستحتاج `acrLoginServer` و `acrName` و `apiUrl` و `webUrl`

لعرض المخرجات لاحقاً:
```bash
az deployment group show \
  --resource-group rg-nusuk \
  --name main \
  --query properties.outputs
```

---

## الخطوة 3: بناء ودفع صور Docker يدوياً (أول مرة)

```bash
# الحصول على اسم ACR
ACR_NAME=$(az acr list -g rg-nusuk --query "[0].name" -o tsv)
ACR_SERVER=$(az acr show -n $ACR_NAME --query "loginServer" -o tsv)

# تسجيل الدخول إلى ACR
az acr login --name $ACR_NAME

# بناء ودفع صورة API
docker build -t $ACR_SERVER/nusuk-api:latest -f apps/api/Dockerfile apps/api
docker push $ACR_SERVER/nusuk-api:latest

# بناء ودفع صورة Web (مع متغيرات البيئة)
docker build \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://nusuk-api.azurewebsites.net \
  --build-arg NEXT_PUBLIC_SOCKET_URL=https://nusuk-api.azurewebsites.net \
  -t $ACR_SERVER/nusuk-web:latest \
  -f apps/web/Dockerfile apps/web
docker push $ACR_SERVER/nusuk-web:latest
```

---

## الخطوة 4: إعادة تشغيل التطبيقات

```bash
az webapp restart --name nusuk-api --resource-group rg-nusuk
az webapp restart --name nusuk-web --resource-group rg-nusuk
```

انتظر 2-3 دقائق ثم تحقق:
```bash
curl https://nusuk-api.azurewebsites.net/health
# يجب أن يرجع: {"status":"ok","timestamp":"..."}
```

---

## الخطوة 5: تعبئة قاعدة البيانات (Seed)

```bash
# SSH إلى API container
az webapp ssh --name nusuk-api --resource-group rg-nusuk

# داخل الحاوية:
npx prisma db seed
```

أو من خلال وحدة تحكم Kudu:
```
https://nusuk-api.scm.azurewebsites.net/DebugConsole
```

---

## الخطوة 6: إعداد GitHub Actions (CI/CD تلقائي)

### إنشاء Service Principal

```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

az ad sp create-for-rbac \
  --name "github-nusuk" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/rg-nusuk \
  --sdk-auth
```

### إضافة الأسرار في GitHub

اذهب إلى: **Settings** → **Secrets and variables** → **Actions**

| السر | القيمة |
|---|---|
| `AZURE_CREDENTIALS` | مخرجات JSON الكاملة من الأمر أعلاه |
| `AZURE_RESOURCE_GROUP` | `rg-nusuk` |

بعد ذلك، أي `git push` إلى `main` سيبني وينشر تلقائياً.

---

## الروابط بعد النشر

| الخدمة | الرابط |
|---|---|
| API | `https://nusuk-api.azurewebsites.net` |
| صحة API | `https://nusuk-api.azurewebsites.net/health` |
| الواجهة | `https://nusuk-web.azurewebsites.net` |
| تسجيل الدخول | `https://nusuk-web.azurewebsites.net/login` |

بيانات الدخول الافتراضية:
- مدير: `admin@nusuk.sa` / `admin123`
- مدير مشروع: `pm@nusuk.sa` / `pm123`
- قائد مسار: `lead@nusuk.sa` / `lead123`

---

## قائمة التحقق

```
✓ HTTPS يعمل (azurewebsites.net يوفر SSL تلقائياً)
✓ تسجيل الدخول يعمل
✓ عمليات CRUD تُحفظ في PostgreSQL
✓ التحديثات الفورية تعمل (افتح متصفحين)
✓ سجلات التدقيق تُحفظ (صفحة /audit)
✓ نقطة /health ترجع OK
✓ لا أخطاء CORS في وحدة تحكم المتصفح
✓ WebSockets تتصل عبر wss://
✓ لا أسرار مكشوفة
```

---

## عرض السجلات

```bash
# بث سجلات API مباشرة
az webapp log tail --name nusuk-api --resource-group rg-nusuk

# بث سجلات Web
az webapp log tail --name nusuk-web --resource-group rg-nusuk
```

---

## استكشاف الأخطاء

### الحاوية لا تبدأ
```bash
# عرض سجلات Docker
az webapp log download --name nusuk-api --resource-group rg-nusuk
```

### خطأ CORS
تأكد من أن `CORS_ORIGINS` في API يطابق عنوان Web بالضبط:
```bash
az webapp config appsettings set \
  --name nusuk-api \
  --resource-group rg-nusuk \
  --settings CORS_ORIGINS="https://nusuk-web.azurewebsites.net"
```

### WebSocket لا يتصل
تأكد من تفعيل WebSockets:
```bash
az webapp config show --name nusuk-api -g rg-nusuk --query webSocketsEnabled
# يجب أن يكون: true
```

### خطأ قاعدة البيانات
تحقق من أن PostgreSQL يسمح باتصالات Azure:
```bash
az postgres flexible-server firewall-rule list \
  --resource-group rg-nusuk \
  --name $(az postgres flexible-server list -g rg-nusuk --query "[0].name" -o tsv)
```

---

## الحذف الكامل

```bash
az group delete --name rg-nusuk --yes --no-wait
```

---

## ملخص البنية

```
rg-nusuk
├── ACR (حاويات Docker)
│   ├── nusuk-api:latest
│   └── nusuk-web:latest
├── PostgreSQL Flexible Server
│   └── nusuk_db (SSL مُفعّل)
├── App Service Plan (Linux B1)
│   ├── nusuk-api (NestJS + Prisma + Socket.IO)
│   │   ├── تهجيرات Prisma عند التشغيل
│   │   ├── WebSockets مُفعّل
│   │   └── CORS من CORS_ORIGINS
│   └── nusuk-web (Next.js standalone)
│       └── NEXT_PUBLIC_* مُضمّن وقت البناء
└── GitHub Actions CI/CD
    └── بناء + دفع + نشر عند push إلى main
```
