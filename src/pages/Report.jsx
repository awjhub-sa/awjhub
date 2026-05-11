import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, AlertTriangle, Zap, Image as ImageIcon, Video, Upload, X, CheckCircle2 } from 'lucide-react';
import { db } from '../config/db.js';
import { collection, addDoc, serverTimestamp, runTransaction, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext.jsx';
import { getCaterer } from '../config/centers.js';

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

const SEVERITY_MAP = {
  high: { label: 'عالي الخطورة', color: 'bg-[#BA1A1A]', text: 'text-[#BA1A1A]', border: 'border-[#BA1A1A]', light: 'bg-red-50' },
  medium: { label: 'متوسط الخطورة', color: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500', light: 'bg-orange-50' },
  low: { label: 'منخفض الخطورة', color: 'bg-green-600', text: 'text-green-600', border: 'border-green-600', light: 'bg-green-50' },
};

export default function Report() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

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
    if (!selectedReport || !description || !imageFile || !videoFile) {
      alert('الرجاء إكمال كافة المتطلبات (النوع، الوصف، الصورة، والفيديو)');
      return;
    }
    setLoading(true);
    try {
      const counterRef = doc(db, 'counters', 'reports');
      const nextNum = await runTransaction(db, async (tx) => {
        const snap = await tx.get(counterRef);
        const n = (snap.exists() ? snap.data().value : 0) + 1;
        tx.set(counterRef, { value: n });
        return n;
      });
      const reportNumber = `BLG-${String(nextNum).padStart(4, '0')}`;
      await addDoc(collection(db, 'reports'), {
        uid: profile?.uid,
        observer: profile?.nameAr || profile?.name || 'مراقب',
        center: profile?.center || '—',
        caterer: profile?.caterer || getCaterer(profile?.center) || '—',
        reportType: selectedReport,
        severity,
        description,
        reportNumber,
        status: 'pending',
        timestamp: serverTimestamp(),
      });
      setReportNum(reportNumber);
      setSubmitted(true);
    } catch (e) { alert('خطأ في الإرسال'); }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FDFCFB] flex items-center justify-center p-6 font-arabic">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={40} className="text-green-600" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#2D2926] mb-1">تم إرسال البلاغ</h2>
            <p className="text-sm text-[#9D8F85]">وصل البلاغ لغرفة العمليات بنجاح</p>
          </div>
          <div className="bg-[#2D2926] rounded-2xl px-6 py-5 text-center">
            <p className="text-white/50 text-[11px] font-semibold mb-2 tracking-widest uppercase">رقم البلاغ</p>
            <p className="text-white text-3xl font-black tracking-wider">{reportNum}</p>
            <p className="text-white/40 text-[10px] mt-2">احتفظ بهذا الرقم للمتابعة</p>
          </div>
          <button onClick={() => navigate('/home')}
            className="w-full py-4 rounded-2xl bg-[#A98159] text-white font-bold text-base shadow-lg active:scale-95 transition-all">
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-32 font-arabic">
      <header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] w-full px-4 md:px-8 py-3 mb-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/home')} className="p-2 hover:bg-gray-100 rounded-xl transition shrink-0 border border-transparent active:border-[#A98159]/20">
            <ChevronRight className="text-[#A98159]" size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-base font-bold text-[#2D2926] absolute left-1/2 -translate-x-1/2 whitespace-nowrap">بلاغ طارئ عاجل</h1>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4">
          <div className="rounded-[2.5rem] p-6 my-6 text-white shadow-lg relative overflow-hidden bg-[#2D2926]">
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-3 rounded-2xl">
                  <AlertTriangle className={severity === 'high' ? "text-[#BA1A1A] animate-pulse" : "text-[#A98159]"} size={28} />
                </div>
                <div>
                  <p className="text-[#A98159] text-[10px] font-black uppercase tracking-wider">نظام الرصد الميداني</p>
                  <h2 className="text-xl font-bold">تفاصيل البلاغ</h2>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 relative z-10">
              <div className="bg-white/5 rounded-2xl py-3 border border-white/10 text-center">
                <span className="text-white/40 text-[9px] block mb-1">المراقب</span>
                <span className="text-white font-bold text-[11px] truncate px-1">{profile?.nameAr || '—'}</span>
              </div>
              <div className="bg-white/5 rounded-2xl py-3 border border-white/10 text-center">
                <span className="text-white/40 text-[9px] block mb-1">المركز</span>
                <span className="text-[#A98159] font-bold text-[11px]">{profile?.center || '—'}</span>
              </div>
              <div className="bg-white/5 rounded-2xl py-3 border border-white/10 text-center">
                <span className="text-white/40 text-[9px] block mb-1">المتعهد</span>
                <span className="text-white font-bold text-[11px] truncate px-1">{profile?.caterer || '—'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-[#D1C4B9] shadow-sm space-y-6">
            <div>
              <label className="text-xs font-bold text-[#A98159] mb-3 block tracking-wide">نوع المخالفة/البلاغ</label>
              <select value={selectedReport} onChange={handleReportChange}
                className="w-full px-4 py-4 border border-[#D1C4B9] rounded-2xl bg-[#FDFCFB] font-bold text-sm outline-none focus:ring-2 focus:ring-[#A98159]/20 transition-all appearance-none">
                <option value="">اختر نوع البلاغ من القائمة...</option>
                {REPORT_TYPES.map(r => <option key={r.id} value={r.title}>{r.title}</option>)}
              </select>
            </div>

            {selectedReport && (
              <div className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all duration-300 ${SEVERITY_MAP[severity].border} ${SEVERITY_MAP[severity].light}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${SEVERITY_MAP[severity].color} shadow-lg shadow-red-200`} />
                  <span className={`font-black text-sm ${SEVERITY_MAP[severity].text}`}>{SEVERITY_MAP[severity].label}</span>
                </div>
                <CheckCircle2 size={18} className={SEVERITY_MAP[severity].text} />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-[#A98159] mb-2 block tracking-wide">وصف البلاغ الميداني *</label>
              <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                placeholder="يرجى كتابة تفاصيل واضحة للمساعدة في المعالجة السريعة..."
                className="w-full px-4 py-4 border border-[#D1C4B9] rounded-2xl outline-none text-sm resize-none focus:border-[#A98159] transition-colors" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div onClick={() => imageInputRef.current.click()} 
                   className={`relative border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center transition-all cursor-pointer ${imageFile ? 'border-green-500 bg-green-50' : 'border-[#D1C4B9] bg-gray-50'}`}>
                <input type="file" ref={imageInputRef} hidden accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} />
                {imageFile ? (
                  <>
                    <CheckCircle2 className="text-green-600 mb-1" size={24} />
                    <span className="text-[10px] font-bold text-green-700 text-center truncate w-full px-1">تم رفع الصورة</span>
                    <X className="absolute top-1 left-1 text-red-400" size={14} onClick={(e) => {e.stopPropagation(); setImageFile(null)}}/>
                  </>
                ) : (
                  <>
                    <ImageIcon className="text-[#A98159] mb-1" size={24} />
                    <span className="text-[10px] font-bold text-[#6D6E71]">ارفق صورة *</span>
                  </>
                )}
              </div>

              <div onClick={() => videoInputRef.current.click()} 
                   className={`relative border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center transition-all cursor-pointer ${videoFile ? 'border-green-500 bg-green-50' : 'border-[#D1C4B9] bg-gray-50'}`}>
                <input type="file" ref={videoInputRef} hidden accept="video/*" onChange={(e) => setVideoFile(e.target.files[0])} />
                {videoFile ? (
                  <>
                    <CheckCircle2 className="text-green-600 mb-1" size={24} />
                    <span className="text-[10px] font-bold text-green-700 text-center truncate w-full px-1">تم رفع الفيديو</span>
                    <X className="absolute top-1 left-1 text-red-400" size={14} onClick={(e) => {e.stopPropagation(); setVideoFile(null)}}/>
                  </>
                ) : (
                  <>
                    <Video className="text-[#A98159] mb-1" size={24} />
                    <span className="text-[10px] font-bold text-[#6D6E71]">ارفق فيديو *</span>
                  </>
                )}
              </div>
            </div>
          </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 border-t border-[#D1C4B9] z-50">
        <button onClick={handleSubmit} disabled={loading}
          className={`w-full max-w-md mx-auto py-4 rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95
            ${loading ? 'bg-gray-400' : 'bg-[#BA1A1A] text-white hover:bg-[#961515]'}`}>
          {loading ? 'جاري رفع البيانات...' : <><Zap size={22} fill="white" /> إرسال بلاغ عاجل</>}
        </button>
      </div>
    </div>
  );
}