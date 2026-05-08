import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Save, CheckCircle2, AlertCircle, Mountain } from 'lucide-react';
import { db } from '../config/db.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext.jsx';
import { getCaterer } from '../config/centers.js';

/* ── Data ──────────────────────────────────────────────────── */
const SECTIONS = [
  {
    id: 'general',
    title: 'متطلبات عامة',
    criteria: [
      {
        id: 1,
        text: 'هل الطبخ داخل المخيم في مطبخ واحد أم في عدة مطابخ؟',
        score: null,
        type: 'choice',
        choices: ['مطبخ واحد', 'مطبخين', '3 مطابخ', '4 مطابخ أو أكثر'],
      },
      { id: 2,  text: 'هل تم غسيل المطبخ (الحوائط / المداخن / مروح الشفط / الأرضيات) بشكل عام؟', score: 0.19, type: 'yesno' },
      { id: 3,  text: 'هل تم وضع المستندات الرسمية للمنشأة في لوحة ظاهرة داخل/خارج المطبخ؟', score: 0.19, type: 'yesno' },
      { id: 4,  text: 'هل يوجد مصادر مياه متوفرة داخل المطبخ مع توفر المياه داخل الخزان الاحتياطي؟', score: null, type: 'yesno' },
      { id: 5,  text: 'هل تم وضع قائمة الوجبات الغذائية (المنيو) بلغة الحاج في لوحة المعلومات طيلة فترة الموسم؟', score: 0.75, type: 'yesno' },
      { id: 6,  text: 'هل تم وضع مواعيد توزيع الوجبات الغذائية بلغة الحاج في لوحة المعلومات طيلة فترة الموسم؟', score: 0.75, type: 'yesno' },
      { id: 7,  text: 'هل يوجد ملصقات توعوية عن سلامة الغذاء داخل المطبخ؟', score: 0.75, type: 'yesno' },
      { id: 8,  text: 'هل صواعق الحشرات الكهربائية نظيفة وتعمل؟', score: 0.19, type: 'yesno' },
      { id: 9,  text: 'هل تم توفير دولاب مخصص للأغراض الشخصية للعاملين؟', score: null, type: 'yesno' },
      { id: 10, text: 'هل تم توفير حافظات (غرف الثلج)؟', score: 0.19, type: 'yesno' },
      { id: 11, text: 'هل تم توفير كميات كافية من الثلج داخل حافظة الثلج؟', score: 0.38, type: 'yesno' },
      { id: 12, text: 'هل مواقد الطبخ لعمليات الطبخ من حيث الإنشاء وتم تجربتها؟', score: 0.75, type: 'yesno' },
      { id: 13, text: 'هل تم توفير فلتر للمياه (فلتر ثلاثي) داخل المطبخ؟', score: 0.57, type: 'yesno' },
      {
        id: 14,
        text: 'هل تم توفير (ثلاجات / ترامس) لتبريد مياه الشرب داخل المخيم؟',
        score: null,
        type: 'yesno_detail',
        detailLabel: 'عدد الثلاجات / ترامس وأنواعها (درفة / درفتين):',
      },
      { id: 15, text: 'هل تم تحديد موقع مهيأ/مخصون لتخزين المواد الغذائية؟', score: null, type: 'yesno' },
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
const REQUIRED_IDS = ALL_CRITERIA.filter(c => c.type !== 'choice' && c.type !== 'yesno_detail').map(c => c.id);

/* ══════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════ */
export default function ArafatReadiness() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [answers, setAnswers] = useState({});
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(false);

  const handleAnswer = (id, value) =>
    setAnswers(prev => ({ ...prev, [id]: value }));

  const handleDetail = (id, value) =>
    setDetails(prev => ({ ...prev, [id]: value }));

  const totalScore = ALL_CRITERIA.reduce((sum, c) => {
    if (c.score && answers[c.id] === 'نعم') return sum + c.score;
    return sum;
  }, 0);

  const maxScore = ALL_CRITERIA.reduce((sum, c) => (c.score ? sum + c.score : sum), 0);
  const answeredCount = Object.keys(answers).length;
  const totalRequired = ALL_CRITERIA.length;

  const handleSubmit = async () => {
    const unanswered = REQUIRED_IDS.filter(id => !answers[id]);
    if (unanswered.length > 0) {
      alert(`الرجاء الإجابة على جميع البنود. المتبقي: ${unanswered.length} بند`);
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'arafat_readiness'), {
        observer:     profile?.nameAr || profile?.name || 'مراقب',
        center:       profile?.center  || '—',
        caterer:      profile?.caterer || getCaterer(profile?.center) || '—',
        uid:          profile?.uid     || '',
        answers,
        details,
        totalScore,
        maxScore,
        scoreOutOf10: maxScore > 0 ? parseFloat(((totalScore / maxScore) * 10).toFixed(2)) : 0,
        timestamp: serverTimestamp(),
        status: 'completed',
      });
      alert('تم إرسال تقييم الجاهزية بنجاح');
      navigate('/home');
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء الإرسال');
    }
    setLoading(false);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-28 font-arabic">

      {/* Header */}
      <div className="bg-white sticky top-0 z-50 px-4 py-4 border-b border-[#D1C4B9] flex items-center justify-between shadow-sm">
        <button onClick={() => navigate('/home')} className="p-2 hover:bg-gray-100 rounded-full transition">
          <ChevronRight className="text-[#A98159]" />
        </button>
        <h1 className="text-base font-bold text-[#2D2926]">تقييم جاهزية مشعر عرفة</h1>
        <div className="w-10" />
      </div>

      <div className="p-4 max-w-2xl mx-auto">

        {/* Info card */}
        <div className="rounded-3xl p-5 mb-6 text-white shadow-gold"
          style={{ background: 'linear-gradient(135deg, #3D3330 0%, #2D2926 100%)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="bg-[#A98159]/20 p-3 rounded-2xl">
                <Mountain className="text-[#A98159]" size={26} />
              </div>
              <div>
                <p className="text-[#A98159] text-xs font-bold">نموذج الفحص الميداني</p>
                <h2 className="text-base font-bold">جاهزية مشعر عرفة — {totalRequired} معياراً</h2>
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[#A98159]">{answeredCount}<span className="text-sm text-white/40">/{totalRequired}</span></p>
              <p className="text-[10px] text-white/50">مكتمل</p>
            </div>
          </div>
          {/* Observer info */}
          <div className="grid grid-cols-3 gap-2 text-xs mb-1 mt-1">
            <div className="bg-white/5 rounded-xl px-3 py-2">
              <p className="text-white/40 text-[10px] mb-0.5">المراقب</p>
              <p className="text-white font-bold truncate">{profile?.nameAr || profile?.name || '—'}</p>
            </div>
            <div className="bg-white/5 rounded-xl px-3 py-2">
              <p className="text-white/40 text-[10px] mb-0.5">المركز</p>
              <p className="text-[#A98159] font-bold">{profile?.center || '—'}</p>
            </div>
            <div className="bg-white/5 rounded-xl px-3 py-2">
              <p className="text-white/40 text-[10px] mb-0.5">المتعهد</p>
              <p className="text-white text-[10px] leading-snug truncate">{profile?.caterer || getCaterer(profile?.center) || '—'}</p>
            </div>
          </div>
          <div className="mt-0">
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span>الدرجة المتوقعة</span>
              <span>{totalScore.toFixed(2)} / {maxScore.toFixed(2)}</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#A98159] rounded-full transition-all duration-500"
                style={{ width: maxScore ? `${(totalScore / maxScore) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </div>

        {/* Sections */}
        {SECTIONS.map(section => (
          <div key={section.id} className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-[#D1C4B9]" />
              <span className="text-xs font-bold text-[#A98159] bg-[#FDF8F0] border border-[#D1C4B9] px-3 py-1 rounded-full">
                {section.title}
              </span>
              <div className="h-px flex-1 bg-[#D1C4B9]" />
            </div>

            <div className="space-y-3">
              {section.criteria.map(c => (
                <div key={c.id} className="bg-white rounded-2xl p-5 border border-[#D1C4B9] shadow-card">
                  <div className="flex justify-end items-start mb-3">
                    <span className="text-[#A98159] font-bold text-sm">#{c.id}</span>
                  </div>

                  <p className="text-[#2D2926] font-semibold text-sm mb-4 leading-relaxed">
                    {c.text}
                  </p>

                  {c.type === 'choice' && (
                    <div className="grid grid-cols-2 gap-2">
                      {c.choices.map(choice => (
                        <button
                          key={choice}
                          onClick={() => handleAnswer(c.id, choice)}
                          className={`py-2.5 px-3 rounded-xl text-sm font-bold transition-all text-center ${
                            answers[c.id] === choice
                              ? 'bg-[#A98159] text-white shadow-md'
                              : 'bg-gray-50 text-[#6D6E71] border border-gray-100'
                          }`}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  )}

                  {(c.type === 'yesno' || c.type === 'yesno_detail') && (
                    <>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleAnswer(c.id, 'نعم')}
                          className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
                            answers[c.id] === 'نعم'
                              ? 'bg-[#386B41] text-white shadow-lg'
                              : 'bg-gray-50 text-[#6D6E71] border border-gray-100'
                          }`}
                        >
                          <CheckCircle2 size={17} /> نعم
                        </button>
                        <button
                          onClick={() => handleAnswer(c.id, 'لا')}
                          className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
                            answers[c.id] === 'لا'
                              ? 'bg-[#BA1A1A] text-white shadow-lg'
                              : 'bg-gray-50 text-[#6D6E71] border border-gray-100'
                          }`}
                        >
                          <AlertCircle size={17} /> لا
                        </button>
                      </div>

                      {c.type === 'yesno_detail' && answers[c.id] === 'نعم' && (
                        <div className="mt-3">
                          <label className="text-xs text-[#6D6E71] mb-1 block">{c.detailLabel}</label>
                          <input
                            type="text"
                            value={details[c.id] || ''}
                            onChange={e => handleDetail(c.id, e.target.value)}
                            className="w-full border border-[#D1C4B9] rounded-xl px-3 py-2 text-sm text-[#2D2926] outline-none focus:border-[#A98159] transition"
                            placeholder="اكتب التفاصيل هنا..."
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Floating submit */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-[#D1C4B9]">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full max-w-md mx-auto bg-[#A98159] text-white py-4 rounded-2xl font-bold text-base shadow-gold-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? 'جاري الإرسال...' : (
            <><Save size={20} /> حفظ وإرسال تقييم الجاهزية</>
          )}
        </button>
      </div>
    </div>
  );
}
