import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CaretRight as ChevronRight,
  Siren,
  Lightning as Zap,
  Image as ImageIcon,
  VideoCamera as Video,
  UploadSimple as Upload,
  X,
  CheckCircle as CheckCircle2,
  SunHorizon as Sunrise,
  Sun as SunMedium,
  MoonStars as MoonStar,
  MapPin,
  Tent,
} from '@phosphor-icons/react';
import { db, serverTimestamp, uploadFile, STORAGE_BUCKETS } from '../../lib/db.js';
import { compressImage } from '../../lib/imageCompression.js';
import { useAuth } from "../../context/AuthContext.jsx";
import { getCaterer } from '../../config/centers.js';
import { initialStatusFields } from '../../lib/statusTracking.js';

const REPORT_TYPES = [
  { id: 1, title: 'عدم توفر مصدر للمياه (انقطاع مياه المطبخ)', severity: 'high' },
  { id: 2, title: 'حدوث التماس كهربائي / انقطاع الكهرباء داخل المطبخ', severity: 'high' },
  { id: 3, title: 'عطل في مواقد الكيروسين (بسبب عطل كهربائي)', severity: 'high' },
  { id: 4, title: 'عطل في مواقد الكيروسين (بسبب انسكاب مياه على المجرى)', severity: 'high' },
  { id: 5, title: 'نقص المواد الغذانية (المواد الأساسية / المواد الخام)', severity: 'high' },
  { id: 6, title: 'عطل في مستودعات الحفظ (التبريد / التجميد)', severity: 'high' },
  { id: 7, title: 'عدم التزام المتعهد بالمواعيد الزمنية لإعداد الوجبات وتوزيعها', severity: 'high' },
  { id: 8, title: 'هروب عمالة المتعهد / عدم وجود فريق عمل المتعهد داخل المطبخ', severity: 'high' },
  { id: 9, title: 'دخول حجاج من خارج المخيم', severity: 'high' },
  { id: 10, title: 'إستخدام عبوات مياه الشرب للوضوء (أثناء إنقطاع مصدر المياه)', severity: 'high' },
  { id: 11, title: 'نقص في مخزون عبوات مياه الشرب', severity: 'high' },
  { id: 12, title: 'إستخدام عبوات مياه الشرب لأغراض الطبخ', severity: 'high' },
  { id: 13, title: 'إتلاف مواد غذائية', severity: 'high' },
  { id: 14, title: 'عدم حفظ العينات المرجعية', severity: 'high' },
  { id: 15, title: 'الإحتفاظ بمواد غذائية منتهية الصلاحية أو تظهر عليها علامات الفساد', severity: 'high' },
  { id: 16, title: 'وجود تسريب لمياه الصرف الصحي داخل المطبخ / طفح المجاري', severity: 'medium' },
  { id: 17, title: 'عدم تعاون المتعهد وفريق العمل / عدم إستجابة المتعهد للتعليمات', severity: 'medium' },
  { id: 18, title: 'عدم إستجابة فريق الكيروسين لإصلاح عطل المواقد', severity: 'medium' },
  { id: 19, title: 'نقص في أعداد الوجبات المقدمة للحجاج', severity: 'medium' },
  { id: 20, title: 'توزيع عبوات مياه الشرب خارج المخيم', severity: 'medium' },
  { id: 21, title: 'إتلاف وجبات جاهزة', severity: 'medium' },
  { id: 22, title: 'تدني مستوى سائل الكيروسين', severity: 'low' },
  { id: 23, title: 'نقص مواد التغليف / التعبئة', severity: 'low' },
  { id: 24, title: 'عدم تواجد الحجاج داخل المخيم أثناء تقديم الوجبات', severity: 'low' },
  { id: 25, title: 'إستخدام عبوات مياه الشرب لدورات المياه', severity: 'low' },
  { id: 26, title: 'أخرى', severity: 'low' },
];

