import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Save, CheckCircle2, AlertCircle, Home } from 'lucide-react';
import { db } from '../config/db.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext.jsx';
import { getCaterer } from '../config/centers.js';

const SECTIONS = [
  {
    id: 'general',
    title: 'متطلبات عامة',
    criteria: [
      { id: 1, text: 'هل الطبخ داخل المخيم في مطبخ واحد أم في عدة مطابخ؟', score: null, type: 'choice', choices: ['مطبخ واحد', 'مطبخين', '3 مطابخ', '4 مطابخ أو أكثر'] },
      { id: 2, text: 'هل تم غسيل المطبخ (الحوائط / المداخن / مروح الشفط / الأرضيات) بشكل عام؟', score: 0.18, type: 'yesno' },
      { id: 3, text: 'هل تم وضع المستندات الرسمية للمنشأة في لوحة ظاهرة داخل/خارج المطبخ؟', score: 0.18, type: 'yesno' },
      { id: 5, text: 'هل يوجد مصادر مياه متوفرة داخل المطبخ وللمرافق التابعة للمركز (دورات المياه)؟', score: null, type: 'yesno' },
      { id: 6, text: 'هل تم وضع قائمة الوجبات الغذائية (المنيو) بلغة الحاج في لوحة المعلومات طيلة فترة الموسم؟', score: 0.71, type: 'yesno' },
      { id: 7, text: 'هل تم وضع مواعيد توزيع الوجبات الغذائية بلغة الحاج في لوحة المعلومات طيلة فترة الموسم؟', score: 0.71, type: 'yesno' },
      { id: 8, text: 'هل يوجد ملصقات توعوية عن سلامة الغذاء داخل المطبخ؟', score: 0.71, type: 'yesno' },
      { id: 9, text: 'هل تم توفير مغسلة أيدي داخل المطبخ (بخاصية عمل مستشعر / حساس)؟', score: 0.54, type: 'yesno' },
      { id: 10, text: 'هل صواعق الحشرات الكهربائية نظيفة وتعمل؟', score: 0.18, type: 'yesno' },
      { id: 11, text: 'هل تم توفير دولاب مخصص للأغراض الشخصية للعاملين؟', score: null, type: 'yesno' },
      { id: 12, text: 'هل تم تنظيف غرفة الزيت / التفتيش بحيث تكون خالية من الرواسب؟', score: 0.71, type: 'yesno' },
      { id: 13, text: 'هل تم توفير مياه الشرب بشكل كافٍ داخل الموقع (علب – ريطات / شرنكات)؟', score: 1.43, type: 'yesno' },
      { id: 14, text: 'هل تم توفير المواد الأساسية الغذائية من المتعهد (المواد الخام + البروتين)؟', score: 1.43, type: 'yesno' },
      { id: 15, text: 'هل مواقد الطبخ / الدوافير (الكيروسين) تعمل بشكل جيد وتم تجربتها؟', score: 0.71, type: 'yesno' },
      { id: 16, text: 'هل تم توفير فلتر للمياه (فلتر ثلاثي) داخل المطبخ؟', score: 0.54, type: 'yesno' },
      { id: 17, text: 'هل تم توفير (ثلاجات / ترامس) لتبريد مياه الشرب داخل المخيم؟', score: null, type: 'yesno_detail', detailLabel: 'عدد الثلاجات / ترامس وأنواعها:' },
      { id: 18, text: 'هل تم تحديد موقع مهيأ/مخصون لتخزين المواد الغذائية؟', score: null, type: 'yesno' },
    ],
  },
  {
    id: 'technical',
    title: 'متطلبات فنية',
    criteria: [
      { id: 19, text: 'هل جميع المنتجات المستخدمة بها بطاقة تعريف المنتج؟', score: 0.18, type: 'yesno' },
      { id: 20, text: 'هل يتم تخزين المواد الغذائية بطريقة آمنة وسليمة؟', score: 0.18, type: 'yesno' },
      { id: 21, text: 'هل تم توفير معدات وأدوات الطبخ (القدور – مواد التعبئة)؟', score: 0.36, type: 'yesno' },
      { id: 22, text: 'هل يوجد داخل الموقع مستودع (غرفة) تبريد مهيأة؟', score: null, type: 'yesno' },
      { id: 23, text: 'هل يوجد داخل الموقع مستودع (غرفة) تجميد مهيأة؟', score: null, type: 'yesno' },
      { id: 24, text: 'هل تم توفير حافظات (غرف الثلج)؟', score: 0.18, type: 'yesno' },
      { id: 25, text: 'هل تم توفير كميات كافية من الثلج داخل حافظة الثلج؟', score: 0.36, type: 'yesno' },
      { id: 26, text: 'هل توفير الوجبات الجافة الجاهزة بكميات كافية؟', score: 0.71, type: 'yesno' },
    ],
  },
];

const ALL_CRITERIA = SECTIONS.flatMap(s => s.criteria);
const REQUIRED_IDS = ALL_CRITERIA.filter(c => c.type !== 'choice' && c.type !== 'yesno_detail').map(c => c.id);

export default function MinaReadiness() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [answers, setAnswers] = useState({});
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(false);

  const handleAnswer = (id, value) => setAnswers(prev => ({ ...prev, [id]: value }));
  const handleDetail = (id, value) => setDetails(prev => ({ ...prev, [id]: value }));

  const totalRequired = ALL_CRITERIA.length;
  const answeredCount = Object.keys(answers).length;

  const handleSubmit = async () => {
    const unanswered = REQUIRED_IDS.filter(id => !answers[id]);
    if (unanswered.length > 0) {
      alert(`المتبقي: ${unanswered.length} بند`);
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'mina_readiness'), {
        observer: profile?.nameAr || profile?.name || 'مراقب',
        center: profile?.center || '—',
        caterer: profile?.caterer || getCaterer(profile?.center) || '—',
        uid: profile?.uid || '',
        answers,
        details,
        timestamp: serverTimestamp(),
        status: 'completed',
      });
      alert('تم إرسال التقييم بنجاح');
      navigate('/home');
    } catch (e) { alert('خطأ في الإرسال'); }
    setLoading(false);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-28 font-arabic px-4 md:px-8">
