# دليل النشر المؤسسي على Azure — منصة نُسُك

## البنية المعمارية

```
Azure Resource Group: rg-nusuk-production
├── Azure Database for PostgreSQL (Flexible Server)
│   └── nusuk-db
├── App Service Plan (Linux, B1+)
│   ├── nusuk-api  (NestJS)     → https://nusuk-api.azurewebsites.net
│   └── nusuk-web  (Next.js)    → https://nusuk-web.azurewebsites.net
├── Azure Key Vault
│   └── kv-nusuk (مفاتيح JWT، بيانات قاعدة البيانات)
├── Azure Blob Storage
│   └── stnusukfiles (رفع الملفات حسب المسار)
├── Application Insights
│   └── ai-nusuk (المراقبة، السجلات، الأداء)
└── (اختياري) نطاق مخصص + Azure CDN
```

---

## المتطلبات الأساسية

- تثبيت Azure CLI: `az --version`
- مستودع GitHub: `Noujoomm/nusuk-platform`
- اشتراك Azure فعّال

```bash
az login
az account set --subscription "<SUBSCRIPTION_ID>"
```

---

## الخطوة 1: إنشاء مجموعة الموارد

```bash
az group create \
  --name rg-nusuk-production \
  --location westeurope
```

---

## الخطوة 2: إنشاء خادم PostgreSQL المرن

```bash
# إنشاء الخادم
az postgres flexible-server create \
  --resource-group rg-nusuk-production \
  --name nusuk-pg-server \
  --location westeurope \
  --admin-user nusukadmin \
  --admin-password '<كلمة_مرور_قوية>' \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 16 \
  --yes

# إنشاء قاعدة البيانات
az postgres flexible-server db create \
  --resource-group rg-nusuk-production \
  --server-name nusuk-pg-server \
  --database-name nusuk_db

# السماح لخدمات Azure بالاتصال
az postgres flexible-server firewall-rule create \
  --resource-group rg-nusuk-production \
  --name nusuk-pg-server \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# فرض SSL
az postgres flexible-server parameter set \
  --resource-group rg-nusuk-production \
  --server-name nusuk-pg-server \
  --name require_secure_transport \
  --value on
```

**صيغة DATABASE_URL:**
```
postgresql://nusukadmin:<PASSWORD>@nusuk-pg-server.postgres.database.azure.com:5432/nusuk_db?sslmode=require
```

---

## الخطوة 3: إنشاء حساب التخزين

```bash
# إنشاء حساب التخزين
az storage account create \
  --name stnusukfiles \
  --resource-group rg-nusuk-production \
  --location westeurope \
  --sku Standard_LRS \
  --kind StorageV2

# إنشاء حاوية Blob لرفع الملفات
az storage container create \
  --name uploads \
  --account-name stnusukfiles \
  --public-access off

# الحصول على سلسلة الاتصال (تُخزّن في Key Vault لاحقاً)
az storage account show-connection-string \
  --name stnusukfiles \
  --resource-group rg-nusuk-production \
  --query connectionString \
  --output tsv
```

---

## الخطوة 4: إنشاء خطة خدمة التطبيق

```bash
az appservice plan create \
  --name asp-nusuk-production \
  --resource-group rg-nusuk-production \
  --location westeurope \
  --is-linux \
  --sku B1
```

> لأحمال الإنتاج، استخدم `--sku S1` أو `P1v3` لأداء أفضل وقابلية توسع أعلى.

---

## الخطوة 5: إنشاء خدمة تطبيق API

```bash
# إنشاء خدمة التطبيق
az webapp create \
  --name nusuk-api \
  --resource-group rg-nusuk-production \
  --plan asp-nusuk-production \
  --runtime "NODE:20-lts"

# تفعيل WebSockets
az webapp config set \
  --name nusuk-api \
  --resource-group rg-nusuk-production \
  --web-sockets-enabled true

# تعيين أمر التشغيل
az webapp config set \
  --name nusuk-api \
  --resource-group rg-nusuk-production \
  --startup-file "npx prisma migrate deploy && node dist/main.js"

# تهيئة إعدادات التطبيق (متغيرات البيئة)
az webapp config appsettings set \
  --name nusuk-api \
  --resource-group rg-nusuk-production \
  --settings \
    NODE_ENV=production \
    PORT=8080 \
    DATABASE_URL="postgresql://nusukadmin:<PASSWORD>@nusuk-pg-server.postgres.database.azure.com:5432/nusuk_db?sslmode=require" \
    JWT_SECRET="$(openssl rand -base64 32)" \
    JWT_REFRESH_SECRET="$(openssl rand -base64 32)" \
    JWT_ACCESS_EXPIRES=15m \
    JWT_REFRESH_EXPIRES=7d \
    CORS_ORIGINS="https://nusuk-web.azurewebsites.net" \
    WEBSITES_PORT=8080

# تفعيل HTTPS فقط
az webapp update \
  --name nusuk-api \
  --resource-group rg-nusuk-production \
  --https-only true
```

