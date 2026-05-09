/**
 * First-pass classifier. The model returns a JSON object — never any
 * surrounding prose — that the service uses to pick the right
 * enhancement prompt (light / medium / heavy).
 *
 * The score scale is intentionally simple (1..5 across four axes) and
 * the cutoffs in the service are documented next to the constant
 * thresholds, so changing the dispatcher's behaviour is a numbers
 * tweak, not a prompt rewrite.
 */

import type { TrackRubric } from '../rubrics/rubric.interface';

export function buildDiagnosticPrompt(text: string, rubric: TrackRubric): string {
  return `أنت محلل نصوص محترف، تقيّم تقارير PMO حكومية بالعربية الفصحى لمنصة رؤية (مشروع بطاقة نُسك).

المسار: ${rubric.trackName}
وصف المسار: ${rubric.trackDescription}
المصطلحات المتخصصة (لا تعتبر أخطاء إن وردت): ${rubric.domainGlossary.join('، ')}

مهمتك: تقييم النص التالي على أربعة محاور (1 إلى 5)، وتحديد مستوى التدخل المناسب لتحسينه.

محاور التقييم:
- language       (1-5): الإملاء، النحو، علامات الترقيم.
- organization   (1-5): التنظيم، التسلسل المنطقي، وضوح الفقرات.
- clarity        (1-5): الوضوح، الخلو من الغموض، تحديد الأفكار.
- professionalism (1-5): النبرة الرسمية، احترافية الصياغة، ملاءمتها لتقرير حكومي.

قواعد التقييم:
- 5 = ممتاز جاهز للنشر بدون تعديل.
- 4 = جيد جداً يحتاج تنقيحاً طفيفاً.
- 3 = مقبول لكن يحتاج إعادة صياغة في عدة مواضع.
- 2 = ضعيف، الصياغة ركيكة أو غير مهنية.
- 1 = ضعيف جداً، التقرير يحتاج إعادة كتابة.

ثم حدد interventionLevel:
- "light"  إذا كان متوسط الدرجات ≥ 4
- "medium" إذا كان متوسط الدرجات بين 2.5 و 4
- "heavy"  إذا كان متوسط الدرجات < 2.5

أرجع JSON خالصاً فقط، بدون أي شرح أو تعليق أو علامات markdown:

{
  "qualityScore": {
    "language": <1-5>,
    "organization": <1-5>,
    "clarity": <1-5>,
    "professionalism": <1-5>
  },
  "weaknesses": [<قائمة قصيرة جداً بنقاط الضعف الرئيسية، ٣ كحد أقصى>],
  "interventionLevel": "light" | "medium" | "heavy"
}

النص:
"""
${text}
"""`;
}
