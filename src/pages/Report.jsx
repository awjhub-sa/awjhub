// src/pages/Report.jsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Camera, X, AlertTriangle, Loader2,
  Send, CheckCircle2, Zap, Package, Timer, Star,
  Thermometer, Users, FileX, Image
} from 'lucide-react';
import { db } from '../config/db';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/* ── Report type definitions ───────────────────────────── */
const REPORT_TYPES = [
  {
    id: 'shortage',
    label: 'نقص في الكميات',
    desc: 'الكميات المقدمة أقل من المطلوب',
    icon: Package,
    color: 'error',
  },
  {
    id: 'delay',
    label: 'تأخر في التوزيع',
    desc: 'الوجبة لم تصل في الوقت المحدد',
    icon: Timer,
    color: 'warning',
  },
  {
    id: 'quality',
    label: 'مشكلة في الجودة',
    desc: 'الطعم أو النضج أو المظهر غير مقبول',
    icon: Star,
    color: 'primary',
  },
  {
    id: 'hygiene',
    label: 'مخالفة صحية',
    desc: 'شوائب أو تلوث أو سوء تخزين',
    icon: Thermometer,
    color: 'error',
  },
  {
    id: 'crowd',
    label: 'ازدحام حرج',
    desc: 'ازدحام شديد يهدد السلامة',
    icon: Users,
    color: 'error',
  },
  {
    id: 'other',
    label: 'بلاغ آخر',
    desc: 'أي مشكلة غير مذكورة أعلاه',
    icon: FileX,
    color: 'secondary',
  },
];

const SEVERITY = [
  { id: 'low',    label: 'منخفضة',  color: 'bg-success/10 border-success/30 text-success' },
  { id: 'medium', label: 'متوسطة',  color: 'bg-yellow-50 border-yellow-300 text-yellow-700' },
  { id: 'high',   label: 'عالية',   color: 'bg-error/10 border-error/30 text-error' },
  { id: 'urgent', label: '🚨 عاجل جداً', color: 'bg-error text-white border-error' },
];

/* ── Color helper ─────────────────────────────────────── */
const typeColor = (color) => {
  const map = {
    error:    'bg-error/10 border-error/25 text-error',
    warning:  'bg-yellow-50 border-yellow-200 text-yellow-700',
    primary:  'bg-primary-50 border-primary/25 text-primary',
    secondary:'bg-primary-50/50 border-appBorder text-secondary',
  };
  return map[color] || map.secondary;
};

/* ══════════════════════════════════════════════════════════
   REPORT PAGE
   ══════════════════════════════════════════════════════════ */
