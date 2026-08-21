import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ClipboardText as ClipboardList,
  Prohibit as Ban,
  CircleNotch as Loader2,
  X,
} from '@phosphor-icons/react';
import { db, serverTimestamp, uploadFile, STORAGE_BUCKETS } from '../lib/db.js';
import { compressImage } from '../lib/imageCompression.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getCaterer } from '../config/centers.js';
import { useAssignedTasks, extractDay, MEAL_META } from '../hooks/useAssignedTasks.js';
import { MEAL_QUESTIONS, MEAL_MAX_SCORE, computeMealScore } from '../config/mealQuestions.js';
import { Surface, IconTile, Pill, EmptyState } from '../components/ui/index.jsx';

/* Every tinted surface on this screen is derived from the one colour the thing
   it holds already owns, so a meal's amber and a pass's green never drift. */
const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

const PRIMARY = 'rgb(var(--c-primary))';
const INFO    = 'rgb(var(--c-info))';
const OK      = '#15803D';
const BAD     = '#DC2626';

/* ── Phases ──
   Phase 2 (cooking) is skipped for the «وجبة جافة» (dry) category since
   dry meals are not cooked on-site. Picking happens at runtime in
   buildPhases() below, keyed off the assigned task's meal_categories. */
const PHASES = [
  { id: 1, label: 'مرحلة التجهيز',          desc: 'ارفع صورة لمرحلة تجهيز المواد الخام' },
  { id: 2, label: 'مرحلة الطبخ',             desc: 'ارفع صورة أثناء عملية الطبخ'         },
  { id: 3, label: 'مرحلة التعبئة والتوزيع',  desc: 'ارفع صورة لتعبئة وتوزيع الوجبات'    },
];

/* Returns the phase list for a given assignment.
   - dry-only category (meal_categories === ['dry']) → 2 phases (skip cooking)
   - anything else (no categories, mixed, cooked, sterilized) → 3 phases */
function buildPhases(categories) {
  const isDryOnly = Array.isArray(categories)
    && categories.length === 1
    && categories[0] === 'dry';
  return isDryOnly ? [PHASES[0], PHASES[2]] : PHASES;
}

/* ── Questions — source of truth in src/config/mealQuestions.js ── */
const QUESTIONS = MEAL_QUESTIONS;

const STORAGE_KEY = (uid, taskId, mealType) => `mealcheck_${uid}_${taskId}_${mealType}`;

