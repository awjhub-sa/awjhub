import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight, Save, CheckCircle2, AlertCircle, Mountain } from 'lucide-react';
import { db } from '../../config/db.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext.jsx';
import { getCaterer } from '../../config/centers.js';

const SECTIONS = [
  {
    id: 'general',
    title: 'متطلبات عامة',
    criteria: [
      { id: 1, text: 'هل الطبخ داخل المخيم في مطبخ واحد أم في عدة مطابخ؟', score: null, type: 'choice', choices: ['مطبخ واحد', 'مطبخين', '3 مطابخ', '4 مطابخ أو أكثر'] },
      { id: 2, text: 'هل تم غسيل المطبخ (الحوائط / المداخن / مروح الشفط / الأرضيات) بشكل عام؟', score: 0.19, type: 'yesno' },
      { id: 3, text: 'هل تم وضع المستندات الرسمية للمنشأة في لوحة ظاهرة داخل/خارج المطبخ؟', score: 0.19, type: 'yesno' },
      { id: 4, text: 'هل يوجد مصادر مياه متوفرة داخل المطبخ مع توفر المياه داخل الخزان الاحتياطي؟', score: null, type: 'yesno' },
      { id: 5, text: 'هل تم وضع قائمة الوجبات الغذائية (المنيو) بلغة الحاج في لوحة المعلومات طيلة فترة الموسم؟', score: 0.75, type: 'yesno' },
      { id: 6, text: 'هل تم وضع مواعيد توزيع الوجبات الغذائية بلغة الحاج في لوحة المعلومات طيلة فترة الموسم؟', score: 0.75, type: 'yesno' },
      { id: 7, text: 'هل يوجد ملصقات توعوية عن سلامة الغذاء داخل المطبخ؟', score: 0.75, type: 'yesno' },
      { id: 8, text: 'هل صواعق الحشرات الكهربائية نظيفة وتعمل؟', score: 0.19, type: 'yesno' },
      { id: 9, text: 'هل تم توفير دولاب مخصص للأغراض الشخصية للعاملين؟', score: null, type: 'yesno' },
      { id: 10, text: 'هل تم توفير حافظات (غرف الثلج)؟', score: 0.19, type: 'yesno' },
      { id: 11, text: 'هل تم توفير كميات كافية من الثلج داخل حافظة الثلج؟', score: 0.38, type: 'yesno' },
      { id: 12, text: 'هل مواقد الطبخ لعمليات الطبخ من حيث الإنشاء وتم تجربتها؟', score: 0.75, type: 'yesno' },
      { id: 13, text: 'هل تم توفير فلتر للمياه (فلتر ثلاثي) داخل المطبخ؟', score: 0.57, type: 'yesno' },
      { id: 14, text: 'هل تم توفير (ثلاجات / ترامس) لتبريد مياه الشرب داخل المخيم؟', score: null, type: 'yesno_multi_detail', fields: [{ key: 'fridgeCount', label: 'عدد الثلاجات', type: 'number' }, { key: 'thermosType', label: 'ترامس وانواعها ( درفه أو درفتين )', type: 'text' }] },
      { id: 15, text: 'هل تم تحديد موقع مهيأ/مخصص لتخزين المواد الغذائية؟', score: null, type: 'yesno' },
    ],
  },
  {
    id: 'technical',
    title: 'متطلبات فنية',
    criteria: [
      { id: 16, text: 'هل جميع المنتجات المستخدمة بها بطاقة تعريف المنتج (وصف المنتج – تاريخ الصلاحية – بلد المصدر – مسببات الحساسية – شروط التخزين)؟', score: 0.19, type: 'yesno' },
      { id: 17, text: 'هل يتم تخزين المواد الغذائية بطريقة آمنة وسليمة؟', score: 0.19, type: 'yesno' },
      { id: 18, text: 'هل تم توفير مياه الشرب بشكل كافٍ داخل الموقع (علب – ريطات / شرنكات)؟', score: 1.51, type: 'yesno' },
      { id: 19, text: 'هل تم توفير المواد الأساسية الغذائية من المتعهد (المواد الخام + البروتين)؟', score: 1.51, type: 'yesno' },
      { id: 20, text: 'هل تم توفير معدات وأدوات الطبخ (القدور – مواد التعبئة – المواد الغذائية – الحطب)؟', score: 0.38, type: 'yesno' },
      { id: 21, text: 'هل يوجد داخل الموقع مستودع (غرفة) تبريد مهيأة وجاهزة للاستخدام؟', score: null, type: 'yesno' },
      { id: 22, text: 'هل تم توفير مستودع منفصل مطابق للاشتراطات لتخزين الحطب؟', score: null, type: 'yesno' },
      { id: 23, text: 'هل الحطب متوفر بكميات كافية؟', score: 0.75, type: 'yesno' },
      { id: 24, text: 'هل توفير الوجبات الجافة الجاهزة بكميات كافية (وجبات احتياطية)؟', score: 0.75, type: 'yesno' },
    ],
  },
];

