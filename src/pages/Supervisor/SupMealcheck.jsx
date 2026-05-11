import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Utensils, ChevronRight, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { db } from '../../config/db.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext.jsx';
import { getCaterer } from '../../config/centers.js';

const QUESTIONS = [
  { id: 1, text: "هل توجد أغذية من وجبات سابقة داخل المطبخ أو المخيم؟", category: "متطلبات عامة", score: 0.25 },
  { id: 2, text: "هل تم وضع المستندات الرسمية للمنشأة في لوحة ظاهرة داخل المطبخ؟", category: "متطلبات عامة", score: 0.25 },
  { id: 3, text: "هل يوجد مراقب للجودة داخل المطبخ (يتابع العمليات ويدون الملاحظات الهامة)؟", category: "متطلبات عامة", score: 0.0 },
  { id: 4, text: "هل تم توفير حاويات للنفايات داخل المطبخ (بخاصية عمل بضغط القدم)؟", category: "متطلبات عامة", score: 0.25 },
  { id: 5, text: "هل تم توفير مغسلة أيدي داخل المطبخ (بخاصية عمل مستشعر / حساس)؟", category: "متطلبات عامة", score: 0.25 },
  { id: 6, text: "هل الأرضيات والأسقف والحوائط نظيفة وسليمة إنشائياً؟", category: "البيئة والمنشأة", score: 0.25 },
  { id: 7, text: "هل نظام التصريف (المجاري) داخل المطبخ يعمل بشكل جيد ومغطى بإحكام؟", category: "البيئة والمنشأة", score: 0.25 },
  { id: 8, text: "هل الإضاءة كافية ومحمية ضد الكسر؟", category: "البيئة والمنشأة", score: 0.25 },
  { id: 9, text: "هل التهوية كافية (المراوح والمكيفات تعمل بشكل جيد)؟", category: "البيئة والمنشأة", score: 0.25 },
  { id: 10, text: "هل توجد حشرات أو قوارض أو فضلات لها داخل المطبخ؟", category: "البيئة والمنشأة", score: 0.5 },
  { id: 11, text: "هل يتم تخزين المواد الغذائية على طاولات/أرفف (بارتفاع لا يقل عن 20 سم)؟", category: "التخزين", score: 0.25 },
  { id: 12, text: "هل يتم فصل المواد الغذائية عن المنظفات والمواد الكيميائية؟", category: "التخزين", score: 0.5 },
  { id: 13, text: "هل الثلاجات والمجمدات تعمل بشكل جيد ومزودة بمقياس درجة حرارة؟", category: "التخزين", score: 0.5 },
  { id: 14, text: "هل يتم ترتيب المواد الغذائية حسب تاريخ الصلاحية (FIFO)؟", category: "التخزين", score: 0.25 },
  { id: 15, text: "هل جميع العاملين يرتدون الزي الرسمي النظيف (يونيفورم)؟", category: "العاملين", score: 0.25 },
  { id: 16, text: "هل يرتدي العاملون غطاء الرأس والكمامات والقفازات؟", category: "العاملين", score: 0.25 },
  { id: 17, text: "هل يمتلك جميع العاملين شهادات صحية سارية المفعول؟", category: "العاملين", score: 0.5 },
  { id: 18, text: "هل تظهر على أي من العاملين علامات مرضية أو جروح مكشوفة؟", category: "العاملين", score: 0.5 },
  { id: 19, text: "هل يلتزم العاملون بعدم التدخين أو الأكل داخل منطقة التحضير؟", category: "العاملين", score: 0.25 },
  { id: 20, text: "هل يتم غسل الخضروات والفواكه في أحواض مخصصة لذلك؟", category: "التحضير والطهي", score: 0.25 },
  { id: 21, text: "هل يتم تذويب اللحوم المجمدة بطريقة صحيحة (داخل الثلاجة)؟", category: "التحضير والطهي", score: 0.25 },
  { id: 22, text: "هل يتم طهي الطعام بشكل جيد (وصول الحرارة للمركز)؟", category: "التحضير والطهي", score: 0.5 },
  { id: 23, text: "هل يتم استخدام ألواح تقطيع ملونة (لفصل اللحوم عن الخضروات)؟", category: "التحضير والطهي", score: 0.25 },
  { id: 24, text: "هل درجة حرارة الوجبة مناسبة عند الاستلام؟", category: "الاستلام والتوزيع", score: 0.5 },
  { id: 25, text: "هل يتم نقل الوجبات في حافظات حرارية مغلقة ونظيفة؟", category: "الاستلام والتوزيع", score: 0.5 },
  { id: 26, text: "هل التغليف سليم ومحكم الإغلاق ولا يوجد تسريب؟", category: "الاستلام والتوزيع", score: 0.25 },
  { id: 27, text: "هل ملصق البيانات (تاريخ ووقت التحضير) موجود على الوجبات؟", category: "الاستلام والتوزيع", score: 0.25 },
  { id: 28, text: "هل يتم تنظيف وتعقيم الأدوات والمعدات بعد كل استخدام؟", category: "النظافة العامة", score: 0.25 },
  { id: 29, text: "هل تستخدم فوط تنظيف نظيفة أو مناديل ورقية (ذات الاستخدام الواحد)؟", category: "النظافة العامة", score: 0.25 },
  { id: 30, text: "هل منطقة غسيل الأواني نظيفة ومنظمة؟", category: "النظافة العامة", score: 0.25 },
  { id: 31, text: "هل يتم إخراج النفايات من المطبخ بشكل دوري؟", category: "النظافة العامة", score: 0.25 },
  { id: 32, text: "هل تتوفر مواد التنظيف والتعقيم المعتمدة؟", category: "النظافة العامة", score: 0.25 },
  { id: 33, text: "هل يتم حفظ العينات من الوجبات اليومية بشكل صحيح؟", category: "إجراءات إضافية", score: 0.5 },
  { id: 34, text: "هل يوجد سجل لمتابعة درجات حرارة الثلاجات والطعام? (إضافية)", category: "إجراءات إضافية", score: 0.25 },
  { id: 35, text: "هل يتم الالتزام بالوزن المحدد للمكونات داخل الوجبة؟", category: "إجراءات إضافية", score: 0.25 }
];

