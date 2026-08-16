import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ForkKnife as Utensils,
  CaretRight as ChevronRight,
  FloppyDisk as Save,
  CheckCircle as CheckCircle2,
  WarningCircle as AlertCircle,
  Camera,
  Lock,
  ArrowLeft,
  ArrowCounterClockwise as RotateCcw,
  Prohibit as Ban,
  Sparkle as Sparkles,
  CircleNotch as Loader2,
  X,
} from '@phosphor-icons/react';
import { db, serverTimestamp, uploadFile, STORAGE_BUCKETS } from '../../lib/db.js';
import { compressImage } from '../../lib/imageCompression.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getCaterer } from '../../config/centers.js';
import { extractDay, MEAL_META } from '../../hooks/useAssignedTasks.js';
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

function TaskGate({ profile, centerId, catererName, tasks, completions, loading, onSelect }) {
  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center font-arabic">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const items = [];
  tasks.filter(t => t.taskTypes?.includes('meal_evaluation')).forEach(task => {
    (task.mealTypes?.length > 0 ? task.mealTypes : []).forEach(mealType => {
      const done = completions.some(c => c.taskId === task.id && c.mealType === mealType);
      items.push({ task, mealType, done });
    });
  });

  const pending   = items.filter(i => !i.done);
  const completed = items.filter(i => i.done);

  return (
    <div dir="rtl" className="min-h-screen bg-canvas pb-10 font-arabic">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-line w-full px-4 py-3 mb-6 shadow-sm">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <button onClick={() => window.history.back()} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 rounded-xl transition">
            <ChevronRight className="text-primary" size={22} weight="bold" />
          </button>
          <h1 className="text-base font-bold text-ink absolute left-1/2 -translate-x-1/2 whitespace-nowrap">تقييم جودة الوجبات</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 space-y-5">
        <div className="group rounded-[2rem] p-5 text-white bg-ink shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl blur-md bg-primary opacity-40 group-hover:opacity-70 transition-opacity" />
              <div className="relative bg-white/10 p-2.5 rounded-xl transition-transform duration-300 group-hover:scale-110">
                <Utensils className="text-primary" size={22} />
                <Sparkles size={9} className="absolute -top-0.5 -right-0.5 text-yellow-200 drop-shadow" />
              </div>
            </div>
            <div>
              <p className="text-primary text-[10px] font-black uppercase tracking-widest">مهام التقييم — مشرف</p>
              <h2 className="text-base font-bold">اختر الوجبة للتقييم</h2>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { lbl: 'المشرف', val: profile?.nameAr || profile?.name, cls: 'text-white' },
              { lbl: 'المركز', val: centerId,                          cls: 'text-primary' },
              { lbl: 'المتعهد', val: catererName,                     cls: 'text-white' },
            ].map(c => (
              <div key={c.lbl} className="bg-white/5 rounded-xl px-2 py-2.5 border border-white/10 text-center min-w-0">
                <p className="text-white/40 text-[9px] sm:text-[10px] mb-0.5 truncate">{c.lbl}</p>
                <p className={`font-bold text-[10px] sm:text-[11px] truncate ${c.cls}`} title={c.val || ''}>{c.val || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {items.length === 0 && (
          <div className="bg-white border border-line rounded-2xl py-14 text-center shadow-sm">
            <Ban size={36} className="mx-auto text-gray-300 mb-3" weight="thin" />
            <p className="text-ink font-bold text-base mb-1">لا توجد مهام حالياً</p>
            <p className="text-muted text-sm">لم تُسند مهام تقييم لهذا المركز بعد</p>
          </div>
        )}

        {pending.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="w-1.5 h-4 rounded-full bg-primary" />
              <p className="text-xs font-black text-primary uppercase tracking-wider">مهام معلقة</p>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 tabular-nums">
                {pending.length}
              </span>
            </div>
            {pending.map(({ task, mealType }) => {
              const meta = MEAL_META[mealType] || {};
              return (
                <button key={`${task.id}_${mealType}`}
                  onClick={() => onSelect({ taskId: task.id, mealType, scheduledDate: task.scheduledDate, day: extractDay(task.scheduledDate), categories: task.mealCategories || [] })}
                  className="group/task relative w-full bg-gradient-to-br from-white via-white to-background/40 border-2 border-line hover:border-primary/60 rounded-2xl p-4 flex items-center gap-4 text-right transition-all duration-300 active:scale-[0.98] hover:shadow-[0_8px_24px_rgb(var(--c-primary)/0.18)] hover:-translate-y-0.5 overflow-hidden"
                >
                  <div className="absolute top-0 bottom-0 right-0 w-1"
                    style={{ background: meta.color }} />
                  <div className="relative flex-shrink-0">
                    <div className="absolute inset-0 rounded-2xl blur-md opacity-0 group-hover/task:opacity-50 transition-opacity"
                      style={{ background: meta.color }} />
                    <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center border-2 group-hover/task:scale-110 group-hover/task:rotate-3 transition-transform duration-300"
                      style={{ background: `linear-gradient(135deg, ${meta.bg}, ${meta.bg}AA)`, borderColor: meta.border }}>
                      <meta.icon size={28} weight="regular" style={{ color: meta.color }} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-base text-ink">{meta.label}</p>
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-primary bg-background border border-primary/30 px-2 py-0.5 rounded-full">
                        <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                        معلقة
                      </span>
                    </div>
                    <p className="text-[11px] text-muted mt-0.5 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-primary" />
                      {task.scheduledDate}
                    </p>
                  </div>
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-background flex items-center justify-center group-hover/task:bg-primary group-hover/task:-translate-x-1 transition-all duration-300">
                    <ArrowLeft size={16} className="text-primary group-hover/task:text-white transition-colors" weight="bold" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {items.length > 0 && pending.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl py-10 text-center">
            <CheckCircle2 size={32} className="mx-auto text-green-400 mb-2" weight="light" />
            <p className="text-green-700 font-bold text-sm">جميع مهام هذا المركز مكتملة</p>
            <p className="text-green-600 text-xs mt-1">تحقق من سجل نشاط المراقبين في الصفحة الرئيسية</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SupMealcheck() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { profile } = useAuth();

  const centerId    = state?.centerId || '—';
  const catererName = getCaterer(centerId) || '—';

  const [tasks,       setTasks]       = useState([]);
  const [completions, setCompletions] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  useEffect(() => {
    const uid = profile?.uid;
    if (!uid || !centerId || centerId === '—') { setTasksLoading(false); return; }
    let t1 = false, t2 = false;
    const done = () => { if (t1 && t2) setTasksLoading(false); };

    const u1 = db.assigned_tasks.subscribe(all => {
      setTasks(all.filter(t => t.targetCenters?.includes(centerId)));
      t1 = true; done();
    });
    const u2 = db.task_completions.subscribe(all => {
      setCompletions(all.filter(c => c.center === centerId));
      t2 = true; done();
    });
    return () => { u1?.(); u2?.(); };
  }, [profile?.uid, centerId]);

  const [selectedTask, setSelectedTask] = useState(null);
  const [screen, setScreen] = useState('phases');
  const [phaseDone,   setPhaseDone]   = useState({ 1: false, 2: false, 3: false });
  const [phasePhotos, setPhasePhotos] = useState({ 1: null,  2: null,  3: null  });
  const [phaseUploading, setPhaseUploading] = useState({ 1: false, 2: false, 3: false });
  const fileRefs = [useRef(null), useRef(null), useRef(null)];
  const [answers, setAnswers] = useState({});
  const [qPhotos, setQPhotos] = useState({});
  const [qPhotoUploading, setQPhotoUploading] = useState({});
  const qPhotoInputRefs = useRef({});
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!selectedTask || !profile?.uid) return;
    setScreen('phases');
    setPhaseDone({ 1: false, 2: false, 3: false });
    setPhasePhotos({ 1: null, 2: null, 3: null });
    setAnswers({});
    setQPhotos({});
    setRestored(false);
    try {
      const raw = localStorage.getItem(STORAGE_KEY(profile.uid, selectedTask.taskId, selectedTask.mealType));
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.answers && Object.keys(data.answers).length > 0) {
        setAnswers(data.answers);
        if (data.qPhotos) setQPhotos(data.qPhotos);
        if (data.screen) setScreen(data.screen);
        setRestored(true);
      }
    } catch {}
  }, [selectedTask?.taskId, selectedTask?.mealType, profile?.uid]);

  useEffect(() => {
    if (!selectedTask || !centerId || centerId === '—' || !profile?.uid) return;
    const docId      = `${centerId}_d${selectedTask.day}_${selectedTask.mealType}`;
    const storageKey = STORAGE_KEY(profile.uid, selectedTask.taskId, selectedTask.mealType);
    return db.meal_phases.subscribe(rows => {
      const row = rows.find(r => r.id === docId);
      if (!row) {
        localStorage.removeItem(storageKey);
        setPhaseDone({ 1: false, 2: false, 3: false });
        setPhasePhotos({ 1: null, 2: null, 3: null });
        setAnswers({});
        setScreen('phases');
        setRestored(false);
      } else {
        setPhaseDone({ 1: !!row.phase1, 2: !!row.phase2, 3: !!row.phase3 });
      }
    });
  }, [selectedTask?.taskId, selectedTask?.mealType, centerId, profile?.uid]);

  useEffect(() => {
    if (!selectedTask || !profile?.uid) return;
    localStorage.setItem(
      STORAGE_KEY(profile.uid, selectedTask.taskId, selectedTask.mealType),
      JSON.stringify({ screen, answers, qPhotos })
    );
  }, [screen, answers, qPhotos, selectedTask, profile?.uid]);

  const handleQPhotoChange = async (qid, file) => {
    if (!file) return;
    setQPhotoUploading(prev => ({ ...prev, [qid]: true }));
    try {
      const compressed = await compressImage(file);
      const date = selectedTask?.scheduledDate || 'undated';
      const url = await uploadFile(
        STORAGE_BUCKETS.phases,
        `mealcheck/${centerId}/${date}/${selectedTask?.mealType || 'meal'}/q${qid}_${Date.now()}.jpg`,
        compressed,
      );
      setQPhotos(prev => ({ ...prev, [qid]: url }));
    } catch (err) {
      console.error('[SupMealcheck question photo]', err);
      alert(`فشل رفع الصورة: ${err?.message || err}`);
    } finally {
      setQPhotoUploading(prev => ({ ...prev, [qid]: false }));
    }
  };

  const removeQPhoto = (qid) => setQPhotos(prev => {
    const next = { ...prev };
    delete next[qid];
    return next;
  });

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
    if (!centerId || centerId === '—' || !selectedTask) return;

    setPhasePhotos(prev => ({ ...prev, [id]: file }));
    setPhaseUploading(prev => ({ ...prev, [id]: true }));
    try {
      const docId = `${centerId}_d${selectedTask.day}_${selectedTask.mealType}`;
      const compressed = await compressImage(file);
      const photoUrl = await uploadFile(
        STORAGE_BUCKETS.phases,
        `${docId}/phase${id}_${Date.now()}.jpg`,
        compressed,
      );
      await db.meal_phases.upsert({
        id:             docId,
        center:         centerId,
        day:            selectedTask.day,
        mealId:         selectedTask.mealType,
        [`phase${id}`]:      serverTimestamp(),
        [`phase${id}Photo`]: photoUrl,
        [`phase${id}Uid`]:   profile?.uid,
        updatedAt:      serverTimestamp(),
      });
      setPhaseDone(prev => ({ ...prev, [id]: true }));
    } catch (err) {
      console.error('[SupMealcheck phase upload]', err);
      setPhasePhotos(prev => ({ ...prev, [id]: null }));
      alert(`فشل رفع الصورة: ${err?.message || err}`);
    } finally {
      setPhaseUploading(prev => ({ ...prev, [id]: false }));
    }
  };

  const phases            = buildPhases(selectedTask?.categories);
  const allPhasesComplete = phases.every(p => phaseDone[p.id]);
  const handleAnswer = (id, val) => setAnswers(prev => ({ ...prev, [id]: val }));

  const handleSubmit = async () => {
    if (Object.keys(answers).length < QUESTIONS.length) {
      alert('يرجى الإجابة على جميع المعايير قبل الإرسال');
      return;
    }
    const photoRequiredIds = QUESTIONS.filter(q => q.requiresPhoto).map(q => q.id);
    const missingPhotos = photoRequiredIds.filter(id => answers[id] && !qPhotos[id]);
    if (missingPhotos.length > 0) {
      alert(`الأسئلة التالية تحتاج صورة: ${missingPhotos.join('، ')}`);
      return;
    }
    setLoadingSubmit(true);
    try {
      const totalScore   = computeMealScore(answers);
      const maxScore     = MEAL_MAX_SCORE;
      const scoreOutOf10 = maxScore > 0 ? parseFloat(((totalScore / maxScore) * 10).toFixed(2)) : 0;
      const percentage   = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
      await db.meal_evaluations.insert({
        uid:           profile?.uid,
        center:        centerId,
        caterer:       catererName,
        observer:      profile?.nameAr || profile?.name || 'مشرف',
        answers:       { ...answers, __photos: qPhotos },
        totalScore,
        maxScore,
        scoreOutOf10,
        percentage:    parseFloat(percentage.toFixed(1)),
        mealType:      selectedTask?.mealType || null,
        scheduledDate: selectedTask?.scheduledDate || null,
        timestamp:     serverTimestamp(),
      });
      await db.task_completions.insert({
        taskId:        selectedTask?.taskId,
        taskType:      'meal_evaluation',
        mealType:      selectedTask?.mealType,
        scheduledDate: selectedTask?.scheduledDate,
        center:        centerId,
        uid:           profile?.uid,
        observerName:  profile?.nameAr || profile?.name || 'مشرف',
        timestamp:     serverTimestamp(),
      });
      localStorage.removeItem(STORAGE_KEY(profile?.uid, selectedTask?.taskId, selectedTask?.mealType));
      alert('تم إرسال التقييم بنجاح');
      setSelectedTask(null);
    } catch (err) {
      console.error('[SupMealcheck submit]', err);
      alert(`حدث خطأ أثناء الإرسال: ${err?.message || err}`);
    }
    finally { setLoadingSubmit(false); }
  };

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

  if (screen === 'phases') {
    const completedCount = phases.filter(p => phaseDone[p.id]).length;
    const totalPhases    = phases.length;
    return (
      <div dir="rtl" className="min-h-screen bg-canvas pb-32 font-arabic">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-line w-full px-4 py-3 mb-6 shadow-sm">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <button onClick={() => setSelectedTask(null)} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 rounded-xl transition">
              <ChevronRight className="text-primary" size={22} weight="bold" />
            </button>
            <h1 className="text-base font-bold text-ink absolute left-1/2 -translate-x-1/2 whitespace-nowrap">مراحل تقييم الوجبة</h1>
            <div className="w-10" />
          </div>
        </header>

        <div className="max-w-xl mx-auto px-4 space-y-4">
          {restored && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
              <RotateCcw size={14} className="text-blue-500 flex-shrink-0" weight="regular" />
              <p className="text-blue-700 text-[12px] font-bold flex-1">تم استعادة تقدمك من الجلسة السابقة</p>
              <button onClick={clearProgress} className="text-blue-400 hover:text-blue-600 text-[11px] font-bold underline flex-shrink-0">مسح</button>
            </div>
          )}

          <div className="rounded-[2rem] p-6 text-white bg-ink shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${meta.color}22` }}>
                <meta.icon size={22} weight="regular" style={{ color: meta.color }} />
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
                <div className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${(completedCount / totalPhases) * 100}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { lbl: 'المشرف',  val: profile?.nameAr || profile?.name, cls: 'text-white' },
                { lbl: 'المركز',  val: centerId,                          cls: 'text-primary' },
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
              const isUnlocked  = idx === 0 || phaseDone[phases[idx - 1].id];
              const isDone      = phaseDone[phase.id];
              const isUploading = phaseUploading[phase.id];
              const isRestored  = isDone && !phasePhotos[phase.id];
              const ref         = fileRefs[idx];
              const stepNum     = idx + 1;
              return (
                <div key={phase.id} className={`group/phase relative rounded-2xl border-2 p-5 transition-all duration-300 overflow-hidden ${
                  isDone
                    ? 'bg-gradient-to-br from-green-50 via-white to-emerald-50/40 border-green-300 shadow-[0_6px_20px_rgba(34,197,94,0.18)]'
                    : isUnlocked
                      ? 'bg-gradient-to-br from-white via-white to-background/40 border-line hover:border-primary/40 hover:shadow-[0_6px_20px_rgb(var(--c-primary)/0.15)]'
                      : 'bg-gradient-to-br from-gray-50 to-gray-100/40 border-gray-200 opacity-60'
                }`}>
                  {(isDone || isUnlocked) && (
                    <div className="absolute top-0 right-0 left-0 h-1"
                      style={{ background: isDone
                        ? 'linear-gradient(90deg, #16A34A, #22C55E, #16A34A)'
                        : 'linear-gradient(90deg, transparent, rgb(var(--c-primary)), transparent)' }} />
                  )}
                  <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden"
                    disabled={!isUnlocked} onChange={e => handlePhotoChange(phase.id, e.target.files[0])} />
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      {isUnlocked && !isDone && (
                        <div className="absolute inset-0 rounded-2xl blur-md bg-primary opacity-0 group-hover/phase:opacity-50 transition-opacity" />
                      )}
                      {isDone && (
                        <div className="absolute inset-0 rounded-2xl blur-md bg-green-400 opacity-40" />
                      )}
                      <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-300 ${
                        isDone
                          ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-md group-hover/phase:scale-110'
                          : isUnlocked
                            ? 'bg-gradient-to-br from-background to-primary-100 border-2 border-primary/25 group-hover/phase:scale-110 group-hover/phase:rotate-3'
                            : 'bg-gray-100 border border-gray-200'
                      }`}>
                        {isDone
                          ? <CheckCircle2 size={26} className="text-white" weight="bold" />
                          : isUnlocked
                            ? <span className="text-primary font-black text-xl tabular-nums">{stepNum}</span>
                            : <Lock size={20} className="text-gray-300" weight="light" />}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-base ${isDone ? 'text-green-700' : isUnlocked ? 'text-ink' : 'text-gray-400'}`}>
                        {phase.label}
                      </p>
                      {isDone
                        ? <p className="text-[11px] text-green-600 font-semibold mt-1 flex items-center gap-1.5">
                            <CheckCircle2 size={12} weight="bold" />
                            {isRestored ? 'تم توثيق هذه المرحلة في جلسة سابقة' : `تم رفع الصورة — ${phasePhotos[phase.id]?.name}`}
                          </p>
                        : <p className="text-[11px] text-muted mt-1 flex items-center gap-1.5">
                            {!isUnlocked && <Lock size={10} className="text-gray-300" />}
                            {isUnlocked ? phase.desc : 'أكمل المرحلة السابقة أولاً'}
                          </p>
                      }
                    </div>
                    {isUnlocked && (
                      <button onClick={() => !isUploading && ref.current?.click()}
                        disabled={isUploading}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-70 disabled:cursor-wait ${
                          isDone
                            ? 'bg-white border-2 border-green-300 text-green-600 hover:bg-green-50 hover:border-green-400'
                            : 'text-white shadow-[0_4px_14px_rgb(var(--c-primary)/0.4)] active:scale-95 hover:shadow-[0_6px_20px_rgb(var(--c-primary)/0.5)]'
                        }`}
                        style={isDone ? undefined : { background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))' }}
                      >
                        {isUploading
                          ? <><Loader2 size={14} className="animate-spin" weight="bold" /> جارٍ الرفع...</>
                          : <><Camera size={14} weight="bold" /> {isDone ? 'تغيير' : 'رفع صورة'}</>}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white/90 backdrop-blur-md border-t border-line z-50">
          <div className="max-w-xl mx-auto">
            {!allPhasesComplete && (
              <p className="text-center text-[11px] text-muted font-semibold mb-2">
                ارفع صورة لكل مرحلة لتتمكن من بدء التقييم
              </p>
            )}
            <button onClick={() => setScreen('questions')} disabled={!allPhasesComplete}
              className={`min-h-[56px] w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all duration-300 ${
                allPhasesComplete
                  ? 'text-white shadow-[0_8px_28px_rgb(var(--c-primary)/0.4)] hover:shadow-[0_10px_36px_rgb(var(--c-primary)/0.5)] active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              style={allPhasesComplete ? { background: 'linear-gradient(135deg, rgb(var(--c-primary-400)) 0%, rgb(var(--c-primary)) 50%, rgb(var(--c-primary-700)) 100%)' } : undefined}>
              {allPhasesComplete
                ? <>بدء التقييم <ArrowLeft size={18} weight="bold" /></>
                : <>{totalPhases - completedCount} مراحل متبقية</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  return (
    <div dir="rtl" className="min-h-screen bg-canvas pb-32 font-arabic">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-line w-full px-4 py-3 mb-6 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button onClick={() => setScreen('phases')} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 rounded-xl transition">
            <ChevronRight className="text-primary" size={22} weight="bold" />
          </button>
          <h1 className="text-base font-bold text-ink absolute left-1/2 -translate-x-1/2 whitespace-nowrap">تقييم جودة الوجبات</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {restored && answeredCount > 0 && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
            <RotateCcw size={14} className="text-blue-500 flex-shrink-0" weight="regular" />
            <p className="text-blue-700 text-[12px] font-bold">تم استعادة {answeredCount} إجابة محفوظة</p>
          </div>
        )}

        <div className="rounded-[2.5rem] p-6 text-white shadow-lg bg-ink">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${meta.color}22` }}>
              <meta.icon size={22} weight="regular" style={{ color: meta.color }} />
            </div>
            <div>
              <h2 className="text-xl font-bold">{QUESTIONS.length} معياراً للجودة</h2>
              <p className="text-white/40 text-[10px] font-bold">{meta.label} — {selectedTask.scheduledDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {phases.map(p => (
              <span key={p.id} className="flex items-center gap-1 bg-green-500/20 text-green-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-500/30">
                <CheckCircle2 size={10} weight="bold" /> {p.label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { lbl: 'المشرف',  val: profile?.nameAr || '—', cls: 'text-white' },
              { lbl: 'المركز',  val: centerId || '—',         cls: 'text-primary' },
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
            const ans = answers[q.id];
            const isYes = ans === 'نعم';
            const isNo  = ans === 'لا';
            const goodIsYes = !q.negative;
            const yesGood = goodIsYes ? isYes : false;
            const noGood  = goodIsYes ? false : isNo;
            return (
              <React.Fragment key={q.id}>
                {isFirstInCategory && (
                  <div className="col-span-full pt-6 pb-3 flex items-center gap-3">
                    <div className="flex-grow h-px bg-gradient-to-l from-transparent via-primary/40 to-transparent" />
                    <span className="px-5 py-2 rounded-full text-white text-xs font-black shadow-[0_4px_14px_rgb(var(--c-primary)/0.35)]"
                      style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))' }}>
                      {q.category}
                    </span>
                    <div className="flex-grow h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                  </div>
                )}
                <div className={`group/q relative bg-gradient-to-br from-white via-white to-background/40 rounded-3xl shadow-[0_2px_12px_rgb(var(--c-ink)/0.05)] overflow-hidden transition-all duration-300 ${
                  ans
                    ? 'border-2 border-primary/40 shadow-[0_6px_24px_rgb(var(--c-primary)/0.18)]'
                    : 'border border-line hover:shadow-[0_4px_18px_rgb(var(--c-ink)/0.08)]'
                }`}>
                  {ans && (
                    <div className="absolute top-0 right-0 left-0 h-1"
                      style={{ background: yesGood || noGood
                        ? 'linear-gradient(90deg, #16A34A, #22C55E, #16A34A)'
                        : 'linear-gradient(90deg, #DC2626, #EF4444, #DC2626)' }} />
                  )}
                  <div className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="relative flex-shrink-0">
                        <div className="absolute inset-0 rounded-2xl blur-md bg-primary opacity-30 group-hover/q:opacity-50 transition-opacity" />
                        <div className="relative w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-md tabular-nums"
                          style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))' }}>
                          {q.id}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        {ans && (
                          <div className="mb-1.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700">
                              <CheckCircle2 size={9} weight="bold" />
                              مُجاب
                            </span>
                          </div>
                        )}
                        <p className="text-ink font-bold text-[15px] leading-relaxed">{q.text}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleAnswer(q.id, 'نعم')}
                        className={`min-h-[52px] py-3.5 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-2.5 active:scale-[0.98] ${
                          isYes
                            ? `text-white scale-[1.02] shadow-[0_6px_20px_${yesGood ? 'rgb(var(--c-success) / 0.4)' : 'rgb(var(--c-error) / 0.4)'}]`
                            : 'bg-white text-muted border-2 border-line hover:border-primary/40 hover:bg-background'
                        }`}
                        style={isYes ? {
                          background: yesGood
                            ? 'linear-gradient(135deg, #16A34A, #15803D)'
                            : 'linear-gradient(135deg, #DC2626, #B91C1C)'
                        } : undefined}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${isYes ? 'bg-white/25 scale-110' : 'bg-success/10'}`}>
                          <CheckCircle2 size={16} weight="bold" className={isYes ? 'text-white' : 'text-success'} />
                        </div>
                        <span className="text-[15px]">نعم</span>
                      </button>
                      <button
                        onClick={() => handleAnswer(q.id, 'لا')}
                        className={`min-h-[52px] py-3.5 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-2.5 active:scale-[0.98] ${
                          isNo
                            ? `text-white scale-[1.02] shadow-[0_6px_20px_${noGood ? 'rgb(var(--c-success) / 0.4)' : 'rgb(var(--c-error) / 0.4)'}]`
                            : 'bg-white text-muted border-2 border-line hover:border-red-300 hover:bg-red-50/30'
                        }`}
                        style={isNo ? {
                          background: noGood
                            ? 'linear-gradient(135deg, #16A34A, #15803D)'
                            : 'linear-gradient(135deg, #DC2626, #B91C1C)'
                        } : undefined}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${isNo ? 'bg-white/25 scale-110' : 'bg-error/10'}`}>
                          <Ban size={16} weight="bold" className={isNo ? 'text-white' : 'text-error'} />
                        </div>
                        <span className="text-[15px]">لا</span>
                      </button>
                    </div>

                    {q.requiresPhoto && ans && (
                      <div className="mt-3">
                        <input
                          ref={el => { qPhotoInputRefs.current[q.id] = el; }}
                          type="file" accept="image/*" capture="environment"
                          className="hidden"
                          onChange={e => handleQPhotoChange(q.id, e.target.files[0])}
                        />
                        {qPhotos[q.id] ? (
                          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-2.5">
                            <img src={qPhotos[q.id]} alt="" className="w-14 h-14 rounded-lg object-cover border border-green-300" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-green-700 flex items-center gap-1.5">
                                <CheckCircle2 size={13} weight="bold" /> تم رفع الصورة
                              </p>
                              <p className="text-[10px] text-green-600 mt-0.5">اضغط للتغيير</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button onClick={() => qPhotoInputRefs.current[q.id]?.click()}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-green-700 bg-white border border-green-300 hover:bg-green-50">
                                تغيير
                              </button>
                              <button onClick={() => removeQPhoto(q.id)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 bg-white border border-red-200 hover:bg-red-50">
                                <X size={13} weight="bold" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => !qPhotoUploading[q.id] && qPhotoInputRefs.current[q.id]?.click()}
                            disabled={qPhotoUploading[q.id]}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-primary/40 bg-background text-primary font-bold text-sm hover:bg-primary-50 hover:border-primary transition-all disabled:opacity-60 disabled:cursor-wait"
                          >
                            {qPhotoUploading[q.id]
                              ? <><Loader2 size={16} className="animate-spin" /> جارٍ رفع الصورة...</>
                              : <><Camera size={16} weight="bold" /> رفع صورة مرفقة (مطلوبة)</>}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white/90 backdrop-blur-md border-t border-line z-50">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] text-muted font-semibold">{answeredCount} / {QUESTIONS.length} سؤال</span>
            <span className="text-[11px] text-primary font-bold">{Math.round((answeredCount / QUESTIONS.length) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / QUESTIONS.length) * 100}%` }} />
          </div>
          <button onClick={handleSubmit} disabled={loadingSubmit}
            className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all disabled:bg-gray-400">
            <Save size={20} />
            {loadingSubmit ? 'جاري الإرسال...' : 'حفظ وإرسال التقرير النهائي'}
          </button>
        </div>
      </div>
    </div>
  );
}
