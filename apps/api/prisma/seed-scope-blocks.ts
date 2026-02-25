import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SCOPE_TEXT = `1.7 ادارة التصاريح وتنظيم الوصول
تشمل هذه المهمة إدارة جميع التصاريح اللازمة للوصول إلى مواقع العمل والمنشآت ذات الصلة بالمشروع، بما في ذلك تصاريح الدخول للعمال والمعدات والمواد.
1.7.1 اصدار تصاريح الدخول والخروج
إصدار ومتابعة تصاريح الدخول والخروج لجميع العاملين في المشروع والزوار والمقاولين من الباطن، وضمان الالتزام بمتطلبات الأمن والسلامة.
1.7.2 تنسيق الوصول مع الجهات المعنية
التنسيق مع الجهات الحكومية والأمنية المعنية لضمان سلاسة عمليات الوصول إلى مواقع العمل، بما يشمل الحصول على الموافقات اللازمة.
1.7.5 ادارة المركبات والمعدات
إدارة حركة المركبات والمعدات داخل مواقع العمل، بما يشمل تسجيل الدخول والخروج وضمان الالتزام بمعايير السلامة المرورية.
1.8 ادارة المخاطر والطوارئ
تشمل هذه المهمة تحديد وتقييم وإدارة المخاطر المرتبطة بالمشروع، ووضع خطط الطوارئ والاستجابة للحوادث.
1.8.1 تقييم المخاطر وتحليلها
إجراء تقييم شامل للمخاطر المحتملة في جميع مراحل المشروع، وتحليل تأثيرها واحتمالية حدوثها، ووضع استراتيجيات التخفيف المناسبة.
1.8.2 خطط الطوارئ والاستجابة
إعداد وتحديث خطط الطوارئ والاستجابة للحوادث، بما يشمل تحديد فرق الاستجابة ونقاط التجمع وإجراءات الإخلاء.
1.8.4 التدريب على السلامة والطوارئ
تنفيذ برامج تدريبية دورية للعاملين في المشروع على إجراءات السلامة والطوارئ، بما يشمل تمارين الإخلاء والإسعافات الأولية.`;

async function seedScopeBlocks() {
  // Find the first track to seed data into
  const tracks = await prisma.track.findMany({ take: 1, orderBy: { sortOrder: 'asc' } });

  if (tracks.length === 0) {
    console.log('No tracks found. Create a track first.');
    return;
  }

  const trackId = tracks[0].id;
  console.log(`Seeding scope blocks for track: ${tracks[0].nameAr} (${trackId})`);

  // Delete existing scope blocks for this track
  await prisma.scopeBlock.deleteMany({ where: { trackId } });

  // Parse the text into blocks
  const lines = SCOPE_TEXT.split('\n');
  const blocks: Array<{
    code: string;
    title: string;
    content: string;
    parentCode: string | null;
  }> = [];

  let currentBlock: { code: string; title: string; content: string; parentCode: string | null } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
    if (match) {
      // Save previous block
      if (currentBlock) {
        blocks.push(currentBlock);
      }

      const code = match[1];
      const title = match[2];

      // Determine parent code
      const parts = code.split('.');
      const parentCode = parts.length > 2 ? parts.slice(0, -1).join('.') : null;

      currentBlock = { code, title, content: '', parentCode };
    } else if (currentBlock) {
      // Append to content
      currentBlock.content += (currentBlock.content ? '\n' : '') + trimmed;
    }
  }

  // Don't forget the last block
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  // Create blocks in order, tracking IDs for parent references
  const codeToId: Record<string, string> = {};
  let orderIndex = 0;

  for (const block of blocks) {
    const parentId = block.parentCode ? codeToId[block.parentCode] : null;

    const created = await prisma.scopeBlock.create({
      data: {
        trackId,
        code: block.code,
        title: block.title,
        content: block.content || null,
        parentId: parentId || null,
        orderIndex: orderIndex++,
        progress: 0,
        status: 'pending',
      },
    });

    codeToId[block.code] = created.id;
    console.log(`  Created: ${block.code} - ${block.title} ${parentId ? `(child of ${block.parentCode})` : '(root)'}`);
  }

  console.log(`\nSeeded ${blocks.length} scope blocks successfully.`);
}

seedScopeBlocks()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