export default function SupMealcheck() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { profile } = useAuth();
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);

  const selectedCenter = state?.centerId || '—';
  const catererName = getCaterer(selectedCenter) || '—';

  const handleAnswer = (id, val) => setAnswers(prev => ({ ...prev, [id]: val }));

  const handleSubmit = async () => {
    if (Object.keys(answers).length < QUESTIONS.length) {
      alert('يرجى الإجابة على جميع المعايير قبل الإرسال');
      return;
    }
    setLoading(true);
    try {
      let totalScore = 0;
      QUESTIONS.forEach(q => { if (answers[q.id] === 'نعم') totalScore += q.score; });
      const percentage = (totalScore / 10.75) * 100;

      await addDoc(collection(db, 'meal_evaluations'), {
        uid: profile?.uid,
        centerId: selectedCenter,
        caterer: catererName,
        observerName: profile?.nameAr || profile?.name || 'مشرف',
        answers,
        totalScore: totalScore.toFixed(2),
        percentage: percentage.toFixed(1),
        status: 'pending',
        role: 'supervisor',
        timestamp: serverTimestamp()
      });
      alert('تم إرسال التقييم بنجاح');
      navigate('/supervisor-home');
    } catch (err) { alert('حدث خطأ أثناء الإرسال'); }
    setLoading(false);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-32 font-arabic">
      <header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] w-full px-4 md:px-8 py-3 mb-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/supervisor-home')} className="p-2 hover:bg-gray-100 rounded-xl transition shrink-0 border border-transparent active:border-[#A98159]/20">
            <ChevronRight className="text-[#A98159]" size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-base font-bold text-[#2D2926] absolute left-1/2 -translate-x-1/2 whitespace-nowrap">تقييم جودة الوجبات</h1>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {/* Header Card with 3 Columns */}
        <div className="rounded-[2.5rem] p-6 my-6 text-white shadow-lg relative overflow-hidden bg-[#2D2926]">
          <div className="flex justify-between items-center mb-6 relative z-10">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-3 rounded-2xl">
                <Utensils className="text-[#A98159]" size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold">{QUESTIONS.length} معياراً للجودة</h2>
                <p className="text-white/40 text-[10px] font-bold">نموذج فحص الوجبات اليومي</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2 relative z-10">
            <div className="bg-white/5 rounded-2xl py-3 border border-white/10 text-center">
              <span className="text-white/40 text-[9px] block mb-1">المشرف</span>
              <span className="text-white font-bold text-[11px] truncate px-1 block">{profile?.nameAr || '—'}</span>
            </div>
            
            <div className="bg-white/5 rounded-2xl py-3 border border-white/10 text-center">
              <span className="text-white/40 text-[9px] block mb-1">المركز</span>
              <span className="text-[#A98159] font-bold text-[11px]">{selectedCenter}</span>
            </div>

            <div className="bg-white/5 rounded-2xl py-3 border border-white/10 text-center">
              <span className="text-white/40 text-[9px] block mb-1">المتعهد</span>
              <span className="text-white font-bold text-[11px] truncate px-1 block">{catererName}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {QUESTIONS.map((q, index) => {
            const isFirstInCategory = index === 0 || QUESTIONS[index - 1].category !== q.category;
            return (
              <React.Fragment key={q.id}>
                {isFirstInCategory && (
                  <div className="col-span-full pt-4 pb-2 relative flex items-center">
                    <div className="flex-grow border-t border-[#D1C4B9]" />
                    <span className="mx-4 px-4 py-1.5 rounded-full border border-[#D1C4B9] bg-[#FDF8F0] text-[#A98159] text-xs font-black shadow-sm">{q.category}</span>
                    <div className="flex-grow border-t border-[#D1C4B9]" />
                  </div>
                )}
                <div className="bg-white border border-[#D1C4B9] p-6 rounded-3xl shadow-sm">
                  <span className="text-[#A98159] font-bold text-sm block mb-2">#{q.id}</span>
                  <p className="text-[#2D2926] font-bold text-base mb-6 leading-relaxed">{q.text}</p>
                  <div className="flex gap-3">
                    <button onClick={() => handleAnswer(q.id, 'نعم')} className={`flex-1 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${answers[q.id] === 'نعم' ? 'bg-[#386B41] text-white shadow-lg' : 'bg-gray-50 text-[#6D6E71] border border-gray-100'}`}>
                      <CheckCircle2 size={18} /> نعم
                    </button>
                    <button onClick={() => handleAnswer(q.id, 'لا')} className={`flex-1 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${answers[q.id] === 'لا' ? 'bg-[#BA1A1A] text-white shadow-lg' : 'bg-gray-50 text-[#6D6E71] border border-gray-100'}`}>
                      <AlertCircle size={18} /> لا
                    </button>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-[#D1C4B9] z-50">
        <button onClick={handleSubmit} disabled={loading} className="w-full max-w-md mx-auto bg-[#A98159] text-white py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all disabled:bg-gray-400">
          <Save size={20} /> {loading ? 'جاري الإرسال...' : 'حفظ وإرسال التقرير النهائي'}
        </button>
      </div>
    </div>
  );
}