import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronRight, Send, Truck, Package, Utensils, Droplets, User, Sparkles,
  AlertTriangle, ArrowLeft, FileText, Clock, MapPin, Mountain,
} from 'lucide-react';
import { supabase } from '../../config/supabase.js';
import { db, serverTimestamp, rowFromDb } from '../../lib/db.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getCaterer } from '../../config/centers.js';
import { initialStatusFields } from '../../lib/statusTracking.js';

const CATEGORY_TYPES = [{ id: 'meals', label: 'إسناد وجبات', icon: Utensils }, { id: 'water', label: 'إسناد مياه', icon: Droplets }];
const SUPPORT_TYPES = [{ value: 'internal', label: 'داخلي' }, { value: 'external', label: 'خارجي' }, { value: 'both', label: 'داخلي وخارجي' }];
const HOLY_SITES = [
  { key: 'mina',   label: 'منى',   Icon: MapPin,   color: '#A98159' },
  { key: 'arafat', label: 'عرفات', Icon: Mountain, color: '#0E7C66' },
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
      <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-10 font-arabic">
        <header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] w-full px-4 md:px-8 py-3 mb-4 shadow-sm">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <button onClick={() => navigate('/supervisor-home')} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 rounded-xl transition shrink-0">
              <ChevronRight className="text-[#A98159]" size={22} strokeWidth={2.5} />
            </button>
            <h1 className="text-base font-bold text-[#2D2926] absolute left-1/2 -translate-x-1/2 whitespace-nowrap">طلب إسناد</h1>
            <div className="w-10 shrink-0" />
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 space-y-4">
          <div className="bg-gradient-to-br from-[#3D3330] via-[#2D2926] to-[#1F1A17] rounded-3xl p-5 sm:p-6 shadow-lg overflow-hidden relative">
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10"
              style={{ background: 'radial-gradient(circle, #A98159 0%, transparent 70%)', transform: 'translate(30%, -40%)' }} />
            <div className="flex items-start gap-3 relative">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl blur-xl bg-[#A98159] opacity-50" />
                <div className="relative bg-gradient-to-br from-[#C4A46E] to-[#A98159] p-3 rounded-2xl shadow-md">
                  <FileText size={22} className="text-white" strokeWidth={2.25} />
                </div>
              </div>
              <div>
                <p className="text-[#A98159] text-[10px] font-black uppercase tracking-widest mb-1">الخطوة الأولى</p>
                <h2 className="text-white text-lg font-bold leading-snug">اختر البلاغ الذي تطلب الإسناد له</h2>
                <p className="text-white/60 text-xs mt-1.5 leading-relaxed">
                  بلاغات <span className="font-bold text-[#A98159]">{selectedCenter}</span> <span className="text-amber-300 font-bold">قيد الانتظار</span> فقط.
                </p>
              </div>
            </div>
          </div>

          {loadingReports ? (
            <div className="bg-white rounded-2xl py-14 text-center border border-[#EDE5DC]">
              <div className="w-8 h-8 border-2 border-[#EDE5DC] border-t-[#A98159] rounded-full animate-spin mx-auto" />
              <p className="text-[#9D8F85] text-sm mt-3 font-medium">جارٍ التحميل...</p>
            </div>
          ) : pendingReports.length === 0 ? (
            <div className="bg-gradient-to-br from-white to-amber-50/40 rounded-2xl border-2 border-amber-200 p-7 text-center">
              <div className="relative w-fit mx-auto mb-3">
                <div className="absolute inset-0 rounded-2xl blur-xl bg-amber-400 opacity-30" />
                <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)' }}>
                  <AlertTriangle size={26} className="text-amber-600" strokeWidth={2} />
                </div>
              </div>
              <p className="text-[#2D2926] font-bold text-base mb-1">لا توجد بلاغات قيد الانتظار</p>
              <p className="text-[#6D6E71] text-sm mb-5 leading-relaxed">
                لا يمكن رفع طلب إسناد بدون بلاغ مرتبط.<br/>
                ارفع بلاغاً أولاً من قسم البلاغات على هذا المركز.
              </p>
              <button onClick={() => navigate('/sup-report', { state: { centerId: selectedCenter } })}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white font-bold text-sm shadow-md active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #C4A46E, #A98159)' }}>
                <AlertTriangle size={15} />
                رفع بلاغ جديد
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <span className="w-1.5 h-4 rounded-full bg-[#A98159]" />
                <p className="text-xs font-black text-[#A98159] uppercase tracking-wider">بلاغات قيد الانتظار</p>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#A98159]/10 text-[#A98159] border border-[#A98159]/20 tabular-nums">
                  {pendingReports.length}
                </span>
              </div>
              {pendingReports.map(r => {
                const label = REPORT_TYPE_LABEL[r.reportType] || REPORT_TYPE_LABEL[r.type] || r.reportType || 'بلاغ';
                return (
                  <button key={r.id} onClick={() => setSelectedReport(r)}
                    className="group/rep min-h-[72px] w-full text-right bg-gradient-to-br from-white via-white to-[#FDF8F0]/40 border-2 border-[#EDE5DC] hover:border-[#A98159]/50 active:bg-[#FDF8F0] rounded-2xl p-4 flex items-center gap-3 transition-all duration-300 hover:shadow-[0_6px_20px_rgba(169,129,89,0.15)] hover:-translate-y-0.5 overflow-hidden relative"
                  >
                    <div className="absolute top-0 bottom-0 right-0 w-1 bg-amber-500" />
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-0 rounded-xl blur-md bg-amber-400 opacity-0 group-hover/rep:opacity-50 transition-opacity" />
                      <div className="relative w-11 h-11 rounded-xl flex items-center justify-center border-2 group-hover/rep:scale-110 group-hover/rep:rotate-3 transition-transform duration-300"
                        style={{ background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', borderColor: '#FCD34D' }}>
                        <AlertTriangle size={18} className="text-amber-600" strokeWidth={2} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <p className="text-sm font-bold text-[#2D2926] leading-tight">{label}</p>
                        {r.reportNumber && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md tabular-nums tracking-wide bg-[#FDF8F0] border border-[#A98159]/30 text-[#A98159]">
                            {r.reportNumber}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                          <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                          قيد الانتظار
                        </span>
                      </div>
                      <p className="text-[11px] text-[#9D8F85] truncate flex items-center gap-1">
                        <Clock size={10} />
                        {fmtTime(r.timestamp)} · بواسطة: {r.observer || '—'}
                      </p>
                    </div>
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#FDF8F0] group-hover/rep:bg-[#A98159] flex items-center justify-center group-hover/rep:-translate-x-1 transition-all duration-300">
                      <ArrowLeft size={16} className="text-[#A98159] group-hover/rep:text-white transition-colors" strokeWidth={2.5} />
                    </div>
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
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-28 font-arabic px-0">
      <header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] w-full px-4 md:px-8 py-3 mb-6 shadow-sm"><div className="max-w-5xl mx-auto flex items-center justify-between"><button onClick={() => navigate('/supervisor-home')} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 rounded-xl transition shrink-0 border border-transparent active:border-[#A98159]/20"><ChevronRight className="text-[#A98159]" size={22} strokeWidth={2.5} /></button><h1 className="text-base font-bold text-[#2D2926] absolute left-1/2 -translate-x-1/2 whitespace-nowrap">طلب إسناد</h1><div className="w-10 shrink-0" /></div></header>

      {/* Linked report banner */}
      <div className="max-w-5xl mx-auto px-4 pt-2">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 border-2 border-amber-200/70 rounded-2xl p-3.5 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)' }}>
            <AlertTriangle size={16} className="text-amber-600" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">إسناد لبلاغ</p>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <p className="text-sm font-bold text-[#2D2926] leading-tight">
                {REPORT_TYPE_LABEL[selectedReport.reportType] || REPORT_TYPE_LABEL[selectedReport.type] || 'بلاغ'}
              </p>
              {selectedReport.reportNumber && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md tabular-nums bg-white border border-amber-300 text-amber-700">
                  {selectedReport.reportNumber}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => setSelectedReport(null)}
            className="flex-shrink-0 text-[11px] font-bold text-amber-700 hover:text-white hover:bg-amber-600 border border-amber-300 hover:border-amber-600 px-3 py-1.5 rounded-lg transition-all active:scale-95">
            تغيير
          </button>
        </div>
      </div>

      <div className="px-4"><div className="rounded-[2.5rem] p-6 my-6 text-white shadow-lg relative overflow-hidden" style={{ background: '#2D2926' }}><Truck className="absolute -left-4 -bottom-4 text-white/5 w-32 h-32 rotate-12" /><div className="flex justify-between items-center mb-8 relative z-10 group"><div className="flex items-center gap-4"><div className="relative"><div className="absolute inset-0 rounded-2xl blur-xl bg-[#A98159] opacity-50 group-hover:opacity-80 transition-opacity" /><div className="relative bg-gradient-to-br from-[#C4A46E] to-[#A98159] p-3 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300"><Truck className="text-white" size={24} /><Sparkles size={10} className="absolute -top-0.5 -right-0.5 text-yellow-200 drop-shadow" /></div></div><div><p className="text-[#A98159] text-[10px] font-black uppercase tracking-widest">منظومة الخدمات اللوجستية</p><h2 className="text-xl font-bold">رفع طلب إسناد</h2></div></div></div><div className="flex flex-wrap justify-center gap-2 relative z-10 w-full"><div className="bg-white/5 rounded-2xl px-3 py-3 flex-1 min-w-[100px] border border-white/10 backdrop-blur-sm flex flex-col items-center"><span className="text-white/40 text-[10px] block mb-1">المشرف</span><span className="text-white font-bold text-[11px] truncate w-full text-center">{profile?.nameAr || '—'}</span></div><div className="bg-white/5 rounded-2xl px-3 py-3 flex-1 min-w-[80px] border border-white/10 backdrop-blur-sm flex flex-col items-center"><span className="text-white/40 text-[10px] block mb-1">المركز</span><span className="text-[#A98159] font-bold text-sm">{selectedCenter}</span></div><div className="bg-white/5 rounded-2xl px-3 py-3 flex-1 min-w-[100px] border border-white/10 backdrop-blur-sm flex flex-col items-center"><span className="text-white/40 text-[10px] block mb-1">المتعهد</span><span className="text-white font-bold text-[11px] truncate w-full text-center">{getCaterer(selectedCenter) || '—'}</span></div></div></div><div className="bg-white rounded-[2rem] p-6 border border-[#D1C4B9] shadow-sm space-y-8"><div><label className="text-xs font-bold text-[#A98159] mb-4 block text-center uppercase tracking-wide">المشعر *</label><div className="grid grid-cols-2 gap-3">{HOLY_SITES.map(s => { const active = holySite === s.key; const SIcon = s.Icon; return (<button key={s.key} type="button" onClick={() => setHolySite(s.key)} className={`relative flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 transition-all ${active ? 'text-white scale-[1.02] shadow-md' : 'bg-[#F9F7F5] text-[#6D6E71] border-[#E5DDD5] hover:border-[#A98159]/40'}`} style={active ? { background: `linear-gradient(135deg, ${s.color}, ${s.color}CC)`, borderColor: s.color } : undefined}><SIcon size={22} strokeWidth={2.25} /><span className="text-sm font-bold">{s.label}</span></button>); })}</div></div><div className="h-px bg-[#E5DDD5] w-full" /><div><label className="text-xs font-bold text-[#A98159] mb-4 block text-center uppercase tracking-wide">تصنيف الإسناد</label><div className="grid grid-cols-2 gap-4">{CATEGORY_TYPES.map(type => (<button key={type.id} onClick={() => { setCategory(type.id); setSupportType(''); setQtyInternal(''); setQtyExternal(''); }} className={`py-6 rounded-3xl flex flex-col items-center gap-3 transition-all duration-300 border-2 ${category === type.id ? 'border-[#A98159] bg-[#A98159]/5 text-[#2D2926]' : 'border-transparent bg-[#F9F7F5] text-[#6D6E71]'}`}><type.icon size={32} className={category === type.id ? 'text-[#A98159]' : 'text-[#D1C4B9]'} /><span className="font-bold text-sm">{type.label}</span></button>))}</div></div>{category && (<div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-8"><div className="h-px bg-[#E5DDD5] w-full" /><div><label className="text-xs font-bold text-[#A98159] mb-4 block text-center tracking-wider">نطاق الإسناد</label><div className="grid grid-cols-3 gap-3">{SUPPORT_TYPES.map(type => (<button key={type.value} onClick={() => { setSupportType(type.value); setQtyInternal(''); setQtyExternal(''); }} className={`py-4 rounded-2xl text-[11px] font-bold transition-all ${supportType === type.value ? 'bg-[#2D2926] text-white shadow-lg' : 'bg-[#F9F7F5] text-[#6D6E71] border border-[#E5DDD5]'}`}>{type.label}</button>))}</div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6">{showInternal && (<div className="animate-in zoom-in-95 duration-300"><label className="flex items-center gap-2 text-xs font-bold text-[#2D2926] mb-2 px-1"><Package size={14} className="text-[#A98159]" /> {category === 'water' ? 'عدد العبوات (داخلي)' : 'عدد الوجبات (داخلي)'}</label><input type="text" inputMode="numeric" value={qtyInternal} onChange={e => setQtyInternal(sanitizeNumber(e.target.value))} placeholder="0" className="w-full px-5 py-4 bg-[#FDFCFB] border-2 border-[#E5DDD5] rounded-2xl outline-none focus:border-[#A98159] font-bold text-lg" /></div>)}{showExternal && (<div className="animate-in zoom-in-95 duration-300"><label className="flex items-center gap-2 text-xs font-bold text-[#2D2926] mb-2 px-1"><Package size={14} className="text-[#A98159]" /> {category === 'water' ? 'عدد العبوات (خارجي)' : 'عدد الوجبات (خارجي)'}</label><input type="text" inputMode="numeric" value={qtyExternal} onChange={e => setQtyExternal(sanitizeNumber(e.target.value))} placeholder="0" className="w-full px-5 py-4 bg-[#FDFCFB] border-2 border-[#E5DDD5] rounded-2xl outline-none focus:border-[#A98159] font-bold text-lg" /></div>)}</div><textarea placeholder="أضف ملاحظاتك..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-4 py-4 border border-[#D1C4B9] rounded-2xl outline-none text-sm resize-none" /></div>)}</div></div>
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-lg border-t border-[#D1C4B9] z-50 text-center"><button onClick={handleSubmit} disabled={!isFormValid || loading} className={`w-full max-w-md mx-auto py-4 rounded-2xl font-bold text-lg shadow-xl flex items-center justify-center gap-3 transition-all duration-300 ${!isFormValid || loading ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-70 shadow-none' : 'bg-[#1A73E8] text-white hover:bg-[#1557B0] active:scale-95'}`}>{loading ? 'جاري الإرسال...' : <><Send size={20} /> <span>إرسال طلب الإسناد</span></>}</button></div>
    </div>
  );
}