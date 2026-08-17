import { useEffect, useState } from 'react';
import { db, uploadFile, serverTimestamp } from '../../lib/db.js';
import { useBrand, applyPalette, defaultIdentity } from '../../context/BrandContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import FormDocument from '../../components/forms/FormDocument.jsx';
import {
  Palette, FloppyDisk as Save, Image as ImageIcon, Warning, X,
  CircleNotch, ArrowCounterClockwise, Buildings as Building2, Eye, Sparkle,
} from '@phosphor-icons/react';

const inputCls =
  'w-full px-4 py-2.5 border border-line rounded-xl text-sm text-ink outline-none focus:border-primary transition placeholder-muted/40 bg-white';

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-xs font-medium text-muted mb-1.5">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-muted mt-1">{hint}</p>}
  </div>
);

const LOGOS = [
  { key: 'logoFull',   label: 'الشعار الأفقي',        hint: 'نص داكن — للخلفيات الفاتحة والمستندات', dark: false },
  { key: 'logoOnDark', label: 'الشعار على خلفية داكنة', hint: 'نص أبيض — للقائمة الجانبية',           dark: true  },
  { key: 'logoSquare', label: 'الشعار المربّع',        hint: 'للمساحات الضيقة',                       dark: false },
  { key: 'logoMark',   label: 'الأيقونة',              hint: 'الحروف فقط — تاب المتصفح',              dark: false },
];

const SWATCHES = [
  { key: 'colorPrimary',    label: 'اللون الأساسي',   hint: 'القائمة الجانبية والأزرار' },
  { key: 'colorPrimary400', label: 'الأساسي الفاتح',  hint: 'رأس التدرّجات' },
  { key: 'colorPrimary700', label: 'الأساسي الغامق',  hint: 'ذيل التدرّجات' },
  { key: 'colorAccent',     label: 'لون التمييز',     hint: 'المؤشر والحالات النشطة' },
  { key: 'colorAccent600',  label: 'التمييز الغامق',  hint: 'النصوص على التمييز' },
  { key: 'colorHeader',     label: 'لون الشريط العلوي', hint: 'خلفية الهيدر' },
  { key: 'colorInk',        label: 'لون النص',        hint: 'العناوين والنص الأساسي' },
];