---

## الخطوة 6: إنشاء خدمة تطبيق الويب

```bash
# إنشاء خدمة التطبيق
az webapp create \
  --name nusuk-web \
  --resource-group rg-nusuk-production \
  --plan asp-nusuk-production \
  --runtime "NODE:20-lts"

# تعيين أمر التشغيل
az webapp config set \
  --name nusuk-web \
  --resource-group rg-nusuk-production \
  --startup-file "node server.js"

# تهيئة إعدادات التطبيق
az webapp config appsettings set \
  --name nusuk-web \
  --resource-group rg-nusuk-production \
  --settings \
    NODE_ENV=production \
    PORT=3000 \
    WEBSITES_PORT=3000 \
    NEXT_PUBLIC_API_BASE_URL="https://nusuk-api.azurewebsites.net" \
    NEXT_PUBLIC_SOCKET_URL="https://nusuk-api.azurewebsites.net"

# تفعيل HTTPS فقط
az webapp update \
  --name nusuk-web \
  --resource-group rg-nusuk-production \
  --https-only true
```

---

## الخطوة 7: إنشاء Key Vault (إدارة الأسرار)

```bash
# إنشاء Key Vault
az keyvault create \
  --name kv-nusuk \
  --resource-group rg-nusuk-production \
  --location westeurope

# تفعيل الهوية المُدارة لخدمة تطبيق API
az webapp identity assign \
  --name nusuk-api \
  --resource-group rg-nusuk-production

# الحصول على معرّف Principal من المخرجات، ثم منح الوصول
PRINCIPAL_ID=$(az webapp identity show \
  --name nusuk-api \
  --resource-group rg-nusuk-production \
  --query principalId --output tsv)

az keyvault set-policy \
  --name kv-nusuk \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list

# تخزين الأسرار
az keyvault secret set --vault-name kv-nusuk --name JWT-SECRET --value "$(openssl rand -base64 32)"
az keyvault secret set --vault-name kv-nusuk --name JWT-REFRESH-SECRET --value "$(openssl rand -base64 32)"
az keyvault secret set --vault-name kv-nusuk --name DATABASE-URL --value "postgresql://nusukadmin:<PASSWORD>@nusuk-pg-server.postgres.database.azure.com:5432/nusuk_db?sslmode=require"

# ربط أسرار Key Vault في إعدادات التطبيق
az webapp config appsettings set \
  --name nusuk-api \
  --resource-group rg-nusuk-production \
  --settings \
    JWT_SECRET="@Microsoft.KeyVault(SecretUri=https://kv-nusuk.vault.azure.net/secrets/JWT-SECRET/)" \
    JWT_REFRESH_SECRET="@Microsoft.KeyVault(SecretUri=https://kv-nusuk.vault.azure.net/secrets/JWT-REFRESH-SECRET/)" \
    DATABASE_URL="@Microsoft.KeyVault(SecretUri=https://kv-nusuk.vault.azure.net/secrets/DATABASE-URL/)"
```

---

## الخطوة 8: إنشاء Application Insights

```bash
# إنشاء Application Insights
az monitor app-insights component create \
  --app ai-nusuk \
  --location westeurope \
  --resource-group rg-nusuk-production \
  --kind web

# الحصول على سلسلة الاتصال
APPINSIGHTS_CONN=$(az monitor app-insights component show \
  --app ai-nusuk \
  --resource-group rg-nusuk-production \
  --query connectionString --output tsv)

# إضافتها لإعدادات API
az webapp config appsettings set \
  --name nusuk-api \
  --resource-group rg-nusuk-production \
  --settings \
    APPLICATIONINSIGHTS_CONNECTION_STRING="$APPINSIGHTS_CONN"
```

---

## الخطوة 9: ربط GitHub CI/CD

### الخيار أ: GitHub Actions (موصى به)

إنشاء Service Principal لـ GitHub Actions:

```bash
az ad sp create-for-rbac \
  --name "github-nusuk-deploy" \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/rg-nusuk-production \
  --sdk-auth
```

