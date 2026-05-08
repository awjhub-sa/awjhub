import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Camera, Video, X, AlertTriangle,
  Loader2, Send, CheckCircle2, Zap, User, Building2,
} from 'lucide-react';
import { db } from '../config/db.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext.jsx';
import { getCaterer } from '../config/centers.js';

/* ── ضغط الصورة لـ base64 ──────────────────────────────── */
function compressImage(file, maxWidth = 900, quality = 0.72) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const scale  = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = img.width  * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ── أنواع البلاغات ─────────────────────────────────────── */
const REPORT_TYPES = [
  { id: 'water',    label: 'تسرب مياه',         icon: '💧', color: '#1D6FA4' },
  { id: 'electric', label: 'عطل كهربائي',        icon: '⚡', color: '#D97706' },
  { id: 'crowd',    label: 'ازدحام حرج',         icon: '👥', color: '#7C3AED' },
  { id: 'food',     label: 'مشكلة غذائية',       icon: '🍽️', color: '#A98159' },
  { id: 'medical',  label: 'حالة طبية طارئة',    icon: '🚑', color: '#BA1A1A' },
  { id: 'security', label: 'بلاغ أمني',          icon: '🛡️', color: '#374151' },
  { id: 'fire',     label: 'حريق / دخان',        icon: '🔥', color: '#DC2626' },
  { id: 'other',    label: 'بلاغ آخر',           icon: '📋', color: '#6D6E71' },
];

/* ── مستويات الخطورة ─────────────────────────────────────── */
const SEVERITY = [
  { id: 'high',   label: 'عالية',   desc: 'خطر فوري',      bg: '#FEE2E2', border: '#FECACA', text: '#991B1B', dot: '#DC2626' },
  { id: 'medium', label: 'متوسطة',  desc: 'يحتاج متابعة',  bg: '#FEF3C7', border: '#FDE68A', text: '#92400E', dot: '#D97706' },
  { id: 'low',    label: 'منخفضة',  desc: 'للعلم فقط',     bg: '#DBEAFE', border: '#BFDBFE', text: '#1E40AF', dot: '#3B82F6' },
];

