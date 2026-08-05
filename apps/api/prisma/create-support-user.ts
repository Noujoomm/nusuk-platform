/**
 * إنشاء مستخدم مقيّد بدور «الخدمات المساندة» (support_services).
 * هذا الدور يرى قسم الخدمات المساندة فقط — لا يظهر له أي قسم آخر.
 *
 * التشغيل (يحتاج DATABASE_URL للإنتاج):
 *   DATABASE_URL="postgres://..." npx ts-node prisma/create-support-user.ts
 *
 * يمكن تجاوز البيانات الافتراضية عبر متغيّرات البيئة:
 *   SUPPORT_EMAIL, SUPPORT_PASSWORD, SUPPORT_NAME_AR, SUPPORT_NAME
 *
 * السكربت idempotent: إعادة تشغيله تُحدّث كلمة المرور/الدور لنفس الإيميل.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const EMAIL = (process.env.SUPPORT_EMAIL || 'support@roya2030.org').toLowerCase().trim();
const PASSWORD = process.env.SUPPORT_PASSWORD || 'Roya!Sanad#2026';
const NAME_AR = process.env.SUPPORT_NAME_AR || 'الخدمات المساندة';
const NAME = process.env.SUPPORT_NAME || 'Support Services';

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      passwordHash,
      role: 'support_services' as any,
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      lockedAt: null,
    },
    create: {
      email: EMAIL,
      name: NAME,
      nameAr: NAME_AR,
      passwordHash,
      role: 'support_services' as any,
      isActive: true,
    },
  });

  console.log('\n✅ تم إنشاء/تحديث مستخدم الخدمات المساندة:');
  console.log('──────────────────────────────────────');
  console.log(`  الإيميل:      ${user.email}`);
  console.log(`  كلمة المرور:  ${PASSWORD}`);
  console.log(`  الدور:        support_services (الخدمات المساندة)`);
  console.log(`  ID:           ${user.id}`);
  console.log('──────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ فشل إنشاء المستخدم:', e?.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