انسخ مخرجات JSON وأضفها كسر في GitHub:

1. اذهب إلى **مستودع GitHub** ← **Settings** ← **Secrets and variables** ← **Actions**
2. أضف هذه الأسرار:

| اسم السر | القيمة |
|---|---|
| `AZURE_CREDENTIALS` | مخرجات JSON من `az ad sp create-for-rbac` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://nusuk-api.azurewebsites.net` |
| `NEXT_PUBLIC_SOCKET_URL` | `https://nusuk-api.azurewebsites.net` |

3. ادفع (Push) إلى فرع `main` لتشغيل النشر

### الخيار ب: مركز النشر في Azure

1. اذهب إلى كل App Service في بوابة Azure
2. **مركز النشر** ← **المصدر: GitHub**
3. فوّض واختر المستودع والفرع
4. Azure ينشئ سير العمل تلقائياً

---

## الخطوة 10: تعبئة قاعدة البيانات بالبيانات الأولية

بعد نشر API وتشغيل التهجيرات، عبّئ البيانات:

```bash
# الخيار 1: SSH إلى خدمة التطبيق
az webapp ssh --name nusuk-api --resource-group rg-nusuk-production

# داخل جلسة SSH:
npx prisma db seed

# الخيار 2: استخدام وحدة تحكم Kudu
# انتقل إلى: https://nusuk-api.scm.azurewebsites.net/DebugConsole
# نفّذ: npx prisma db seed
```

---

## الخطوة 11: النطاق المخصص + SSL

```bash
# إضافة النطاق المخصص
az webapp config hostname add \
  --webapp-name nusuk-api \
  --resource-group rg-nusuk-production \
  --hostname api.nusuk.sa

az webapp config hostname add \
  --webapp-name nusuk-web \
  --resource-group rg-nusuk-production \
  --hostname app.nusuk.sa

# إنشاء شهادة SSL مُدارة (مجانية)
az webapp config ssl create \
  --name nusuk-api \
  --resource-group rg-nusuk-production \
  --hostname api.nusuk.sa

az webapp config ssl create \
  --name nusuk-web \
  --resource-group rg-nusuk-production \
  --hostname app.nusuk.sa
```

**سجلات DNS المطلوب إضافتها:**
```
CNAME  api  →  nusuk-api.azurewebsites.net
CNAME  app  →  nusuk-web.azurewebsites.net
TXT    asuid.api  →  <معرّف التحقق من Azure>
TXT    asuid.app  →  <معرّف التحقق من Azure>
```

بعد إضافة النطاقات المخصصة، حدّث:
- في API: `CORS_ORIGINS` ← `https://app.nusuk.sa`
- في Web: `NEXT_PUBLIC_API_BASE_URL` ← `https://api.nusuk.sa`
- في Web: `NEXT_PUBLIC_SOCKET_URL` ← `https://api.nusuk.sa`

---

## ملخص متغيرات البيئة

### خدمة API (`nusuk-api`)

| المتغير | القيمة |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `WEBSITES_PORT` | `8080` |
| `DATABASE_URL` | مرجع Key Vault |
| `JWT_SECRET` | مرجع Key Vault |
| `JWT_REFRESH_SECRET` | مرجع Key Vault |
| `JWT_ACCESS_EXPIRES` | `15m` |
| `JWT_REFRESH_EXPIRES` | `7d` |
| `CORS_ORIGINS` | `https://nusuk-web.azurewebsites.net` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | من App Insights |

### خدمة الويب (`nusuk-web`)

| المتغير | القيمة |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `WEBSITES_PORT` | `3000` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://nusuk-api.azurewebsites.net` |
| `NEXT_PUBLIC_SOCKET_URL` | `https://nusuk-api.azurewebsites.net` |

---

## إعداد WebSocket

يدعم Azure App Service اتصالات WebSocket عند تفعيلها:

- تُفعَّل عبر `az webapp config set --web-sockets-enabled true`
- Socket.IO يتصل عبر `wss://` تلقائياً على HTTPS
- طرق النقل: `websocket` مع احتياطي `polling` في العميل
- لا حاجة لإعداد منفذ أو مسار خاص
- يُوصى بتقارب ARR: مُفعّل افتراضياً، يضمن جلسات ثابتة

```bash
# التحقق من تفعيل WebSocket
az webapp config show \
  --name nusuk-api \
  --resource-group rg-nusuk-production \
  --query webSocketsEnabled
```

---

## التوسع