const MEAL_OPTIONS = [
  { key: 'breakfast', label: 'الإفطار', Icon: Sunrise,   color: '#F59E0B' },
  { key: 'lunch',     label: 'الغداء',  Icon: SunMedium, color: '#4E7CB0' },
  { key: 'dinner',    label: 'العشاء',  Icon: MoonStar,  color: '#B4674E' },
];

const HOLY_SITES = [
  { key: 'mina',   label: 'منى',   Icon: Tent,   color: 'rgb(var(--c-primary))' },
  { key: 'arafat', label: 'عرفات', Icon: MapPin, color: '#5E9070' },
];

/* One colour per severity; the banner's surface is derived from it rather than
   carrying its own set of classes. */
const SEVERITY_MAP = {
  high:   { label: 'عالي الخطورة',   color: '#DC2626' },
  medium: { label: 'متوسط الخطورة', color: '#EA580C' },
  low:    { label: 'منخفض الخطورة', color: '#16A34A' },
};

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

const OK = '#16A34A';

export default function SupReport() {
  const navigate = useNavigate();
  const { state } = useLocation(); // استقبال المركز المختار
  const { profile } = useAuth();
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const selectedCenter = state?.centerId || '—'; // تحديد المركز المختار للمشرف
  const [holySite, setHolySite] = useState('');
  const [mealType, setMealType] = useState('');
  const [selectedReport, setSelectedReport] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [imageFile, setImageFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleReportChange = (e) => {
    const reportTitle = e.target.value;
    setSelectedReport(reportTitle);
    const reportData = REPORT_TYPES.find(r => r.title === reportTitle);
    if (reportData) setSeverity(reportData.severity);
  };

  const handleSubmit = async () => {
    if (!holySite) {
        alert('اختر المشعر أولاً (منى / عرفات)');
        return;
    }
    if (!mealType) {
        alert('اختر الوجبة أولاً (فطور / غداء / عشاء)');
        return;
    }
    if (!selectedReport || !description || !imageFile || !videoFile) {
        alert('الرجاء إكمال كافة المتطلبات (النوع، الوصف، الصورة، والفيديو)');
        return;
    }

    setLoading(true);
    try {
      const ts = Date.now();
      const folder = `${selectedCenter || 'unknown'}/${ts}`;
      const compressedImage = await compressImage(imageFile);
      const [imgUrl, vidUrl] = await Promise.all([
        uploadFile(STORAGE_BUCKETS.reports, `${folder}/image_${compressedImage.name}`, compressedImage),
        uploadFile(STORAGE_BUCKETS.reports, `${folder}/video_${videoFile.name}`, videoFile),
      ]);
      await db.reports.insert({
        uid: profile?.uid,
        observer: profile?.nameAr || profile?.name || 'مشرف',
        center: selectedCenter,
        caterer: getCaterer(selectedCenter) || '—',
        holySite,
        mealType,
        reportType: selectedReport,
        severity,
        description,
        images: [imgUrl],
        videoUrl: vidUrl,
        role: 'supervisor',
        timestamp: serverTimestamp(),
        ...initialStatusFields('pending'),
      });
      alert('تم إرسال البلاغ لغرفة العمليات');
      navigate('/supervisor-home');
    } catch (e) {
      console.error('[SupReport submit]', e);
      alert(`خطأ في الإرسال: ${e?.message || e}`);
    }
    setLoading(false);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-canvas pb-32 font-arabic">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-line w-full px-4 md:px-8 py-2.5 mb-6">
        <div className="max-w-5xl mx-auto grid grid-cols-[40px_1fr_40px] items-center gap-2">
          <button onClick={() => navigate('/supervisor-home')}
            className="w-10 h-10 flex items-center justify-center rounded-[10px] border border-line bg-white hover:bg-[rgb(var(--c-bg))] transition-colors">
            <ChevronRight className="text-primary" size={18} weight="bold" />
          </button>
          <h1 className="text-[14px] font-bold text-ink text-center truncate">بلاغ طارئ عاجل (إشراف)</h1>
          <span />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4">
          <div className="relative rounded-[18px] overflow-hidden px-5 py-5 mb-5"
            style={{ background: 'linear-gradient(180deg, rgb(var(--c-primary)) 0%, rgb(var(--c-primary-700)) 100%)' }}>
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--c-accent) / 0.6), transparent)' }} />
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
                style={{ background: 'rgb(255 255 255 / 0.06)' }}>
                <Siren size={23} weight="duotone" className={severity === 'high' ? 'text-red-300' : 'text-accent'} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-accent/80">نظام الرصد الميداني</p>
                <h2 className="text-[19px] font-extrabold text-white mt-1 leading-tight">تفاصيل البلاغ</h2>
              </div>
            </div>
            <div className="flex items-stretch mt-4 pt-4 border-t border-white/10">
              {[
                { lbl: 'المشرف',  val: profile?.nameAr || '—',          cls: 'text-white' },
                { lbl: 'المركز',  val: selectedCenter,                   cls: 'text-accent' },
                { lbl: 'المتعهد', val: getCaterer(selectedCenter) || '—', cls: 'text-white' },
              ].map((c, i) => (
                <div key={c.lbl} className={`flex-1 min-w-0 px-4 first:ps-0 ${i > 0 ? 'border-s border-white/10' : ''}`}>
                  <p className="text-[10px] font-medium text-white/50">{c.lbl}</p>
                  <p className={`text-[13px] font-bold mt-1 truncate ${c.cls}`}>{c.val}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-[14px] p-5 border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] space-y-5">
            <div>
              <label className="text-[11px] font-bold text-muted tracking-[0.14em] uppercase mb-2.5 block">المشعر *</label>
              <div className="grid grid-cols-2 gap-2.5">
                {HOLY_SITES.map(s => {
                  const active = holySite === s.key;
                  const SIcon = s.Icon;
                  return (
                    <button key={s.key} type="button"
                      onClick={() => setHolySite(s.key)}
                      className={`flex flex-col items-center gap-1.5 py-3.5 rounded-[11px] border transition-colors ${
                        active ? 'text-white' : 'bg-white text-muted border-line hover:bg-[rgb(var(--c-bg))]'
                      }`}
                      style={active ? { background: s.color, borderColor: s.color } : undefined}
                    >
                      <SIcon size={20} weight="bold" style={active ? undefined : { color: s.color }} />
                      <span className="text-[13px] font-bold">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-muted tracking-[0.14em] uppercase mb-2.5 block">الوجبة *</label>
              <div className="grid grid-cols-3 gap-2.5">
                {MEAL_OPTIONS.map(m => {
                  const active = mealType === m.key;
                  const MIcon = m.Icon;
                  return (
                    <button key={m.key} type="button"
                      onClick={() => setMealType(m.key)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-[11px] border transition-colors ${
                        active ? 'text-white' : 'bg-white text-muted border-line hover:bg-[rgb(var(--c-bg))]'
                      }`}
                      style={active ? { background: m.color, borderColor: m.color } : undefined}
                    >
                      <MIcon size={18} weight="bold" style={active ? undefined : { color: m.color }} />
                      <span className="text-[12px] font-bold">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-muted tracking-[0.14em] uppercase mb-2.5 block">نوع المخالفة/البلاغ</label>
              <select value={selectedReport} onChange={handleReportChange}
                className="w-full px-3.5 py-3 border border-line rounded-[11px] bg-white font-semibold text-[13px] text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all appearance-none">
                <option value="">اختر</option>
                {REPORT_TYPES.map(r => <option key={r.id} value={r.title}>{r.title}</option>)}
              </select>
            </div>

            {selectedReport && (
              <div className="px-4 py-3 rounded-[11px] border flex items-center justify-between"
                style={{
                  background: tint(SEVERITY_MAP[severity].color, 12),
                  borderColor: tint(SEVERITY_MAP[severity].color, 28),
                }}>
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: SEVERITY_MAP[severity].color }} />
                  <span className="font-bold text-[13px]" style={{ color: SEVERITY_MAP[severity].color }}>
                    {SEVERITY_MAP[severity].label}
                  </span>
                </div>
                <CheckCircle2 size={16} weight="bold" style={{ color: SEVERITY_MAP[severity].color }} />
              </div>
            )}

            <div>
              <label className="text-[11px] font-bold text-muted tracking-[0.14em] uppercase mb-2.5 block">وصف البلاغ الميداني *</label>
              <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                placeholder="يرجى كتابة تفاصيل واضحة للمساعدة في المعالجة السريعة..."
                className="w-full px-3.5 py-3 bg-white border border-line rounded-[11px] outline-none text-[13px] text-ink resize-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div onClick={() => imageInputRef.current.click()}
                   className="relative border border-dashed rounded-[11px] p-4 flex flex-col items-center justify-center transition-colors cursor-pointer"
                   style={imageFile
                     ? { background: tint(OK, 12), borderColor: tint(OK, 34) }
                     : { background: 'rgb(var(--c-bg))', borderColor: 'rgb(var(--c-line))' }}>
                <input type="file" ref={imageInputRef} hidden accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} />
                {imageFile ? (
                  <>
                    <CheckCircle2 size={22} weight="duotone" className="mb-1.5" style={{ color: OK }} />
                    <span className="text-[11px] font-bold text-center truncate w-full px-1" style={{ color: OK }}>تم رفع الصورة</span>
                    <X className="absolute top-1.5 end-1.5" size={14} weight="bold" style={{ color: 'rgb(var(--c-muted))' }}
                       onClick={(e) => {e.stopPropagation(); setImageFile(null)}}/>
                  </>
                ) : (
                  <>
                    <ImageIcon size={22} weight="duotone" className="mb-1.5 text-primary" />
                    <span className="text-[11px] font-bold text-muted">ارفق صورة *</span>
                  </>
                )}
              </div>

              <div onClick={() => videoInputRef.current.click()}
                   className="relative border border-dashed rounded-[11px] p-4 flex flex-col items-center justify-center transition-colors cursor-pointer"
                   style={videoFile
                     ? { background: tint(OK, 12), borderColor: tint(OK, 34) }
                     : { background: 'rgb(var(--c-bg))', borderColor: 'rgb(var(--c-line))' }}>
                <input type="file" ref={videoInputRef} hidden accept="video/*" onChange={(e) => setVideoFile(e.target.files[0])} />
                {videoFile ? (
                  <>
                    <CheckCircle2 size={22} weight="duotone" className="mb-1.5" style={{ color: OK }} />
                    <span className="text-[11px] font-bold text-center truncate w-full px-1" style={{ color: OK }}>تم رفع الفيديو</span>
                    <X className="absolute top-1.5 end-1.5" size={14} weight="bold" style={{ color: 'rgb(var(--c-muted))' }}
                       onClick={(e) => {e.stopPropagation(); setVideoFile(null)}}/>
                  </>
                ) : (
                  <>
                    <Video size={22} weight="duotone" className="mb-1.5 text-primary" />
                    <span className="text-[11px] font-bold text-muted">ارفق فيديو *</span>
                  </>
                )}
              </div>
            </div>
          </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-md border-t border-line z-50">
        <button onClick={handleSubmit} disabled={loading}
          className={`w-full max-w-md mx-auto min-h-[50px] rounded-[12px] border font-bold text-[15px] flex items-center justify-center gap-2 transition-colors
            ${loading ? 'bg-muted border-muted text-white' : 'bg-error border-error text-white hover:bg-[#B91C1C] hover:border-[#B91C1C]'}`}>
          {loading ? 'جاري رفع البيانات...' : <><Zap size={18} weight="fill" /> إرسال بلاغ عاجل</>}
        </button>
      </div>
    </div>
  );
}