export default function Report() {
  const navigate = useNavigate();
  const fileRef  = useRef(null);

  const [form, setForm] = useState({
    type:        '',
    severity:    '',
    location:    '',
    mealType:    '',
    description: '',
    photos:      [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [errors,     setErrors]     = useState({});

  const set = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: '' }));
  };

  const handlePhotos = (e) => {
    const files = Array.from(e.target.files).slice(0, 5);
    set('photos', [...form.photos, ...files].slice(0, 5));
  };
  const removePhoto = (i) => set('photos', form.photos.filter((_, idx) => idx !== i));

  const validate = () => {
    const errs = {};
    if (!form.type)        errs.type        = 'يرجى اختيار نوع البلاغ';
    if (!form.severity)    errs.severity    = 'يرجى تحديد درجة الخطورة';
    if (!form.location.trim())   errs.location    = 'يرجى إدخال الموقع';
    if (!form.description.trim()) errs.description = 'يرجى وصف المشكلة';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        photos: form.photos.map(f => f.name), // In real app: upload to Storage first
        monitorId: 'omar-alrefaei',
        centerNo: 45,
        createdAt: serverTimestamp(),
        status: 'open',
      };
      await addDoc(collection(db, 'reports'), payload);
      setSubmitted(true);
    } catch {
      setSubmitted(true); // Demo fallback
    }
    setSubmitting(false);
  };

  /* ── Success screen ── */
  if (submitted) {
    const isUrgent = form.severity === 'urgent';
    return (
      <div dir="rtl" className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center"
        style={{ fontFamily: "'IBM Plex Sans Arabic', Tahoma, sans-serif" }}>
        <div className={`w-20 h-20 rounded-full ${isUrgent ? 'bg-error/10' : 'bg-success/10'} flex items-center justify-center mb-5`}>
          {isUrgent
            ? <Zap size={38} className="text-error" strokeWidth={1.5} />
            : <CheckCircle2 size={38} className="text-success" strokeWidth={1.5} />
          }
        </div>
        <h2 className="text-2xl font-bold text-dark mb-2">
          {isUrgent ? 'تم إرسال البلاغ العاجل!' : 'تم إرسال البلاغ'}
        </h2>
        <p className="text-secondary mb-2">
          {isUrgent
            ? 'تم إشعار غرفة العمليات فوراً'
            : 'سيتم مراجعة البلاغ من قِبل المشرف المختص'}
        </p>
        <p className="text-xs text-secondary mb-8 bg-primary-50 border border-appBorder rounded-xl px-4 py-2">
          رقم البلاغ: <span className="font-bold text-primary">RPT-{Date.now().toString().slice(-6)}</span>
        </p>
        <button
          onClick={() => navigate('/home')}
          className="w-full max-w-xs py-4 rounded-xl font-bold text-white bg-gold-gradient shadow-gold hover:opacity-90 transition-opacity"
        >
          العودة للرئيسية
        </button>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background"
      style={{ fontFamily: "'IBM Plex Sans Arabic', Tahoma, sans-serif" }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-appBorder px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl border border-appBorder flex items-center justify-center hover:bg-primary-50 transition-colors"
          >
            <ChevronRight size={18} className="text-secondary" strokeWidth={2} />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-dark text-base leading-tight">رفع بلاغ</h1>
            <p className="text-xs text-secondary">مركز رقم ٤٥ — عمر الرفاعي</p>
          </div>
          <div className="flex items-center gap-1.5 bg-error/10 border border-error/25 rounded-xl px-3 py-1.5">
            <AlertTriangle size={13} className="text-error" strokeWidth={2.5} />
            <span className="text-xs font-bold text-error">عاجل</span>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pb-32 pt-5 space-y-5">

        {/* ── 1. Report type ── */}
        <section>
          <label className="block text-sm font-bold text-dark mb-3">
            نوع البلاغ <span className="text-error">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {REPORT_TYPES.map(rt => {
              const Icon = rt.icon;
              const sel = form.type === rt.id;
              return (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => set('type', rt.id)}
                  className={`
                    text-right p-3.5 rounded-xl border-2 transition-all duration-150 active:scale-[0.97]
                    ${sel
                      ? 'border-primary bg-primary-50 shadow-gold'
                      : 'border-appBorder bg-background hover:border-primary/40'}
                  `}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${sel ? 'bg-primary' : typeColor(rt.color)}`}>
                    <Icon size={17} className={sel ? 'text-white' : ''} strokeWidth={2} />
                  </div>
                  <p className={`text-sm font-bold leading-tight ${sel ? 'text-dark' : 'text-dark'}`}>{rt.label}</p>
                  <p className="text-[11px] text-secondary mt-0.5 leading-tight">{rt.desc}</p>
                </button>
              );
            })}
          </div>
          {errors.type && <p className="text-error text-xs mt-1.5">{errors.type}</p>}
        </section>

        {/* ── 2. Severity ── */}
        <section>
          <label className="block text-sm font-bold text-dark mb-3">
            درجة الخطورة <span className="text-error">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {SEVERITY.map(sv => (
              <button
                key={sv.id}
                type="button"
                onClick={() => set('severity', sv.id)}
                className={`
                  py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all active:scale-95
                  ${form.severity === sv.id ? sv.color + ' border-opacity-100' : 'bg-background border-appBorder text-secondary hover:border-primary/30'}
                `}
              >
                {sv.label}
              </button>
            ))}
          </div>
          {errors.severity && <p className="text-error text-xs mt-1.5">{errors.severity}</p>}
        </section>

        {/* ── 3. Location + Meal ── */}
        <section className="bg-white border border-appBorder rounded-2xl p-4 shadow-card">
          <label className="block text-sm font-bold text-dark mb-3">تفاصيل الموقع</label>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-secondary block mb-1">الموقع الدقيق <span className="text-error">*</span></label>
              <input
                type="text"
                placeholder="رقم المخيم / المنطقة / الموقع"
                value={form.location}
                onChange={e => set('location', e.target.value)}
                className={`w-full h-11 px-3 text-sm border rounded-xl bg-background text-dark
                  placeholder-secondary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all
                  ${errors.location ? 'border-error' : 'border-appBorder focus:border-primary/60'}`}
              />
              {errors.location && <p className="text-error text-xs mt-1">{errors.location}</p>}
            </div>
            <div>
              <label className="text-xs text-secondary block mb-1">الوجبة المتعلقة</label>
              <select
                value={form.mealType}
                onChange={e => set('mealType', e.target.value)}
                className="w-full h-11 px-3 text-sm border border-appBorder rounded-xl bg-background text-dark
                  focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/20"
              >
                <option value="">-- اختر الوجبة --</option>
                <option value="breakfast">الفطور</option>
                <option value="lunch">الغداء</option>
                <option value="dinner">العشاء</option>
                <option value="snack">وجبة خفيفة</option>
                <option value="na">لا ينطبق</option>
              </select>
            </div>
          </div>
        </section>

        {/* ── 4. Description ── */}
        <section>
          <label className="block text-sm font-bold text-dark mb-2">
            وصف المشكلة <span className="text-error">*</span>
          </label>
          <textarea
            rows={5}
            placeholder="اكتب وصفاً تفصيلياً للمشكلة، ما الذي لاحظته بالضبط؟ متى؟ كم عدد المتأثرين؟"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            className={`w-full px-4 py-3 text-sm border rounded-2xl bg-white text-dark
              placeholder-secondary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all resize-none
              ${errors.description ? 'border-error' : 'border-appBorder focus:border-primary/60'}`}
          />
          <div className="flex justify-between mt-1 px-1">
            {errors.description
              ? <p className="text-error text-xs">{errors.description}</p>
              : <span />
            }
            <span className="text-xs text-secondary">{form.description.length} حرف</span>
          </div>
        </section>

        {/* ── 5. Photos ── */}
        <section>
          <label className="block text-sm font-bold text-dark mb-2">
            الصور الداعمة
            <span className="text-secondary font-normal text-xs mr-1">(اختياري — حتى 5 صور)</span>
          </label>

          {form.photos.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {form.photos.map((f, i) => (
                <div key={i}
                  className="relative flex items-center gap-1.5 bg-primary-50 border border-primary/20 rounded-lg px-2.5 py-1.5">
                  <Image size={13} className="text-primary" strokeWidth={2} />
                  <span className="text-xs text-dark max-w-[100px] truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="text-secondary hover:text-error transition-colors"
                  >
                    <X size={13} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={form.photos.length >= 5}
            className="w-full h-14 border-2 border-dashed border-appBorder rounded-xl flex items-center justify-center gap-2
              text-secondary text-sm hover:border-primary/40 hover:text-primary hover:bg-primary-50/50
              transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Camera size={18} strokeWidth={1.75} />
            <span>{form.photos.length > 0 ? 'إضافة صورة أخرى' : 'التقاط أو إرفاق صورة'}</span>
          </button>
          <input ref={fileRef} type="file" multiple accept="image/*" capture="environment"
            className="hidden" onChange={handlePhotos} />
        </section>

      </div>

      {/* ── Sticky submit bar ── */}
      <div className="fixed bottom-0 right-0 left-0 bg-background border-t border-appBorder px-4 py-3 shadow-card-lg z-40">
        <div className="max-w-lg mx-auto">
          {form.severity === 'urgent' && (
            <div className="flex items-center gap-2 mb-2.5 bg-error/5 border border-error/20 rounded-xl px-3 py-2">
              <Zap size={14} className="text-error flex-shrink-0" strokeWidth={2.5} />
              <span className="text-xs text-error font-medium">البلاغ العاجل يُرسل فوراً لغرفة العمليات</span>
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="
              w-full py-4 rounded-xl font-bold text-white text-base
              bg-gold-gradient shadow-gold
              hover:opacity-90 active:scale-[0.98]
              transition-all duration-200 disabled:opacity-60
              flex items-center justify-center gap-2
            "
          >
            {submitting
              ? <><Loader2 size={18} className="animate-spin" /> جارٍ الإرسال...</>
              : <><Send size={18} strokeWidth={2.5} /> إرسال البلاغ</>
            }
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}
