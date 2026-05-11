import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Utensils, ChevronRight, Save, CheckCircle2, AlertCircle,
  Camera, Lock, ArrowLeft, RotateCcw, ClipboardList, Ban,
} from 'lucide-react';
import { db, storage } from '../config/db.js';
import { collection, addDoc, serverTimestamp, setDoc, doc, getDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../context/AuthContext.jsx';
import { getCaterer } from '../config/centers.js';
import { useAssignedTasks, extractDay, MEAL_META } from '../hooks/useAssignedTasks.js';

/* ── Phases ── */
const PHASES = [
  { id: 1, label: 'مرحلة التجهيز',          desc: 'ارفع صورة لمرحلة تجهيز المواد الخام' },
  { id: 2, label: 'مرحلة الطبخ',             desc: 'ارفع صورة أثناء عملية الطبخ'         },
  { id: 3, label: 'مرحلة التعبئة والتوزيع',  desc: 'ارفع صورة لتعبئة وتوزيع الوجبات'    },
];

/* ── Questions ── */
const QUESTIONS = [
  { id: 1,  text: "هل توجد أغذية من وجبات سابقة داخل المطبخ أو المخيم؟",                                   category: "متطلبات عامة",        score: 0.25 },
  { id: 2,  text: "هل تم وضع المستندات الرسمية للمنشأة في لوحة ظاهرة داخل المطبخ؟",                        category: "متطلبات عامة",        score: 0.25 },
  { id: 3,  text: "هل يوجد مراقب للجودة داخل المطبخ (يتابع العمليات ويدون الملاحظات الهامة)؟",             category: "متطلبات عامة",        score: 0.0  },
  { id: 4,  text: "هل تم توفير حاويات للنفايات داخل المطبخ (بخاصية عمل بضغط القدم)؟",                     category: "متطلبات عامة",        score: 0.25 },
  { id: 5,  text: "هل تم توفير مغسلة أيدي داخل المطبخ (بخاصية عمل مستشعر / حساس)؟",                      category: "متطلبات عامة",        score: 0.25 },
  { id: 6,  text: "هل الأرضيات والأسقف والحوائط نظيفة وسليمة إنشائياً؟",                                   category: "البيئة والمنشأة",      score: 0.25 },
  { id: 7,  text: "هل نظام التصريف (المجاري) داخل المطبخ يعمل بشكل جيد ومغطى بإحكام؟",                   category: "البيئة والمنشأة",      score: 0.25 },
  { id: 8,  text: "هل الإضاءة كافية ومحمية ضد الكسر؟",                                                     category: "البيئة والمنشأة",      score: 0.25 },
  { id: 9,  text: "هل التهوية كافية (المراوح والمكيفات تعمل بشكل جيد)؟",                                   category: "البيئة والمنشأة",      score: 0.25 },
  { id: 10, text: "هل توجد حشرات أو قوارض أو فضلات لها داخل المطبخ؟",                                     category: "البيئة والمنشأة",      score: 0.5  },
  { id: 11, text: "هل يتم تخزين المواد الغذائية على طاولات/أرفف (بارتفاع لا يقل عن 20 سم)؟",             category: "التخزين",              score: 0.25 },
  { id: 12, text: "هل يتم فصل المواد الغذائية عن المنظفات والمواد الكيميائية؟",                            category: "التخزين",              score: 0.5  },
  { id: 13, text: "هل الثلاجات والمجمدات تعمل بشكل جيد ومزودة بمقياس درجة حرارة؟",                       category: "التخزين",              score: 0.5  },
  { id: 14, text: "هل يتم ترتيب المواد الغذائية حسب تاريخ الصلاحية (FIFO)؟",                              category: "التخزين",              score: 0.25 },
  { id: 15, text: "هل جميع العاملين يرتدون الزي الرسمي النظيف (يونيفورم)؟",                               category: "العاملين",              score: 0.25 },
  { id: 16, text: "هل يرتدي العاملون غطاء الرأس والكمامات والقفازات؟",                                    category: "العاملين",              score: 0.25 },
  { id: 17, text: "هل يمتلك جميع العاملين شهادات صحية سارية المفعول؟",                                    category: "العاملين",              score: 0.5  },
  { id: 18, text: "هل تظهر على أي من العاملين علامات مرضية أو جروح مكشوفة؟",                              category: "العاملين",              score: 0.5  },
  { id: 19, text: "هل يلتزم العاملون بعدم التدخين أو الأكل داخل منطقة التحضير؟",                         category: "العاملين",              score: 0.25 },
  { id: 20, text: "هل يتم غسل الخضروات والفواكه في أحواض مخصصة لذلك؟",                                   category: "التحضير والطهي",        score: 0.25 },
  { id: 21, text: "هل يتم تذويب اللحوم المجمدة بطريقة صحيحة (داخل الثلاجة)؟",                            category: "التحضير والطهي",        score: 0.25 },
  { id: 22, text: "هل يتم طهي الطعام بشكل جيد (وصول الحرارة للمركز)؟",                                   category: "التحضير والطهي",        score: 0.5  },
  { id: 23, text: "هل يتم استخدام ألواح تقطيع ملونة (لفصل اللحوم عن الخضروات)؟",                        category: "التحضير والطهي",        score: 0.25 },
  { id: 24, text: "هل درجة حرارة الوجبة مناسبة عند الاستلام؟",                                            category: "الاستلام والتوزيع",     score: 0.5  },
  { id: 25, text: "هل يتم نقل الوجبات في حافظات حرارية مغلقة ونظيفة؟",                                   category: "الاستلام والتوزيع",     score: 0.5  },
  { id: 26, text: "هل التغليف سليم ومحكم الإغلاق ولا يوجد تسريب؟",                                       category: "الاستلام والتوزيع",     score: 0.25 },
  { id: 27, text: "هل ملصق البيانات (تاريخ ووقت التحضير) موجود على الوجبات؟",                            category: "الاستلام والتوزيع",     score: 0.25 },
  { id: 28, text: "هل يتم تنظيف وتعقيم الأدوات والمعدات بعد كل استخدام؟",                                category: "النظافة العامة",        score: 0.25 },
  { id: 29, text: "هل تستخدم فوط تنظيف نظيفة أو مناديل ورقية (ذات الاستخدام الواحد)؟",                 category: "النظافة العامة",        score: 0.25 },
  { id: 30, text: "هل منطقة غسيل الأواني نظيفة ومنظمة؟",                                                 category: "النظافة العامة",        score: 0.25 },
  { id: 31, text: "هل يتم إخراج النفايات من المطبخ بشكل دوري؟",                                          category: "النظافة العامة",        score: 0.25 },
  { id: 32, text: "هل تتوفر مواد التنظيف والتعقيم المعتمدة؟",                                            category: "النظافة العامة",        score: 0.25 },
  { id: 33, text: "هل يتم حفظ العينات من الوجبات اليومية بشكل صحيح؟",                                    category: "إجراءات إضافية",        score: 0.5  },
  { id: 34, text: "هل يوجد سجل لمتابعة درجات حرارة الثلاجات والطعام؟",                                   category: "إجراءات إضافية",        score: 0.25 },
  { id: 35, text: "هل يتم الالتزام بالوزن المحدد للمكونات داخل الوجبة؟",                                 category: "إجراءات إضافية",        score: 0.25 },
];

const STORAGE_KEY = (uid, taskId, mealType) => `mealcheck_${uid}_${taskId}_${mealType}`;

/* ── Task Gate Screen ── */
function TaskGate({ profile, tasks, completions, loading, onSelect }) {
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center font-arabic">
        <div className="w-8 h-8 border-2 border-[#A98159]/30 border-t-[#A98159] rounded-full animate-spin" />
      </div>
    );
  }

  // Expand tasks into individual (taskId, mealType) items
  const items = [];
  tasks
    .filter(t => t.task_types?.includes('meal_evaluation'))
    .forEach(task => {
      const mealTypes = task.meal_types?.length > 0 ? task.meal_types : [];
      mealTypes.forEach(mealType => {
        const done = completions.some(c => c.taskId === task.id && c.mealType === mealType);
        items.push({ task, mealType, done });
      });
    });

  const pending   = items.filter(i => !i.done);
  const completed = items.filter(i => i.done);

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-10 font-arabic">
      <header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] w-full px-4 py-3 mb-6 shadow-sm">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <button onClick={() => window.history.back()} className="p-2 hover:bg-gray-100 rounded-xl transition">
            <ChevronRight className="text-[#A98159]" size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-base font-bold text-[#2D2926] absolute left-1/2 -translate-x-1/2 whitespace-nowrap">تقييم جودة الوجبات</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 space-y-5">
        {/* Observer card */}
        <div className="rounded-[2rem] p-5 text-white bg-[#2D2926] shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-white/10 p-2.5 rounded-xl"><Utensils className="text-[#A98159]" size={22} /></div>
            <div>
              <p className="text-[#A98159] text-[10px] font-black uppercase tracking-widest">مهام التقييم</p>
              <h2 className="text-base font-bold">اختر الوجبة للتقييم</h2>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { lbl: 'المراقب', val: profile?.nameAr || profile?.name, cls: 'text-white' },
              { lbl: 'المركز',  val: profile?.center,                   cls: 'text-[#A98159]' },
              { lbl: 'المتعهد', val: profile?.caterer || getCaterer(profile?.center), cls: 'text-white' },
            ].map(c => (
              <div key={c.lbl} className="bg-white/5 rounded-xl px-2 py-2 border border-white/10 text-center">
                <p className="text-white/40 text-[9px] mb-0.5">{c.lbl}</p>
                <p className={`font-bold text-[10px] truncate ${c.cls}`}>{c.val || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* No tasks at all */}
        {items.length === 0 && (
          <div className="bg-white border border-[#EDE5DC] rounded-2xl py-14 text-center shadow-sm">
            <Ban size={36} className="mx-auto text-gray-300 mb-3" strokeWidth={1.2} />
            <p className="text-[#2D2926] font-bold text-base mb-1">لا توجد مهام حالياً</p>
            <p className="text-[#9D8F85] text-sm">لم تُسند إليك أي مهام تقييم لمركزك بعد</p>
          </div>
        )}

        {/* Pending tasks */}
        {pending.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-black text-[#A98159] uppercase tracking-wider px-1">مهام معلقة — {pending.length}</p>
            {pending.map(({ task, mealType }) => {
              const meta = MEAL_META[mealType] || {};
              return (
                <button key={`${task.id}_${mealType}`}
                  onClick={() => onSelect({ taskId: task.id, mealType, scheduledDate: task.scheduled_date, day: extractDay(task.scheduled_date) })}
                  className="w-full bg-white border-2 border-[#D1C4B9] hover:border-[#A98159] rounded-2xl p-4 flex items-center gap-4 text-right transition-all active:scale-[0.98] shadow-sm hover:shadow-md">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: meta.bg, border: `1.5px solid ${meta.border}` }}>
                    <meta.icon size={26} weight="duotone" style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-[#2D2926]">{meta.label}</p>
                    <p className="text-[11px] text-[#9D8F85] mt-0.5">{task.scheduled_date}</p>
                  </div>
                  <ArrowLeft size={18} className="text-[#A98159] flex-shrink-0" strokeWidth={2.5} />
                </button>
              );
            })}
          </div>
        )}

        {/* Completed tasks */}
        {completed.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-black text-green-600 uppercase tracking-wider px-1">مكتملة — {completed.length}</p>
            {completed.map(({ task, mealType }) => {
              const meta = MEAL_META[mealType] || {};
              return (
                <div key={`${task.id}_${mealType}_done`}
                  className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-green-100 border border-green-200">
                    <meta.icon size={26} weight="duotone" style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-green-700">{meta.label}</p>
                    <p className="text-[11px] text-green-600 mt-0.5">{task.scheduled_date}</p>
                  </div>
                  <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" strokeWidth={2} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function Mealcheck() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { tasks, completions, loading } = useAssignedTasks(profile);

  /* ── Selected task ── */
  const [selectedTask, setSelectedTask] = useState(null);
  // { taskId, mealType, scheduledDate, day }

  /* ── Screen ── */
  const [screen, setScreen] = useState('phases');

  /* ── Phase state ── */
  const [phaseDone,   setPhaseDone]   = useState({ 1: false, 2: false, 3: false });
  const [phasePhotos, setPhasePhotos] = useState({ 1: null,  2: null,  3: null  });
  const fileRefs = [useRef(null), useRef(null), useRef(null)];

  /* ── Questions ── */
  const [answers, setAnswers] = useState({});
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [restored, setRestored] = useState(false);

  /* ── Load saved progress when task changes ── */
  useEffect(() => {
    if (!selectedTask || !profile?.uid || !profile?.center) return;
    setScreen('phases');
    setPhaseDone({ 1: false, 2: false, 3: false });
    setPhasePhotos({ 1: null, 2: null, 3: null });
    setAnswers({});
    setRestored(false);

    const storageKey = STORAGE_KEY(profile.uid, selectedTask.taskId, selectedTask.mealType);
    const docId = `${profile.center}_d${selectedTask.day}_${selectedTask.mealType}`;

    /* Check Firestore first — if admin cleared the day, wipe local progress */
    getDoc(doc(db, 'meal_phases', docId)).then(snap => {
      if (!snap.exists()) {
        localStorage.removeItem(storageKey);
        return;
      }
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const data = JSON.parse(raw);
        const hasPhases  = Object.values(data.phaseDone  || {}).some(Boolean);
        const hasAnswers = Object.keys(data.answers || {}).length > 0;
        if (!hasPhases && !hasAnswers) return;
        if (data.phaseDone) setPhaseDone(data.phaseDone);
        if (data.answers)   setAnswers(data.answers);
        if (data.screen)    setScreen(data.screen);
        setRestored(true);
      } catch {}
    }).catch(() => {
      /* Network error — fall back to localStorage */
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.phaseDone) setPhaseDone(data.phaseDone);
        if (data.answers)   setAnswers(data.answers);
        if (data.screen)    setScreen(data.screen);
        setRestored(true);
      } catch {}
    });
  }, [selectedTask?.taskId, selectedTask?.mealType, profile?.uid, profile?.center]);

  /* ── Auto-save ── */
  useEffect(() => {
    if (!selectedTask || !profile?.uid) return;
    localStorage.setItem(
      STORAGE_KEY(profile.uid, selectedTask.taskId, selectedTask.mealType),
      JSON.stringify({ screen, answers, phaseDone })
    );
  }, [screen, answers, phaseDone, selectedTask, profile?.uid]);

  const clearProgress = () => {
    if (selectedTask && profile?.uid) {
      localStorage.removeItem(STORAGE_KEY(profile.uid, selectedTask.taskId, selectedTask.mealType));
    }
    setScreen('phases');
    setPhaseDone({ 1: false, 2: false, 3: false });
    setPhasePhotos({ 1: null, 2: null, 3: null });
    setAnswers({});
    setRestored(false);
  };

  /* ── Photo upload ── */
  const handlePhotoChange = async (id, file) => {
    if (!file) return;
    setPhasePhotos(prev => ({ ...prev, [id]: file }));
    setPhaseDone(prev  => ({ ...prev, [id]: true  }));
    const center = profile?.center;
    if (!center || !selectedTask) return;

    const docId   = `${center}_d${selectedTask.day}_${selectedTask.mealType}`;
    const baseDoc = {
      center,
      day:           selectedTask.day,
      mealType:      selectedTask.mealType,
      scheduledDate: selectedTask.scheduledDate,
      observer:      profile?.nameAr || profile?.name || '—',
      uid:           profile?.uid,
      [`phase${id}`]: serverTimestamp(),
      updatedAt:      serverTimestamp(),
    };

    /* 1. Save phase timestamp immediately — always, regardless of photo */
    try {
      await setDoc(doc(db, 'meal_phases', docId), baseDoc, { merge: true });
    } catch { /* silent */ }

    /* 2. Upload photo separately — failure doesn't block phase data */
    try {
      const sRef     = storageRef(storage, `meal_phases/${docId}/phase${id}_${Date.now()}`);
      await uploadBytes(sRef, file);
      const photoURL = await getDownloadURL(sRef);
      await setDoc(doc(db, 'meal_phases', docId), { [`phase${id}_photo`]: photoURL }, { merge: true });
    } catch { /* photo upload failed silently */ }
  };

  const allPhasesComplete = phaseDone[1] && phaseDone[2] && phaseDone[3];
  const handleAnswer = (id, val) => setAnswers(prev => ({ ...prev, [id]: val }));

  const handleSubmit = async () => {
    if (Object.keys(answers).length < QUESTIONS.length) {
      alert('يرجى الإجابة على جميع المعايير قبل الإرسال');
      return;
    }
    setLoadingSubmit(true);
    try {
      let totalScore = 0;
      QUESTIONS.forEach(q => { if (answers[q.id] === 'نعم') totalScore += q.score; });
      const percentage = (totalScore / 10.75) * 100;
      await addDoc(collection(db, 'meal_evaluations'), {
        uid: profile?.uid,
        centerId: profile?.center || 'N/A',
        caterer: profile?.caterer || getCaterer(profile?.center),
        observerName: profile?.nameAr || profile?.name || 'مراقب',
        answers,
        totalScore: totalScore.toFixed(2),
        percentage: percentage.toFixed(1),
        mealType: selectedTask?.mealType || null,
        mealLabel: MEAL_META[selectedTask?.mealType]?.label || null,
        scheduledDate: selectedTask?.scheduledDate || null,
        taskId: selectedTask?.taskId || null,
        status: 'pending',
        timestamp: serverTimestamp(),
      });
      // Mark task complete
      await addDoc(collection(db, 'task_completions'), {
        taskId: selectedTask?.taskId,
        taskType: 'meal_evaluation',
        mealType: selectedTask?.mealType,
        scheduledDate: selectedTask?.scheduledDate,
        center: profile?.center,
        uid: profile?.uid,
        observerName: profile?.nameAr || profile?.name || '—',
        completedAt: serverTimestamp(),
      });
      localStorage.removeItem(STORAGE_KEY(profile?.uid, selectedTask?.taskId, selectedTask?.mealType));
      alert('تم إرسال التقييم بنجاح');
      setSelectedTask(null);
    } catch { alert('حدث خطأ أثناء الإرسال'); }
    finally { setLoadingSubmit(false); }
  };

  /* ── Task gate ── */
  if (!selectedTask) {
    return <TaskGate profile={profile} tasks={tasks} completions={completions} loading={loading} onSelect={setSelectedTask} />;
  }

  const meta = MEAL_META[selectedTask.mealType] || {};

  /* ════════════════════════════════════════════
     PHASES SCREEN
  ════════════════════════════════════════════ */
  if (screen === 'phases') {
    const completedCount = [1, 2, 3].filter(id => phaseDone[id]).length;
    return (
      <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-32 font-arabic">
        <header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] w-full px-4 py-3 mb-6 shadow-sm">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-gray-100 rounded-xl transition">
              <ChevronRight className="text-[#A98159]" size={22} strokeWidth={2.5} />
            </button>
            <h1 className="text-base font-bold text-[#2D2926] absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
              مراحل تقييم الوجبة
            </h1>
            <div className="w-10" />
          </div>
        </header>

        <div className="max-w-xl mx-auto px-4 space-y-4">
          {restored && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
              <RotateCcw size={14} className="text-blue-500 flex-shrink-0" strokeWidth={2} />
              <p className="text-blue-700 text-[12px] font-bold flex-1">تم استعادة تقدمك من الجلسة السابقة</p>
              <button onClick={clearProgress} className="text-blue-400 hover:text-blue-600 text-[11px] font-bold underline flex-shrink-0">مسح</button>
            </div>
          )}

          <div className="rounded-[2rem] p-6 text-white bg-[#2D2926] shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${meta.color}22` }}>
                <meta.icon size={22} weight="duotone" style={{ color: meta.color }} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: meta.color }}>{meta.label} — {selectedTask.scheduledDate}</p>
                <h2 className="text-lg font-bold">توثيق مراحل الوجبة</h2>
              </div>
            </div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-white/50 text-[11px] font-semibold">التقدم</p>
                <p className="text-white/70 text-[11px] font-bold">{completedCount} / 3</p>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-[#A98159] rounded-full transition-all duration-500"
                  style={{ width: `${(completedCount / 3) * 100}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { lbl: 'المراقب', val: profile?.nameAr || profile?.name, cls: 'text-white' },
                { lbl: 'المركز',  val: profile?.center,                   cls: 'text-[#A98159]' },
                { lbl: 'المتعهد', val: profile?.caterer || getCaterer(profile?.center), cls: 'text-white' },
              ].map(c => (
                <div key={c.lbl} className="bg-white/5 rounded-xl px-2 py-2 border border-white/10 text-center">
                  <p className="text-white/40 text-[9px] mb-0.5">{c.lbl}</p>
                  <p className={`font-bold text-[10px] truncate ${c.cls}`}>{c.val || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {PHASES.map((phase, idx) => {
              const isUnlocked = idx === 0 || phaseDone[idx];
              const isDone     = phaseDone[phase.id];
              const isRestored = isDone && !phasePhotos[phase.id];
              const ref        = fileRefs[idx];
              return (
                <div key={phase.id} className={`bg-white rounded-2xl border-2 p-5 transition-all duration-300 ${isDone ? 'border-green-400 shadow-[0_4px_16px_rgba(34,197,94,0.15)]' : isUnlocked ? 'border-[#D1C4B9] hover:border-[#A98159]/50 shadow-sm' : 'border-[#EDE8E3] opacity-50'}`}>
                  <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden"
                    disabled={!isUnlocked} onChange={e => handlePhotoChange(phase.id, e.target.files[0])} />
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-green-100' : isUnlocked ? 'bg-[#FDF8F0] border border-[#A98159]/20' : 'bg-gray-50'}`}>
                      {isDone ? <CheckCircle2 size={24} className="text-green-500" strokeWidth={2} />
                        : isUnlocked ? <span className="text-[#A98159] font-black text-lg">{phase.id}</span>
                        : <Lock size={18} className="text-gray-300" strokeWidth={1.5} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm ${isDone ? 'text-green-700' : isUnlocked ? 'text-[#2D2926]' : 'text-gray-400'}`}>{phase.label}</p>
                      {isDone
                        ? <p className="text-[11px] text-green-600 font-semibold mt-0.5 flex items-center gap-1">
                            <CheckCircle2 size={11} strokeWidth={2.5} />
                            {isRestored ? 'تم توثيق هذه المرحلة في جلسة سابقة' : `تم رفع الصورة — ${phasePhotos[phase.id]?.name}`}
                          </p>
                        : <p className="text-[11px] text-[#9D8F85] mt-0.5">{isUnlocked ? phase.desc : 'أكمل المرحلة السابقة أولاً'}</p>
                      }
                    </div>
                    {isUnlocked && (
                      <button onClick={() => ref.current?.click()}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${isDone ? 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100' : 'bg-[#A98159] text-white shadow-md hover:bg-[#8B6840] active:scale-95'}`}>
                        <Camera size={14} strokeWidth={2} />
                        {isDone ? 'تغيير' : 'رفع صورة'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-[#D1C4B9] z-50">
          <div className="max-w-xl mx-auto">
            {!allPhasesComplete && (
              <p className="text-center text-[11px] text-[#9D8F85] font-semibold mb-2">
                ارفع صورة لكل مرحلة لتتمكن من بدء التقييم
              </p>
            )}
            <button onClick={() => setScreen('questions')} disabled={!allPhasesComplete}
              className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all duration-300 ${allPhasesComplete ? 'bg-[#A98159] text-white shadow-xl active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
              {allPhasesComplete
                ? <>بدء التقييم <ArrowLeft size={18} strokeWidth={2.5} /></>
                : <>{3 - completedCount} مراحل متبقية</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════
     QUESTIONS SCREEN
  ════════════════════════════════════════════ */
  const answeredCount = Object.keys(answers).length;
  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-32 font-arabic">
      <header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] w-full px-4 py-3 mb-6 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button onClick={() => setScreen('phases')} className="p-2 hover:bg-gray-100 rounded-xl transition">
            <ChevronRight className="text-[#A98159]" size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-base font-bold text-[#2D2926] absolute left-1/2 -translate-x-1/2 whitespace-nowrap">تقييم جودة الوجبات</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {restored && answeredCount > 0 && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
            <RotateCcw size={14} className="text-blue-500 flex-shrink-0" strokeWidth={2} />
            <p className="text-blue-700 text-[12px] font-bold">تم استعادة {answeredCount} إجابة محفوظة</p>
          </div>
        )}

        <div className="rounded-[2.5rem] p-6 text-white shadow-lg bg-[#2D2926]">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${meta.color}22` }}>
              <meta.icon size={22} weight="duotone" style={{ color: meta.color }} />
            </div>
            <div>
              <h2 className="text-xl font-bold">{QUESTIONS.length} معياراً للجودة</h2>
              <p className="text-white/40 text-[10px] font-bold">{meta.label} — {selectedTask.scheduledDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {PHASES.map(p => (
              <span key={p.id} className="flex items-center gap-1 bg-green-500/20 text-green-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-500/30">
                <CheckCircle2 size={10} strokeWidth={2.5} /> {p.label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { lbl: 'المراقب', val: profile?.nameAr || '—', cls: 'text-white' },
              { lbl: 'المركز',  val: profile?.center  || '—', cls: 'text-[#A98159]' },
              { lbl: 'المتعهد', val: profile?.caterer || getCaterer(profile?.center) || '—', cls: 'text-white' },
            ].map(c => (
              <div key={c.lbl} className="bg-white/5 rounded-xl px-2 py-2 border border-white/10 text-center">
                <p className="text-white/40 text-[9px] mb-0.5">{c.lbl}</p>
                <p className={`font-bold text-[10px] truncate ${c.cls}`}>{c.val}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {QUESTIONS.map((q, index) => {
            const isFirstInCategory = index === 0 || QUESTIONS[index - 1].category !== q.category;
            return (
              <React.Fragment key={q.id}>
                {isFirstInCategory && (
                  <div className="col-span-full pt-4 pb-2 flex items-center">
                    <div className="flex-grow border-t border-[#D1C4B9]" />
                    <span className="mx-4 px-4 py-1.5 rounded-full border border-[#D1C4B9] bg-[#FDF8F0] text-[#A98159] text-xs font-black shadow-sm">{q.category}</span>
                    <div className="flex-grow border-t border-[#D1C4B9]" />
                  </div>
                )}
                <div className={`bg-white border p-6 rounded-3xl shadow-sm transition-all ${answers[q.id] ? 'border-[#A98159]/30' : 'border-[#D1C4B9]'}`}>
                  <span className="text-[#A98159] font-bold text-sm block mb-2">#{q.id}</span>
                  <p className="text-[#2D2926] font-bold text-base mb-6 leading-relaxed">{q.text}</p>
                  <div className="flex gap-3">
                    <button onClick={() => handleAnswer(q.id, 'نعم')}
                      className={`flex-1 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${answers[q.id] === 'نعم' ? 'bg-[#386B41] text-white shadow-lg' : 'bg-gray-50 text-[#6D6E71] border border-gray-100'}`}>
                      <CheckCircle2 size={18} /> نعم
                    </button>
                    <button onClick={() => handleAnswer(q.id, 'لا')}
                      className={`flex-1 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${answers[q.id] === 'لا' ? 'bg-[#BA1A1A] text-white shadow-lg' : 'bg-gray-50 text-[#6D6E71] border border-gray-100'}`}>
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
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] text-[#9D8F85] font-semibold">{answeredCount} / {QUESTIONS.length} سؤال</span>
            <span className="text-[11px] text-[#A98159] font-bold">{Math.round((answeredCount / QUESTIONS.length) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
            <div className="h-full bg-[#A98159] rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / QUESTIONS.length) * 100}%` }} />
          </div>
          <button onClick={handleSubmit} disabled={loadingSubmit}
            className="w-full bg-[#A98159] text-white py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all disabled:bg-gray-400">
            <Save size={20} />
            {loadingSubmit ? 'جاري الإرسال...' : 'حفظ وإرسال التقرير النهائي'}
          </button>
        </div>
      </div>
    </div>
  );
}
