import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CaretRight as ChevronRight,
  PaperPlaneTilt as Send,
  Truck,
  Package,
  ForkKnife as Utensils,
  Drop as Droplets,
  User,
  Warning as AlertTriangle,
  ArrowLeft,
  FileText,
  Clock,
  MapPin,
  Mountains as Mountain,
} from '@phosphor-icons/react';
import { supabase } from '../../config/supabase.js';
import { db, serverTimestamp, rowFromDb } from '../../lib/db.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getCaterer } from '../../config/centers.js';
import { initialStatusFields } from '../../lib/statusTracking.js';
import { Surface } from '../../components/ui/index.jsx';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

/* Two colours carry this screen: the report you are attaching to, and the
   logistics request you are raising against it. */
const REPORT_C = '#D97706';
const LOGI_C   = 'rgb(var(--c-info))';

const CATEGORY_TYPES = [{ id: 'meals', label: 'إسناد وجبات', icon: Utensils }, { id: 'water', label: 'إسناد مياه', icon: Droplets }];
const SUPPORT_TYPES = [{ value: 'internal', label: 'داخلي' }, { value: 'external', label: 'خارجي' }, { value: 'both', label: 'داخلي وخارجي' }];
const HOLY_SITES = [
  { key: 'mina',   label: 'منى',   Icon: MapPin,   color: 'rgb(var(--c-primary))' },
  { key: 'arafat', label: 'عرفات', Icon: Mountain, color: '#5E9070' },
];

const REPORT_TYPE_LABEL = {
  water: 'تسرب مياه', electric: 'عطل كهربائي', crowd: 'ازدحام حرج', food: 'مشكلة غذائية',
  medical: 'حالة طبية طارئة', security: 'بلاغ أمني', fire: 'حريق / دخان', other: 'بلاغ آخر',
  shortage: 'نقص في الكميات', delay: 'تأخر في التوزيع', quality: 'مشكلة في الجودة', hygiene: 'مخالفة صحية',
};
const fmtTime = (ts) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('ar', { dateStyle: 'short', timeStyle: 'short' });
  } catch { return '—'; }
};