/* ── Task Gate Screen ── */
function TaskGate({ profile, tasks, completions, loading, onSelect }) {
  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center font-arabic">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Expand tasks into individual (taskId, mealType) items
  const items = [];
  tasks
    .filter(t => t.taskTypes?.includes('meal_evaluation'))
    .forEach(task => {
      const mealTypes = task.mealTypes?.length > 0 ? task.mealTypes : [];
      mealTypes.forEach(mealType => {
        const done = completions.some(c => c.taskId === task.id && c.mealType === mealType);
        items.push({ task, mealType, done });
      });
    });

  const pending   = items.filter(i => !i.done);
  const completed = items.filter(i => i.done);

  return (
    <div dir="rtl" className="min-h-screen bg-canvas pb-10 font-arabic">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-line w-full px-4 py-3 mb-6">
        <div className="max-w-xl mx-auto flex items-center gap-2">
          <button onClick={() => window.history.back()} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-[rgb(var(--c-bg))] rounded-[10px] transition-colors">
            <ChevronRight className="text-primary" size={22} weight="bold" />
          </button>
          <h1 className="flex-1 text-center text-[15px] font-bold text-ink truncate">تقييم جودة الوجبات</h1>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 space-y-5">
        {/* Observer card */}
        <div className="rounded-[14px] p-5 text-white bg-ink">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-11 h-11 rounded-[11px] flex items-center justify-center shrink-0 border border-white/10 bg-white/[0.06]">
              <Utensils className="text-accent" size={21} weight="duotone" />
            </span>
            <div>
              <p className="text-accent/80 text-[10px] font-bold uppercase tracking-[0.18em]">مهام التقييم</p>
              <h2 className="text-[16px] font-bold mt-1">الوجبات</h2>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { lbl: 'المراقب', val: profile?.nameAr || profile?.name, cls: 'text-white' },
              { lbl: 'المركز',  val: profile?.center,                   cls: 'text-accent' },
              { lbl: 'المتعهد', val: profile?.caterer || getCaterer(profile?.center), cls: 'text-white' },
            ].map(c => (
              <div key={c.lbl} className="bg-white/[0.06] rounded-[10px] px-2 py-2.5 border border-white/10 text-center min-w-0">
                <p className="text-white/45 text-[10px] mb-1 truncate">{c.lbl}</p>
                <p className={`font-bold text-[11px] truncate ${c.cls}`} title={c.val || ''}>{c.val || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* No tasks at all */}
        {items.length === 0 && (
          <Surface>
            <EmptyState Icon={Ban} title="لا توجد مهام حالياً" hint="لم تُسند إليك أي مهام تقييم لمركزك بعد" />
          </Surface>
        )}

        {/* Pending tasks */}
        {pending.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 px-1">
              <span className="w-1 h-3.5 rounded-full bg-primary" />
              <p className="text-[11px] font-bold text-primary uppercase tracking-wider">مهام معلقة</p>
              <Pill color={PRIMARY}>{pending.length}</Pill>
            </div>
            {pending.map(({ task, mealType }) => {
              const meta = MEAL_META[mealType] || {};
              const c    = meta.color || PRIMARY;
              return (
                <button key={`${task.id}_${mealType}`}
                  onClick={() => onSelect({ taskId: task.id, mealType, scheduledDate: task.scheduledDate, day: extractDay(task.scheduledDate), categories: task.mealCategories || [] })}
                  className="group relative w-full text-start rounded-[14px] border p-4 flex items-center gap-3.5 overflow-hidden
                             shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow duration-200
                             hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)]"
                  style={{ background: tint(c, 12), borderColor: tint(c, 28) }}
                >
                  <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: c }} />
                  <IconTile Icon={meta.icon} color={c} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[14.5px] text-ink truncate">{meta.label}</p>
                    <p className="text-[11.5px] font-medium text-muted mt-1">{task.scheduledDate}</p>
                  </div>
                  <ArrowLeft size={15} weight="bold" className="shrink-0 text-muted/40 group-hover:text-muted transition-colors" />
                </button>
              );
            })}
          </div>
        )}

        {/* Completed tasks */}
        {completed.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 px-1 mt-4">
              <span className="w-1 h-3.5 rounded-full" style={{ background: OK }} />
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: OK }}>مكتملة</p>
              <Pill color={OK}>{completed.length}</Pill>
            </div>
            {completed.map(({ task, mealType }) => {
              const meta = MEAL_META[mealType] || {};
              return (
                <div key={`${task.id}_${mealType}_done`}
                  className="relative rounded-[14px] border p-4 flex items-center gap-3.5 overflow-hidden"
                  style={{ background: tint(OK, 12), borderColor: tint(OK, 28) }}>
                  <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: OK }} />
                  <IconTile Icon={meta.icon} color={OK} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[14.5px] truncate" style={{ color: OK }}>{meta.label}</p>
                    <p className="text-[11.5px] font-medium text-muted mt-1">{task.scheduledDate}</p>
                  </div>
                  <span className="shrink-0">
                    <Pill color={OK} solid Icon={CheckCircle2}>تم</Pill>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [phaseUploading, setPhaseUploading] = useState({ 1: false, 2: false, 3: false });
  const fileRefs = [useRef(null), useRef(null), useRef(null)];

  /* ── Questions ── */
  const [answers, setAnswers] = useState({});
  const [qPhotos, setQPhotos] = useState({});               // { [qid]: url }
  const [qPhotoUploading, setQPhotoUploading] = useState({}); // { [qid]: bool }
  const qPhotoInputRefs = useRef({});
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [restored, setRestored] = useState(false);

  /* ── Reset + restore answers from localStorage when task changes ── */
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
    if (!selectedTask || !profile?.center || !profile?.uid) return;
    const docId      = `${profile.center}_d${selectedTask.day}_${selectedTask.mealType}`;
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
  }, [selectedTask?.taskId, selectedTask?.mealType, profile?.center, profile?.uid]);

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
      const center = profile?.center || 'unknown';
      const date = selectedTask?.scheduledDate || 'undated';
      const url = await uploadFile(
        STORAGE_BUCKETS.phases,
        `mealcheck/${center}/${date}/${selectedTask?.mealType || 'meal'}/q${qid}_${Date.now()}.jpg`,
        compressed,
      );
      setQPhotos(prev => ({ ...prev, [qid]: url }));
    } catch (err) {
      console.error('[Mealcheck question photo]', err);
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
    if (selectedTask && profile?.uid) {
      localStorage.removeItem(STORAGE_KEY(profile.uid, selectedTask.taskId, selectedTask.mealType));
    }
    setScreen('phases');
    setPhasePhotos({ 1: null, 2: null, 3: null });
    setAnswers({});
    setRestored(false);
  };

  const handlePhotoChange = async (id, file) => {
    if (!file) return;
    const center = profile?.center;
    if (!center || !selectedTask) return;

    setPhasePhotos(prev => ({ ...prev, [id]: file }));
    setPhaseUploading(prev => ({ ...prev, [id]: true }));
    try {
      const docId = `${center}_d${selectedTask.day}_${selectedTask.mealType}`;
      const compressed = await compressImage(file);
      const photoUrl = await uploadFile(
        STORAGE_BUCKETS.phases,
        `${docId}/phase${id}_${Date.now()}.jpg`,
        compressed,
      );
      await db.meal_phases.upsert({
        id:             docId,
        center,
        day:            selectedTask.day,
        mealId:         selectedTask.mealType,
        [`phase${id}`]:      serverTimestamp(),
        [`phase${id}Photo`]: photoUrl,
        [`phase${id}Uid`]:   profile?.uid,
        updatedAt:      serverTimestamp(),
      });
      /* Mark done optimistically — don't wait for the realtime echo. */
      setPhaseDone(prev => ({ ...prev, [id]: true }));
    } catch (err) {
      console.error('[Mealcheck phase upload]', err);
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
        uid: profile?.uid,
        center: profile?.center || 'N/A',
        caterer: profile?.caterer || getCaterer(profile?.center),
        observer: profile?.nameAr || profile?.name || 'مراقب',
        answers: { ...answers, __photos: qPhotos },
        totalScore,
        maxScore,
        scoreOutOf10,
        percentage: parseFloat(percentage.toFixed(1)),
        mealType: selectedTask?.mealType || null,
        scheduledDate: selectedTask?.scheduledDate || null,
        timestamp: serverTimestamp(),
      });
      await db.task_completions.insert({
        taskId: selectedTask?.taskId,
        taskType: 'meal_evaluation',
        mealType: selectedTask?.mealType,
        scheduledDate: selectedTask?.scheduledDate,
        center: profile?.center,
        uid: profile?.uid,
        observerName: profile?.nameAr || profile?.name || 'مراقب',
        timestamp: serverTimestamp(),
      });
      localStorage.removeItem(STORAGE_KEY(profile?.uid, selectedTask?.taskId, selectedTask?.mealType));
      alert('تم إرسال التقييم بنجاح');
      setSelectedTask(null);
    } catch (err) {
      console.error('[Mealcheck submit]', err);
      alert(`حدث خطأ أثناء الإرسال: ${err?.message || err}`);
    }
    finally { setLoadingSubmit(false); }
  };

  if (!selectedTask) {
    return <TaskGate profile={profile} tasks={tasks} completions={completions} loading={loading} onSelect={setSelectedTask} />;
  }

  const meta = MEAL_META[selectedTask.mealType] || {};

  if (screen === 'phases') {
    const completedCount = phases.filter(p => phaseDone[p.id]).length;
    const totalPhases    = phases.length;
    return (
      <div dir="rtl" className="min-h-screen bg-canvas pb-32 font-arabic">
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-line w-full px-4 py-3 mb-6">
          <div className="max-w-xl mx-auto flex items-center gap-2">
            <button onClick={() => setSelectedTask(null)} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-[rgb(var(--c-bg))] rounded-[10px] transition-colors">
              <ChevronRight className="text-primary" size={22} weight="bold" />
            </button>
            <h1 className="flex-1 text-center text-[15px] font-bold text-ink truncate">
              مراحل تقييم الوجبة
            </h1>
            <div className="w-10 shrink-0" />
          </div>
        </header>

        <div className="max-w-xl mx-auto px-4 space-y-4">
          {restored && (
            <div className="flex items-center gap-3 rounded-[14px] border px-4 py-3"
              style={{ background: tint(INFO, 12), borderColor: tint(INFO, 28) }}>
              <RotateCcw size={14} className="shrink-0" weight="bold" style={{ color: INFO }} />
              <p className="text-[12px] font-bold flex-1" style={{ color: INFO }}>تم استعادة تقدمك من الجلسة السابقة</p>
              <button onClick={clearProgress} className="shrink-0 min-h-[40px] px-2 text-[11.5px] font-bold text-muted hover:text-ink transition-colors">مسح</button>
            </div>
          )}

          <div className="rounded-[14px] p-5 text-white bg-ink">
            <div className="flex items-center gap-3 mb-5">
              <span className="w-11 h-11 rounded-[11px] flex items-center justify-center shrink-0 border border-white/10 bg-white/[0.06]">
                <meta.icon size={21} weight="duotone" style={{ color: meta.color }} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] truncate" style={{ color: meta.color }}>{meta.label} — {selectedTask.scheduledDate}</p>
                <h2 className="text-[17px] font-bold mt-1">توثيق مراحل الوجبة</h2>
              </div>
            </div>
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/50 text-[11px] font-medium">التقدم</p>
                <p className="text-white/75 text-[11px] font-bold tabular-nums">{completedCount} / {totalPhases}</p>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${(completedCount / totalPhases) * 100}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { lbl: 'المراقب', val: profile?.nameAr || profile?.name, cls: 'text-white' },
                { lbl: 'المركز',  val: profile?.center,                   cls: 'text-accent' },
                { lbl: 'المتعهد', val: profile?.caterer || getCaterer(profile?.center), cls: 'text-white' },
              ].map(c => (
                <div key={c.lbl} className="bg-white/[0.06] rounded-[10px] px-2 py-2.5 border border-white/10 text-center min-w-0">
                  <p className="text-white/45 text-[10px] mb-1 truncate">{c.lbl}</p>
                  <p className={`font-bold text-[11px] truncate ${c.cls}`}>{c.val || '—'}</p>
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
                <div key={phase.id}
                  className={`relative rounded-[14px] border p-4 overflow-hidden shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] ${
                    isUnlocked ? '' : 'bg-[rgb(var(--c-bg))] border-line opacity-60'
                  }`}
                  style={isUnlocked
                    ? (isDone
                        ? { background: tint(OK, 12), borderColor: tint(OK, 28) }
                        : { background: '#fff', borderColor: 'rgb(var(--c-line))' })
                    : undefined}>
                  {isUnlocked && (
                    <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: isDone ? OK : PRIMARY }} />
                  )}
                  <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden"
                    disabled={!isUnlocked} onChange={e => handlePhotoChange(phase.id, e.target.files[0])} />
                  <div className="flex items-center gap-3.5">
                    {isDone ? (
                      <IconTile Icon={CheckCircle2} color={OK} size="lg" />
                    ) : isUnlocked ? (
                      <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                        style={{ background: tint(PRIMARY, 9), borderColor: tint(PRIMARY, 22) }}>
                        <span className="text-primary font-extrabold text-[19px] tabular-nums">{stepNum}</span>
                      </span>
                    ) : (
                      <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-line bg-white">
                        <Lock size={19} className="text-muted/40" weight="bold" />
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-[14.5px] ${isDone ? '' : isUnlocked ? 'text-ink' : 'text-muted'}`}
                        style={isDone ? { color: OK } : undefined}>
                        {phase.label}
                      </p>
                      {isDone
                        ? <p className="text-[11.5px] font-medium mt-1 flex items-center gap-1.5" style={{ color: OK }}>
                            <CheckCircle2 size={12} weight="bold" className="shrink-0" />
                            {isRestored ? 'تم توثيق هذه المرحلة في جلسة سابقة' : `تم رفع الصورة — ${phasePhotos[phase.id]?.name}`}
                          </p>
                        : <p className="text-[11.5px] font-medium text-muted mt-1 flex items-center gap-1.5">
                            {!isUnlocked && <Lock size={10} weight="bold" className="text-muted/40 shrink-0" />}
                            {isUnlocked ? phase.desc : 'أكمل المرحلة السابقة أولاً'}
                          </p>
                      }
                    </div>
                    {isUnlocked && (
                      <button onClick={() => !isUploading && ref.current?.click()}
                        disabled={isUploading}
                        className={`shrink-0 min-h-[40px] flex items-center gap-1.5 px-3.5 py-2.5 rounded-[10px] text-[12px] font-bold border transition-colors disabled:opacity-70 disabled:cursor-wait ${
                          isDone
                            ? 'bg-white hover:bg-[rgb(var(--c-bg))]'
                            : 'bg-primary border-primary text-white hover:bg-primary-700'
                        }`}
                        style={isDone ? { color: OK, borderColor: tint(OK, 34) } : undefined}
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

        <div className="fixed bottom-0 inset-x-0 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-md border-t border-line z-50">
          <div className="max-w-xl mx-auto">
                        <button onClick={() => setScreen('questions')} disabled={!allPhasesComplete}
              className={`min-h-[56px] w-full py-4 rounded-[14px] font-bold text-[15px] border flex items-center justify-center gap-2.5 transition-colors ${
                allPhasesComplete
                  ? 'bg-primary border-primary text-white hover:bg-primary-700'
                  : 'bg-[rgb(var(--c-bg))] border-line text-muted cursor-not-allowed'
              }`}>
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
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-line w-full px-4 py-3 mb-6">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <button onClick={() => setScreen('phases')} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-[rgb(var(--c-bg))] rounded-[10px] transition-colors">
            <ChevronRight className="text-primary" size={22} weight="bold" />
          </button>
          <h1 className="flex-1 text-center text-[15px] font-bold text-ink truncate">تقييم جودة الوجبات</h1>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {restored && answeredCount > 0 && (
          <div className="flex items-center gap-3 rounded-[14px] border px-4 py-3"
            style={{ background: tint(INFO, 12), borderColor: tint(INFO, 28) }}>
            <RotateCcw size={14} className="shrink-0" weight="bold" style={{ color: INFO }} />
            <p className="text-[12px] font-bold" style={{ color: INFO }}>تم استعادة {answeredCount} إجابة محفوظة</p>
          </div>
        )}

        <div className="rounded-[14px] p-5 text-white bg-ink">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-11 h-11 rounded-[11px] flex items-center justify-center shrink-0 border border-white/10 bg-white/[0.06]">
              <meta.icon size={21} weight="duotone" style={{ color: meta.color }} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[18px] font-bold">{QUESTIONS.length} معياراً للجودة</h2>
              <p className="text-white/50 text-[11px] font-medium mt-1 truncate">{meta.label} — {selectedTask.scheduledDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {phases.map(p => (
              <span key={p.id} className="inline-flex items-center gap-1 bg-white/[0.06] text-green-300 text-[10.5px] font-bold px-2 py-[3px] rounded-md border border-white/10 leading-none">
                <CheckCircle2 size={10} weight="bold" /> {p.label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { lbl: 'المراقب', val: profile?.nameAr || '—', cls: 'text-white' },
              { lbl: 'المركز',  val: profile?.center  || '—', cls: 'text-accent' },
              { lbl: 'المتعهد', val: profile?.caterer || getCaterer(profile?.center) || '—', cls: 'text-white' },
            ].map(c => (
              <div key={c.lbl} className="bg-white/[0.06] rounded-[10px] px-2 py-2.5 border border-white/10 text-center min-w-0">
                <p className="text-white/45 text-[10px] mb-1 truncate">{c.lbl}</p>
                <p className={`font-bold text-[11px] truncate ${c.cls}`}>{c.val}</p>
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
            /* Negative questions: "لا" is the good answer */
            const goodIsYes = !q.negative;
            const yesGood = goodIsYes ? isYes : false;
            const noGood  = goodIsYes ? false : isNo;
            const yesBad  = goodIsYes ? false : isYes;
            const noBad   = goodIsYes ? isNo  : false;
            /* The card takes the colour of the answer it now holds. */
            const tone    = ans ? ((yesGood || noGood) ? OK : BAD) : PRIMARY;
            return (
              <React.Fragment key={q.id}>
                {isFirstInCategory && (
                  <div className="col-span-full pt-6 pb-3 flex items-center gap-3">
                    <div className="flex-grow h-px bg-line" />
                    <span className="px-4 py-1.5 rounded-full text-[11.5px] font-bold border whitespace-nowrap"
                      style={{ background: tint(PRIMARY, 12), borderColor: tint(PRIMARY, 28), color: PRIMARY }}>
                      {q.category}
                    </span>
                    <div className="flex-grow h-px bg-line" />
                  </div>
                )}
                <div className="relative bg-white rounded-[14px] border overflow-hidden
                                shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow duration-200
                                hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)]"
                  style={{ borderColor: ans ? tint(tone, 30) : 'rgb(var(--c-line))' }}>
                  {ans && <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: tone }} />}

                  <div className="p-4 sm:p-5">
                    {/* Header: number badge + tags */}
                    <div className="flex items-start gap-3 mb-3.5">
                      <span className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border text-[14px] font-bold tabular-nums"
                        style={{ background: tint(PRIMARY, 9), borderColor: tint(PRIMARY, 22), color: PRIMARY }}>
                        {q.id}
                      </span>
                      <div className="flex-1 min-w-0">
                        {ans && (
                          <div className="mb-1.5">
                            <Pill color={tone} Icon={CheckCircle2}>مُجاب</Pill>
                          </div>
                        )}
                        <p className="text-ink font-bold text-[14.5px] leading-relaxed">{q.text}</p>
                      </div>
                    </div>

                    {/* Yes / No — the answer is the only colour in the card */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleAnswer(q.id, 'نعم')}
                        className={`min-h-[52px] py-3.5 rounded-[11px] font-bold border transition-colors flex items-center justify-center gap-2.5 ${
                          isYes ? 'text-white' : 'bg-white text-muted border-line hover:bg-[rgb(var(--c-bg))]'
                        }`}
                        style={isYes
                          ? { background: yesGood ? OK : BAD, borderColor: yesGood ? OK : BAD }
                          : undefined}
                      >
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isYes ? 'bg-white/20' : 'bg-success/10'}`}>
                          <CheckCircle2 size={16} weight="bold" className={isYes ? 'text-white' : 'text-success'} />
                        </span>
                        <span className="text-[15px]">نعم</span>
                      </button>
                      <button
                        onClick={() => handleAnswer(q.id, 'لا')}
                        className={`min-h-[52px] py-3.5 rounded-[11px] font-bold border transition-colors flex items-center justify-center gap-2.5 ${
                          isNo ? 'text-white' : 'bg-white text-muted border-line hover:bg-[rgb(var(--c-bg))]'
                        }`}
                        style={isNo
                          ? { background: noGood ? OK : BAD, borderColor: noGood ? OK : BAD }
                          : undefined}
                      >
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isNo ? 'bg-white/20' : 'bg-error/10'}`}>
                          <Ban size={16} weight="bold" className={isNo ? 'text-white' : 'text-error'} />
                        </span>
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
                          <div className="flex items-center gap-3 rounded-[11px] border p-2.5"
                            style={{ background: tint(OK, 12), borderColor: tint(OK, 28) }}>
                            <img src={qPhotos[q.id]} alt="" className="w-14 h-14 rounded-[10px] object-cover border" style={{ borderColor: tint(OK, 28) }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-bold flex items-center gap-1.5" style={{ color: OK }}>
                                <CheckCircle2 size={13} weight="bold" className="shrink-0" /> تم رفع الصورة
                              </p>
                              <p className="text-[10.5px] font-medium text-muted mt-1">اضغط للتغيير</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button onClick={() => qPhotoInputRefs.current[q.id]?.click()}
                                className="min-h-[40px] px-3 rounded-[10px] text-[11.5px] font-bold bg-white border hover:bg-[rgb(var(--c-bg))] transition-colors"
                                style={{ color: OK, borderColor: tint(OK, 34) }}>
                                تغيير
                              </button>
                              <button onClick={() => removeQPhoto(q.id)}
                                className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-white border hover:bg-[rgb(var(--c-bg))] transition-colors"
                                style={{ color: BAD, borderColor: tint(BAD, 28) }}>
                                <X size={13} weight="bold" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => !qPhotoUploading[q.id] && qPhotoInputRefs.current[q.id]?.click()}
                            disabled={qPhotoUploading[q.id]}
                            className="w-full min-h-[44px] flex items-center justify-center gap-2 py-3 rounded-[11px] border border-dashed text-primary font-bold text-[13px] transition-colors disabled:opacity-60 disabled:cursor-wait"
                            style={{ background: tint(PRIMARY, 9), borderColor: tint(PRIMARY, 34) }}
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

      <div className="fixed bottom-0 inset-x-0 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-md border-t border-line z-50">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] text-muted font-medium tabular-nums">{answeredCount} / {QUESTIONS.length} سؤال</span>
            <span className="text-[11px] text-primary font-bold tabular-nums">{Math.round((answeredCount / QUESTIONS.length) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-[rgb(var(--c-bg))] border border-line rounded-full mb-3 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / QUESTIONS.length) * 100}%` }} />
          </div>
          <button onClick={handleSubmit} disabled={loadingSubmit}
            className="w-full min-h-[56px] bg-primary border border-primary text-white py-4 rounded-[14px] font-bold text-[15px] flex items-center justify-center gap-2.5 hover:bg-primary-700 transition-colors disabled:bg-[rgb(var(--c-bg))] disabled:border-line disabled:text-muted">
            <Save size={19} weight="bold" />
            {loadingSubmit ? 'جاري الإرسال...' : 'حفظ وإرسال التقرير النهائي'}
          </button>
        </div>
      </div>
    </div>
  );
}