### أفقي (توسيع الخوادم)
```bash
az appservice plan update \
  --name asp-nusuk-production \
  --resource-group rg-nusuk-production \
  --number-of-workers 3
```

### عمودي (ترقية المواصفات)
```bash
az appservice plan update \
  --name asp-nusuk-production \
  --resource-group rg-nusuk-production \
  --sku P1v3
```

### التوسع التلقائي
```bash
az monitor autoscale create \
  --resource-group rg-nusuk-production \
  --resource asp-nusuk-production \
  --resource-type Microsoft.Web/serverfarms \
  --min-count 1 \
  --max-count 5 \
  --count 1

az monitor autoscale rule create \
  --resource-group rg-nusuk-production \
  --autoscale-name asp-nusuk-production \
  --condition "CpuPercentage > 70 avg 5m" \
  --scale out 1

az monitor autoscale rule create \
  --resource-group rg-nusuk-production \
  --autoscale-name asp-nusuk-production \
  --condition "CpuPercentage < 30 avg 5m" \
  --scale in 1
```

---

## المراقبة والتنبيهات

### عرض السجلات
```bash
# بث سجلات API مباشرة
az webapp log tail \
  --name nusuk-api \
  --resource-group rg-nusuk-production

# تفعيل التسجيل التشخيصي
az webapp log config \
  --name nusuk-api \
  --resource-group rg-nusuk-production \
  --application-logging filesystem \
  --level information \
  --web-server-logging filesystem
```

### لوحة معلومات Application Insights

الوصول عبر: بوابة Azure ← Application Insights ← `ai-nusuk`

- **المقاييس الحية**: مراقبة الطلبات/الاستجابات في الوقت الفعلي
- **الإخفاقات**: تتبع الاستثناءات وأعطال التبعيات
- **الأداء**: مدة الطلبات، استدعاءات التبعيات
- **الاستخدام**: جلسات المستخدمين، مشاهدات الصفحات

---

## قائمة التحقق بعد النشر

بعد النشر، تحقق من:

- [ ] `https://nusuk-api.azurewebsites.net/health` يُرجع `{ "status": "ok" }`
- [ ] تسجيل الدخول يعمل على `https://nusuk-web.azurewebsites.net/login`
- [ ] عمليات CRUD تُحفظ في PostgreSQL
- [ ] التحديثات الفورية تعمل (افتح متصفحين، عدّل في واحد، شاهد التحديث في الآخر)
- [ ] سجلات التدقيق تُحفظ (راجع صفحة /audit)
- [ ] نقطة نهاية الصحة تُرجع OK
- [ ] HTTPS مُفعّل (HTTP يُعيد التوجيه إلى HTTPS)
- [ ] لا أخطاء CORS في وحدة تحكم المتصفح
- [ ] لا أسرار مكشوفة في إعدادات التطبيق (استخدم مراجع Key Vault)
- [ ] Application Insights يستقبل القياسات
- [ ] WebSockets تتصل عبر `wss://`

---

## تقدير التكلفة (شهرياً)

| المورد | المستوى | التكلفة التقديرية |
|---|---|---|
| خطة خدمة التطبيق | B1 (مشترك لـ API + Web) | ~13$ |
| PostgreSQL المرن | Burstable B1ms | ~15$ |
| حساب التخزين | Standard LRS | ~1$ |
| Application Insights | مستوى مجاني (5GB) | 0$ |
| Key Vault | Standard | ~0.03$/سر |
| **المجموع** | | **~29$/شهرياً** |

> للترقية لأحمال الإنتاج الفعلية: S1/P1v3 (~70-150$/شهرياً).

---

## قائمة التحقق الأمني

- [x] فرض HTTPS فقط على كلتا الخدمتين
- [x] فرض SSL على PostgreSQL
- [x] أسرار JWT في Azure Key Vault
- [x] هوية مُدارة للوصول إلى Key Vault
- [x] CORS صارم (بدون علامات شاملة)
- [x] تحديد معدل الطلبات عبر @nestjs/throttler (100 طلب/60 ثانية)
- [x] ترويسات أمان Helmet مُفعّلة
- [x] تشفير كلمات المرور بـ bcrypt
- [x] التخزين Blob بوصول خاص (غير عام)
- [x] Trust proxy مُفعّل لكشف IP الصحيح
- [x] لا أسرار في الكود أو سجل Git

---

## الحذف الكامل

لإزالة جميع الموارد:
```bash
az group delete --name rg-nusuk-production --yes --no-wait
```
