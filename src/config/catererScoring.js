/**
 * src/config/catererScoring.js
 *
 * How a caterer's season is scored, out of a hundred.
 *
 * Transcribed from the evaluation workbook the operation already runs on, so
 * the numbers this system produces can be laid beside last season's sheet and
 * agree. Three phases, eleven criteria, and a grade band at the end — none of
 * it invented here.
 *
 * The part that is not in the workbook is `derive`. Three of these criteria are
 * things the system already measures every day: Mina readiness, Arafat
 * readiness and the meal evaluations are inspections that have been happening
 * all season and are sitting in three tables. Half the final mark — fifty of a
 * hundred — can therefore be computed rather than typed, which is the whole
 * difference between a spreadsheet on a web page and a system.
 *
 * A computed score is a proposal, never a verdict: every criterion can be
 * overridden by hand, and the screen says which of the two a number is. An
 * evaluation that cannot be argued with is one nobody trusts.
 */

/** Grade bands, exactly as the workbook defines them. */
export const GRADES = [
  { min: 90, label: 'ممتاز',          color: '#16A34A' },
  { min: 80, label: 'جيد جداً',       color: '#5E9070' },
  { min: 70, label: 'جيد',            color: '#B99A64' },
  { min: 60, label: 'مقبول',          color: '#F59E0B' },
  { min: 0,  label: 'بحاجة لتحسين',   color: '#DC2626' },
];

export const gradeOf = (score) =>
  score == null ? null : GRADES.find(g => score >= g.min) || GRADES[GRADES.length - 1];

/**
 * `derive` names the source a criterion can be computed from, or is absent when
 * the criterion is a judgement only a person can make. `unit` is what one point
 * of the underlying ten-point inspection is worth here.
 */
export const PHASES = [
  {
    key: 'pre',
    label: 'قبل الموسم',
    weight: 35,
    color: '#4E7CB0',
    criteria: [
      { key: 'preResponse',  label: 'تجاوب المتعهد',   max: 5 },
      { key: 'minaReady',    label: 'جاهزية منى',      max: 15, derive: 'mina',
        note: 'متوسط آخر تقييم جاهزية لمراكز المتعهد' },
      { key: 'arafatReady',  label: 'جاهزية عرفة',     max: 5,  derive: 'arafat',
        note: 'متوسط آخر تقييم جاهزية لمراكز المتعهد' },
      { key: 'opsPlan',      label: 'الخطة التشغيلية', max: 5 },
      { key: 'kerosene',     label: 'شهادة الكيروسين', max: 5 },
    ],
  },
  {
    key: 'during',
    label: 'أثناء الموسم',
    weight: 50,
    color: '#B99A64',
    criteria: [
      { key: 'mealScore',      label: 'تقييم الوجبات',  max: 30, derive: 'meals',
        note: 'متوسط تقييمات جودة الوجبات خلال الموسم' },
      { key: 'duringResponse', label: 'تجاوب المتعهد',  max: 5 },
      { key: 'support',        label: 'طلبات الإسناد',  max: 10 },
      { key: 'supervisor',     label: 'تقييم المشرف',   max: 5 },
    ],
  },
  {
    key: 'post',
    label: 'بعد الموسم',
    weight: 15,
    color: '#5E9070',
    criteria: [
      { key: 'disposal',    label: 'محضر إتلاف',  max: 5 },
      { key: 'finalReport', label: 'تقرير ختامي', max: 10 },
    ],
  },
];

export const ALL_CRITERIA = PHASES.flatMap(p =>
  p.criteria.map(c => ({ ...c, phase: p.key, phaseLabel: p.label })));

export const CRITERION = Object.fromEntries(ALL_CRITERIA.map(c => [c.key, c]));

/* Sanity: the workbook totals a hundred, and so must this. A typo in a `max`
   above would otherwise show up as everyone quietly scoring 98. */
export const TOTAL_MAX = ALL_CRITERIA.reduce((n, c) => n + c.max, 0);
if (TOTAL_MAX !== 100) {
  console.error(`[catererScoring] الدرجات تجمع ${TOTAL_MAX} لا 100 — راجع config/catererScoring.js`);
}
