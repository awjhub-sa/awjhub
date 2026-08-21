/**
 * src/components/menu/MealEditor.jsx
 *
 * Writes one meal: this nationality, this day, this sitting.
 *
 * The four categories are the ones the field forms already grade against —
 * main dish, sides, drinks, snacks — so what is typed here is what the observer
 * is later asked about. They are not configurable on purpose; a fifth category
 * invented in the menu screen would have nothing to grade it.
 *
 * One dish per line. Paste a block of them and each line becomes its own dish,
 * because the way a kitchen sends a menu is a list, not a form.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Plus, Trash, FloppyDisk, MapPin, Clock as ClockIcon,
  DotsSixVertical, WarningCircle,
} from '@phosphor-icons/react';
import { CATEGORY_KEYS, CATEGORY_META } from '../../config/menus.js';
import { splitDishes } from '../../lib/menuImport.js';

const AR = (n) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

const ALERT = '#B4674E';

/** Common spots, offered as chips — typing "منى" forty-two times is not a task. */
const PLACES = ['منى', 'عرفات', 'مزدلفة', 'مكة'];

export default function MealEditor({
  open, onClose, onSave, onDelete,
  natLabel, dayLabel, mealLabel, mealColor,
  initial,            // { main, side, drinks, snacks, location, time }
  isSaved,            // already has a row of its own
  seedLines,          // lines handed over from a PDF with no table
}) {
  const [draft, setDraft] = useState(() => normalize(initial));
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState('');
  const firstField = useRef(null);

  /* Reopening on a different meal must show that meal, not the last one. */
  useEffect(() => {
    if (open) { setDraft(normalize(initial)); setErr(''); }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const total = useMemo(
    () => CATEGORY_KEYS.reduce((n, k) => n + draft[k].filter(s => s.trim()).length, 0),
    [draft],
  );

  if (!open) return null;

  const setCat = (cat, list) => setDraft(d => ({ ...d, [cat]: list }));

  const addDish = (cat, value = '') => setCat(cat, [...draft[cat], value]);

  const editDish = (cat, i, value) => {
    /* A pasted block arrives as one change event carrying newlines. Splitting
       it into rows here is what the person meant by pasting it. */
    const parts = value.includes('\n') ? splitDishes(value) : null;
    const next = [...draft[cat]];
    if (parts?.length) next.splice(i, 1, ...parts);
    else next[i] = value;
    setCat(cat, next);
  };

  const removeDish = (cat, i) => setCat(cat, draft[cat].filter((_, x) => x !== i));

  const save = async () => {
    const clean = {
      location: draft.location.trim() || null,
      time: draft.time.trim() || null,
    };
    for (const k of CATEGORY_KEYS) clean[k] = draft[k].map(s => s.trim()).filter(Boolean);

    if (!CATEGORY_KEYS.some(k => clean[k].length)) {
      setErr('أضف صنفاً واحداً على الأقل قبل الحفظ');
      return;
    }
    setBusy(true); setErr('');
    try {
      await onSave(clean);
      onClose();
    } catch (e) {
      setErr(e?.message || 'تعذّر الحفظ — تحقّق من الاتصال');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true); setErr('');
    try {
      await onDelete();
      onClose();
    } catch (e) {
      setErr(e?.message || 'تعذّر الحذف');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" dir="rtl">
      <button className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} aria-label="إغلاق" />

      <div className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[88vh] bg-[rgb(var(--c-bg))]
                      rounded-t-[18px] sm:rounded-[18px] overflow-hidden flex flex-col
                      shadow-[0_24px_60px_-16px_rgb(var(--c-ink)/0.35)] animate-[meSlide_.22s_ease-out]">

        <header className="px-4 sm:px-6 py-4 border-b flex items-start gap-3 flex-shrink-0"
          style={{ background: tint(mealColor, 12), borderColor: tint(mealColor, 28) }}>
          <span className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 border
                           text-[15px] font-extrabold tabular-nums"
            style={{ background: tint(mealColor, 9), borderColor: tint(mealColor, 22), color: mealColor }}>
            {AR(total)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold truncate leading-tight" style={{ color: mealColor }}>
              {mealLabel} — {natLabel}
            </p>
            <p className="text-[11.5px] font-medium text-muted mt-1">
              {dayLabel} · {total > 0 ? `${AR(total)} صنف` : 'لا أصناف بعد'}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-[10px] border border-line bg-white hover:text-ink
                       flex items-center justify-center flex-shrink-0 text-muted transition-colors">
            <X size={15} weight="bold" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">

          {seedLines?.length > 0 && (
            <div className="rounded-[14px] border p-3"
              style={{ background: tint(ALERT, 12), borderColor: tint(ALERT, 28) }}>
              <SeedLines lines={seedLines} onPick={addDish} />
            </div>
          )}

          {/* ── Where and when ── */}
          <section className="bg-white rounded-[14px] border border-line p-4 shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] font-bold text-muted/70 tracking-widest flex items-center gap-1 mb-1.5">
                  <MapPin size={11} weight="bold" /> الموقع
                </span>
                <input
                  ref={firstField}
                  value={draft.location}
                  onChange={e => setDraft(d => ({ ...d, location: e.target.value }))}
                  placeholder="منى"
                  className="w-full h-9 px-3 rounded-[10px] border border-line bg-[rgb(var(--c-bg))] text-[12.5px] font-medium text-ink
                             focus:outline-none focus:border-primary/50 focus:bg-white transition-colors"
                />
                <span className="flex gap-1 mt-1.5">
                  {PLACES.map(p => (
                    <button key={p} type="button"
                      onClick={() => setDraft(d => ({ ...d, location: p }))}
                      className="text-[10.5px] font-bold px-2 py-0.5 rounded-md border border-line
                                 bg-white text-muted hover:text-ink hover:border-primary/40 transition-colors">
                      {p}
                    </button>
                  ))}
                </span>
              </label>

              <label className="block">
                <span className="text-[10px] font-bold text-muted/70 tracking-widest flex items-center gap-1 mb-1.5">
                  <ClockIcon size={11} weight="bold" /> وقت التقديم
                </span>
                <input
                  value={draft.time}
                  onChange={e => setDraft(d => ({ ...d, time: e.target.value }))}
                  placeholder="٠٦:٠٠ ص - ٠٩:٠٠ ص"
                  className="w-full h-9 px-3 rounded-[10px] border border-line bg-[rgb(var(--c-bg))] text-[12.5px] font-medium text-ink
                             focus:outline-none focus:border-primary/50 focus:bg-white transition-colors"
                />
              </label>
            </div>
          </section>

          {/* ── The four categories ── */}
          {CATEGORY_KEYS.map(cat => {
            const c = CATEGORY_META[cat];
            const list = draft[cat];
            return (
              <section key={cat} className="bg-white rounded-[14px] border border-line overflow-hidden
                                            shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b"
                  style={{ background: tint(c.color, 12), borderColor: tint(c.color, 28) }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  <span className="text-[12px] font-bold" style={{ color: c.color }}>{c.label}</span>
                  {cat === 'main' && (
                    <span className="text-[10px] font-medium text-muted/70">أساسي</span>
                  )}
                  <span className="ms-auto text-[10.5px] font-bold tabular-nums text-muted">
                    {list.length ? AR(list.length) : '—'}
                  </span>
                </div>

                <div className="p-3 space-y-1.5">
                  {list.map((dish, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <DotsSixVertical size={13} weight="bold" className="text-muted/30 flex-shrink-0" />
                      <input
                        value={dish}
                        onChange={e => editDish(cat, i, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); addDish(cat); }
                          if (e.key === 'Backspace' && !dish && list.length > 1) {
                            e.preventDefault(); removeDish(cat, i);
                          }
                        }}
                        placeholder="اسم الصنف، الكمية"
                        autoFocus={!dish && i === list.length - 1}
                        className="flex-1 h-8 px-2.5 rounded-[10px] border border-line bg-[rgb(var(--c-bg))] text-[12.5px] text-ink
                                   focus:outline-none focus:border-primary/50 focus:bg-white transition-colors"
                      />
                      <button type="button" onClick={() => removeDish(cat, i)}
                        className="w-7 h-7 rounded-[10px] flex items-center justify-center flex-shrink-0
                                   text-muted/50 hover:text-error hover:bg-error/10 transition-colors">
                        <Trash size={13} weight="bold" />
                      </button>
                    </div>
                  ))}

                  <button type="button" onClick={() => addDish(cat)}
                    className="w-full h-8 rounded-[10px] border border-dashed flex items-center justify-center gap-1.5
                               text-[11.5px] font-bold transition-colors"
                    style={{ borderColor: tint(c.color, 30), color: c.color }}>
                    <Plus size={12} weight="bold" />
                    إضافة صنف
                  </button>
                </div>
              </section>
            );
          })}

        </div>

        <footer className="px-4 sm:px-6 py-3 bg-white border-t border-line flex items-center gap-2 flex-shrink-0">
          {err && (
            <p className="text-[11.5px] font-bold text-error flex-1 truncate">{err}</p>
          )}
          {!err && isSaved && (
            <button type="button" onClick={remove} disabled={busy}
              className="text-[11.5px] font-bold text-error/80 hover:text-error flex items-center gap-1 disabled:opacity-40 transition-colors">
              <Trash size={12} weight="bold" />
              حذف المنيو
            </button>
          )}
          <div className="ms-auto flex items-center gap-2">
            <button type="button" onClick={onClose} disabled={busy}
              className="h-9 px-4 rounded-[10px] border border-line bg-white text-[12.5px] font-bold text-muted
                         hover:text-ink disabled:opacity-40 transition-colors">
              إلغاء
            </button>
            <button type="button" onClick={save} disabled={busy}
              className="h-9 px-5 rounded-[10px] bg-primary text-white text-[12.5px] font-bold flex items-center gap-1.5
                         disabled:opacity-50 hover:brightness-110 transition-all">
              <FloppyDisk size={14} weight="bold" />
              {busy ? 'جارٍ الحفظ…' : 'حفظ المنيو'}
            </button>
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes meSlide {
          from { opacity: 0; transform: translateY(14px) scale(.99); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}

/* Lines read off a photograph. Each one is a button per category, because
   deciding "this is a drink" is the part a person has to do — the reading was
   only ever a first draft. */
function SeedLines({ lines, onPick }) {
  const [used, setUsed] = useState(() => new Set());

  return (
    <div className="space-y-1 max-h-44 overflow-y-auto">
      {lines.map((line, i) => (
        <div key={i} className={`flex items-center gap-1.5 ${used.has(i) ? 'opacity-40' : ''}`}>
          <span className="flex-1 text-[11.5px] text-ink truncate bg-white rounded-md px-2 py-1 border border-line">
            {line}
          </span>
          {CATEGORY_KEYS.map(cat => {
            const c = CATEGORY_META[cat];
            return (
              <button key={cat} type="button" title={c.label}
                onClick={() => { onPick(cat, line); setUsed(s => new Set(s).add(i)); }}
                className="w-6 h-6 rounded-md border flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: tint(c.color, 9), borderColor: tint(c.color, 22), color: c.color }}>
                {c.label.replace('ال', '')[0]}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function normalize(meal) {
  const out = {
    location: meal?.location || '',
    time: meal?.time || '',
  };
  for (const k of CATEGORY_KEYS) {
    const list = Array.isArray(meal?.[k]) ? meal[k].filter(Boolean) : [];
    /* An empty category still shows one blank row — an editor that opens with
       nothing to type into reads as broken. */
    out[k] = list.length ? [...list] : (k === 'main' ? [''] : []);
  }
  return out;
}