const ALL_CRITERIA = SECTIONS.flatMap(s => s.criteria);
const REQUIRED_IDS = ALL_CRITERIA.filter(c => c.type !== 'choice' && c.type !== 'yesno_detail' && c.type !== 'yesno_multi_detail').map(c => c.id);

export default function SupArafatReadiness() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { profile } = useAuth();
  const [answers, setAnswers] = useState({});
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(false);

  const selectedCenter = state?.centerId || '—';

  const handleAnswer = (id, value) => setAnswers(prev => ({ ...prev, [id]: value }));
  const handleDetail = (id, value) => setDetails(prev => ({ ...prev, [id]: value }));

  const handleSubmit = async () => {
    const unanswered = REQUIRED_IDS.filter(id => !answers[id]);
    if (unanswered.length > 0) { alert(`الرجاء الإجابة على جميع البنود. المتبقي: ${unanswered.length} بند`); return; }
    setLoading(true);
    try {
      await addDoc(collection(db, 'arafat_readiness'), {
        observer: profile?.nameAr || profile?.name || 'مشرف',
        center: selectedCenter,
        caterer: getCaterer(selectedCenter) || '—',
        uid: profile?.uid || '',
        answers,
        details,
        role: 'supervisor',
        timestamp: serverTimestamp(),
        status: 'completed',
      });
      alert('تم إرسال تقييم الجاهزية بنجاح');
      navigate('/supervisor-home');
    } catch (e) { alert('حدث خطأ أثناء الإرسال'); }
    setLoading(false);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-28 font-arabic px-4 md:px-8">
      <header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] w-full px-4 md:px-8 py-3 mb-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/supervisor-home')} className="p-2 hover:bg-gray-100 rounded-xl transition shrink-0 border border-transparent active:border-[#A98159]/20">
            <ChevronRight className="text-[#A98159]" size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-base font-bold text-[#2D2926] absolute left-1/2 -translate-x-1/2 whitespace-nowrap">جاهزية مشعر عرفة</h1>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      <div className="rounded-[2.5rem] p-6 my-6 text-white shadow-lg relative overflow-hidden bg-[#2D2926]">
        <div className="flex justify-between items-center mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-3 rounded-2xl"><Mountain className="text-[#A98159]" size={28} /></div>
            <div><p className="text-[#A98159] text-xs font-bold">نموذج الفحص الميداني</p><h2 className="text-xl font-bold">{ALL_CRITERIA.length} بندًا للجاهزية</h2></div>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-4 w-full">
          <div className="bg-white/5 rounded-2xl px-4 py-3 flex-1 min-w-[120px] flex flex-col items-center justify-center border border-white/10 shadow-sm transition-all hover:bg-white/10"><span className="text-white/40 text-[10px] mb-1 font-medium">المشرف</span><span className="text-white font-bold text-sm whitespace-nowrap">{profile?.nameAr || '—'}</span></div>
          <div className="bg-white/5 rounded-2xl px-4 py-3 flex-1 min-w-[100px] flex flex-col items-center justify-center border border-white/10 shadow-sm transition-all hover:bg-white/10"><span className="text-white/40 text-[10px] mb-1 font-medium">المركز</span><span className="text-[#A98159] font-bold text-sm whitespace-nowrap">{selectedCenter}</span></div>
          <div className="bg-white/5 rounded-2xl px-4 py-3 flex-1 min-w-[140px] flex flex-col items-center justify-center border border-white/10 shadow-sm transition-all hover:bg-white/10"><span className="text-white/40 text-[10px] mb-1 font-medium">المتعهد</span><span className="text-white font-bold text-sm whitespace-nowrap">{getCaterer(selectedCenter) || '—'}</span></div>
        </div>
      </div>

      {SECTIONS.map(section => (
        <div key={section.id} className="mb-6">
          <div className="flex items-center gap-3 mb-4"><div className="h-px flex-1 bg-[#D1C4B9]" /><span className="text-xs font-bold text-[#A98159] bg-[#FDF8F0] border border-[#D1C4B9] px-4 py-1.5 rounded-full">{section.title}</span><div className="h-px flex-1 bg-[#D1C4B9]" /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.criteria.map(c => (
              <div key={c.id} className="bg-white rounded-3xl p-6 border border-[#D1C4B9] shadow-sm">
                <span className="text-[#A98159] font-bold text-sm block mb-2">#{c.id}</span>
                <p className="text-[#2D2926] font-bold text-sm mb-4 leading-relaxed">{c.text}</p>
                {c.type === 'choice' && (<div className="grid grid-cols-2 gap-2">{c.choices.map(choice => (<button key={choice} onClick={() => handleAnswer(c.id, choice)} className={`py-3 rounded-2xl text-sm font-bold transition-all ${answers[c.id] === choice ? 'bg-[#A98159] text-white shadow-md' : 'bg-gray-50 text-[#6D6E71] border border-gray-100'}`}>{choice}</button>))}</div>)}
                {(c.type === 'yesno' || c.type === 'yesno_detail' || c.type === 'yesno_multi_detail') && (
                  <>
                    <div className="flex gap-3"><button onClick={() => handleAnswer(c.id, 'نعم')} className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${answers[c.id] === 'نعم' ? 'bg-[#386B41] text-white shadow-lg' : 'bg-gray-50 text-[#6D6E71] border border-gray-100'}`}><CheckCircle2 size={18} /> نعم</button><button onClick={() => handleAnswer(c.id, 'لا')} className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${answers[c.id] === 'لا' ? 'bg-[#BA1A1A] text-white shadow-lg' : 'bg-gray-50 text-[#6D6E71] border border-gray-100'}`}><AlertCircle size={18} /> لا</button></div>
                    {c.type === 'yesno_detail' && answers[c.id] === 'نعم' && (<input type="text" value={details[c.id] || ''} onChange={e => handleDetail(c.id, e.target.value)} className="w-full mt-3 border border-[#D1C4B9] rounded-xl px-4 py-3 text-sm focus:border-[#A98159] outline-none" placeholder={c.detailLabel} />)}
                    {c.type === 'yesno_multi_detail' && answers[c.id] === 'نعم' && (<div className="grid grid-cols-1 gap-3 mt-3">{c.fields.map(field => (<input key={field.key} type={field.type} value={details[`${c.id}_${field.key}`] || ''} onChange={e => handleDetail(`${c.id}_${field.key}`, e.target.value)} className="w-full border border-[#D1C4B9] rounded-xl px-4 py-3 text-sm focus:border-[#A98159] outline-none" placeholder={field.label} />))}</div>)}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-[#D1C4B9] z-[100]"><button onClick={handleSubmit} disabled={loading} className="w-full max-w-md mx-auto bg-[#A98159] text-white py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-all">{loading ? 'جاري الإرسال...' : <><Save size={22} /> حفظ وإرسال التقرير</>}</button></div>
    </div>
  );
}