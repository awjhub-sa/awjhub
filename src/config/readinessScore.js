/**
 * Scoring helper for the readiness questionnaires (منى / عرفة).
 *
 * Pages that own the criteria definitions:
 *   • src/pages/MinaReadiness.jsx               (مراقب — منى)
 *   • src/pages/ArafatReadiness.jsx             (مراقب — عرفة)
 *   • src/pages/Supervisor/SupMinaReadiness.jsx (مشرف — منى)
 *   • src/pages/Supervisor/SupArafatReadiness.jsx (مشرف — عرفة)
 *
 * Each criterion may have:
 *   score: number | null   — null means informational only (not counted)
 *   type:  'yesno' | 'yesno_detail' | 'choice'
 *
 * Convention:
 *   • criteria with a numeric score award their value on answer === 'نعم'
 *   • null-score criteria are ignored in scoring
 *   • 'choice' criteria are ignored (no yes/no)
 */

export function computeReadinessTotals(criteria, answers) {
  let total = 0;
  let max   = 0;
  for (const c of criteria) {
    if (typeof c.score !== 'number' || c.score <= 0) continue;
    max += c.score;
    if (answers?.[c.id] === 'نعم') total += c.score;
  }
  const scoreOutOf10 = max > 0 ? parseFloat(((total / max) * 10).toFixed(2)) : 0;
  const percentage   = max > 0 ? parseFloat(((total / max) * 100).toFixed(1)) : 0;
  return {
    totalScore:   parseFloat(total.toFixed(4)),
    maxScore:     parseFloat(max.toFixed(4)),
    scoreOutOf10,
    percentage,
  };
}
