import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Utensils, Camera, ChevronRight, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { db } from '../config/db'; // تأكد من المسار
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const Mealcheck = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // مثال لأول 5 أسئلة (تقدر تكملها لـ 35 بنفس الطريقة)
  const questions = [
    { id: 1, text: "هل درجة حرارة الوجبة مناسبة عند الاستلام؟", category: "الجودة" },
    { id: 2, text: "هل الوجبات مغلفة بطريقة سليمة وغير ممزقة؟", category: "التغليف" },
    { id: 3, text: "هل توجد ملصقات توضح تاريخ الإنتاج والانتهاء؟", category: "البيانات" },
    { id: 4, text: "هل شكل الطعام ومظهره العام فاتح للشهية؟", category: "الجودة" },
    { id: 5, text: "هل طاقم التوزيع يلتزم بارتداء القفازات والكمامات؟", category: "النظافة" },
  ];

  const [answers, setAnswers] = useState({});

  const handleAnswer = (id, value) => {
    setAnswers({ ...answers, [id]: value });
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      alert("الرجاء الإجابة على جميع البنود قبل الإرسال");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "meal_evaluations"), {
        observer: "عمر الرفاعي",
        answers: answers,
        timestamp: serverTimestamp(),
        status: "completed"
      });
      alert("تم إرسال التقييم بنجاح");
      navigate('/home');
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("حدث خطأ أثناء الإرسال");
    }
    setLoading(false);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-24 font-arabic">
      {/* Header */}
      <div className="bg-white sticky top-0 z-50 px-4 py-4 border-b border-[#D1C4B9] flex items-center justify-between shadow-sm">
        <button onClick={() => navigate('/home')} className="p-2 hover:bg-gray-100 rounded-full transition">
          <ChevronRight className="text-[#A98159]" />
        </button>
        <h1 className="text-lg font-bold text-[#2D2926]">تقييم جودة الوجبات</h1>
        <div className="w-10"></div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {/* Info Card */}
        <div className="bg-dark-gradient rounded-3xl p-6 mb-8 text-white shadow-gold">
          <div className="flex items-center gap-4">
            <div className="bg-[#A98159]/20 p-3 rounded-2xl">
              <Utensils className="text-[#A98159]" size={28} />
            </div>
            <div>
              <p className="text-[#A98159] text-xs font-bold">نموذج الفحص الميداني</p>
              <h2 className="text-lg font-bold">35 معياراً للجودة</h2>
            </div>
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-4">
          {questions.map((q) => (
            <div key={q.id} className="bg-white rounded-[2rem] p-6 border border-[#D1C4B9] shadow-card">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] bg-[#FDFCFB] border border-[#D1C4B9] text-[#6D6E71] px-3 py-1 rounded-full font-bold">
                  {q.category}
                </span>
                <span className="text-[#A98159] font-bold text-sm">#{q.id}</span>
              </div>
              <p className="text-[#2D2926] font-bold text-base mb-6 leading-relaxed text-right">{q.text}</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => handleAnswer(q.id, 'نعم')}
                  className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${answers[q.id] === 'نعم' ? 'bg-[#386B41] text-white shadow-lg' : 'bg-gray-50 text-[#6D6E71] border border-gray-100'}`}
                >
                  <CheckCircle2 size={18} /> نعم
                </button>
                <button 
                  onClick={() => handleAnswer(q.id, 'لا')}
                  className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${answers[q.id] === 'لا' ? 'bg-[#BA1A1A] text-white shadow-lg' : 'bg-gray-50 text-[#6D6E71] border border-gray-100'}`}
                >
                  <AlertCircle size={18} /> لا
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Floating Submit Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-[#D1C4B9]">
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="w-full max-w-md mx-auto bg-[#A98159] text-white py-4 rounded-2xl font-bold text-lg shadow-gold-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? "جاري الإرسال..." : (
              <>
                <Save size={20} /> حفظ وإرسال التقرير
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Mealcheck;