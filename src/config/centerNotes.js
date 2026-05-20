/* Operations-room sticky notes per center.
   These appear next to reports & logistics requests in the admin dashboard
   so the operations team focuses on the right context per center. */

const RULES = [
  {
    centers: [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 83, 84, 85, 86, 87],
    note: 'خلف مركز 84 يوجد مطبخ فيه 2500 وجبة إسناد',
  },
  {
    centers: [72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82],
    note: 'خلف مركز 78 يوجد مطبخ فيه 1500 وجبة إسناد',
  },
  {
    centers: [78, 79],
    note: 'مركز 78-79 يطبخ في مطبخه الرئيسي الموجود في 79',
  },
  {
    centers: [76],
    note: 'مركز 76 نتعامل مع بلاغاته كمركز 80 لأنه يطبخ في 80',
  },
  {
    centers: [5, 7, 40, 41, 42, 43, 44, 45, 46, 47, 49, 50],
    note: 'يوجد حافظات ثلج إضافية في مركز 41 و 46',
  },
  {
    /* 25 covers both مركز 25-أ and مركز 25-ب (matched by numeric prefix) */
    centers: [20, 21, 22, 23, 24, 25],
    note: 'يوجد حافظات ثلج إضافية في مركز 20 و 23 و 25-أ',
  },
  {
    centers: [30, 31, 32, 33, 34, 35],
    note: 'يوجد إسناد مياه موجود بين مركز 30 و 33',
  },
];

/* Extract the leading numeric portion of a center identifier:
     'مركز 60'    → 60
     'مركز 25-أ'  → 25
     60           → 60
*/
function toCenterNum(centerIdOrNum) {
  if (centerIdOrNum == null) return null;
  if (typeof centerIdOrNum === 'number') return centerIdOrNum;
  const m = String(centerIdOrNum).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

/** Returns the list of operations-room notes attached to this center,
 *  in declaration order. Empty array if none. */
export function getCenterNotes(centerIdOrNum) {
  const num = toCenterNum(centerIdOrNum);
  if (!num) return [];
  return RULES.filter(r => r.centers.includes(num)).map(r => r.note);
}

/** Quick check used to render an indicator chip in compact list views. */
export function hasCenterNotes(centerIdOrNum) {
  return getCenterNotes(centerIdOrNum).length > 0;
}
