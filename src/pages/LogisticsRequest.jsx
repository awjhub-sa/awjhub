import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CaretRight as ChevronRight,
  PaperPlaneTilt as Send,
  Truck,
  Package,
  ForkKnife as Utensils,
  Drop as Droplets,
  User,
  CheckCircle as CheckCircle2,
  Warning as AlertTriangle,
  ArrowLeft,
  FileText,
  Clock,
  MapPin,
  Mountains as Mountain,
} from '@phosphor-icons/react';
import { supabase } from '../config/supabase.js';
import { db, serverTimestamp, rowFromDb } from '../lib/db.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getCaterer } from '../config/centers.js';
import { initialStatusFields } from '../lib/statusTracking.js';
import { IconTile, Pill } from '../components/ui/index.jsx';

/* Tints are derived from the one colour a block already owns — amber for the
   report it hangs off, navy for the request itself. */
const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

const PRIMARY = 'rgb(var(--c-primary))';
const WARN    = '#D97706';
const OK      = '#15803D';

const CATEGORY_TYPES = [
  { id: 'meals', label: 'إسناد وجبات', icon: Utensils },
  { id: 'water', label: 'إسناد مياه', icon: Droplets },
];

const SUPPORT_TYPES = [
  { value: 'internal', label: 'داخلي' },
  { value: 'external', label: 'خارجي' },
  { value: 'both',     label: 'داخلي وخارجي' },
];

const HOLY_SITES = [
  { key: 'mina',   label: 'منى',   Icon: MapPin,   color: 'rgb(var(--c-primary))' },
  { key: 'arafat', label: 'عرفات', Icon: Mountain, color: '#5E9070' },
];

/* Same report-type map used in AdminReports — keep labels short here */
const REPORT_TYPE_LABEL = {
  water:    'تسرب مياه',
  electric: 'عطل كهربائي',
  crowd:    'ازدحام حرج',
  food:     'مشكلة غذائية',
  medical:  'حالة طبية طارئة',
  security: 'بلاغ أمني',
  fire:     'حريق / دخان',
  other:    'بلاغ آخر',
  shortage: 'نقص في الكميات',
  delay:    'تأخر في التوزيع',
  quality:  'مشكلة في الجودة',
  hygiene:  'مخالفة صحية',
};

function fmtTime(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('ar', { dateStyle: 'short', timeStyle: 'short' });
  } catch { return '—'; }
}

