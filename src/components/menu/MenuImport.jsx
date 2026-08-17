/**
 * src/components/menu/MenuImport.jsx
 *
 * Brings a menu in from a file instead of having it typed twice.
 *
 * Two paths, and they are not equals. A spreadsheet has columns that say what
 * each value is, so it imports exactly and the preview is a formality. A
 * photograph has to be read by OCR, and Arabic OCR on a phone photo is a guess
 * — so that path produces lines for a person to sort, and says as much rather
 * than presenting a guess as an import.
 *
 * Nothing is written until the preview is confirmed.
 */

import { useRef, useState } from 'react';
import {
  X, MicrosoftExcelLogo, Image as ImageIcon, DownloadSimple, UploadSimple,
  CheckCircle, WarningCircle, ArrowRight, Spinner,
} from '@phosphor-icons/react';
import { HAJJ_DAYS, MEAL_KEYS, MEAL_LABEL, CATEGORY_KEYS, CATEGORY_META } from '../../config/menus.js';
import { parseMenuSheet, readMenuImage } from '../../lib/menuImport.js';

const AR = (n) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

export default function MenuImport({
  open, onClose, natLabel, currentDay, onApplySheet, onApplyImage,
}) {
  const [tab, setTab]         = useState('excel');
  const [file, setFile]       = useState(null);
  const [parsed, setParsed]   = useState(null);   // { rows, warnings, sheet }
  const [picked, setPicked]   = useState(() => new Set());
  const [dayFix, setDayFix]   = useState({});     // index -> day, for rows with no day column
  const [ocr, setOcr]         = useState(null);   // { lines, confidence }
  const [progress, setProgress] = useState(0);
  const [targetMeal, setTargetMeal] = useState('breakfast');
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState('');
  const inputRef = useRef(null);

  const reset = () => {
    setFile(null); setParsed(null); setOcr(null);
    setPicked(new Set()); setDayFix({}); setErr(''); setProgress(0);
  };

  const close = () => { reset(); onClose(); };

  if (!open) return null;

  const dayOfRow = (row, i) => row.day || dayFix[i] || currentDay;

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f); setErr(''); setBusy(true); setParsed(null); setOcr(null);
    try {
      if (tab === 'excel') {
        const res = await parseMenuSheet(f);
        setParsed(res);
        setPicked(new Set(res.rows.map((_, i) => i)));   // everything, by default
      } else {
        setProgress(0);
        const res = await readMenuImage(f, setProgress);
        if (!res.lines.length) throw new Error('لم يُقرأ أي نص من الصورة — جرّب صورة أوضح أو أفقية');
        setOcr(res);
      }
    } catch (e) {
      setErr(e?.message || 'تعذّرت قراءة الملف');
      setFile(null);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true); setErr('');
    try {
      const rows = parsed.rows
        .map((r, i) => ({ ...r, day: dayOfRow(r, i) }))
        .filter((_, i) => picked.has(i));
      await onApplySheet(rows, file?.name);
      close();
    } catch (e) {
      setErr(e?.message || 'تعذّر الحفظ');
      setBusy(false);
    }
  };

  /* A file the customer can fill in and import back without guessing at
     headings — the fastest way to make the import "just work". */
  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const head = ['اليوم', 'الوجبة', 'الموقع', 'الوقت',
      ...CATEGORY_KEYS.map(k => CATEGORY_META[k].label)];
    const sample = [
      ['8', 'الإفطار', 'منى', '06:00 ص — 09:00 ص',
        'فول مدمس — 150 جم\nبيض مسلوق', 'خبز عربي\nجبن', 'شاي\nمياه معدنية', 'تمر'],
      ['8', 'الغداء', 'منى', '12:00 م — 03:00 م',
        'أرز بخاري\nدجاج مشوي — 200 جم', 'سلطة خضراء', 'عصير برتقال', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet([head, ...sample]);
    ws['!cols'] = head.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'المنيو');
    XLSX.writeFile(wb, 'قالب-المنيو.xlsx');
  };

  const accept = tab === 'excel'
    ? '.xlsx,.xls,.csv'
    : 'image/png,image/jpeg,image/webp';

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" dir="rtl">
      <button className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={close} aria-label="إغلاق" />

      <div className="relative w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[88vh] bg-background
                      rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col
                      shadow-[0_20px_70px_rgb(var(--c-ink)/0.35)] animate-[miSlide_.22s_ease-out]">

        <header className="px-4 sm:px-6 py-4 bg-white border-b border-line flex items-center gap-3 flex-shrink-0">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}>
            <UploadSimple size={16} weight="bold" className="text-white" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black text-ink">استيراد منيو</p>
            <p className="text-[10.5px] font-bold text-muted mt-0.5 truncate">{natLabel}</p>
          </div>
          <button onClick={close}
            className="w-8 h-8 rounded-lg border border-line bg-white hover:bg-background
                       flex items-center justify-center flex-shrink-0">
            <X size={15} weight="bold" className="text-muted" />
          </button>
        </header>

        {/* ── Which kind of file ── */}
        <div className="px-4 sm:px-6 pt-3 bg-white border-b border-line flex gap-2 flex-shrink-0">
          {[
            { key: 'excel', label: 'ملف إكسل', Icon: MicrosoftExcelLogo, hint: 'دقيق' },
            { key: 'image', label: 'صورة المنيو', Icon: ImageIcon, hint: 'مسودّة' },
          ].map(t => {
            const on = tab === t.key;
            return (
              <button key={t.key}
                onClick={() => { setTab(t.key); reset(); }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl border-b-2 transition-colors ${
                  on ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'
                }`}>
                <t.Icon size={15} weight="bold" />
                <span className="text-[12px] font-black">{t.label}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  on ? 'bg-primary/10' : 'bg-background'
                }`}>{t.hint}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">

          {/* ── Pick a file ── */}
          {!parsed && !ocr && (
            <>
              <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
                className="w-full rounded-2xl border-2 border-dashed border-line bg-white
                           py-10 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors
                           disabled:opacity-60">
                {busy ? (
                  <>
                    <Spinner size={26} weight="bold" className="text-primary animate-spin" />
                    <p className="text-[12px] font-black text-ink">
                      {tab === 'image' ? `جارٍ قراءة الصورة… ${AR(progress)}٪` : 'جارٍ قراءة الملف…'}
                    </p>
                    {tab === 'image' && (
                      <p className="text-[10px] font-bold text-muted">قد يستغرق نحو دقيقة</p>
                    )}
                  </>
                ) : (
                  <>
                    <UploadSimple size={26} weight="bold" className="text-muted/50" />
                    <p className="text-[12.5px] font-black text-ink">
                      {tab === 'excel' ? 'اختر ملف إكسل أو CSV' : 'اختر صورة للمنيو'}
                    </p>
                    <p className="text-[10.5px] font-bold text-muted">
                      {tab === 'excel'
                        ? 'يحتاج الملف عموداً للوجبة وأعمدة للأصناف'
                        : 'صورة واضحة، أفقية، ونص غير مائل'}
                    </p>
                  </>
                )}
              </button>
              <input ref={inputRef} type="file" accept={accept} className="hidden"
                onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />

              {tab === 'excel' ? (
                <button type="button" onClick={downloadTemplate}
                  className="w-full h-9 rounded-xl border border-line bg-white text-[11.5px] font-bold text-primary
                             flex items-center justify-center gap-1.5 hover:bg-primary/5">
                  <DownloadSimple size={13} weight="bold" />
                  تنزيل قالب جاهز — املأه واستورده مباشرة
                </button>
              ) : (
                /* Said plainly, before the upload rather than after the mistake. */
                <div className="rounded-xl border p-3 flex gap-2"
                  style={{ borderColor: '#EBCFC3', background: 'color-mix(in srgb, #B4674E 7%, #fff)' }}>
                  <WarningCircle size={15} weight="bold" style={{ color: '#B4674E' }} className="flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-ink leading-relaxed">
                    قراءة النص العربي من الصور غير مضمونة: النتيجة <b>مسودّة تحتاج مراجعة</b>،
                    وستظهر لك السطور لتوزّعها بنفسك على التصنيفات. للاستيراد الدقيق استخدم ملف إكسل.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Sheet preview ── */}
          {parsed && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-lg
                                 bg-white border border-line text-ink">
                  <CheckCircle size={12} weight="fill" className="text-success" />
                  قُرئ {AR(parsed.rows.length)} صف من «{parsed.sheet}»
                </span>
                <span className="text-[10.5px] font-bold text-muted truncate">{file?.name}</span>
                <button onClick={reset}
                  className="mr-auto text-[11px] font-bold text-primary hover:underline">
                  ملف آخر
                </button>
              </div>

              {parsed.warnings.map((w, i) => (
                <p key={i} className="text-[10.5px] font-bold text-ink flex items-center gap-1.5 px-1">
                  <WarningCircle size={12} weight="bold" style={{ color: '#B4674E' }} />
                  {w}
                </p>
              ))}

              <div className="bg-white rounded-2xl border border-line overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox"
                      checked={picked.size === parsed.rows.length}
                      onChange={e => setPicked(e.target.checked
                        ? new Set(parsed.rows.map((_, i) => i))
                        : new Set())}
                      className="w-3.5 h-3.5 accent-primary" />
                    <span className="text-[11px] font-black text-ink">تحديد الكل</span>
                  </label>
                  <span className="mr-auto text-[10.5px] font-bold text-muted">
                    {AR(picked.size)} من {AR(parsed.rows.length)} سيُحفظ
                  </span>
                </div>

                <ul className="divide-y divide-line max-h-[46vh] overflow-y-auto">
                  {parsed.rows.map((row, i) => {
                    const on = picked.has(i);
                    const day = dayOfRow(row, i);
                    const count = CATEGORY_KEYS.reduce((n, k) => n + (row[k]?.length || 0), 0);
                    return (
                      <li key={i} className={`px-4 py-2.5 ${on ? '' : 'opacity-45'}`}>
                        <div className="flex items-center gap-2.5">
                          <input type="checkbox" checked={on}
                            onChange={() => setPicked(s => {
                              const n = new Set(s);
                              n.has(i) ? n.delete(i) : n.add(i);
                              return n;
                            })}
                            className="w-3.5 h-3.5 accent-primary flex-shrink-0" />

                          {/* The day is editable here: a sheet without a day column
                              is common, and refusing it would send the customer back
                              to Excel to add one. */}
                          <select value={day}
                            onChange={e => setDayFix(f => ({ ...f, [i]: e.target.value }))}
                            className="h-7 px-1.5 rounded-lg border border-line bg-background text-[11px] font-black
                                       text-ink focus:outline-none focus:border-primary/50">
                            {HAJJ_DAYS.map(d => (
                              <option key={d.value} value={d.value}>{d.dayAr}</option>
                            ))}
                          </select>

                          <span className="text-[11.5px] font-black text-ink flex-shrink-0">
                            {MEAL_LABEL[row.meal]}
                          </span>
                          {row.location && (
                            <span className="text-[10px] font-bold text-muted">{row.location}</span>
                          )}
                          <span className="mr-auto text-[10px] font-black tabular-nums text-muted flex-shrink-0">
                            {AR(count)} صنف
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1 mt-1.5 pr-7">
                          {CATEGORY_KEYS.flatMap(k =>
                            (row[k] || []).map((dish, j) => (
                              <span key={`${k}-${j}`}
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                style={{
                                  background: `color-mix(in srgb, ${CATEGORY_META[k].color} 10%, #fff)`,
                                  color: CATEGORY_META[k].color,
                                }}>
                                {dish}
                              </span>
                            )))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <p className="text-[10.5px] text-muted leading-relaxed px-1">
                الحفظ يستبدل المنيو الحالي للوجبات المحدّدة فقط، ولا يمسّ بقية الأيام.
              </p>
            </>
          )}

          {/* ── OCR result ── */}
          {ocr && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-lg
                                 bg-white border border-line text-ink">
                  {AR(ocr.lines.length)} سطر مقروء
                </span>
                <span className="text-[10.5px] font-bold text-muted">
                  دقة تقديرية {AR(ocr.confidence)}٪
                </span>
                <button onClick={reset} className="mr-auto text-[11px] font-bold text-primary hover:underline">
                  صورة أخرى
                </button>
              </div>

              {ocr.confidence < 70 && (
                <div className="rounded-xl border p-3 flex gap-2"
                  style={{ borderColor: '#EBCFC3', background: 'color-mix(in srgb, #B4674E 7%, #fff)' }}>
                  <WarningCircle size={15} weight="bold" style={{ color: '#B4674E' }} className="flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-ink leading-relaxed">
                    الدقة منخفضة — راجع كل سطر قبل الاعتماد، أو استخدم صورة أوضح.
                  </p>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-line p-3 max-h-[38vh] overflow-y-auto space-y-1">
                {ocr.lines.map((l, i) => (
                  <p key={i} className="text-[11.5px] text-ink bg-background rounded-lg px-2.5 py-1.5 border border-line/60">
                    {l}
                  </p>
                ))}
              </div>

              {/* A photograph does not say which sitting it is for, so it is
                  asked rather than assumed — landing every scan on breakfast
                  would silently be wrong two times in three. */}
              <div className="bg-white rounded-2xl border border-line p-3">
                <p className="text-[10px] font-black text-muted/70 tracking-widest mb-2">هذه الصورة تخصّ وجبة</p>
                <div className="grid grid-cols-3 gap-2">
                  {MEAL_KEYS.map(k => {
                    const on = targetMeal === k;
                    return (
                      <button key={k} type="button" onClick={() => setTargetMeal(k)}
                        className={`py-2 rounded-xl border text-[12px] font-black transition-all ${
                          on ? 'text-white border-transparent' : 'bg-white border-line text-ink hover:border-primary/40'
                        }`}
                        style={on
                          ? { background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }
                          : undefined}>
                        {MEAL_LABEL[k]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-[10.5px] text-muted leading-relaxed px-1">
                ستُفتح هذه السطور داخل محرّر الوجبة لتوزّعها على التصنيفات، ولن يُحفظ شيء قبل مراجعتك.
              </p>
            </>
          )}
        </div>

        {(parsed || ocr) && (
          <footer className="px-4 sm:px-6 py-3 bg-white border-t border-line flex items-center gap-2 flex-shrink-0">
            {err && <p className="text-[11px] font-bold text-error flex-1 truncate">{err}</p>}
            <div className="mr-auto flex items-center gap-2">
              <button type="button" onClick={close} disabled={busy}
                className="h-9 px-4 rounded-lg border border-line bg-white text-[12px] font-bold text-muted
                           hover:text-ink disabled:opacity-40">
                إلغاء
              </button>
              {parsed ? (
                <button type="button" onClick={apply} disabled={busy || picked.size === 0}
                  className="h-9 px-5 rounded-lg text-white text-[12px] font-black flex items-center gap-1.5
                             disabled:opacity-50 shadow-[0_3px_12px_rgb(var(--c-primary)/0.3)]"
                  style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}>
                  {busy ? 'جارٍ الحفظ…' : `حفظ ${AR(picked.size)} وجبة`}
                </button>
              ) : (
                <button type="button" onClick={() => { onApplyImage(ocr.lines, targetMeal); close(); }}
                  className="h-9 px-5 rounded-lg text-white text-[12px] font-black flex items-center gap-1.5
                             shadow-[0_3px_12px_rgb(var(--c-primary)/0.3)]"
                  style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}>
                  متابعة للمحرّر
                  <ArrowRight size={14} weight="bold" />
                </button>
              )}
            </div>
          </footer>
        )}
      </div>

      <style>{`
        @keyframes miSlide {
          from { opacity: 0; transform: translateY(14px) scale(.99); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