/* ══════════════════════════════════════════════════════════ */
export default function Report() {
  const navigate        = useNavigate();
  const { profile }     = useAuth();
  const imageRef        = useRef(null);
  const videoRef        = useRef(null);

  const [reportType,   setReportType]   = useState('');
  const [severity,     setSeverity]     = useState('');
  const [description,  setDescription]  = useState('');
  const [images,       setImages]       = useState([]);   // base64
  const [videos,       setVideos]       = useState([]);   // {name, size}
  const [submitting,   setSubmitting]   = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [errors,       setErrors]       = useState({});

  /* ── handlers ── */
  const handleImages = async (e) => {
    const files = Array.from(e.target.files).slice(0, 5 - images.length);
    const compressed = await Promise.all(files.map(f => compressImage(f)));
    setImages(prev => [...prev, ...compressed].slice(0, 5));
    setErrors(p => ({ ...p, images: '' }));
  };

  const handleVideos = (e) => {
    const files = Array.from(e.target.files).slice(0, 2 - videos.length);
    const meta  = files.map(f => ({ name: f.name, size: (f.size / 1024 / 1024).toFixed(1) }));
    setVideos(prev => [...prev, ...meta].slice(0, 2));
  };

  const validate = () => {
    const errs = {};
    if (!reportType)         errs.type        = 'يرجى اختيار نوع البلاغ';
    if (!severity)           errs.severity    = 'يرجى تحديد مستوى الخطورة';
    if (!description.trim()) errs.description = 'يرجى وصف المشكلة';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reports'), {
        reportType,
        severity,
        description,
        images,
        videos: videos.map(v => v.name),
        observer: profile?.nameAr || profile?.name || 'مراقب',
        center:   profile?.center  || '—',
        caterer:  profile?.caterer || getCaterer(profile?.center) || '—',
        uid:      profile?.uid     || '',
        timestamp:  serverTimestamp(),
        createdAt:  serverTimestamp(),
        status: 'pending',
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setErrors({ description: 'حدث خطأ أثناء الإرسال، تحقق من الاتصال وحاول مجدداً' });
    }
    setSubmitting(false);
  };

  /* ── شاشة النجاح ── */
  if (submitted) {
    const sv = SEVERITY.find(s => s.id === severity);
    return (
      <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-[#FDFCFB]"
        style={{ fontFamily: "'IBM Plex Sans Arabic', Tahoma, sans-serif" }}>
        <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-5">
          {severity === 'high'
            ? <Zap size={38} className="text-red-600" strokeWidth={1.5} />
            : <CheckCircle2 size={38} className="text-green-600" strokeWidth={1.5} />}
        </div>
        <h2 className="text-2xl font-bold text-[#2D2926] mb-2">تم إرسال البلاغ</h2>
        <p className="text-[#6D6E71] text-sm mb-2">سيتم مراجعته من قِبل المشرف المختص</p>
        {sv && (
          <span className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-6"
            style={{ background: sv.bg, color: sv.text, border: `1px solid ${sv.border}` }}>
            خطورة {sv.label}
          </span>
        )}
        <button onClick={() => navigate('/home')}
          className="w-full max-w-xs py-4 rounded-xl font-bold text-white hover:opacity-90 transition"
          style={{ background: 'linear-gradient(135deg,#C4A46E,#A98159,#8B6840)' }}>
          العودة للرئيسية
        </button>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-28"
      style={{ fontFamily: "'IBM Plex Sans Arabic', Tahoma, sans-serif" }}>

      {/* Header */}
      <div className="bg-white sticky top-0 z-50 border-b border-[#D1C4B9] shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl border border-[#D1C4B9] flex items-center justify-center hover:bg-[#FDF8F0] transition">
            <ChevronRight size={18} className="text-[#A98159]" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-[#2D2926] text-base">رفع بلاغ ميداني</h1>
            <p className="text-xs text-[#6D6E71]">البلاغات ترسل فوراً للوحة التحكم</p>
          </div>
          <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5">
            <AlertTriangle size={13} className="text-red-600" strokeWidth={2.5} />
            <span className="text-xs font-bold text-red-600">عاجل</span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* هوية المراقب — تلقائية */}
        <div className="bg-white rounded-2xl border border-[#D1C4B9] overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-[#FDF8F0] border-b border-[#D1C4B9]">
            <p className="text-xs font-bold text-[#A98159]">بيانات المراقب — مُعبّأة تلقائياً</p>
          </div>
          <div className="px-4 py-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <User size={14} className="text-[#A98159] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-[#6D6E71]">اسم المراقب</p>
                <p className="text-sm font-bold text-[#2D2926] truncate">{profile?.nameAr || profile?.name || '—'}</p>
              </div>
            </div>
            <div className="h-px bg-[#D1C4B9]/40" />
            <div className="flex items-center gap-2">
              <Building2 size={14} className="text-[#A98159] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-[#6D6E71]">المركز / المسكن</p>
                <p className="text-sm font-bold text-[#2D2926]">{profile?.center || '—'}</p>
              </div>
            </div>
            <div className="h-px bg-[#D1C4B9]/40" />
            <div className="flex items-center gap-2">
              <Building2 size={14} className="text-[#A98159] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-[#6D6E71]">المتعهد</p>
                <p className="text-xs font-bold text-[#A98159] leading-snug">{profile?.caterer || getCaterer(profile?.center) || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* نوع البلاغ */}
        <div>
          <p className="text-sm font-bold text-[#2D2926] mb-2.5">
            نوع البلاغ <span className="text-red-500">*</span>
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {REPORT_TYPES.map(rt => {
              const sel = reportType === rt.id;
              return (
                <button key={rt.id} onClick={() => { setReportType(rt.id); setErrors(p => ({ ...p, type: '' })); }}
                  className="flex items-center gap-3 p-3.5 rounded-2xl border-2 text-right transition-all active:scale-[0.97]"
                  style={sel
                    ? { borderColor: rt.color, background: `${rt.color}12` }
                    : { borderColor: '#E5DDD5', background: '#fff' }}>
                  <span className="text-2xl leading-none">{rt.icon}</span>
                  <span className="text-sm font-bold" style={{ color: sel ? rt.color : '#2D2926' }}>
                    {rt.label}
                  </span>
                </button>
              );
            })}
          </div>
          {errors.type && <p className="text-red-500 text-xs mt-1.5">{errors.type}</p>}
        </div>

        {/* مستوى الخطورة */}
        <div>
          <p className="text-sm font-bold text-[#2D2926] mb-2.5">
            مستوى الخطورة <span className="text-red-500">*</span>
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {SEVERITY.map(sv => {
              const sel = severity === sv.id;
              return (
                <button key={sv.id} onClick={() => { setSeverity(sv.id); setErrors(p => ({ ...p, severity: '' })); }}
                  className="py-4 rounded-2xl border-2 text-center transition-all active:scale-[0.97]"
                  style={sel
                    ? { background: sv.bg, borderColor: sv.dot, color: sv.text }
                    : { background: '#fff', borderColor: '#E5DDD5', color: '#6D6E71' }}>
                  <span className="block w-3 h-3 rounded-full mx-auto mb-2"
                    style={{ background: sel ? sv.dot : '#D1C4B9' }} />
                  <p className="text-sm font-bold">{sv.label}</p>
                  <p className="text-[10px] mt-0.5 opacity-80">{sv.desc}</p>
                </button>
              );
            })}
          </div>
          {errors.severity && <p className="text-red-500 text-xs mt-1.5">{errors.severity}</p>}
        </div>

        {/* وصف المشكلة */}
        <div>
          <p className="text-sm font-bold text-[#2D2926] mb-2">
            وصف المشكلة <span className="text-red-500">*</span>
          </p>
          <textarea rows={4}
            value={description}
            onChange={e => { setDescription(e.target.value); setErrors(p => ({ ...p, description: '' })); }}
            placeholder="اكتب وصفاً تفصيلياً للمشكلة — ماذا لاحظت؟ منذ متى؟ كم عدد المتأثرين؟"
            className={`w-full px-4 py-3 text-sm border-2 rounded-2xl bg-white text-[#2D2926] placeholder-[#6D6E71]/50
              focus:outline-none focus:ring-2 focus:ring-[#A98159]/20 transition-all resize-none
              ${errors.description ? 'border-red-400' : 'border-[#D1C4B9] focus:border-[#A98159]'}`}
          />
          {errors.description
            ? <p className="text-red-500 text-xs mt-1">{errors.description}</p>
            : <p className="text-xs text-[#6D6E71] text-left mt-1">{description.length} حرف</p>}
        </div>

        {/* المرفقات */}
        <div className="bg-white rounded-2xl border border-[#D1C4B9] overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-[#FDF8F0] border-b border-[#D1C4B9]">
            <p className="text-xs font-bold text-[#A98159]">المرفقات (اختياري)</p>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">

            {/* صور */}
            <div>
              <button onClick={() => imageRef.current?.click()}
                disabled={images.length >= 5}
                className="w-full h-20 rounded-xl border-2 border-dashed border-[#D1C4B9] flex flex-col items-center justify-center gap-1.5
                  hover:border-[#A98159] hover:bg-[#FDF8F0] transition disabled:opacity-40 disabled:cursor-not-allowed">
                <Camera size={22} className="text-[#A98159]" />
                <span className="text-xs font-bold text-[#A98159]">
                  {images.length > 0 ? `${images.length} صورة` : 'إضافة صور'}
                </span>
              </button>
              <input ref={imageRef} type="file" multiple accept="image/*" capture="environment"
                className="hidden" onChange={handleImages} />
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  {images.map((src, i) => (
                    <div key={i} className="relative group">
                      <img src={src} className="w-full h-12 object-cover rounded-lg border border-[#D1C4B9]" alt="" />
                      <button onClick={() => setImages(p => p.filter((_, j) => j !== i))}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        <X size={10} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* فيديو */}
            <div>
              <button onClick={() => videoRef.current?.click()}
                disabled={videos.length >= 2}
                className="w-full h-20 rounded-xl border-2 border-dashed border-[#D1C4B9] flex flex-col items-center justify-center gap-1.5
                  hover:border-[#A98159] hover:bg-[#FDF8F0] transition disabled:opacity-40 disabled:cursor-not-allowed">
                <Video size={22} className="text-[#A98159]" />
                <span className="text-xs font-bold text-[#A98159]">
                  {videos.length > 0 ? `${videos.length} فيديو` : 'إضافة فيديو'}
                </span>
              </button>
              <input ref={videoRef} type="file" multiple accept="video/*" capture="environment"
                className="hidden" onChange={handleVideos} />
              {videos.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {videos.map((v, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#F5F0EB] rounded-lg px-2.5 py-1.5 text-xs">
                      <span className="truncate text-[#2D2926] font-medium">{v.name}</span>
                      <button onClick={() => setVideos(p => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 mr-1">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* زر الإرسال */}
      <div className="fixed bottom-0 right-0 left-0 bg-white/95 backdrop-blur-md border-t border-[#D1C4B9] px-4 py-3 z-40">
        <div className="max-w-lg mx-auto">
          {severity === 'high' && (
            <div className="flex items-center gap-2 mb-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <Zap size={13} className="text-red-600 flex-shrink-0" strokeWidth={2.5} />
              <span className="text-xs text-red-600 font-medium">البلاغ عالي الخطورة يصل للمشرف فوراً</span>
            </div>
          )}
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-4 rounded-xl font-bold text-white text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#C4A46E,#A98159,#8B6840)', boxShadow: '0 4px 20px rgba(169,129,89,0.35)' }}>
            {submitting
              ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> جارٍ الإرسال...</>
              : <><Send size={18} strokeWidth={2.5} /> إرسال البلاغ</>}
          </button>
        </div>
      </div>
    </div>
  );
}