export default function SupLogisticsRequest() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { profile } = useAuth();

  /* Step 0 — report picker */
  const [pendingReports, setPendingReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);

  const [holySite, setHolySite] = useState('');
  const [category, setCategory] = useState('');
  const [supportType, setSupportType] = useState('');
  const [qtyInternal, setQtyInternal] = useState('');
  const [qtyExternal, setQtyExternal] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);

  const selectedCenter = state?.centerId || '—';

  /* Subscribe to pending reports for this center */
  useEffect(() => {
    if (!selectedCenter || selectedCenter === '—') { setLoadingReports(false); return; }
    let mounted = true;
    const load = async () => {
      const { data } = await supabase.from('reports').select('*')
        .eq('center', selectedCenter)
        .eq('status', 'pending')
        .order('timestamp', { ascending: false });
      if (mounted) {
        setPendingReports((data || []).map(rowFromDb));
        setLoadingReports(false);
      }
    };
    load();
    const ch = supabase.channel(`pending-reports-sup-${selectedCenter}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [selectedCenter]);
  const showInternal = supportType === 'internal' || supportType === 'both';
  const showExternal = supportType === 'external' || supportType === 'both';

  const sanitizeNumber = (value) => {
    const arabicNumbers = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
    let sanitized = value;
    for (let i = 0; i < 10; i++) { sanitized = sanitized.replace(arabicNumbers[i], i); }
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
      await db.logistics_requests.insert({
        uid: profile?.uid,
        observer: profile?.nameAr || profile?.name || '—',
        center: selectedCenter,
        caterer: getCaterer(selectedCenter) || '—',
        holySite,
        category,
        supportType,
        qtyInternal: showInternal ? parseInt(qtyInternal) : null,
        qtyExternal: showExternal ? parseInt(qtyExternal) : null,
        notes,
        role: 'supervisor',
        reportId:     selectedReport?.id           || null,
        reportNumber: selectedReport?.reportNumber || null,
        reportType:   selectedReport?.reportType   || selectedReport?.type || null,
        timestamp: serverTimestamp(),
        ...initialStatusFields('pending'),
      });
      alert('تم إرسال طلب الإسناد بنجاح');
      navigate('/supervisor-home');
    } catch (e) {
      console.error('[SupLogistics submit]', e);
      alert(`خطأ في الإرسال: ${e?.message || e}`);
    }
    setLoading(false);
  };

  /* Step 0 — report picker */
  if (!selectedReport) {
    return (
      <div dir="rtl" className="min-h-screen bg-canvas pb-10 font-arabic">
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-line w-full px-4 md:px-8 py-3 mb-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <button onClick={() => navigate('/supervisor-home')} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-[rgb(var(--c-bg))] rounded-[10px] transition-colors shrink-0">
              <ChevronRight className="text-primary" size={20} weight="bold" />
            </button>
            <h1 className="text-[15px] font-bold text-ink absolute left-1/2 -translate-x-1/2 whitespace-nowrap">طلب إسناد</h1>
            <div className="w-10 shrink-0" />
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 space-y-4">
          <div
            className="rounded-[14px] border p-4 sm:p-5 flex items-start gap-3.5 shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]"
            style={{ background: tint(REPORT_C, 12), borderColor: tint(REPORT_C, 28) }}
          >
            <span
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
              style={{ background: tint(REPORT_C, 9), borderColor: tint(REPORT_C, 22) }}
            >
              <FileText size={21} weight="duotone" style={{ color: REPORT_C }} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] leading-none" style={{ color: REPORT_C }}>
                الخطوة الأولى
              </p>
              <h2 className="text-[18px] font-extrabold text-ink mt-1.5 leading-tight">البلاغات</h2>
              <p className="text-[12px] font-medium text-muted mt-1.5 leading-relaxed">
                بلاغات <span className="font-bold text-ink">{selectedCenter}</span> <span className="font-bold" style={{ color: REPORT_C }}>قيد الانتظار</span> فقط.
              </p>
            </div>
          </div>

          {loadingReports ? (
            <Surface className="py-14 text-center">
              <div className="w-8 h-8 border-2 border-line border-t-primary rounded-full animate-spin mx-auto" />
              <p className="text-[13px] text-muted mt-3 font-semibold">جارٍ التحميل...</p>
            </Surface>
          ) : pendingReports.length === 0 ? (
            <div
              className="rounded-[14px] border p-7 text-center"
              style={{ background: tint(REPORT_C, 12), borderColor: tint(REPORT_C, 28) }}
            >
              <span
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto border"
                style={{ background: tint(REPORT_C, 9), borderColor: tint(REPORT_C, 22) }}
              >
                <AlertTriangle size={22} weight="duotone" style={{ color: REPORT_C }} />
              </span>
              <p className="text-ink font-bold text-[15px] mt-3.5 mb-1">لا توجد بلاغات قيد الانتظار</p>
              <p className="text-muted text-[12.5px] font-medium mb-5 leading-relaxed">
                لا يمكن رفع طلب إسناد بدون بلاغ مرتبط.<br/>
                ارفع بلاغاً أولاً من قسم البلاغات على هذا المركز.
              </p>
              <button onClick={() => navigate('/sup-report', { state: { centerId: selectedCenter } })}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[11px] bg-primary border border-primary text-white text-[12px] font-bold transition-colors hover:bg-[rgb(var(--c-primary-700))]">
                <AlertTriangle size={14} weight="bold" />
                رفع بلاغ جديد
              </button>
            </div>
          ) : (
            <Surface className="overflow-hidden">
              <div
                className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b"
                style={{ background: tint(REPORT_C, 12), borderColor: tint(REPORT_C, 28) }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border"
                    style={{ background: tint(REPORT_C, 9), borderColor: tint(REPORT_C, 22) }}
                  >
                    <AlertTriangle size={18} weight="duotone" style={{ color: REPORT_C }} />
                  </span>
                  <p className="text-[14px] font-bold truncate leading-tight" style={{ color: REPORT_C }}>
                    بلاغات قيد الانتظار
                  </p>
                </div>
                <span
                  className="text-[10.5px] font-bold px-1.5 py-[3px] rounded-md tabular-nums leading-none shrink-0"
                  style={{ background: tint(REPORT_C, 11), color: REPORT_C }}
                >
                  {pendingReports.length}
                </span>
              </div>

              {pendingReports.map((r, i) => {
                const label = REPORT_TYPE_LABEL[r.reportType] || REPORT_TYPE_LABEL[r.type] || r.reportType || 'بلاغ';
                return (
                  <button key={r.id} onClick={() => setSelectedReport(r)}
                    className={`group/rep relative min-h-[68px] w-full text-start flex items-center gap-3.5 ps-5 pe-4 py-3.5 transition-colors hover:bg-[rgb(var(--c-bg))] ${
                      i === pendingReports.length - 1 ? '' : 'border-b border-line'
                    }`}
                  >
                    <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: REPORT_C }} />
                    <span
                      className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border"
                      style={{ background: tint(REPORT_C, 9), borderColor: tint(REPORT_C, 22) }}
                    >
                      <AlertTriangle size={18} weight="duotone" style={{ color: REPORT_C }} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13.5px] font-bold text-ink leading-tight">{label}</span>
                        {r.reportNumber && (
                          <span className="text-[10.5px] font-bold px-1.5 py-[3px] rounded-md tabular-nums leading-none bg-[rgb(var(--c-primary)/0.08)] text-primary">
                            {r.reportNumber}
                          </span>
                        )}
                        <span
                          className="text-[10.5px] font-bold px-1.5 py-[3px] rounded-md leading-none"
                          style={{ background: tint(REPORT_C, 11), color: REPORT_C }}
                        >
                          قيد الانتظار
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 text-[11.5px] text-muted mt-1.5 truncate">
                        <Clock size={12} weight="bold" className="text-muted/60 shrink-0" />
                        <span className="font-medium text-ink/75 truncate">{fmtTime(r.timestamp)} · بواسطة: {r.observer || '—'}</span>
                      </span>
                    </span>
                    <ArrowLeft size={15} weight="bold" className="shrink-0 text-muted/40 group-hover/rep:text-muted transition-colors" />
                  </button>
                );
              })}
            </Surface>
          )}
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-canvas pb-28 font-arabic px-0">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-line w-full px-4 md:px-8 py-3 mb-6 shadow-sm"><div className="max-w-5xl mx-auto flex items-center justify-between"><button onClick={() => navigate('/supervisor-home')} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 rounded-xl transition shrink-0 border border-transparent active:border-primary/20"><ChevronRight className="text-primary" size={22} weight="bold" /></button><h1 className="text-base font-bold text-ink absolute left-1/2 -translate-x-1/2 whitespace-nowrap">طلب إسناد</h1><div className="w-10 shrink-0" /></div></header>

      {/* Linked report banner */}
      <div className="max-w-5xl mx-auto px-4 pt-2">
        <div
          className="rounded-[14px] border p-3.5 flex items-center gap-3"
          style={{ background: tint(REPORT_C, 12), borderColor: tint(REPORT_C, 28) }}
        >
          <span
            className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border"
            style={{ background: tint(REPORT_C, 9), borderColor: tint(REPORT_C, 22) }}
          >
            <AlertTriangle size={18} weight="duotone" style={{ color: REPORT_C }} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] leading-none" style={{ color: REPORT_C }}>
              إسناد لبلاغ
            </p>
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              <p className="text-[13.5px] font-bold text-ink leading-tight">
                {REPORT_TYPE_LABEL[selectedReport.reportType] || REPORT_TYPE_LABEL[selectedReport.type] || 'بلاغ'}
              </p>
              {selectedReport.reportNumber && (
                <span
                  className="text-[10.5px] font-bold px-1.5 py-[3px] rounded-md tabular-nums leading-none"
                  style={{ background: tint(REPORT_C, 11), color: REPORT_C }}
                >
                  {selectedReport.reportNumber}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => setSelectedReport(null)}
            className="shrink-0 text-[12px] font-bold text-ink bg-white hover:bg-[rgb(var(--c-bg))] border border-line px-3 py-1.5 rounded-[10px] transition-colors">
            تغيير
          </button>
        </div>
      </div>

      <div className="px-4">
        <div className="rounded-[14px] border p-5 my-6 shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]"
          style={{ background: tint(LOGI_C, 12), borderColor: tint(LOGI_C, 28) }}>
          <div className="flex items-center gap-3.5 mb-5">
            <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
              style={{ background: tint(LOGI_C, 9), borderColor: tint(LOGI_C, 22) }}>
              <Truck size={21} weight="duotone" style={{ color: LOGI_C }} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] leading-none" style={{ color: LOGI_C }}>منظومة الخدمات اللوجستية</p>
              <h2 className="text-[19px] font-extrabold text-ink mt-1.5 leading-tight">رفع طلب إسناد</h2>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { lbl: 'المشرف',  val: profile?.nameAr || '—' },
              { lbl: 'المركز',  val: selectedCenter },
              { lbl: 'المتعهد', val: getCaterer(selectedCenter) || '—' },
            ].map(c => (
              <div key={c.lbl} className="bg-white rounded-[11px] px-2.5 py-2.5 border text-center min-w-0"
                style={{ borderColor: tint(LOGI_C, 22) }}>
                <p className="text-[10px] font-semibold text-muted mb-1 truncate">{c.lbl}</p>
                <p className="text-[12px] font-bold text-ink truncate" title={c.val || ''}>{c.val || '—'}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-[14px] p-5 sm:p-6 border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] space-y-7">
          <div>
            <label className="text-[11px] font-bold text-muted mb-3 block text-center uppercase tracking-[0.18em]">المشعر *</label>
            <div className="grid grid-cols-2 gap-3">
              {HOLY_SITES.map(s => {
                const active = holySite === s.key;
                const SIcon = s.Icon;
                return (
                  <button key={s.key} type="button" onClick={() => setHolySite(s.key)}
                    className="flex flex-col items-center gap-2 py-4 rounded-[11px] border transition-colors"
                    style={active
                      ? { background: tint(s.color, 12), borderColor: s.color, color: s.color }
                      : { background: 'rgb(var(--c-bg))', borderColor: 'rgb(var(--c-line))', color: 'rgb(var(--c-muted))' }}>
                    <SIcon size={20} weight="duotone" />
                    <span className="text-[13px] font-bold">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-line w-full" />

          <div>
            <label className="text-[11px] font-bold text-muted mb-3 block text-center uppercase tracking-[0.18em]">تصنيف الإسناد</label>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORY_TYPES.map(type => {
                const active = category === type.id;
                return (
                  <button key={type.id} onClick={() => { setCategory(type.id); setSupportType(''); setQtyInternal(''); setQtyExternal(''); }}
                    className="py-5 rounded-[11px] flex flex-col items-center gap-2.5 border transition-colors"
                    style={active
                      ? { background: tint(LOGI_C, 12), borderColor: LOGI_C, color: LOGI_C }
                      : { background: 'rgb(var(--c-bg))', borderColor: 'rgb(var(--c-line))', color: 'rgb(var(--c-muted))' }}>
                    <type.icon size={26} weight="duotone" />
                    <span className="text-[13px] font-bold">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {category && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-7">
              <div className="h-px bg-line w-full" />

              <div>
                <label className="text-[11px] font-bold text-muted mb-3 block text-center uppercase tracking-[0.18em]">نطاق الإسناد</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {SUPPORT_TYPES.map(type => {
                    const active = supportType === type.value;
                    return (
                      <button key={type.value} onClick={() => { setSupportType(type.value); setQtyInternal(''); setQtyExternal(''); }}
                        className={`py-3.5 rounded-[11px] text-[12px] font-bold border transition-colors ${
                          active
                            ? 'bg-primary border-primary text-white'
                            : 'bg-[rgb(var(--c-bg))] border-line text-muted hover:text-ink'
                        }`}>
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
                      <Package size={14} weight="duotone" style={{ color: LOGI_C }} /> {category === 'water' ? 'عدد العبوات (داخلي)' : 'عدد الوجبات (داخلي)'}
                    </label>
                    <input type="text" inputMode="numeric" value={qtyInternal} onChange={e => setQtyInternal(sanitizeNumber(e.target.value))} placeholder="0"
                      className="w-full px-4 py-3.5 bg-[rgb(var(--c-bg))] border border-line rounded-[11px] outline-none focus:border-primary font-bold text-[16px] tabular-nums text-ink transition-colors" />
                  </div>
                )}
                {showExternal && (
                  <div className="animate-in zoom-in-95 duration-300">
                    <label className="flex items-center gap-2 text-[12px] font-bold text-ink mb-2 px-1">
                      <Package size={14} weight="duotone" style={{ color: LOGI_C }} /> {category === 'water' ? 'عدد العبوات (خارجي)' : 'عدد الوجبات (خارجي)'}
                    </label>
                    <input type="text" inputMode="numeric" value={qtyExternal} onChange={e => setQtyExternal(sanitizeNumber(e.target.value))} placeholder="0"
                      className="w-full px-4 py-3.5 bg-[rgb(var(--c-bg))] border border-line rounded-[11px] outline-none focus:border-primary font-bold text-[16px] tabular-nums text-ink transition-colors" />
                  </div>
                )}
              </div>

              <textarea placeholder="أضف ملاحظاتك..." value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full px-4 py-3.5 bg-[rgb(var(--c-bg))] border border-line rounded-[11px] outline-none focus:border-primary text-[13px] font-medium text-ink resize-none transition-colors" />
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-line z-50 text-center">
        <button onClick={handleSubmit} disabled={!isFormValid || loading}
          className={`w-full max-w-md mx-auto py-3.5 rounded-[12px] font-bold text-[15px] flex items-center justify-center gap-2.5 border transition-colors ${
            !isFormValid || loading
              ? 'bg-[rgb(var(--c-bg))] border-line text-muted/60 cursor-not-allowed'
              : 'bg-primary border-primary text-white hover:bg-[rgb(var(--c-primary-700))]'
          }`}>
          {loading ? 'جاري الإرسال...' : <><Send size={18} weight="bold" /> <span>إرسال طلب الإسناد</span></>}
        </button>
      </div>
    </div>
  );
}