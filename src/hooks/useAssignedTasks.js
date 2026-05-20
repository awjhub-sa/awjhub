import { useEffect, useState } from 'react';
import { db } from '../lib/db.js';
import { Coffee, ForkKnife, Moon } from '@phosphor-icons/react';

export function extractCenterNum(centerStr) {
  return parseInt((centerStr || '').replace(/[^0-9]/g, '')) || 0;
}

/* Extract Arabic day number → latin digit string, e.g. "٨ ذو الحجة ١٤٤٧" → "8" */
const AR_DIGITS = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
export function extractDay(scheduledDate) {
  const latin = (scheduledDate || '').replace(/[٠-٩]/g, d => AR_DIGITS[d] || d);
  return latin.match(/^\d+/)?.[0] || '0';
}

export function useAssignedTasks(profile) {
  const [tasks,       setTasks]       = useState([]);
  const [completions, setCompletions] = useState([]);
  const [loading,     setLoading]     = useState(true);

  const uid    = profile?.uid;
  const center = profile?.center || '';

  useEffect(() => {
    if (!uid) return;
    let t1 = false, t2 = false;
    const done = () => { if (t1 && t2) setLoading(false); };

    const u1 = db.assigned_tasks.subscribe(rows => {
      setTasks(rows.filter(t => t.targetCenters?.includes(center)));
      t1 = true; done();
    });

    /* Filter by CENTER not uid — so observer's task badge clears when
       the supervisor uploads on their behalf, and vice-versa. */
    const u2 = db.task_completions.subscribe(rows => {
      setCompletions(rows.filter(c => c.center === center));
      t2 = true; done();
    });

    return () => { u1(); u2(); };
  }, [uid, center]);

  return { tasks, completions, loading };
}

export const MEAL_META = {
  breakfast: { label: 'الإفطار', icon: Coffee,    color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  lunch:     { label: 'الغداء',  icon: ForkKnife, color: '#EF4444', bg: '#FEF2F2', border: '#FCA5A5' },
  dinner:    { label: 'العشاء',  icon: Moon,      color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE' },
};
