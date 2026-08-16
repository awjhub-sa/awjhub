import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CaretRight as ChevronRight,
  FloppyDisk as Save,
  CheckCircle as CheckCircle2,
  WarningCircle as AlertCircle,
  House as Home,
  ArrowLeft,
  Prohibit as Ban,
  CalendarBlank as Calendar,
  Camera,
  CircleNotch as Loader2,
  X,
  MagnifyingGlass as Search,
  MapPin,
  Check,
} from '@phosphor-icons/react';
import { db, serverTimestamp, uploadFile, STORAGE_BUCKETS } from '../../lib/db.js';
import { compressImage } from '../../lib/imageCompression.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getCaterer, CENTERS } from '../../config/centers.js';
import { computeReadinessTotals } from '../../config/readinessScore.js';
import { MINA_SECTIONS, MINA_ALL_CRITERIA } from '../../config/minaQuestions.js';

const SECTIONS      = MINA_SECTIONS;
const ALL_CRITERIA  = MINA_ALL_CRITERIA;
const REQUIRED_IDS  = ALL_CRITERIA.filter(c => c.type !== 'choice' && c.type !== 'yesno_detail').map(c => c.id);

export default function SupMinaReadiness() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { profile } = useAuth();

  /* TEMP: sweep mode — when supervisor sweeps all of Mina without prior assignment.
     Triggered by navigating with state.sweepMode = true. Remove the entry point
     in SupervisorHome to disable. */
  const sweepMode = state?.sweepMode === true;
  const [sweepCenter, setSweepCenter] = useState(null);
  const [centerSearch, setCenterSearch] = useState('');

  const centerId    = sweepMode ? (sweepCenter || '—') : (state?.centerId || '—');
  const catererName = centerId && centerId !== '—' ? (getCaterer(centerId) || '—') : '—';

  const [answers,     setAnswers]     = useState({});
  const [details,     setDetails]     = useState({});
  const [photos,      setPhotos]      = useState({});
  const [uploadingPhotos, setUploadingPhotos] = useState({});
  const [loading,     setLoading]     = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const photoInputRefs = useRef({});

  
  const [tasks,        setTasks]        = useState([]);
  const [completions,  setCompletions]  = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  useEffect(() => {
    /* In sweep mode we skip the assigned-task pipeline entirely */
    if (sweepMode) { setTasksLoading(false); return; }
    const uid = profile?.uid;
    if (!uid || !centerId || centerId === '—') { setTasksLoading(false); return; }
    let t1 = false, t2 = false;
    const done = () => { if (t1 && t2) setTasksLoading(false); };

    const u1 = db.assigned_tasks.subscribe(rows => {
      setTasks(rows.filter(t => t.targetCenters?.includes(centerId)));
      t1 = true; done();
    });
    const u2 = db.task_completions.subscribe(rows => {
      setCompletions(rows.filter(c => c.center === centerId));
      t2 = true; done();
    });
    return () => { u1(); u2(); };
  }, [profile?.uid, centerId, sweepMode]);

  const minaTasks   = tasks.filter(t => t.taskTypes?.includes('mina_readiness'));
  const isDone      = (task) => completions.some(c => c.taskId === task.id && c.taskType === 'mina_readiness');
  const pendingTasks = minaTasks.filter(t => !isDone(t));
  const doneTasks    = minaTasks.filter(t => isDone(t));

  /* Centers this supervisor already submitted Mina readiness for today —
     used to show a green check in the sweep-mode picker. */
  const [myDoneToday, setMyDoneToday] = useState(new Set());
  useEffect(() => {
    if (!sweepMode || !profile?.uid) return;
    /* 00:00 Riyadh = UTC-3 of today's Riyadh calendar day */
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Riyadh', year: 'numeric', month: 'numeric', day: 'numeric',
    });
    const parts = fmt.formatToParts(new Date());
    const y = parseInt(parts.find(p => p.type === 'year').value, 10);
    const m = parseInt(parts.find(p => p.type === 'month').value, 10);
    const d = parseInt(parts.find(p => p.type === 'day').value, 10);
    const todayStart = Date.UTC(y, m - 1, d, -3, 0, 0, 0);

    const unsub = db.mina_readiness.subscribe(rows => {
      const set = new Set();
      rows.forEach(r => {
        const ts = r.timestamp?.toMillis?.() ?? (r.timestamp ? new Date(r.timestamp).getTime() : 0);
        if (r.uid === profile.uid && ts >= todayStart) set.add(r.center);
      });
      setMyDoneToday(set);
    });
    return () => unsub?.();
  }, [sweepMode, profile?.uid]);

  const handleAnswer = (id, value) => setAnswers(prev => ({ ...prev, [id]: value }));
  const handleDetail = (id, value) => setDetails(prev => ({ ...prev, [id]: value }));

  const handlePhotoChange = async (qid, file) => {
    if (!file) return;
    setUploadingPhotos(prev => ({ ...prev, [qid]: true }));
    try {
      const compressed = await compressImage(file);
      const date = selectedTask?.scheduledDate || 'undated';
      const url = await uploadFile(
        STORAGE_BUCKETS.phases,
        `readiness/mina/${centerId}/${date}/q${qid}_${Date.now()}.jpg`,
        compressed,
      );
      setPhotos(prev => ({ ...prev, [qid]: url }));
    } catch (err) {
      console.error('[SupMinaReadiness photo upload]', err);
      alert(`فشل رفع الصورة: ${err?.message || err}`);
    } finally {
      setUploadingPhotos(prev => ({ ...prev, [qid]: false }));
    }
  };

  const removePhoto = (qid) => setPhotos(prev => {
    const next = { ...prev };
    delete next[qid];
    return next;
  });

  const handleSubmit = async () => {
    const unanswered = REQUIRED_IDS.filter(id => !answers[id]);
    if (unanswered.length > 0) { alert(`المتبقي: ${unanswered.length} بند`); return; }
    const photoRequiredIds = ALL_CRITERIA.filter(c => c.requiresPhoto).map(c => c.id);
    const missingPhotos = photoRequiredIds.filter(id => answers[id] && !photos[id]);
    if (missingPhotos.length > 0) {
      alert(`الأسئلة التالية تحتاج صورة: ${missingPhotos.join('، ')}`);
      return;
    }
    setLoading(true);
    try {
      const scoring = computeReadinessTotals(ALL_CRITERIA, answers);
      await db.mina_readiness.insert({
        observer:      profile?.nameAr || profile?.name || 'مشرف',
        center:        centerId,
        caterer:       catererName,
        uid:           profile?.uid || null,
        role:          'supervisor',
        answers:       { ...answers, __details: details, __photos: photos },
        ...scoring,
        scheduledDate: selectedTask?.scheduledDate || null,
        timestamp:     serverTimestamp(),
      });
      if (selectedTask?.taskId) {
        await db.task_completions.insert({
          taskId:        selectedTask.taskId,
          taskType:      'mina_readiness',
          mealType:      null,
          scheduledDate: selectedTask.scheduledDate || null,
          center:        centerId,
          uid:           profile?.uid || null,
          observerName:  profile?.nameAr || profile?.name || 'مشرف',
          timestamp:     serverTimestamp(),
        });
      }
      alert('تم إرسال التقييم بنجاح');
      setSelectedTask(null);
      setAnswers({});
      setDetails({});
      setPhotos({});
      /* In sweep mode, reset center pick so supervisor can go to next center */
      if (sweepMode) setSweepCenter(null);
    } catch (e) {
      console.error('[SupMinaReadiness submit]', e);
      alert(`خطأ في الإرسال: ${e?.message || e}`);
    }
    setLoading(false);
  };

  /* All centers, filtered by search box (only used in sweep mode) */
  const filteredCenters = useMemo(() => {
    if (!sweepMode) return [];
    const q = centerSearch.trim();
    if (!q) return CENTERS;
    return CENTERS.filter(c =>
      c.id.includes(q) ||
      (c.caterer && c.caterer.includes(q))
    );
  }, [sweepMode, centerSearch]);

  /* Sweep mode — center picker (shown before the form when no center is picked) */
  if (sweepMode && !sweepCenter) {
    return (
      <div dir="rtl" className="min-h-screen bg-canvas pb-28 font-arabic px-4 md:px-8">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-line w-full px-4 md:px-8 py-3 mb-6 shadow-sm">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <button onClick={() => navigate('/supervisor-home')} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 rounded-xl transition shrink-0">
              <ChevronRight className="text-primary" size={22} weight="bold" />
            </button>
            <h1 className="text-base font-bold text-ink absolute left-1/2 -translate-x-1/2 whitespace-nowrap">جاهزية منى — اختر المركز</h1>
            <div className="w-10 shrink-0" />
          </div>
        </header>

        <div className="max-w-3xl mx-auto space-y-4">
          <div className="bg-gradient-to-br from-ink-800 via-ink to-[#1F1A17] rounded-3xl p-5 shadow-lg flex items-center gap-3">
            <div className="bg-gradient-to-br from-primary-400 to-primary p-3 rounded-2xl shadow-md">
              <MapPin size={22} className="text-white" weight="bold" />
            </div>
            <div>
              <p className="text-primary text-[10px] font-black uppercase tracking-widest mb-0.5">جاهزية منى</p>
              <h2 className="text-white text-lg font-bold leading-snug">اختر المركز لرفع تقييم الجاهزية</h2>
              <p className="text-white/60 text-xs mt-1">تقدر تختار أي مركز بدون الحاجة لإسناد مسبق.</p>
            </div>
          </div>

          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary" weight="bold" />
            <input
              type="text"
              value={centerSearch}
              onChange={e => setCenterSearch(e.target.value)}
              placeholder="ابحث برقم المركز أو المتعهد..."
              className="w-full pr-10 pl-4 py-3 bg-white border border-line rounded-2xl text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {filteredCenters.length === 0 ? (
            <div className="bg-white rounded-2xl py-14 text-center border border-line">
              <Ban size={32} className="mx-auto text-line mb-2" weight="light" />
              <p className="text-muted text-sm font-bold">لا توجد مراكز مطابقة للبحث</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredCenters.map(c => {
                const done = myDoneToday.has(c.id);
                return (
                  <button key={c.id}
                    onClick={() => {
                      setSweepCenter(c.id);
                      setSelectedTask({ taskId: null, scheduledDate: null });
                    }}
                    className={`group/ctr relative rounded-2xl p-3 text-right border-2 transition-all active:scale-[0.98] ${
                      done
                        ? 'bg-gradient-to-br from-green-50 to-white border-green-300 hover:border-green-500 hover:shadow-[0_6px_18px_rgba(34,197,94,0.20)]'
                        : 'bg-gradient-to-br from-white to-background/60 border-line hover:border-primary hover:shadow-[0_6px_18px_rgb(var(--c-primary)/0.18)]'
                    }`}>
                    {done && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-green-500 border-2 border-white flex items-center justify-center shadow-md">
                        <Check size={11} weight="bold" className="text-white" />
                      </div>
                    )}
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        done ? 'bg-green-50 border-green-200' : 'bg-background border-primary/20'
                      }`}>
                        <span className={`text-[12px] font-black tabular-nums ${done ? 'text-green-700' : 'text-primary'}`}>
                          {(c.id.match(/\d+/) || ['—'])[0]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-ink truncate">{c.id}</p>
                        <p className={`text-[10px] font-bold truncate ${done ? 'text-green-700' : 'text-primary'}`}>
                          {done ? 'تم الرفع اليوم' : (c.caterer || '—')}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }


  if (!selectedTask) {
    return (
      <div dir="rtl" className="min-h-screen bg-canvas pb-28 font-arabic px-4 md:px-8">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-line w-full px-4 md:px-8 py-3 mb-6 shadow-sm">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <button onClick={() => navigate('/supervisor-home')} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 rounded-xl transition shrink-0">
              <ChevronRight className="text-primary" size={22} weight="bold" />
            </button>
            <h1 className="text-base font-bold text-ink absolute left-1/2 -translate-x-1/2 whitespace-nowrap">جاهزية مشعر منى</h1>
            <div className="w-10 shrink-0" />
          </div>
        </header>

        <div className="max-w-2xl mx-auto mt-4">
          {tasksLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-muted font-bold text-sm">جاري التحميل...</p>
            </div>
          ) : minaTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
              <div className="w-20 h-20 bg-[rgb(var(--c-primary-50))] rounded-full flex items-center justify-center mb-2">
                <Ban size={36} className="text-line" weight="light" />
              </div>
              <p className="text-ink font-bold text-lg">لا توجد مهام حالياً</p>
              <p className="text-muted text-sm max-w-xs">لم يتم إسناد مهام جاهزية منى لهذا المركز بعد</p>
              <button onClick={() => navigate('/supervisor-home')}
                className="mt-4 flex items-center gap-2 text-primary font-bold text-sm border border-primary/30 px-5 py-2.5 rounded-xl hover:bg-background transition">
                <ArrowLeft size={16} /> العودة للرئيسية
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingTasks.length > 0 && (
                <>
                  <p className="text-sm font-black text-ink px-1 mb-2">المهام المعلقة</p>
                  {pendingTasks.map(task => (
                    <button key={task.id}
                      onClick={() => setSelectedTask({ taskId: task.id, scheduledDate: task.scheduledDate })}
                      className="w-full bg-gradient-to-br from-white to-background/60 border border-line rounded-3xl p-5 text-right flex items-center gap-4 hover:border-primary hover:shadow-[0_8px_24px_rgb(var(--c-primary)/0.18)] hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98]">
                      <div className="w-12 h-12 bg-background border border-primary/20 rounded-2xl flex items-center justify-center shrink-0">
                        <Home className="text-primary" size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-ink text-sm">جاهزية مشعر منى</p>
                          <span className="text-[9px] font-black text-primary bg-background border border-primary/30 px-1.5 py-0.5 rounded-full">معلقة</span>
                        </div>
                        {task.scheduledDate && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Calendar size={12} className="text-primary" />
                            <span className="text-xs text-primary font-bold">{task.scheduledDate}</span>
                          </div>
                        )}
                      </div>
                      <ChevronRight size={18} className="text-primary shrink-0" />
                    </button>
                  ))}
                </>
              )}

              {minaTasks.length > 0 && pendingTasks.length === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-2xl py-10 text-center">
                  <CheckCircle2 size={32} className="mx-auto text-green-400 mb-2" weight="light" />
                  <p className="text-green-700 font-bold text-sm">جميع مهام هذا المركز مكتملة</p>
                  <p className="text-green-600 text-xs mt-1">تحقق من سجل نشاط المراقبين في الصفحة الرئيسية</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  
  return (
    <div dir="rtl" className="min-h-screen bg-canvas pb-28 font-arabic px-4 md:px-8">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-line w-full px-4 md:px-8 py-3 mb-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={() => {
              setSelectedTask(null); setAnswers({}); setDetails({}); setPhotos({});
              if (sweepMode) setSweepCenter(null);
            }}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 rounded-xl transition shrink-0">
            <ChevronRight className="text-primary" size={22} weight="bold" />
          </button>
          <h1 className="text-base font-bold text-ink absolute left-1/2 -translate-x-1/2 whitespace-nowrap">جاهزية منى</h1>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      <div className="rounded-[2.5rem] p-6 my-6 text-white shadow-lg relative overflow-hidden" style={{ background: 'rgb(var(--c-ink))' }}>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-3 rounded-2xl"><Home className="text-primary" size={28} /></div>
            <div>
              <h2 className="text-xl font-bold">{ALL_CRITERIA.length} بندًا للجاهزية</h2>
              {selectedTask?.scheduledDate && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Calendar size={12} className="text-primary" />
                  <span className="text-xs text-primary font-bold">{selectedTask.scheduledDate}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-4 w-full">
          {[
            { lbl: 'المشرف',  val: profile?.nameAr || '—',  cls: 'text-white' },
            { lbl: 'المركز',  val: centerId,                  cls: 'text-primary' },
            { lbl: 'المتعهد', val: catererName,               cls: 'text-white' },
          ].map(c => (
            <div key={c.lbl} className="bg-white/5 rounded-2xl px-4 py-3 flex-1 min-w-[120px] flex flex-col items-center justify-center border border-white/10 shadow-sm">
              <span className="text-white/40 text-[10px] mb-1 font-medium">{c.lbl}</span>
              <span className={`font-bold text-sm whitespace-nowrap ${c.cls}`}>{c.val}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {SECTIONS.map(section => (
          <div key={section.id}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-gradient-to-l from-transparent via-primary/40 to-transparent" />
              <span className="px-5 py-2 rounded-full text-white text-xs font-black shadow-[0_4px_14px_rgb(var(--c-primary)/0.35)]"
                style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))' }}>
                {section.title}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.criteria.map(c => {
                const ans = answers[c.id];
                const isYes = ans === 'نعم';
                const isNo  = ans === 'لا';
                return (
                  <div key={c.id} className={`group/q relative bg-gradient-to-br from-white via-white to-background/40 rounded-3xl shadow-[0_2px_12px_rgb(var(--c-ink)/0.05)] overflow-hidden transition-all duration-300 ${
                    ans
                      ? 'border-2 border-primary/40 shadow-[0_6px_24px_rgb(var(--c-primary)/0.18)]'
                      : 'border border-line hover:shadow-[0_4px_18px_rgb(var(--c-ink)/0.08)]'
                  }`}>
                    {ans && (
                      <div className="absolute top-0 right-0 left-0 h-1"
                        style={{ background: isYes
                          ? 'linear-gradient(90deg, #16A34A, #22C55E, #16A34A)'
                          : isNo
                            ? 'linear-gradient(90deg, #DC2626, #EF4444, #DC2626)'
                            : 'linear-gradient(90deg, rgb(var(--c-primary)), rgb(var(--c-primary-400)), rgb(var(--c-primary)))' }} />
                    )}
                    <div className="p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="relative flex-shrink-0">
                          <div className="absolute inset-0 rounded-2xl blur-md bg-primary opacity-30 group-hover/q:opacity-50 transition-opacity" />
                          <div className="relative w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-md tabular-nums"
                            style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))' }}>
                            {c.id}
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
                          <p className="text-ink font-bold text-[15px] leading-relaxed">{c.text}</p>
                        </div>
                      </div>

                      {c.type === 'choice' && (
                        <div className="grid grid-cols-2 gap-2">
                          {c.choices.map(choice => {
                            const sel = answers[c.id] === choice;
                            return (
                              <button key={choice} onClick={() => handleAnswer(c.id, choice)}
                                className={`py-3 rounded-2xl text-xs font-bold transition-all duration-300 ${
                                  sel ? 'text-white scale-[1.02] shadow-[0_4px_14px_rgb(var(--c-primary)/0.4)]'
                                      : 'bg-white text-muted border-2 border-line hover:border-primary/40 hover:bg-background'
                                }`}
                                style={sel ? { background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))' } : undefined}
                              >
                                {choice}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {(c.type === 'yesno' || c.type === 'yesno_detail') && (
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => handleAnswer(c.id, 'نعم')}
                            className={`min-h-[52px] py-3.5 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-2.5 active:scale-[0.98] ${
                              isYes
                                ? 'text-white scale-[1.02] shadow-[0_6px_20px_rgb(var(--c-success)/0.4)]'
                                : 'bg-white text-muted border-2 border-line hover:border-primary/40 hover:bg-background'
                            }`}
                            style={isYes ? { background: 'linear-gradient(135deg, #16A34A, #15803D)' } : undefined}
                          >
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${isYes ? 'bg-white/25 scale-110' : 'bg-success/10'}`}>
                              <CheckCircle2 size={16} weight="bold" className={isYes ? 'text-white' : 'text-success'} />
                            </div>
                            <span className="text-[15px]">نعم</span>
                          </button>
                          <button
                            onClick={() => handleAnswer(c.id, 'لا')}
                            className={`min-h-[52px] py-3.5 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-2.5 active:scale-[0.98] ${
                              isNo
                                ? 'text-white scale-[1.02] shadow-[0_6px_20px_rgb(var(--c-error)/0.4)]'
                                : 'bg-white text-muted border-2 border-line hover:border-red-300 hover:bg-red-50/30'
                            }`}
                            style={isNo ? { background: 'linear-gradient(135deg, #DC2626, #B91C1C)' } : undefined}
                          >
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${isNo ? 'bg-white/25 scale-110' : 'bg-error/10'}`}>
                              <AlertCircle size={16} weight="bold" className={isNo ? 'text-white' : 'text-error'} />
                            </div>
                            <span className="text-[15px]">لا</span>
                          </button>
                        </div>
                      )}

                      {c.type === 'yesno_detail' && answers[c.id] === 'نعم' && (
                        <input type="text"
                          className="w-full mt-3 border-2 border-line rounded-xl px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none transition-all"
                          value={details[c.id] || ''}
                          onChange={e => handleDetail(c.id, e.target.value)}
                          placeholder={c.detailLabel}
                        />
                      )}

                      {c.requiresPhoto && answers[c.id] && (
                        <div className="mt-3">
                          <input
                            ref={el => { photoInputRefs.current[c.id] = el; }}
                            type="file" accept="image/*" capture="environment"
                            className="hidden"
                            onChange={e => handlePhotoChange(c.id, e.target.files[0])}
                          />
                          {photos[c.id] ? (
                            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-2.5">
                              <img src={photos[c.id]} alt="" className="w-14 h-14 rounded-lg object-cover border border-green-300" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-black text-green-700 flex items-center gap-1.5">
                                  <CheckCircle2 size={13} weight="bold" /> تم رفع الصورة
                                </p>
                                <p className="text-[10px] text-green-600 mt-0.5">اضغط للتغيير</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button onClick={() => photoInputRefs.current[c.id]?.click()}
                                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-green-700 bg-white border border-green-300 hover:bg-green-50">
                                  تغيير
                                </button>
                                <button onClick={() => removePhoto(c.id)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 bg-white border border-red-200 hover:bg-red-50">
                                  <X size={13} weight="bold" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => !uploadingPhotos[c.id] && photoInputRefs.current[c.id]?.click()}
                              disabled={uploadingPhotos[c.id]}
                              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-primary/40 bg-background text-primary font-bold text-sm hover:bg-primary-50 hover:border-primary transition-all disabled:opacity-60 disabled:cursor-wait"
                            >
                              {uploadingPhotos[c.id]
                                ? <><Loader2 size={16} className="animate-spin" /> جارٍ رفع الصورة...</>
                                : <><Camera size={16} weight="bold" /> رفع صورة مرفقة (مطلوبة)</>}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white/90 border-t border-line z-50">
        <button onClick={handleSubmit} disabled={loading}
          className="w-full max-w-md mx-auto min-h-[56px] bg-gradient-to-br from-primary-400 to-primary text-white py-4 rounded-2xl font-bold text-lg active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
          {loading ? 'جاري الإرسال...' : <><Save size={22} /> حفظ وإرسال تقييم الجاهزية</>}
        </button>
      </div>
    </div>
  );
}