<header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] w-full px-4 md:px-8 py-3 mb-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/home')} className="p-2 hover:bg-gray-100 rounded-xl transition shrink-0 border border-transparent active:border-[#A98159]/20">
            <ChevronRight className="text-[#A98159]" size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-base font-bold text-[#2D2926] absolute left-1/2 -translate-x-1/2 whitespace-nowrap">جاهزية مشعر منى</h1>
          <div className="w-10 shrink-0" />
        </div>
      </header>

        {/* Unified Design Header Card */}
        <div className="rounded-[2.5rem] p-6 my-6 text-white shadow-lg relative overflow-hidden" 
             style={{ background: '#2D2926' }}>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-3 rounded-2xl">
                <Home className="text-[#A98159]" size={28} />
              </div>
              <div>
                {/* <p className="text-[#A98159] text-xs font-bold">نموذج الفحص الميداني</p> */}
                <h2 className="text-xl font-bold">{totalRequired} بندًا للجاهزية</h2>
              </div>
            </div>
          </div>

                    <div className="flex flex-wrap justify-center gap-3 mt-4 w-full">
                      {/* مربع المراقب */}
                      <div className="bg-white/5 rounded-2xl px-4 py-3 flex-1 min-w-[120px] flex flex-col items-center justify-center border border-white/10 shadow-sm transition-all hover:bg-white/10">
                        <span className="text-white/40 text-[10px] mb-1 font-medium">المراقب</span>
                        <span className="text-white font-bold text-sm whitespace-nowrap">
                          {profile?.nameAr || profile?.name || '—'}
                        </span>
                      </div>
          
                      {/* مربع المركز */}
                      <div className="bg-white/5 rounded-2xl px-4 py-3 flex-1 min-w-[100px] flex flex-col items-center justify-center border border-white/10 shadow-sm transition-all hover:bg-white/10">
                        <span className="text-white/40 text-[10px] mb-1 font-medium">المركز</span>
                        <span className="text-[#A98159] font-bold text-sm whitespace-nowrap">
                          {profile?.center || '—'} 
                        </span>
                      </div>
          
                      {/* مربع المتعهد */}
                      <div className="bg-white/5 rounded-2xl px-4 py-3 flex-1 min-w-[140px] flex flex-col items-center justify-center border border-white/10 shadow-sm transition-all hover:bg-white/10">
                        <span className="text-white/40 text-[10px] mb-1 font-medium">المتعهد</span>
                        <span className="text-white font-bold text-sm whitespace-nowrap">
                          {profile?.caterer || getCaterer(profile?.center) || '—'}
                        </span>
                      </div>
                    </div>
        </div>


        <div className="space-y-6">
          {SECTIONS.map(section => (
            <div key={section.id}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-[#D1C4B9]" />
                <span className="text-xs font-bold text-[#A98159] bg-[#FDF8F0] border border-[#D1C4B9] px-4 py-1.5 rounded-full">{section.title}</span>
                <div className="h-px flex-1 bg-[#D1C4B9]" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.criteria.map(c => (
                  <div key={c.id} className="bg-white rounded-3xl p-6 border border-[#D1C4B9] shadow-sm">
                    <span className="text-[#A98159] font-bold text-sm block mb-2">#{c.id}</span>
                    <p className="text-[#2D2926] font-bold text-sm mb-4 leading-relaxed">{c.text}</p>
                    {c.type === 'choice' && (
                      <div className="grid grid-cols-2 gap-2">
                        {c.choices.map(choice => (
                          <button key={choice} onClick={() => handleAnswer(c.id, choice)}
                            className={`py-3 rounded-2xl text-xs font-bold transition-all ${answers[c.id] === choice ? 'bg-[#A98159] text-white' : 'bg-gray-50 text-[#6D6E71] border border-gray-100'}`}>
                            {choice}
                          </button>
                        ))}
                      </div>
                    )}
                    {(c.type === 'yesno' || c.type === 'yesno_detail') && (
                      <div className="flex gap-3">
                        <button onClick={() => handleAnswer(c.id, 'نعم')}
                          className={`flex-1 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 ${answers[c.id] === 'نعم' ? 'bg-[#386B41] text-white' : 'bg-gray-50 border border-gray-100 text-[#6D6E71]'}`}>
                          <CheckCircle2 size={18} /> نعم
                        </button>
                        <button onClick={() => handleAnswer(c.id, 'لا')}
                          className={`flex-1 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 ${answers[c.id] === 'لا' ? 'bg-[#BA1A1A] text-white' : 'bg-gray-50 border border-gray-100 text-[#6D6E71]'}`}>
                          <AlertCircle size={18} /> لا
                        </button>
                      </div>
                    )}
                    {c.type === 'yesno_detail' && answers[c.id] === 'نعم' && (
                      <input type="text" className="w-full mt-3 border rounded-xl px-4 py-3 text-sm" value={details[c.id] || ''} onChange={e => handleDetail(c.id, e.target.value)} placeholder={c.detailLabel} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 border-t border-[#D1C4B9] z-50">
          <button onClick={handleSubmit} disabled={loading}
            className="w-full max-w-md mx-auto bg-[#A98159] text-white py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
            {loading ? 'جاري الإرسال...' : <><Save size={22} /> حفظ وإرسال تقييم الجاهزية</>}
          </button>
        </div>
    </div>
  );
}