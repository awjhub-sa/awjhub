import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { db, serverTimestamp, uploadFile, STORAGE_BUCKETS } from '../lib/db.js';
import { compressImage } from '../lib/imageCompression.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getCaterer } from '../config/centers.js';
import { initialStatusFields } from '../lib/statusTracking.js';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

const OK = '#15803D';

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

const SEVERITY_MAP = {
  high:   { label: 'عالي الخطورة',   color: '#DC2626' },
  medium: { label: 'متوسط الخطورة', color: '#D97706' },
  low:    { label: 'منخفض الخطورة',  color: OK },
};

export default function Report() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const [holySite, setHolySite] = useState('');
  const [mealType, setMealType] = useState('');
  const [selectedReport, setSelectedReport] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [imageFile, setImageFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [reportNum,   setReportNum]   = useState('');
  const [submitted,   setSubmitted]   = useState(false);

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
      const folder = `${profile?.center || 'unknown'}/${ts}`;
      /* Compress image then upload media in parallel */
      const compressedImage = await compressImage(imageFile);
      const [imgUrl, vidUrl] = await Promise.all([
        uploadFile(STORAGE_BUCKETS.reports, `${folder}/image_${compressedImage.name}`, compressedImage),
        uploadFile(STORAGE_BUCKETS.reports, `${folder}/video_${videoFile.name}`, videoFile),
      ]);
      /* Insert — report_number is generated server-side by sequence default */
      const inserted = await db.reports.insert({
        uid:        profile?.uid,
        observer:   profile?.nameAr || profile?.name || 'مراقب',
        center:     profile?.center || '—',
        caterer:    profile?.caterer || getCaterer(profile?.center) || '—',
        holySite,
        mealType,
        reportType: selectedReport,
        severity,
        description,
        timestamp:  serverTimestamp(),
        images:     [imgUrl],
        videoUrl:   vidUrl,
        ...initialStatusFields('pending'),
      });
      setReportNum(inserted.reportNumber);
      setSubmitted(true);
    } catch (err) {
      console.error('[Report submit]', err);
      alert(`خطأ في الإرسال: ${err?.message || err}`);
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div dir="rtl" className="min-h-screen bg-canvas flex items-center justify-center p-6 font-arabic">
        <div className="w-full max-w-sm text-center space-y-6">
          <div
            className="w-16 h-16 rounded-[16px] border flex items-center justify-center mx-auto"
            style={{ background: tint(OK, 12), borderColor: tint(OK, 28) }}
          >
            <CheckCircle2 size={30} weight="duotone" style={{ color: OK }} />
          </div>
          <div>
            <h2 className="text-[19px] font-bold text-ink mb-1">تم إرسال البلاغ</h2>
            <p className="text-[13px] font-medium text-muted">وصل البلاغ لغرفة العمليات بنجاح</p>
          </div>
          <div
            className="rounded-[14px] border px-6 py-5 text-center"
            style={{
              background: tint('rgb(var(--c-primary))', 12),
              borderColor: tint('rgb(var(--c-primary))', 28),
            }}
          >
            <p className="text-[10px] font-bold text-muted mb-2.5 tracking-[0.18em]">رقم البلاغ</p>
            <p className="text-[30px] font-extrabold text-primary tabular-nums leading-none">{reportNum}</p>
            <p className="text-[10.5px] font-medium text-muted mt-2.5">احتفظ بهذا الرقم للمتابعة</p>
          </div>
          <button onClick={() => navigate('/home')}
            className="w-full min-h-[48px] py-3.5 rounded-[12px] bg-primary border border-primary text-white font-bold text-[14px]
                       shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] hover:opacity-90 transition-opacity">
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-canvas pb-32 font-arabic">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-line w-full px-4 md:px-8 py-3 mb-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/home')} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-[rgb(var(--c-bg))] rounded-[10px] transition-colors shrink-0">
            <ChevronRight className="text-primary" size={20} weight="bold" />
          </button>
          <h1 className="text-[15px] font-bold text-ink absolute left-1/2 -translate-x-1/2 whitespace-nowrap">بلاغ طارئ عاجل</h1>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4">
          <div className="rounded-[18px] p-5 sm:p-6 my-6 text-white relative overflow-hidden"
            style={{ background: 'rgb(var(--c-ink))' }}>
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--c-accent) / 0.6), transparent)' }} />

            <div className="flex items-center gap-3.5 mb-5">
              <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
                style={{ background: 'rgb(255 255 255 / 0.06)' }}>
                <Siren size={23} weight="duotone" className={severity === 'high' ? 'text-red-300' : 'text-accent'} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.18em] text-accent/80">نظام الرصد الميداني</p>
                <h2 className="text-[19px] font-extrabold mt-1 leading-tight">تفاصيل البلاغ</h2>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-[10px] py-2.5 px-2 border border-white/10 text-center"
                style={{ background: 'rgb(255 255 255 / 0.06)' }}>
                <span className="block text-[10px] font-medium text-white/50 mb-1">المراقب</span>
                <span className="block text-white font-bold text-[12px] truncate">{profile?.nameAr || '—'}</span>
              </div>
              <div className="rounded-[10px] py-2.5 px-2 border border-white/10 text-center"
                style={{ background: 'rgb(255 255 255 / 0.06)' }}>
                <span className="block text-[10px] font-medium text-white/50 mb-1">المركز</span>
                <span className="block text-accent font-bold text-[12px] truncate">{profile?.center || '—'}</span>
              </div>
              <div className="rounded-[10px] py-2.5 px-2 border border-white/10 text-center"
                style={{ background: 'rgb(255 255 255 / 0.06)' }}>
                <span className="block text-[10px] font-medium text-white/50 mb-1">المتعهد</span>
                <span className="block text-white font-bold text-[12px] truncate">{profile?.caterer || '—'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[14px] p-5 border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] space-y-5">
            <div>
              <label className="text-[11.5px] font-bold text-muted mb-2 block">المشعر *</label>
              <div className="grid grid-cols-2 gap-2.5">
                {HOLY_SITES.map(s => {
                  const active = holySite === s.key;
                  const SIcon = s.Icon;
                  return (
                    <button key={s.key} type="button"
                      onClick={() => setHolySite(s.key)}
                      className={`flex flex-col items-center justify-center gap-1.5 min-h-[66px] py-3.5 rounded-[11px] border text-[13px] font-bold transition-colors ${
                        active ? 'text-white' : 'bg-white text-muted border-line hover:bg-[rgb(var(--c-bg))]'
                      }`}
                      style={active ? { background: s.color, borderColor: s.color } : undefined}
                    >
                      <SIcon size={20} weight="bold" />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[11.5px] font-bold text-muted mb-2 block">الوجبة *</label>
              <div className="grid grid-cols-3 gap-2.5">
                {MEAL_OPTIONS.map(m => {
                  const active = mealType === m.key;
                  const MIcon = m.Icon;
                  return (
                    <button key={m.key} type="button"
                      onClick={() => setMealType(m.key)}
                      className={`flex flex-col items-center justify-center gap-1.5 min-h-[60px] py-3 rounded-[11px] border text-[12px] font-bold transition-colors ${
                        active ? 'text-white' : 'bg-white text-muted border-line hover:bg-[rgb(var(--c-bg))]'
                      }`}
                      style={active ? { background: m.color, borderColor: m.color } : undefined}
                    >
                      <MIcon size={18} weight="bold" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[11.5px] font-bold text-muted mb-2 block">نوع المخالفة/البلاغ</label>
              <select value={selectedReport} onChange={handleReportChange}
                className="w-full min-h-[46px] px-3.5 py-3 border border-line rounded-[10px] bg-white font-bold text-[13px] text-ink outline-none focus:border-primary transition-colors appearance-none">
                <option value="">اختر</option>
                {REPORT_TYPES.map(r => <option key={r.id} value={r.title}>{r.title}</option>)}
              </select>
            </div>

            {selectedReport && (
              <div className="rounded-[11px] border p-3.5 flex items-center justify-between gap-3"
                style={{
                  background: tint(SEVERITY_MAP[severity].color, 12),
                  borderColor: tint(SEVERITY_MAP[severity].color, 28),
                }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SEVERITY_MAP[severity].color }} />
                  <span className="text-[13px] font-bold truncate" style={{ color: SEVERITY_MAP[severity].color }}>
                    {SEVERITY_MAP[severity].label}
                  </span>
                </div>
                <CheckCircle2 size={17} weight="duotone" className="shrink-0" style={{ color: SEVERITY_MAP[severity].color }} />
              </div>
            )}

            <div>
              <label className="text-[11.5px] font-bold text-muted mb-2 block">وصف البلاغ الميداني *</label>
              <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                placeholder="يرجى كتابة تفاصيل واضحة للمساعدة في المعالجة السريعة..."
                className="w-full px-3.5 py-3 border border-line rounded-[10px] bg-white outline-none text-[13px] text-ink placeholder:text-muted/70 resize-none focus:border-primary transition-colors" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div onClick={() => imageInputRef.current.click()}
                   className="relative border border-dashed rounded-[11px] p-4 min-h-[92px] flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors"
                   style={imageFile
                     ? { background: tint(OK, 12), borderColor: tint(OK, 34) }
                     : { background: 'rgb(var(--c-bg))', borderColor: 'rgb(var(--c-line))' }}>
                <input type="file" ref={imageInputRef} hidden accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} />
                {imageFile ? (
                  <>
                    <CheckCircle2 size={22} weight="duotone" style={{ color: OK }} />
                    <span className="text-[11px] font-bold text-center truncate w-full px-1" style={{ color: OK }}>تم رفع الصورة</span>
                    <button type="button" onClick={(e) => {e.stopPropagation(); setImageFile(null)}}
                      className="absolute top-1.5 end-1.5 w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-[#DC2626] transition-colors">
                      <X size={13} weight="bold" />
                    </button>
                  </>
                ) : (
                  <>
                    <ImageIcon size={22} weight="duotone" className="text-primary" />
                    <span className="text-[11px] font-bold text-muted">ارفق صورة *</span>
                  </>
                )}
              </div>

              <div onClick={() => videoInputRef.current.click()}
                   className="relative border border-dashed rounded-[11px] p-4 min-h-[92px] flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors"
                   style={videoFile
                     ? { background: tint(OK, 12), borderColor: tint(OK, 34) }
                     : { background: 'rgb(var(--c-bg))', borderColor: 'rgb(var(--c-line))' }}>
                <input type="file" ref={videoInputRef} hidden accept="video/*" onChange={(e) => setVideoFile(e.target.files[0])} />
                {videoFile ? (
                  <>
                    <CheckCircle2 size={22} weight="duotone" style={{ color: OK }} />
                    <span className="text-[11px] font-bold text-center truncate w-full px-1" style={{ color: OK }}>تم رفع الفيديو</span>
                    <button type="button" onClick={(e) => {e.stopPropagation(); setVideoFile(null)}}
                      className="absolute top-1.5 end-1.5 w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-[#DC2626] transition-colors">
                      <X size={13} weight="bold" />
                    </button>
                  </>
                ) : (
                  <>
                    <Video size={22} weight="duotone" className="text-primary" />
                    <span className="text-[11px] font-bold text-muted">ارفق فيديو *</span>
                  </>
                )}
              </div>
            </div>
          </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 px-4 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-sm border-t border-line z-50">
        <button onClick={handleSubmit} disabled={loading}
          className={`w-full max-w-md mx-auto min-h-[52px] rounded-[12px] border font-bold text-[15px] text-white
                      flex items-center justify-center gap-2.5 transition-colors disabled:opacity-60
            ${loading ? 'bg-muted border-muted' : 'bg-[#DC2626] border-[#DC2626] hover:bg-[#B91C1C]'}`}>
          {loading ? 'جاري رفع البيانات...' : <><Zap size={19} weight="fill" /> إرسال بلاغ عاجل</>}
        </button>
      </div>
    </div>
  );
}