export default function LogisticsRequest() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [pendingReports,  setPendingReports]  = useState([]);
  const [loadingReports,  setLoadingReports]  = useState(true);
  const [selectedReport,  setSelectedReport]  = useState(null);

  const [holySite, setHolySite] = useState('');
  const [category, setCategory] = useState('');
  const [supportType, setSupportType] = useState('');
  const [qtyInternal, setQtyInternal] = useState('');
  const [qtyExternal, setQtyExternal] = useState('');
  const [notes, setNotes] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [isFormValid,  setIsFormValid]  = useState(false);
  const [requestNum,   setRequestNum]   = useState('');
  const [submitted,    setSubmitted]    = useState(false);

  /* Subscribe to pending reports for this observer's center */
  useEffect(() => {
    if (!profile?.center) { setLoadingReports(false); return; }
    let mounted = true;
    const load = async () => {
      const { data } = await supabase.from('reports').select('*')
        .eq('center', profile.center)
        .eq('status', 'pending')
        .order('timestamp', { ascending: false });
      if (mounted) {
        setPendingReports((data || []).map(rowFromDb));
        setLoadingReports(false);
      }
    };
    load();
    const ch = supabase.channel(`pending-reports-${profile.center}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [profile?.center]);

  const showInternal = supportType === 'internal' || supportType === 'both';
  const showExternal = supportType === 'external' || supportType === 'both';

  const sanitizeNumber = (value) => {
    const arabicNumbers = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
    let sanitized = value;
    for (let i = 0; i < 10; i++) {
      sanitized = sanitized.replace(arabicNumbers[i], i);
    }
    return sanitized.replace(/[^\d]/g, '');
  };

  /* Inherit holy_site from linked report when available */
  useEffect(() => {
    if (selectedReport?.holySite) setHolySite(selectedReport.holySite);
  }, [selectedReport]);

  useEffect(() => {
    const checkValidity = () => {
      if (!holySite || !category || !supportType) return false;
      const intQty = parseInt(qtyInternal) || 0;
      const extQty = parseInt(qtyExternal) || 0;
      if (supportType === 'internal') return intQty >= 1;
      if (supportType === 'external') return extQty >= 1;
      if (supportType === 'both') return intQty >= 1 && extQty >= 1;
      return false;
    };
    setIsFormValid(checkValidity());
  }, [holySite, category, supportType, qtyInternal, qtyExternal]);

  const handleSubmit = async () => {
    if (!isFormValid || loading) return;
    setLoading(true);
    try {
      const inserted = await db.logistics_requests.insert({
        uid: profile?.uid,
        observer: profile?.nameAr || profile?.name || '—',
        center: profile?.center || '—',
        caterer: profile?.caterer || getCaterer(profile?.center) || '—',
        holySite,
        category,
        supportType,
        qtyInternal: showInternal ? parseInt(qtyInternal) : null,
        qtyExternal: showExternal ? parseInt(qtyExternal) : null,
        notes,
        /* Link to the report this request is for */
        reportId:     selectedReport?.id           || null,
        reportNumber: selectedReport?.reportNumber || null,
        reportType:   selectedReport?.reportType   || selectedReport?.type || null,
        timestamp: serverTimestamp(),
        ...initialStatusFields('pending'),
      });
      setRequestNum(inserted.requestNumber);
      setSubmitted(true);
    } catch (e) {
      console.error('[Logistics submit]', e);
      alert(`خطأ في الإرسال: ${e?.message || e}`);
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div dir="rtl" className="min-h-screen bg-canvas flex items-center justify-center p-6 font-arabic">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto border"
            style={{ background: tint(OK, 12), borderColor: tint(OK, 28) }}>
            <CheckCircle2 size={38} weight="duotone" style={{ color: OK }} />
          </div>
          <div>
            <h2 className="text-[19px] font-bold text-ink mb-1.5">تم إرسال الطلب</h2>
            <p className="text-[13px] font-medium text-muted">وصل طلب الإسناد لغرفة العمليات بنجاح</p>
          </div>
          <div className="bg-ink rounded-[14px] px-6 py-5 text-center">
            <p className="text-white/50 text-[10.5px] font-bold mb-2 tracking-[0.18em] uppercase">رقم الطلب</p>
            <p className="text-white text-[30px] font-extrabold tabular-nums tracking-wider">{requestNum}</p>
            <p className="text-white/45 text-[10px] font-medium mt-2">احتفظ بهذا الرقم للمتابعة</p>
          </div>
          <button onClick={() => navigate('/home')}
            className="w-full min-h-[52px] py-4 rounded-[14px] bg-primary border border-primary text-white font-bold text-[15px] hover:bg-primary-700 transition-colors">
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  if (!selectedReport) {
    return (
      <div dir="rtl" className="min-h-screen bg-canvas pb-10 font-arabic">
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-line w-full px-4 md:px-8 py-3 mb-4">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <button onClick={() => navigate('/home')} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-[rgb(var(--c-bg))] rounded-[10px] transition-colors shrink-0">
              <ChevronRight className="text-primary" size={22} weight="bold" />
            </button>
            <h1 className="flex-1 text-center text-[15px] font-bold text-ink truncate">طلب إسناد</h1>
            <div className="w-10 shrink-0" />
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 space-y-4">
          {/* Intro card */}
          <div className="bg-ink rounded-[14px] p-5">
            <div className="flex items-start gap-3.5">
              <span className="w-11 h-11 rounded-[11px] flex items-center justify-center shrink-0 border border-white/10 bg-white/[0.06]">
                <FileText size={21} className="text-accent" weight="duotone" />
              </span>
              <div className="min-w-0">
                <p className="text-accent/80 text-[10px] font-bold uppercase tracking-[0.18em]">الخطوة الأولى</p>
                <h2 className="text-white text-[17px] font-bold leading-snug mt-1">البلاغات</h2>
                <p className="text-white/60 text-[12px] font-medium mt-1.5 leading-relaxed">
                  طلب الإسناد يجب أن يكون مرتبطاً ببلاغ <span className="text-amber-300 font-bold">قيد الانتظار</span> رفعته سابقاً على مركزك.
                </p>
              </div>
            </div>
          </div>

          {/* Reports list */}
          {loadingReports ? (
            <div className="bg-white rounded-[14px] py-14 text-center border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]">
              <div className="w-8 h-8 border-2 border-line border-t-primary rounded-full animate-spin mx-auto" />
              <p className="text-muted text-[13px] mt-3 font-medium">جارٍ التحميل...</p>
            </div>
          ) : pendingReports.length === 0 ? (
            <div className="rounded-[14px] border p-7 text-center"
              style={{ background: tint(WARN, 12), borderColor: tint(WARN, 28) }}>
              <span className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3.5 border"
                style={{ background: tint(WARN, 9), borderColor: tint(WARN, 22) }}>
                <AlertTriangle size={25} weight="duotone" style={{ color: WARN }} />
              </span>
              <p className="text-ink font-bold text-[15px] mb-1.5">لا توجد بلاغات قيد الانتظار</p>
              <p className="text-muted text-[12.5px] font-medium mb-5 leading-relaxed">
                لا يمكنك رفع طلب إسناد بدون بلاغ مرتبط.<br/>
                ارفع بلاغاً أولاً ثم ارجع لإنشاء طلب الإسناد.
              </p>
              <button onClick={() => navigate('/report')}
                className="inline-flex items-center gap-2 min-h-[44px] px-5 py-3 rounded-[11px] bg-primary border border-primary text-white font-bold text-[13px] hover:bg-primary-700 transition-colors">
                <AlertTriangle size={15} weight="bold" />
                رفع بلاغ جديد
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <span className="w-1 h-3.5 rounded-full bg-primary" />
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider">بلاغاتك قيد الانتظار</p>
                <Pill color={PRIMARY}>{pendingReports.length}</Pill>
              </div>
              {pendingReports.map(r => {
                const label = REPORT_TYPE_LABEL[r.reportType] || REPORT_TYPE_LABEL[r.type] || r.reportType || 'بلاغ';
                return (
                  <button key={r.id} onClick={() => setSelectedReport(r)}
                    className="group relative min-h-[72px] w-full text-start rounded-[14px] border p-4 flex items-center gap-3.5 overflow-hidden
                               shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow duration-200
                               hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)]"
                    style={{ background: tint(WARN, 12), borderColor: tint(WARN, 28) }}
                  >
                    <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: WARN }} />

                    <IconTile Icon={AlertTriangle} color={WARN} size="md" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <p className="text-[13.5px] font-bold text-ink leading-tight">{label}</p>
                        {r.reportNumber && (
                          <Pill color={PRIMARY} className="tabular-nums tracking-wide">{r.reportNumber}</Pill>
                        )}
                        <Pill color={WARN}>
                          <span className="w-1 h-1 rounded-full" style={{ background: WARN }} />
                          قيد الانتظار
                        </Pill>
                      </div>
                      <p className="text-[11.5px] font-medium text-muted truncate flex items-center gap-1.5">
                        <Clock size={11} weight="bold" className="text-muted/60 shrink-0" />
                        {fmtTime(r.timestamp)}
                      </p>
                    </div>

                    <ArrowLeft size={15} weight="bold" className="shrink-0 text-muted/40 group-hover:text-muted transition-colors" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-canvas pb-28 font-arabic px-0">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-line w-full px-4 md:px-8 py-3 mb-6">
        <div className="max-w-5xl mx-auto flex items-center gap-2">
          <button onClick={() => navigate('/home')} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-[rgb(var(--c-bg))] rounded-[10px] transition-colors shrink-0">
            <ChevronRight className="text-primary" size={22} weight="bold" />
          </button>
          <h1 className="flex-1 text-center text-[15px] font-bold text-ink truncate">طلب إسناد</h1>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      {/* Linked report banner */}
      <div className="max-w-5xl mx-auto px-4 pt-2">
        <div className="rounded-[14px] border p-3.5 flex items-center gap-3 shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]"
          style={{ background: tint(WARN, 12), borderColor: tint(WARN, 28) }}>
          <IconTile Icon={AlertTriangle} color={WARN} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: WARN }}>إسناد لبلاغ</p>
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <p className="text-[13.5px] font-bold text-ink leading-tight">
                {REPORT_TYPE_LABEL[selectedReport.reportType] || REPORT_TYPE_LABEL[selectedReport.type] || 'بلاغ'}
              </p>
              {selectedReport.reportNumber && (
                <Pill color={WARN} className="tabular-nums">{selectedReport.reportNumber}</Pill>
              )}
            </div>
          </div>
          <button onClick={() => setSelectedReport(null)}
            className="shrink-0 min-h-[40px] px-3.5 text-[11.5px] font-bold bg-white border rounded-[10px] hover:bg-[rgb(var(--c-bg))] transition-colors"
            style={{ color: WARN, borderColor: tint(WARN, 34) }}>
            تغيير
          </button>
        </div>
      </div>

      <div className="px-4">
        {/* Header Card with Observer Info */}
        <div className="rounded-[14px] p-5 my-6 text-white bg-ink">

          <div className="flex items-center gap-3.5 mb-6">
            <span className="w-11 h-11 rounded-[11px] flex items-center justify-center shrink-0 border border-white/10 bg-white/[0.06]">
              <Truck className="text-accent" size={21} weight="duotone" />
            </span>
            <div className="min-w-0">
              <p className="text-accent/80 text-[10px] font-bold uppercase tracking-[0.18em] truncate">منظومة الخدمات اللوجستية</p>
              <h2 className="text-[18px] font-bold mt-1">رفع طلب إسناد</h2>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 w-full">
            {/* مربع المراقب - الجديد */}
            <div className="bg-white/[0.06] rounded-[10px] px-3 py-2.5 flex-1 min-w-[100px] border border-white/10 text-center">
              <span className="text-white/45 text-[10px] block mb-1">المراقب</span>
              <span className="text-white font-bold text-[11px] truncate block w-full">
                {profile?.nameAr || profile?.name || '—'}
              </span>
            </div>

            {/* مربع المركز */}
            <div className="bg-white/[0.06] rounded-[10px] px-3 py-2.5 flex-1 min-w-[80px] border border-white/10 text-center">
              <span className="text-white/45 text-[10px] block mb-1">المركز</span>
              <span className="text-accent font-bold text-[13px] truncate block w-full">{profile?.center || '—'}</span>
            </div>

            {/* مربع المتعهد */}
            <div className="bg-white/[0.06] rounded-[10px] px-3 py-2.5 flex-1 min-w-[100px] border border-white/10 text-center">
              <span className="text-white/45 text-[10px] block mb-1">المتعهد</span>
              <span className="text-white font-bold text-[11px] truncate block w-full">
                {profile?.caterer || getCaterer(profile?.center) || '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[14px] p-5 sm:p-6 border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] space-y-7">
          <div>
            <label className="text-[11px] font-bold text-primary mb-3.5 block text-center uppercase tracking-[0.14em]">المشعر *</label>
            <div className="grid grid-cols-2 gap-3">
              {HOLY_SITES.map(s => {
                const active = holySite === s.key;
                const SIcon = s.Icon;
                return (
                  <button key={s.key} type="button"
                    onClick={() => setHolySite(s.key)}
                    className={`relative flex flex-col items-center gap-2 min-h-[84px] py-4 rounded-[11px] border transition-colors ${
                      active ? 'ring-2' : 'bg-[rgb(var(--c-bg))] text-muted border-line hover:bg-white'
                    }`}
                    style={active
                      ? { background: tint(s.color, 12), borderColor: tint(s.color, 28), color: s.color, '--tw-ring-color': s.color }
                      : undefined}
                  >
                    <SIcon size={22} weight={active ? 'duotone' : 'bold'} />
                    <span className="text-[13.5px] font-bold">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-line w-full" />

          <div>
            <label className="text-[11px] font-bold text-primary mb-3.5 block text-center uppercase tracking-[0.14em]">تصنيف الإسناد</label>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORY_TYPES.map(type => {
                const active = category === type.id;
                return (
                  <button key={type.id}
                    onClick={() => { setCategory(type.id); setSupportType(''); setQtyInternal(''); setQtyExternal(''); }}
                    className={`min-h-[104px] py-5 rounded-[11px] flex flex-col items-center gap-2.5 border transition-colors ${
                      active ? 'ring-2 ring-primary text-primary' : 'bg-[rgb(var(--c-bg))] border-line text-muted hover:bg-white'
                    }`}
                    style={active ? { background: tint(PRIMARY, 12), borderColor: tint(PRIMARY, 28) } : undefined}>
                    <type.icon size={28} weight={active ? 'duotone' : 'regular'} className={active ? 'text-primary' : 'text-muted/50'} />
                    <span className="font-bold text-[13.5px]">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {category && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-7">
              <div className="h-px bg-line w-full" />
              <div>
                <label className="text-[11px] font-bold text-primary mb-3.5 block text-center tracking-[0.14em]">نطاق الإسناد</label>
                <div className="grid grid-cols-3 gap-3">
                  {SUPPORT_TYPES.map(type => {
                    const active = supportType === type.value;
                    return (
                      <button key={type.value}
                        onClick={() => { setSupportType(type.value); setQtyInternal(''); setQtyExternal(''); }}
                        className={`min-h-[48px] py-4 rounded-[11px] text-[12px] font-bold border transition-colors ${
                          active ? 'ring-2 ring-primary text-primary' : 'bg-[rgb(var(--c-bg))] text-muted border-line hover:bg-white'
                        }`}
                        style={active ? { background: tint(PRIMARY, 12), borderColor: tint(PRIMARY, 28) } : undefined}>
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {showInternal && (
                  <div className="animate-in zoom-in-95 duration-300">
                    <label className="flex items-center gap-2 text-[12px] font-bold text-ink mb-2 px-1">
                      <Package size={14} weight="bold" className="text-primary" />
                      {category === 'water' ? 'عدد العبوات (داخلي)' : 'عدد الوجبات (داخلي)'}
                    </label>
                    <input type="text" inputMode="numeric" value={qtyInternal}
                      onChange={e => setQtyInternal(sanitizeNumber(e.target.value))} placeholder="0"
                      className="w-full min-h-[52px] px-4 py-4 bg-[rgb(var(--c-bg))] border border-line rounded-[11px] outline-none focus:border-primary focus:bg-white transition-colors font-bold text-[17px] tabular-nums text-ink" />
                  </div>
                )}
                {showExternal && (
                  <div className="animate-in zoom-in-95 duration-300">
                    <label className="flex items-center gap-2 text-[12px] font-bold text-ink mb-2 px-1">
                      <Package size={14} weight="bold" className="text-primary" />
                      {category === 'water' ? 'عدد العبوات (خارجي)' : 'عدد الوجبات (خارجي)'}
                    </label>
                    <input type="text" inputMode="numeric" value={qtyExternal}
                      onChange={e => setQtyExternal(sanitizeNumber(e.target.value))} placeholder="0"
                      className="w-full min-h-[52px] px-4 py-4 bg-[rgb(var(--c-bg))] border border-line rounded-[11px] outline-none focus:border-primary focus:bg-white transition-colors font-bold text-[17px] tabular-nums text-ink" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 p-4 bg-white/95 backdrop-blur-lg border-t border-line z-50 text-center">
        <button onClick={handleSubmit} disabled={!isFormValid || loading}
          className={`w-full max-w-md mx-auto min-h-[56px] py-4 rounded-[14px] font-bold text-[15px] border flex items-center justify-center gap-2.5 transition-colors ${!isFormValid || loading ? 'bg-[rgb(var(--c-bg))] border-line text-muted cursor-not-allowed' : 'bg-primary border-primary text-white hover:bg-primary-700'}`}>
          {loading ? 'جاري الإرسال...' : <><Send size={19} weight="bold" /> <span>إرسال طلب الإسناد</span></>}
        </button>
        {!isFormValid && category && supportType && (
          <p className="text-[10.5px] text-error mt-2 font-bold tracking-wide">يجب إدخال كمية (1) أو أكثر لإتمام الطلب</p>
        )}
      </div>
    </div>
  );
}