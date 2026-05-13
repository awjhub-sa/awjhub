import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Utensils, ChevronRight, Save, CheckCircle2, AlertCircle,
  Camera, Lock, ArrowLeft, RotateCcw, Ban,
} from 'lucide-react';
import { db } from '../../config/db.js';
import { collection, addDoc, serverTimestamp, setDoc, doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext.jsx';
import { getCaterer } from '../../config/centers.js';
import { extractDay, extractCenterNum, MEAL_META } from '../../hooks/useAssignedTasks.js';
import { MEAL_QUESTIONS, MEAL_MAX_SCORE, computeMealScore } from '../../config/mealQuestions.js';

/* Phase 2 (cooking) is skipped for the «وجبة جافة» (dry) category since
   dry meals are not cooked on-site. See buildPhases() below. */
const PHASES = [
  { id: 1, label: 'مرحلة التجهيز',         desc: 'ارفع صورة لمرحلة تجهيز المواد الخام' },
  { id: 2, label: 'مرحلة الطبخ',            desc: 'ارفع صورة أثناء عملية الطبخ'         },
  { id: 3, label: 'مرحلة التعبئة والتوزيع', desc: 'ارفع صورة لتعبئة وتوزيع الوجبات'    },
];

function buildPhases(categories) {
  const isDryOnly = Array.isArray(categories)
    && categories.length === 1
    && categories[0] === 'dry';
  return isDryOnly ? [PHASES[0], PHASES[2]] : PHASES;
}

/* Questions — source of truth in src/config/mealQuestions.js */
const QUESTIONS = MEAL_QUESTIONS;

const STORAGE_KEY = (uid, taskId, mealType) => `sup_mealcheck_${uid}_${taskId}_${mealType}`;

/* ── Task Gate ── */
function TaskGate({ profile, centerId, catererName, tasks, completions, loading, onSelect }) {
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center font-arabic">
        <div className="w-8 h-8 border-2 border-[#A98159]/30 border-t-[#A98159] rounded-full animate-spin" />
      </div>
    );
  }

  const items = [];
  tasks.filter(t => t.task_types?.includes('meal_evaluation')).forEach(task => {
    (task.meal_types?.length > 0 ? task.meal_types : []).forEach(mealType => {
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
        <div className="rounded-[2rem] p-5 text-white bg-[#2D2926] shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-white/10 p-2.5 rounded-xl"><Utensils className="text-[#A98159]" size={22} /></div>
            <div>
              <p className="text-[#A98159] text-[10px] font-black uppercase tracking-widest">مهام التقييم — مشرف</p>
              <h2 className="text-base font-bold">اختر الوجبة للتقييم</h2>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { lbl: 'المشرف', val: profile?.nameAr || profile?.name, cls: 'text-white' },
              { lbl: 'المركز', val: centerId,                          cls: 'text-[#A98159]' },
              { lbl: 'المتعهد', val: catererName,                     cls: 'text-white' },
            ].map(c => (
              <div key={c.lbl} className="bg-white/5 rounded-xl px-2 py-2 border border-white/10 text-center">
                <p className="text-white/40 text-[9px] mb-0.5">{c.lbl}</p>
                <p className={`font-bold text-[10px] truncate ${c.cls}`}>{c.val || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {items.length === 0 && (
          <div className="bg-white border border-[#EDE5DC] rounded-2xl py-14 text-center shadow-sm">
            <Ban size={36} className="mx-auto text-gray-300 mb-3" strokeWidth={1.2} />
            <p className="text-[#2D2926] font-bold text-base mb-1">لا توجد مهام حالياً</p>
            <p className="text-[#9D8F85] text-sm">لم تُسند مهام تقييم لهذا المركز بعد</p>
          </div>
        )}

        {pending.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-black text-[#A98159] uppercase tracking-wider px-1">مهام معلقة — {pending.length}</p>
            {pending.map(({ task, mealType }) => {
              const meta = MEAL_META[mealType] || {};
              return (
                <button key={`${task.id}_${mealType}`}
                  onClick={() => onSelect({ taskId: task.id, mealType, scheduledDate: task.scheduled_date, day: extractDay(task.scheduled_date), categories: task.meal_categories || [] })}
                  className="w-full bg-white border-2 border-[#D1C4B9] hover:border-[#A98159] rounded-2xl p-4 flex items-center gap-4 text-right transition-all active:scale-[0.98] shadow-sm hover:shadow-md">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: meta.bg, border: `1.5px solid ${meta.border}` }}>
                    <meta.icon size={26} weight="duotone" style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-[#2D2926]">{meta.label}</p>
                      <span className="text-[9px] font-black text-[#A98159] bg-[#FDF8F0] border border-[#A98159]/30 px-1.5 py-0.5 rounded-full">معلقة</span>
                    </div>
                    <p className="text-[11px] text-[#9D8F85] mt-0.5">{task.scheduled_date}</p>
                  </div>
                  <ArrowLeft size={18} className="text-[#A98159] flex-shrink-0" strokeWidth={2.5} />
                </button>
              );
            })}
          </div>
        )}

        {items.length > 0 && pending.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl py-10 text-center">
            <CheckCircle2 size={32} className="mx-auto text-green-400 mb-2" strokeWidth={1.5} />
            <p className="text-green-700 font-bold text-sm">جميع مهام هذا المركز مكتملة</p>
            <p className="text-green-600 text-xs mt-1">تحقق من سجل نشاط المراقبين في الصفحة الرئيسية</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function SupMealcheck() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { profile } = useAuth();

  const centerId    = state?.centerId || '—';
  const catererName = getCaterer(centerId) || '—';

  /* ── Load tasks for this center ── */
  const [tasks,       setTasks]       = useState([]);
  const [completions, setCompletions] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  useEffect(() => {
    const cn  = extractCenterNum(centerId);
    const uid = profile?.uid;
    if (!uid || !cn) { setTasksLoading(false); return; }
    let t1 = false, t2 = false;
    const done = () => { if (t1 && t2) setTasksLoading(false); };

    const u1 = onSnapshot(collection(db, 'assigned_tasks'), snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTasks(all.filter(t => t.target_centers?.includes(cn)));
      t1 = true; done();
    });
    const u2 = onSnapshot(collection(db, 'task_completions'), snap => {
      setCompletions(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.center === centerId));
      t2 = true; done();
    });
    return () => { u1(); u2(); };
  }, [profile?.uid, centerId]);

  /* ── Selected task ── */
  const [selectedTask, setSelectedTask] = useState(null);

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

  /* ── Reset + restore answers from localStorage when task changes ── */
  useEffect(() => {
    if (!selectedTask || !profile?.uid) return;
    setScreen('phases');
    setPhaseDone({ 1: false, 2: false, 3: false });
    setPhasePhotos({ 1: null, 2: null, 3: null });
    setAnswers({});
    setRestored(false);
    try {
      const raw = localStorage.getItem(STORAGE_KEY(profile.uid, selectedTask.taskId, selectedTask.mealType));
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.answers && Object.keys(data.answers).length > 0) {
        setAnswers(data.answers);
        if (data.screen) setScreen(data.screen);
        setRestored(true);
      }
    } catch {}
  }, [selectedTask?.taskId, selectedTask?.mealType, profile?.uid]);

  /* ── Real-time phaseDone sync from Firestore ── */
  useEffect(() => {
    if (!selectedTask || !centerId || centerId === '—' || !profile?.uid) return;
    const docId      = `${centerId}_d${selectedTask.day}_${selectedTask.mealType}`;
    const storageKey = STORAGE_KEY(profile.uid, selectedTask.taskId, selectedTask.mealType);
    return onSnapshot(doc(db, 'meal_phases', docId), snap => {
      if (!snap.exists()) {
        localStorage.removeItem(storageKey);
        setPhaseDone({ 1: false, 2: false, 3: false });
        setPhasePhotos({ 1: null, 2: null, 3: null });
        setAnswers({});
        setScreen('phases');
        setRestored(false);
      } else {
        const d = snap.data();
        setPhaseDone({ 1: !!d.phase1, 2: !!d.phase2, 3: !!d.phase3 });
      }
    });
  }, [selectedTask?.taskId, selectedTask?.mealType, centerId, profile?.uid]);

  /* ── Auto-save ── */
  useEffect(() => {
    if (!selectedTask || !profile?.uid) return;
    localStorage.setItem(
      STORAGE_KEY(profile.uid, selectedTask.taskId, selectedTask.mealType),
      JSON.stringify({ screen, answers })
    );
  }, [screen, answers, selectedTask, profile?.uid]);

  const clearProgress = () => {
    if (selectedTask && profile?.uid)
      localStorage.removeItem(STORAGE_KEY(profile.uid, selectedTask.taskId, selectedTask.mealType));
    setScreen('phases');
    setPhasePhotos({ 1: null, 2: null, 3: null });
    setAnswers({});
    setRestored(false);
  };

  const handlePhotoChange = async (id, file) => {
    if (!file) return;
    setPhasePhotos(prev => ({ ...prev, [id]: file }));
    if (!centerId || centerId === '—' || !selectedTask) return;
    try {
      await setDoc(doc(db, 'meal_phases', `${centerId}_d${selectedTask.day}_${selectedTask.mealType}`), {
        center:        centerId,
        day:           selectedTask.day,
        mealType:      selectedTask.mealType,
        scheduledDate: selectedTask.scheduledDate,
        observer:      profile?.nameAr || profile?.name || '—',
        uid:           profile?.uid,
        [`phase${id}`]: serverTimestamp(),
        updatedAt:      serverTimestamp(),
        role:          'supervisor',
      }, { merge: true });
    } catch {}
  };

  const phases            = buildPhases(selectedTask?.categories);
  const allPhasesComplete = phases.every(p => phaseDone[p.id]);
  const handleAnswer = (id, val) => setAnswers(prev => ({ ...prev, [id]: val }));

  const handleSubmit = async () => {
    if (Object.keys(answers).length < QUESTIONS.length) {
      alert('يرجى الإجابة على جميع المعايير قبل الإرسال');
      return;
    }
    setLoadingSubmit(true);
    try {
      const totalScore   = computeMealScore(answers);
      const maxScore     = MEAL_MAX_SCORE;
      const scoreOutOf10 = maxScore > 0 ? parseFloat(((totalScore / maxScore) * 10).toFixed(2)) : 0;
      const percentage   = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
      await addDoc(collection(db, 'meal_evaluations'), {
        uid:          profile?.uid,
        center:       centerId,
        centerId,
        caterer:      catererName,
        observer:     profile?.nameAr || profile?.name || 'مشرف',
        observerName: profile?.nameAr || profile?.name || 'مشرف',
        answers,
        totalScore,
        maxScore,
        scoreOutOf10,
        percentage:   percentage.toFixed(1),
        mealType:     selectedTask?.mealType || null,
        mealLabel:    MEAL_META[selectedTask?.mealType]?.label || null,
        scheduledDate: selectedTask?.scheduledDate || null,
        taskId:       selectedTask?.taskId || null,
        status:       'pending',
        role:         'supervisor',
        timestamp:    serverTimestamp(),
      });
      await addDoc(collection(db, 'task_completions'), {
        taskId:        selectedTask?.taskId,
        taskType:      'meal_evaluation',
        mealType:      selectedTask?.mealType,
        scheduledDate: selectedTask?.scheduledDate,
        center:        centerId,
        uid:           profile?.uid,
        observerName:  profile?.nameAr || profile?.name || '—',
        completedAt:   serverTimestamp(),
      });
      localStorage.removeItem(STORAGE_KEY(profile?.uid, selectedTask?.taskId, selectedTask?.mealType));
      alert('تم إرسال التقييم بنجاح');
      setSelectedTask(null);
    } catch { alert('حدث خطأ أثناء الإرسال'); }
    finally { setLoadingSubmit(false); }
  };

  /* ── Task gate ── */
  if (!selectedTask) {
    return (
      <TaskGate
        profile={profile}
        centerId={centerId}
        catererName={catererName}
        tasks={tasks}
        completions={completions}
        loading={tasksLoading}
        onSelect={setSelectedTask}
      />
    );
  }

  const meta = MEAL_META[selectedTask.mealType] || {};

  /* ════════════════════════════════════════════
     PHASES SCREEN
  ════════════════════════════════════════════ */
  if (screen === 'phases') {
    const completedCount = phases.filter(p => phaseDone[p.id]).length;
    const totalPhases    = phases.length;
    return (
      <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-32 font-arabic">
        <header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] w-full px-4 py-3 mb-6 shadow-sm">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-gray-100 rounded-xl transition">
              <ChevronRight className="text-[#A98159]" size={22} strokeWidth={2.5} />
            </button>
            <h1 className="text-base font-bold text-[#2D2926] absolute left-1/2 -translate-x-1/2 whitespace-nowrap">مراحل تقييم الوجبة</h1>
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
                <p className="text-white/70 text-[11px] font-bold">{completedCount} / {totalPhases}</p>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-[#A98159] rounded-full transition-all duration-500"
                  style={{ width: `${(completedCount / totalPhases) * 100}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { lbl: 'المشرف',  val: profile?.nameAr || profile?.name, cls: 'text-white' },
                { lbl: 'المركز',  val: centerId,                          cls: 'text-[#A98159]' },
                { lbl: 'المتعهد', val: catererName,                       cls: 'text-white' },
              ].map(c => (
                <div key={c.lbl} className="bg-white/5 rounded-xl px-2 py-2 border border-white/10 text-center">
                  <p className="text-white/40 text-[9px] mb-0.5">{c.lbl}</p>
                  <p className={`font-bold text-[10px] truncate ${c.cls}`}>{c.val || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {phases.map((phase, idx) => {
              const isUnlocked = idx === 0 || phaseDone[phases[idx - 1].id];
              const isDone     = phaseDone[phase.id];
              const isRestored = isDone && !phasePhotos[phase.id];
              const ref        = fileRefs[idx];
              const stepNum    = idx + 1;
              return (
                <div key={phase.id} className={`bg-white rounded-2xl border-2 p-5 transition-all duration-300 ${isDone ? 'border-green-400 shadow-[0_4px_16px_rgba(34,197,94,0.15)]' : isUnlocked ? 'border-[#D1C4B9] hover:border-[#A98159]/50 shadow-sm' : 'border-[#EDE8E3] opacity-50'}`}>
                  <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden"
                    disabled={!isUnlocked} onChange={e => handlePhotoChange(phase.id, e.target.files[0])} />
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-green-100' : isUnlocked ? 'bg-[#FDF8F0] border border-[#A98159]/20' : 'bg-gray-50'}`}>
                      {isDone ? <CheckCircle2 size={24} className="text-green-500" strokeWidth={2} />
                        : isUnlocked ? <span className="text-[#A98159] font-black text-lg">{stepNum}</span>
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
                : <>{totalPhases - completedCount} مراحل متبقية</>}
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
            {phases.map(p => (
              <span key={p.id} className="flex items-center gap-1 bg-green-500/20 text-green-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-500/30">
                <CheckCircle2 size={10} strokeWidth={2.5} /> {p.label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { lbl: 'المشرف',  val: profile?.nameAr || '—', cls: 'text-white' },
              { lbl: 'المركز',  val: centerId || '—',         cls: 'text-[#A98159]' },
              { lbl: 'المتعهد', val: catererName || '—',      cls: 'text-white' },
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
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <span className="text-[#A98159] font-bold text-sm">#{q.id}</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {q.score > 0 ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#FDF8F0] border border-[#A98159]/30 text-[#A98159]">
                          {q.score.toFixed(2)} نقطة
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-500">
                          استرشادي
                        </span>
                      )}
                      {q.negative && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700">
                          سلبي — «لا» تمنح الدرجة
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[#2D2926] font-bold text-base mb-2 leading-relaxed">{q.text}</p>
                  {q.note && (
                    <p className="text-[11px] text-[#6D6E71] mb-5 leading-relaxed italic bg-[#FAFAF8] rounded-xl px-3 py-2 border border-[#EDE8E3]">
                      {q.note}
                    </p>
                  )}
                  {!q.note && <div className="mb-4" />}
                  <div className="flex gap-3">
                    <button onClick={() => handleAnswer(q.id, 'نعم')}
                      className={`flex-1 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${answers[q.id] === 'نعم' ? (q.negative ? 'bg-[#BA1A1A] text-white shadow-lg' : 'bg-[#386B41] text-white shadow-lg') : 'bg-gray-50 text-[#6D6E71] border border-gray-100'}`}>
                      <CheckCircle2 size={18} /> نعم
                    </button>
                    <button onClick={() => handleAnswer(q.id, 'لا')}
                      className={`flex-1 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${answers[q.id] === 'لا' ? (q.negative ? 'bg-[#386B41] text-white shadow-lg' : 'bg-[#BA1A1A] text-white shadow-lg') : 'bg-gray-50 text-[#6D6E71] border border-gray-100'}`}>
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
