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
  CircleNotch as Loader2,
  X,
} from '@phosphor-icons/react';
import { db, serverTimestamp, uploadFile, STORAGE_BUCKETS } from '../../lib/db.js';
import { compressImage } from '../../lib/imageCompression.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getCaterer } from '../../config/centers.js';
import { extractDay, MEAL_META } from '../../hooks/useAssignedTasks.js';
import { MEAL_QUESTIONS, MEAL_MAX_SCORE, computeMealScore } from '../../config/mealQuestions.js';
import { Surface } from '../../components/ui/index.jsx';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

const NAVY  = 'rgb(var(--c-primary))';
const GREEN = '#15803D';
const RED   = '#DC2626';
const INFO  = 'rgb(var(--c-info))';

/* The identity block every screen here repeats: who, where, which caterer. */
function IdentityGrid({ color, cells }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {cells.map(c => (
        <div
          key={c.lbl}
          className="bg-white rounded-[11px] px-2.5 py-2.5 border text-center min-w-0"
          style={{ borderColor: tint(color, 22) }}
        >
          <p className="text-[10px] font-semibold text-muted mb-1 truncate">{c.lbl}</p>
          <p className="text-[12px] font-bold text-ink truncate" title={c.val || ''}>{c.val || '—'}</p>
        </div>
      ))}
    </div>
  );
}

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
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-line w-full px-4 py-3 mb-6">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <button onClick={() => window.history.back()} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-[rgb(var(--c-bg))] rounded-[10px] transition-colors">
            <ChevronRight className="text-primary" size={22} weight="bold" />
          </button>
          <h1 className="text-base font-bold text-ink absolute left-1/2 -translate-x-1/2 whitespace-nowrap">تقييم جودة الوجبات</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 space-y-5">
        <div
          className="rounded-[14px] border p-5 shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]"
          style={{ background: tint(NAVY, 12), borderColor: tint(NAVY, 28) }}
        >
          <div className="flex items-center gap-3.5 mb-5">
            <span
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
              style={{ background: tint(NAVY, 9), borderColor: tint(NAVY, 22) }}
            >
              <Utensils size={21} weight="duotone" style={{ color: NAVY }} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] leading-none" style={{ color: NAVY }}>مهام التقييم</p>
              <h2 className="text-[19px] font-extrabold text-ink mt-1.5 leading-tight">الوجبات</h2>
            </div>
          </div>
          <IdentityGrid
            color={NAVY}
            cells={[
              { lbl: 'المشرف', val: profile?.nameAr || profile?.name },
              { lbl: 'المركز', val: centerId },
              { lbl: 'المتعهد', val: catererName },
            ]}
          />
        </div>

        {items.length === 0 && (
          <Surface className="py-14 px-5 text-center">
            <Ban size={26} weight="duotone" className="mx-auto text-muted/35" />
            <p className="text-[13px] font-semibold text-muted mt-3">لا توجد مهام حالياً</p>
            <p className="text-[11.5px] font-medium text-muted/70 mt-1">لم تُسند مهام تقييم لهذا المركز بعد</p>
          </Surface>
        )}

        {pending.length > 0 && (
          <Surface className="overflow-hidden">
            <div
              className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b"
              style={{ background: tint(NAVY, 12), borderColor: tint(NAVY, 28) }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border"
                  style={{ background: tint(NAVY, 9), borderColor: tint(NAVY, 22) }}
                >
                  <Utensils size={18} weight="duotone" style={{ color: NAVY }} />
                </span>
                <p className="text-[14px] font-bold truncate leading-tight" style={{ color: NAVY }}>مهام معلقة</p>
              </div>
              <span
                className="text-[10.5px] font-bold px-1.5 py-[3px] rounded-md tabular-nums leading-none shrink-0"
                style={{ background: tint(NAVY, 11), color: NAVY }}
              >
                {pending.length}
              </span>
            </div>

            {pending.map(({ task, mealType }, i) => {
              const meta = MEAL_META[mealType] || {};
              return (
                <button key={`${task.id}_${mealType}`}
                  onClick={() => onSelect({ taskId: task.id, mealType, scheduledDate: task.scheduledDate, day: extractDay(task.scheduledDate), categories: task.mealCategories || [] })}
                  className={`group/task relative w-full text-start flex items-center gap-3.5 ps-5 pe-4 py-3.5 transition-colors hover:bg-[rgb(var(--c-bg))] ${
                    i === pending.length - 1 ? '' : 'border-b border-line'
                  }`}
                >
                  <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: meta.color }} />
                  <span
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                    style={{ background: tint(meta.color, 9), borderColor: tint(meta.color, 22) }}
                  >
                    <meta.icon size={21} weight="duotone" style={{ color: meta.color }} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-bold text-ink leading-tight">{meta.label}</span>
                      <span
                        className="text-[10.5px] font-bold px-1.5 py-[3px] rounded-md leading-none"
                        style={{ background: tint(meta.color, 11), color: meta.color }}
                      >
                        معلقة
                      </span>
                    </span>
                    <span className="block text-[11.5px] font-medium text-ink/75 mt-1.5">{task.scheduledDate}</span>
                  </span>
                  <ArrowLeft size={15} weight="bold" className="shrink-0 text-muted/40 group-hover/task:text-muted transition-colors" />
                </button>
              );
            })}
          </Surface>
        )}

        {items.length > 0 && pending.length === 0 && (
          <div
            className="rounded-[14px] border py-10 px-5 text-center"
            style={{ background: tint(GREEN, 12), borderColor: tint(GREEN, 28) }}
          >
            <CheckCircle2 size={26} weight="duotone" style={{ color: GREEN }} className="mx-auto" />
            <p className="text-[14px] font-bold mt-3" style={{ color: GREEN }}>جميع مهام هذا المركز مكتملة</p>
            <p className="text-[11.5px] font-medium text-muted mt-1.5">تحقق من سجل نشاط المراقبين في الصفحة الرئيسية</p>
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
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-line w-full px-4 py-3 mb-6">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <button onClick={() => setSelectedTask(null)} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-[rgb(var(--c-bg))] rounded-[10px] transition-colors">
              <ChevronRight className="text-primary" size={22} weight="bold" />
            </button>
            <h1 className="text-base font-bold text-ink absolute left-1/2 -translate-x-1/2 whitespace-nowrap">مراحل تقييم الوجبة</h1>
            <div className="w-10" />
          </div>
        </header>

        <div className="max-w-xl mx-auto px-4 space-y-4">
          {restored && (
            <div
              className="flex items-center gap-3 rounded-[14px] border px-4 py-3"
              style={{ background: tint(INFO, 12), borderColor: tint(INFO, 28) }}
            >
              <RotateCcw size={14} weight="bold" style={{ color: INFO }} className="shrink-0" />
              <p className="text-[12px] font-bold flex-1" style={{ color: INFO }}>تم استعادة تقدمك من الجلسة السابقة</p>
              <button onClick={clearProgress} className="text-[11.5px] font-bold text-muted hover:text-ink transition-colors shrink-0">مسح</button>
            </div>
          )}

          <div
            className="rounded-[14px] border p-5 shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]"
            style={{ background: tint(meta.color, 12), borderColor: tint(meta.color, 28) }}
          >
            <div className="flex items-center gap-3.5 mb-5">
              <span
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                style={{ background: tint(meta.color, 9), borderColor: tint(meta.color, 22) }}
              >
                <meta.icon size={21} weight="duotone" style={{ color: meta.color }} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] leading-none" style={{ color: meta.color }}>{meta.label} — {selectedTask.scheduledDate}</p>
                <h2 className="text-[19px] font-extrabold text-ink mt-1.5 leading-tight">توثيق مراحل الوجبة</h2>
              </div>
            </div>
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-muted">التقدم</p>
                <p className="text-[11px] font-bold text-ink tabular-nums">{completedCount} / {totalPhases}</p>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: tint(meta.color, 22) }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(completedCount / totalPhases) * 100}%`, background: meta.color }} />
              </div>
            </div>
            <IdentityGrid
              color={meta.color}
              cells={[
                { lbl: 'المشرف',  val: profile?.nameAr || profile?.name },
                { lbl: 'المركز',  val: centerId },
                { lbl: 'المتعهد', val: catererName },
              ]}
            />
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
                <div
                  className={`relative rounded-[14px] border p-4 overflow-hidden shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] ${
                    isUnlocked ? '' : 'opacity-60'
                  }`}
                  style={
                    isDone
                      ? { background: tint(GREEN, 12), borderColor: tint(GREEN, 28) }
                      : isUnlocked
                        ? { background: '#fff', borderColor: 'rgb(var(--c-line))' }
                        : { background: 'rgb(var(--c-bg))', borderColor: 'rgb(var(--c-line))' }
                  }
                >
                  {(isDone || isUnlocked) && (
                    <span className="absolute inset-y-0 start-0 w-[3px]"
                      style={{ background: isDone ? GREEN : NAVY }} />
                  )}
                  <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden"
                    disabled={!isUnlocked} onChange={e => handlePhotoChange(phase.id, e.target.files[0])} />
                  <div className="flex items-center gap-3.5">
                    <span
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                      style={
                        isDone
                          ? { background: tint(GREEN, 9), borderColor: tint(GREEN, 22) }
                          : isUnlocked
                            ? { background: tint(NAVY, 9), borderColor: tint(NAVY, 22) }
                            : { background: '#fff', borderColor: 'rgb(var(--c-line))' }
                      }
                    >
                      {isDone
                        ? <CheckCircle2 size={21} weight="duotone" style={{ color: GREEN }} />
                        : isUnlocked
                          ? <span className="text-[19px] font-extrabold tabular-nums" style={{ color: NAVY }}>{stepNum}</span>
                          : <Lock size={18} weight="duotone" className="text-muted/45" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold" style={{ color: isDone ? GREEN : isUnlocked ? 'rgb(var(--c-ink))' : 'rgb(var(--c-muted))' }}>
                        {phase.label}
                      </p>
                      {isDone
                        ? <p className="text-[11.5px] font-medium mt-1 flex items-center gap-1.5" style={{ color: GREEN }}>
                            <CheckCircle2 size={12} weight="bold" />
                            {isRestored ? 'تم توثيق هذه المرحلة في جلسة سابقة' : `تم رفع الصورة — ${phasePhotos[phase.id]?.name}`}
                          </p>
                        : <p className="text-[11.5px] font-medium text-muted mt-1 flex items-center gap-1.5">
                            {!isUnlocked && <Lock size={11} weight="bold" className="text-muted/50" />}
                            {isUnlocked ? phase.desc : 'أكمل المرحلة السابقة أولاً'}
                          </p>
                      }
                    </div>
                    {isUnlocked && (
                      <button onClick={() => !isUploading && ref.current?.click()}
                        disabled={isUploading}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12px] font-bold border transition-colors disabled:opacity-70 disabled:cursor-wait ${
                          isDone
                            ? 'bg-white border-line text-ink hover:bg-[rgb(var(--c-bg))]'
                            : 'bg-primary border-primary text-white hover:bg-[rgb(var(--c-primary-700))]'
                        }`}
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
              className={`min-h-[52px] w-full py-3.5 rounded-[12px] font-bold text-[15px] flex items-center justify-center gap-2.5 border transition-colors ${
                allPhasesComplete
                  ? 'bg-primary border-primary text-white hover:bg-[rgb(var(--c-primary-700))]'
                  : 'bg-[rgb(var(--c-bg))] border-line text-muted/60 cursor-not-allowed'
              }`}>
              {allPhasesComplete
                ? <>بدء التقييم <ArrowLeft size={17} weight="bold" /></>
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
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-line w-full px-4 py-3 mb-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button onClick={() => setScreen('phases')} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-[rgb(var(--c-bg))] rounded-[10px] transition-colors">
            <ChevronRight className="text-primary" size={22} weight="bold" />
          </button>
          <h1 className="text-base font-bold text-ink absolute left-1/2 -translate-x-1/2 whitespace-nowrap">تقييم جودة الوجبات</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {restored && answeredCount > 0 && (
          <div
            className="flex items-center gap-3 rounded-[14px] border px-4 py-3"
            style={{ background: tint(INFO, 12), borderColor: tint(INFO, 28) }}
          >
            <RotateCcw size={14} weight="bold" style={{ color: INFO }} className="shrink-0" />
            <p className="text-[12px] font-bold" style={{ color: INFO }}>تم استعادة {answeredCount} إجابة محفوظة</p>
          </div>
        )}

        <div
          className="rounded-[14px] border p-5 shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]"
          style={{ background: tint(meta.color, 12), borderColor: tint(meta.color, 28) }}
        >
          <div className="flex items-center gap-3.5 mb-4">
            <span
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
              style={{ background: tint(meta.color, 9), borderColor: tint(meta.color, 22) }}
            >
              <meta.icon size={21} weight="duotone" style={{ color: meta.color }} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] leading-none" style={{ color: meta.color }}>{meta.label} — {selectedTask.scheduledDate}</p>
              <h2 className="text-[19px] font-extrabold text-ink mt-1.5 leading-tight">{QUESTIONS.length} معياراً للجودة</h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mb-4 flex-wrap">
            {phases.map(p => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 text-[10.5px] font-bold px-1.5 py-[3px] rounded-md leading-none whitespace-nowrap"
                style={{ background: tint(GREEN, 11), color: GREEN }}
              >
                <CheckCircle2 size={10} weight="bold" /> {p.label}
              </span>
            ))}
          </div>
          <IdentityGrid
            color={meta.color}
            cells={[
              { lbl: 'المشرف',  val: profile?.nameAr || '—' },
              { lbl: 'المركز',  val: centerId || '—' },
              { lbl: 'المتعهد', val: catererName || '—' },
            ]}
          />
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
                    <div className="flex-grow h-px bg-line" />
                    <span
                      className="px-3 py-1.5 rounded-[10px] text-[11.5px] font-bold border"
                      style={{ background: tint(NAVY, 12), borderColor: tint(NAVY, 28), color: NAVY }}
                    >
                      {q.category}
                    </span>
                    <div className="flex-grow h-px bg-line" />
                  </div>
                )}
                <div
                  className="relative bg-white rounded-[14px] border overflow-hidden shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow duration-200 hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)]"
                  style={{ borderColor: ans ? tint(yesGood || noGood ? GREEN : RED, 28) : 'rgb(var(--c-line))' }}
                >
                  {ans && (
                    <span className="absolute inset-y-0 start-0 w-[3px]"
                      style={{ background: yesGood || noGood ? GREEN : RED }} />
                  )}
                  <div className="p-4 ps-5">
                    <div className="flex items-start gap-3 mb-3.5">
                      <span
                        className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border text-[14px] font-bold tabular-nums"
                        style={{ background: tint(NAVY, 9), borderColor: tint(NAVY, 22), color: NAVY }}
                      >
                        {q.id}
                      </span>
                      <div className="flex-1 min-w-0">
                        {ans && (
                          <div className="mb-1.5">
                            <span
                              className="inline-flex items-center gap-1 text-[10.5px] font-bold px-1.5 py-[3px] rounded-md leading-none"
                              style={{ background: tint(GREEN, 11), color: GREEN }}
                            >
                              <CheckCircle2 size={10} weight="bold" />
                              مُجاب
                            </span>
                          </div>
                        )}
                        <p className="text-ink font-bold text-[14px] leading-relaxed">{q.text}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        onClick={() => handleAnswer(q.id, 'نعم')}
                        className="min-h-[48px] py-3 rounded-[11px] font-bold border transition-colors flex items-center justify-center gap-2"
                        style={isYes
                          ? { background: tint(yesGood ? GREEN : RED, 12), borderColor: yesGood ? GREEN : RED, color: yesGood ? GREEN : RED }
                          : { background: '#fff', borderColor: 'rgb(var(--c-line))', color: 'rgb(var(--c-muted))' }}
                      >
                        <CheckCircle2 size={17} weight="duotone" />
                        <span className="text-[14px]">نعم</span>
                      </button>
                      <button
                        onClick={() => handleAnswer(q.id, 'لا')}
                        className="min-h-[48px] py-3 rounded-[11px] font-bold border transition-colors flex items-center justify-center gap-2"
                        style={isNo
                          ? { background: tint(noGood ? GREEN : RED, 12), borderColor: noGood ? GREEN : RED, color: noGood ? GREEN : RED }
                          : { background: '#fff', borderColor: 'rgb(var(--c-line))', color: 'rgb(var(--c-muted))' }}
                      >
                        <Ban size={17} weight="duotone" />
                        <span className="text-[14px]">لا</span>
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
                          <div
                            className="flex items-center gap-3 rounded-[11px] border p-2.5"
                            style={{ background: tint(GREEN, 12), borderColor: tint(GREEN, 28) }}
                          >
                            <img src={qPhotos[q.id]} alt="" className="w-14 h-14 rounded-[10px] object-cover border" style={{ borderColor: tint(GREEN, 28) }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-bold flex items-center gap-1.5" style={{ color: GREEN }}>
                                <CheckCircle2 size={13} weight="bold" /> تم رفع الصورة
                              </p>
                              <p className="text-[10.5px] font-medium text-muted mt-1">اضغط للتغيير</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button onClick={() => qPhotoInputRefs.current[q.id]?.click()}
                                className="px-3 py-1.5 rounded-[10px] text-[11.5px] font-bold text-ink bg-white border border-line hover:bg-[rgb(var(--c-bg))] transition-colors">
                                تغيير
                              </button>
                              <button onClick={() => removeQPhoto(q.id)}
                                className="w-7 h-7 rounded-[10px] flex items-center justify-center bg-white border transition-colors"
                                style={{ borderColor: tint(RED, 28), color: RED }}>
                                <X size={13} weight="bold" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => !qPhotoUploading[q.id] && qPhotoInputRefs.current[q.id]?.click()}
                            disabled={qPhotoUploading[q.id]}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-[11px] border border-dashed font-bold text-[13px] transition-colors disabled:opacity-60 disabled:cursor-wait"
                            style={{ background: tint(NAVY, 9), borderColor: tint(NAVY, 30), color: NAVY }}
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
            <span className="text-[11px] text-muted font-semibold tabular-nums">{answeredCount} / {QUESTIONS.length} سؤال</span>
            <span className="text-[11px] text-primary font-bold tabular-nums">{Math.round((answeredCount / QUESTIONS.length) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-[rgb(var(--c-bg))] rounded-full mb-3 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / QUESTIONS.length) * 100}%` }} />
          </div>
          <button onClick={handleSubmit} disabled={loadingSubmit}
            className="w-full bg-primary border border-primary text-white py-3.5 rounded-[12px] font-bold text-[15px] flex items-center justify-center gap-2.5 transition-colors hover:bg-[rgb(var(--c-primary-700))] disabled:bg-[rgb(var(--c-bg))] disabled:border-line disabled:text-muted/60">
            <Save size={18} weight="bold" />
            {loadingSubmit ? 'جاري الإرسال...' : 'حفظ وإرسال التقرير النهائي'}
          </button>
        </div>
      </div>
    </div>
  );
}