export default function AdminBrand() {
  const { settings } = useBrand();
  const [form, setForm]     = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusy]  = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => { if (settings && !form) setForm({ ...settings }); }, [settings, form]);

  /* Repaint on every keystroke so the whole shell — sidebar, buttons, badges —
     shows the palette being chosen, not a swatch beside a form. */
  const patch = (p) => {
    setForm(prev => {
      const next = { ...prev, ...p };
      applyPalette(next);
      return next;
    });
  };

  const upload = async (key, file) => {
    setBusy(key);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      /* Timestamped so a replaced logo is not served from cache under the old
         URL — the one bug guaranteed to be reported as "it didn't change". */
      const url = await uploadFile('brand', `${key}-${Date.now()}.${ext}`, file);
      patch({ [key]: url });
    } catch (ex) {
      setNotice(`تعذّر رفع الملف: ${ex.message}`);
    }
    setBusy(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const { id, createdAt, updatedAt, ...rest } = form;
      await db.org_settings.update(1, { ...rest, updatedAt: serverTimestamp() });
      setNotice('حُفظت الهوية — تسري على كل الشاشات والمستندات فوراً.');
    } catch (ex) { setNotice(ex.message); }
    setSaving(false);
  };

  /* Two different undos, and conflating them would make one of them useless:
     revert goes back to the last save, restore goes back to the product's own
     identity however long ago that was replaced. */
  const revert = () => { setForm({ ...settings }); applyPalette(settings); };

  const restore = () => {
    if (!confirm(
      'استعادة هوية أوج الأصلية؟\n\n'
      + 'سيُستبدل الاسم والشعارات والألوان. بيانات الاتصال والسجل التجاري تبقى كما هي.\n'
      + 'لن يُحفظ شيء حتى تضغط «حفظ».',
    )) return;
    const next = { ...form, ...defaultIdentity() };
    setForm(next);
    applyPalette(next);
    setNotice('استُعيدت هوية أوج — اضغط «حفظ» لتثبيتها، أو «تراجع» للعودة عمّا كان محفوظاً.');
  };

  if (!form) {
    return <p className="text-center text-muted text-sm py-16" dir="rtl">جارٍ التحميل...</p>;
  }

  /* A tiny document, enough to show the letterhead responding. */
  const sample = {
    blocks: [
      { id: 's1', type: 'paragraph', text: 'هكذا ستظهر مستنداتك ونماذجك بهويتك.' },
      { id: 's2', type: 'signature', slots: [{ label: 'التوقيع', key: 'sig' }, { label: 'الختم', key: 'stamp' }] },
    ],
    fields: {},
  };

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        Icon={Palette}
        title="هوية الشركة"
        subtitle="الاسم والشعارات والألوان — تسري على النظام كله وعلى كل مستند يُطبع"
        right={
          <div className="flex items-center gap-2">
            <button onClick={restore} title="يعيد الاسم والشعارات والألوان إلى هوية أوج الأصلية"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-line text-muted text-sm font-medium hover:bg-background hover:text-primary hover:border-primary/40 transition-colors">
              <Sparkle size={14} />
              <span className="hidden sm:inline">استعادة هوية أوج</span>
            </button>
            <button onClick={revert} title="يعود إلى آخر نسخة محفوظة"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-line text-muted text-sm font-medium hover:bg-background transition-colors">
              <ArrowCounterClockwise size={14} />
              <span className="hidden sm:inline">تراجع</span>
            </button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition shadow-[0_4px_16px_rgb(var(--c-primary)/0.35)]"
              style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}>
              {saving ? <CircleNotch size={15} className="animate-spin" /> : <Save size={15} />}
              حفظ
            </button>
          </div>
        }
      />

      {notice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2.5 text-sm font-medium flex items-start gap-2">
          <Warning size={15} className="mt-0.5 flex-shrink-0" />
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} className="text-amber-600 hover:text-amber-900"><X size={14} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] gap-5 items-start">
        <div className="space-y-5">
          {/* Identity */}
          <section className="bg-white rounded-2xl border border-line overflow-hidden">
            <div className="px-5 py-3.5 border-b border-line bg-background/40 flex items-center gap-2">
              <Building2 size={15} className="text-primary" />
              <h2 className="font-bold text-ink text-sm">الاسم والبيانات</h2>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="الاسم المختصر (عربي)">
                <input value={form.nameAr ?? ''} onChange={e => patch({ nameAr: e.target.value })} className={inputCls} />
              </Field>
              <Field label="الاسم المختصر (إنجليزي)">
                <input value={form.nameEn ?? ''} onChange={e => patch({ nameEn: e.target.value })} dir="ltr" className={inputCls} />
              </Field>
              <Field label="الاسم الكامل (عربي)" hint="يظهر في ترويسة المستندات">
                <input value={form.fullNameAr ?? ''} onChange={e => patch({ fullNameAr: e.target.value })} className={inputCls} />
              </Field>
              <Field label="الاسم الكامل (إنجليزي)">
                <input value={form.fullNameEn ?? ''} onChange={e => patch({ fullNameEn: e.target.value })} dir="ltr" className={inputCls} />
              </Field>
              <Field label="السجل التجاري">
                <input value={form.crNumber ?? ''} onChange={e => patch({ crNumber: e.target.value })} dir="ltr" className={inputCls} />
              </Field>
              <Field label="الرقم الضريبي">
                <input value={form.vatNumber ?? ''} onChange={e => patch({ vatNumber: e.target.value })} dir="ltr" className={inputCls} />
              </Field>
              <Field label="الهاتف">
                <input value={form.phone ?? ''} onChange={e => patch({ phone: e.target.value })} dir="ltr" className={inputCls} />
              </Field>
              <Field label="الموقع الإلكتروني">
                <input value={form.website ?? ''} onChange={e => patch({ website: e.target.value })} dir="ltr" className={inputCls} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="العنوان">
                  <input value={form.address ?? ''} onChange={e => patch({ address: e.target.value })} className={inputCls} />
                </Field>
              </div>
            </div>
          </section>

          {/* Logos */}
          <section className="bg-white rounded-2xl border border-line overflow-hidden">
            <div className="px-5 py-3.5 border-b border-line bg-background/40 flex items-center gap-2">
              <ImageIcon size={15} className="text-primary" />
              <h2 className="font-bold text-ink text-sm">الشعارات</h2>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {LOGOS.map(l => (
                <div key={l.key}>
                  <p className="text-xs font-medium text-muted mb-1.5">{l.label}</p>
                  <label className={`block rounded-xl border border-dashed border-line h-24 flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden ${
                    l.dark ? 'bg-[rgb(var(--c-primary))]' : 'bg-background/50'
                  }`}>
                    <input type="file" accept="image/*,.svg" className="hidden"
                      onChange={e => e.target.files?.[0] && upload(l.key, e.target.files[0])} />
                    {busyKey === l.key
                      ? <CircleNotch size={18} className={`animate-spin ${l.dark ? 'text-white' : 'text-muted'}`} />
                      : form[l.key]
                        ? <img src={form[l.key]} alt={l.label} className="max-h-20 max-w-[85%] object-contain" />
                        : <span className={`text-[11px] ${l.dark ? 'text-white/60' : 'text-muted'}`}>اضغط للرفع</span>}
                  </label>
                  <p className="text-[10px] text-muted mt-1">{l.hint}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Palette */}
          <section className="bg-white rounded-2xl border border-line overflow-hidden">
            <div className="px-5 py-3.5 border-b border-line bg-background/40 flex items-center gap-2">
              <Palette size={15} className="text-primary" />
              <h2 className="font-bold text-ink text-sm">الألوان</h2>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SWATCHES.map(s => (
                <Field key={s.key} label={s.label} hint={s.hint}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form[s.key] || '#000000'}
                      onChange={e => patch({ [s.key]: e.target.value })}
                      className="w-11 h-11 rounded-xl border border-line cursor-pointer bg-white p-1"
                    />
                    <input
                      value={form[s.key] ?? ''}
                      onChange={e => patch({ [s.key]: e.target.value })}
                      dir="ltr"
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </Field>
              ))}
              <p className="sm:col-span-2 text-[11px] text-muted leading-relaxed">
                التدرّجات والدرجات الفاتحة تُشتقّ تلقائياً من الأساسي — تكفي هذه الستة.
                والتغيير يظهر فوراً على الشاشة كلها قبل الحفظ.
              </p>
            </div>
          </section>
        </div>

        {/* Live document */}
        <div className="xl:sticky xl:top-0 space-y-2">
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <Eye size={13} /> معاينة حيّة للترويسة
          </p>
          <div className="bg-background/60 rounded-2xl border border-line p-4">
            <FormDocument definition={sample} mode="preview" title="نموذج تجريبي" formNumber="FRM-0001" />
          </div>
        </div>
      </div>
    </div>
  );
}
