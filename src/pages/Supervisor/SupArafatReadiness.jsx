import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CaretRight as ChevronRight,
  FloppyDisk as Save,
  CheckCircle as CheckCircle2,
  WarningCircle as AlertCircle,
  Mountains as Mountain,
  ArrowLeft,
  Prohibit as Ban,
  CalendarBlank as Calendar,
  Camera,
  CircleNotch as Loader2,
  X,
  MagnifyingGlass as Search,
  Check,
} from '@phosphor-icons/react';
import { db, serverTimestamp, uploadFile, STORAGE_BUCKETS } from '../../lib/db.js';
import { compressImage } from '../../lib/imageCompression.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getCaterer, CENTERS } from '../../config/centers.js';
import { computeReadinessTotals } from '../../config/readinessScore.js';
import { ARAFAT_SECTIONS, ARAFAT_ALL_CRITERIA } from '../../config/arafatQuestions.js';
import { HOLY_SITE_COLOR } from '../../config/fieldRecords.js';
import { IconTile, EmptyState } from '../../components/ui/index.jsx';

const SECTIONS     = ARAFAT_SECTIONS;
const ALL_CRITERIA = ARAFAT_ALL_CRITERIA;
const REQUIRED_IDS = ALL_CRITERIA.filter(c => c.type !== 'choice' && c.type !== 'yesno_detail' && c.type !== 'yesno_multi_detail').map(c => c.id);

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

/* Arafat carries its own green everywhere on this screen; yes/no answers carry
   theirs. Nothing else on the page is allowed a colour. */
const SITE = HOLY_SITE_COLOR.arafat;
const YES  = '#16A34A';
const NO   = '#DC2626';

function TopBar({ title, onBack }) {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-line w-full px-4 md:px-8 py-2.5 mb-6">
      <div className="max-w-5xl mx-auto grid grid-cols-[40px_1fr_40px] items-center gap-2">
        <button onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-[10px] border border-line bg-white hover:bg-[rgb(var(--c-bg))] transition-colors">
          <ChevronRight className="text-primary" size={18} weight="bold" />
        </button>
        <h1 className="text-[14px] font-bold text-ink text-center truncate">{title}</h1>
        <span />
      </div>
    </header>
  );
}

export default function SupArafatReadiness() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { profile } = useAuth();

  /* TEMP: sweep mode — when supervisor sweeps all of Arafat without prior assignment. */
  const sweepMode = state?.sweepMode === true;
  const [sweepCenter, setSweepCenter] = useState(null);
  const [centerSearch, setCenterSearch] = useState('');

  const centerId    = sweepMode ? (sweepCenter || '—') : (state?.centerId || '—');
  const catererName = centerId && centerId !== '—' ? (getCaterer(centerId) || '—') : '—';

  const [answers,      setAnswers]      = useState({});
  const [details,      setDetails]      = useState({});
  const [photos,       setPhotos]       = useState({});
  const [uploadingPhotos, setUploadingPhotos] = useState({});
  const [loading,      setLoading]      = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const photoInputRefs = useRef({});

  const [tasks,        setTasks]        = useState([]);
  const [completions,  setCompletions]  = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  useEffect(() => {
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

  const arafatTasks  = tasks.filter(t => t.taskTypes?.includes('arafat_readiness'));
  const isDone       = (task) => completions.some(c => c.taskId === task.id && c.taskType === 'arafat_readiness');
  const pendingTasks = arafatTasks.filter(t => !isDone(t));
  const doneTasks    = arafatTasks.filter(t => isDone(t));

  /* Centers this supervisor already submitted Arafat readiness for today */
  const [myDoneToday, setMyDoneToday] = useState(new Set());
  useEffect(() => {
    if (!sweepMode || !profile?.uid) return;
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Riyadh', year: 'numeric', month: 'numeric', day: 'numeric',
    });
    const parts = fmt.formatToParts(new Date());
    const y = parseInt(parts.find(p => p.type === 'year').value, 10);
    const m = parseInt(parts.find(p => p.type === 'month').value, 10);
    const d = parseInt(parts.find(p => p.type === 'day').value, 10);
    const todayStart = Date.UTC(y, m - 1, d, -3, 0, 0, 0);

    const unsub = db.arafat_readiness.subscribe(rows => {
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
        `readiness/arafat/${centerId}/${date}/q${qid}_${Date.now()}.jpg`,
        compressed,
      );
      setPhotos(prev => ({ ...prev, [qid]: url }));
    } catch (err) {
      console.error('[SupArafatReadiness photo upload]', err);
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
    if (unanswered.length > 0) { alert(`الرجاء الإجابة على جميع البنود. المتبقي: ${unanswered.length} بند`); return; }
    const photoRequiredIds = ALL_CRITERIA.filter(c => c.requiresPhoto).map(c => c.id);
    const missingPhotos = photoRequiredIds.filter(id => answers[id] && !photos[id]);
    if (missingPhotos.length > 0) {
      alert(`الأسئلة التالية تحتاج صورة: ${missingPhotos.join('، ')}`);
      return;
    }
    /* For yesno_multi_detail answered 'نعم': all fields must have values */
    const missingMultiFields = [];
    ALL_CRITERIA.forEach(c => {
      if (c.type !== 'yesno_multi_detail' || answers[c.id] !== 'نعم') return;
      (c.fields || []).forEach(f => {
        const v = details[`${c.id}_${f.key}`];
        if (v == null || String(v).trim() === '') {
          missingMultiFields.push(`السؤال ${c.id} — ${f.label}`);
        }
      });
    });
    if (missingMultiFields.length > 0) {
      alert(`الرجاء تعبئة الحقول التالية:\n${missingMultiFields.join('\n')}`);
      return;
    }
    setLoading(true);
    try {
      const scoring = computeReadinessTotals(ALL_CRITERIA, answers);
      await db.arafat_readiness.insert({
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
          taskType:      'arafat_readiness',
          mealType:      null,
          scheduledDate: selectedTask.scheduledDate || null,
          center:        centerId,
          uid:           profile?.uid || null,
          observerName:  profile?.nameAr || profile?.name || 'مشرف',
          timestamp:     serverTimestamp(),
        });
      }
      alert('تم إرسال تقييم الجاهزية بنجاح');
      setSelectedTask(null);
      setAnswers({});
      setDetails({});
      setPhotos({});
      if (sweepMode) setSweepCenter(null);
    } catch (e) {
      console.error('[SupArafatReadiness submit]', e);
      alert(`حدث خطأ أثناء الإرسال: ${e?.message || e}`);
    }
    setLoading(false);
  };

  /* All centers, filtered by search box (only used in sweep mode) */
  const filteredCenters = useMemo(() => {
    if (!sweepMode) return [];
    const q = centerSearch.trim();
    if (!q) return CENTERS;
    return CENTERS.filter(c => c.id.includes(q) || (c.caterer && c.caterer.includes(q)));
  }, [sweepMode, centerSearch]);

  /* Sweep mode — center picker (shown before the form when no center is picked) */
  if (sweepMode && !sweepCenter) {
    return (
      <div dir="rtl" className="min-h-screen bg-canvas pb-28 font-arabic px-4 md:px-8">
        <TopBar title="جاهزية عرفة" onBack={() => navigate('/supervisor-home')} />

        <div className="max-w-3xl mx-auto space-y-4">
          <div className="rounded-[14px] border p-4 flex items-center gap-3.5"
            style={{ background: tint(SITE, 12), borderColor: tint(SITE, 28) }}>
            <IconTile Icon={Mountain} color={SITE} size="lg" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: SITE }}>جاهزية عرفة</p>
              <h2 className="text-[16px] font-bold text-ink mt-1 leading-tight">المراكز</h2>
              <p className="text-[11.5px] font-medium text-muted mt-1">تقدر تختار أي مركز بدون الحاجة لإسناد مسبق.</p>
            </div>
          </div>

          <div className="relative">
            <Search size={15} className="absolute end-3.5 top-1/2 -translate-y-1/2 text-muted/60" weight="bold" />
            <input
              type="text"
              value={centerSearch}
              onChange={e => setCenterSearch(e.target.value)}
              placeholder="ابحث برقم المركز أو المتعهد..."
              className="w-full ps-4 pe-10 py-2.5 bg-white border border-line rounded-[11px] text-[13px] font-semibold text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
            />
          </div>

          {filteredCenters.length === 0 ? (
            <div className="bg-white rounded-[14px] border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]">
              <EmptyState Icon={Ban} title="لا توجد مراكز مطابقة للبحث" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredCenters.map(c => {
                const done = myDoneToday.has(c.id);
                const tone = done ? YES : SITE;
                return (
                  <button key={c.id}
                    onClick={() => {
                      setSweepCenter(c.id);
                      setSelectedTask({ taskId: null, scheduledDate: null });
                    }}
                    className="relative rounded-[11px] p-2.5 text-start border shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow duration-200 hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)]"
                    style={done
                      ? { background: tint(YES, 12), borderColor: tint(YES, 28) }
                      : { background: '#fff', borderColor: 'rgb(var(--c-line))' }}>
                    <div className="flex items-center gap-2.5">
                      <span className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border"
                        style={{ background: tint(tone, 9), borderColor: tint(tone, 22) }}>
                        {done
                          ? <Check size={15} weight="bold" style={{ color: tone }} />
                          : <span className="text-[12.5px] font-bold tabular-nums" style={{ color: tone }}>
                              {(c.id.match(/\d+/) || ['—'])[0]}
                            </span>}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[13px] text-ink truncate">{c.id}</p>
                        <p className="text-[10.5px] font-semibold truncate mt-0.5"
                          style={{ color: done ? tone : 'rgb(var(--c-muted))' }}>
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
        <TopBar title="جاهزية مشعر عرفة" onBack={() => navigate('/supervisor-home')} />

        <div className="max-w-2xl mx-auto mt-4">
          {tasksLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-9 h-9 border-2 border-line border-t-primary rounded-full animate-spin" />
              <p className="text-muted font-semibold text-[13px]">جاري التحميل...</p>
            </div>
          ) : arafatTasks.length === 0 ? (
            <div className="bg-white rounded-[14px] border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] text-center">
              <EmptyState Icon={Ban} title="لا توجد مهام حالياً" hint="لم يتم إسناد مهام جاهزية عرفة لهذا المركز بعد" />
              <div className="px-5 pb-8 -mt-6">
                <button onClick={() => navigate('/supervisor-home')}
                  className="inline-flex items-center gap-2 text-[12px] font-bold text-ink bg-white border border-line px-4 py-2 rounded-[10px] hover:bg-[rgb(var(--c-bg))] transition-colors">
                  <ArrowLeft size={14} weight="bold" /> العودة للرئيسية
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingTasks.length > 0 && (
                <>
                  <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-muted px-1 mb-2">المهام المعلقة</p>
                  {pendingTasks.map(task => (
                    <button key={task.id}
                      onClick={() => setSelectedTask({ taskId: task.id, scheduledDate: task.scheduledDate })}
                      className="relative w-full bg-white border border-line rounded-[14px] overflow-hidden ps-5 pe-4 py-4 text-start flex items-center gap-3.5 shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow duration-200 hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)]">
                      <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: SITE }} />
                      <IconTile Icon={Mountain} color={SITE} size="lg" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-ink text-[13.5px]">جاهزية مشعر عرفة</p>
                          <span className="text-[10.5px] font-bold px-1.5 py-[3px] rounded-md leading-none"
                            style={{ background: tint(SITE, 11), color: SITE }}>معلقة</span>
                        </div>
                        {task.scheduledDate && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Calendar size={12} weight="bold" className="text-muted/60" />
                            <span className="text-[11.5px] font-medium text-ink/75">{task.scheduledDate}</span>
                          </div>
                        )}
                      </div>
                      <ChevronRight size={15} weight="bold" className="text-muted/40 shrink-0" />
                    </button>
                  ))}
                </>
              )}

              {arafatTasks.length > 0 && pendingTasks.length === 0 && (
                <div className="rounded-[14px] border py-10 text-center"
                  style={{ background: tint(YES, 12), borderColor: tint(YES, 28) }}>
                  <CheckCircle2 size={26} weight="duotone" className="mx-auto mb-2.5" style={{ color: YES }} />
                  <p className="font-bold text-[13px]" style={{ color: YES }}>جميع مهام هذا المركز مكتملة</p>
                  <p className="text-muted text-[11.5px] font-medium mt-1">تحقق من سجل نشاط المراقبين في الصفحة الرئيسية</p>
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
      <TopBar
        title="جاهزية عرفة"
        onBack={() => {
          setSelectedTask(null); setAnswers({}); setDetails({}); setPhotos({});
          if (sweepMode) setSweepCenter(null);
        }}
      />

      <div className="relative rounded-[18px] overflow-hidden px-5 py-5 my-5"
        style={{ background: 'linear-gradient(180deg, rgb(var(--c-primary)) 0%, rgb(var(--c-primary-700)) 100%)' }}>
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--c-accent) / 0.6), transparent)' }} />
        <div className="flex items-center gap-3.5 min-w-0">
          <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
            style={{ background: 'rgb(255 255 255 / 0.06)' }}>
            <Mountain size={23} weight="duotone" className="text-accent" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-accent/80">نموذج الفحص الميداني</p>
            <h2 className="text-[19px] font-extrabold text-white mt-1 leading-tight">{ALL_CRITERIA.length} بندًا للجاهزية</h2>
            {selectedTask?.scheduledDate && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Calendar size={12} weight="bold" className="text-white/45" />
                <span className="text-[11.5px] font-medium text-white/60">{selectedTask.scheduledDate}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-stretch mt-4 pt-4 border-t border-white/10">
          {[
            { lbl: 'المشرف',  val: profile?.nameAr || '—', cls: 'text-white' },
            { lbl: 'المركز',  val: centerId,                 cls: 'text-accent' },
            { lbl: 'المتعهد', val: catererName,              cls: 'text-white' },
          ].map((c, i) => (
            <div key={c.lbl} className={`flex-1 min-w-0 px-4 first:ps-0 ${i > 0 ? 'border-s border-white/10' : ''}`}>
              <p className="text-[10px] font-medium text-white/50">{c.lbl}</p>
              <p className={`text-[13px] font-bold mt-1 truncate ${c.cls}`}>{c.val}</p>
            </div>
          ))}
        </div>
      </div>

      {SECTIONS.map(section => (
        <div key={section.id} className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-px flex-1 bg-line" />
            <span className="px-3.5 py-1.5 rounded-[10px] border text-[11.5px] font-bold"
              style={{ background: tint(SITE, 12), borderColor: tint(SITE, 28), color: SITE }}>
              {section.title}
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {section.criteria.map(c => {
              const ans = answers[c.id];
              const isYes = ans === 'نعم';
              const isNo  = ans === 'لا';
              const tone  = isYes ? YES : isNo ? NO : SITE;
              return (
                <div key={c.id}
                  className="relative bg-white rounded-[14px] border overflow-hidden shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow duration-200 hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)]"
                  style={{ borderColor: ans ? tint(tone, 28) : 'rgb(var(--c-line))' }}>
                  {ans && <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: tone }} />}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3 mb-3.5">
                      <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 border text-[13px] font-bold tabular-nums"
                        style={{ background: tint(SITE, 9), borderColor: tint(SITE, 22), color: SITE }}>
                        {c.id}
                      </span>
                      <div className="flex-1 min-w-0">
                        {ans && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-1.5 py-[3px] rounded-md leading-none mb-1.5"
                            style={{ background: tint(tone, 11), color: tone }}>
                            <CheckCircle2 size={10} weight="bold" />
                            مُجاب
                          </span>
                        )}
                        <p className="text-ink font-bold text-[14px] leading-relaxed">{c.text}</p>
                      </div>
                    </div>

                    {c.type === 'choice' && (
                      <div className="grid grid-cols-2 gap-2">
                        {c.choices.map(choice => {
                          const sel = answers[c.id] === choice;
                          return (
                            <button key={choice} onClick={() => handleAnswer(c.id, choice)}
                              className={`py-2.5 rounded-[11px] text-[13px] font-bold border transition-colors ${
                                sel ? 'text-white' : 'bg-white text-muted border-line hover:bg-[rgb(var(--c-bg))]'
                              }`}
                              style={sel ? { background: SITE, borderColor: SITE } : undefined}
                            >
                              {choice}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {(c.type === 'yesno' || c.type === 'yesno_detail' || c.type === 'yesno_multi_detail') && (
                      <>
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            onClick={() => handleAnswer(c.id, 'نعم')}
                            className={`min-h-[46px] py-3 rounded-[11px] font-bold border transition-colors flex items-center justify-center gap-2 ${
                              isYes ? 'text-white' : 'bg-white text-muted border-line hover:bg-[rgb(var(--c-bg))]'
                            }`}
                            style={isYes ? { background: YES, borderColor: YES } : undefined}
                          >
                            <CheckCircle2 size={16} weight="bold" style={isYes ? undefined : { color: YES }} />
                            <span className="text-[14px]">نعم</span>
                          </button>
                          <button
                            onClick={() => handleAnswer(c.id, 'لا')}
                            className={`min-h-[46px] py-3 rounded-[11px] font-bold border transition-colors flex items-center justify-center gap-2 ${
                              isNo ? 'text-white' : 'bg-white text-muted border-line hover:bg-[rgb(var(--c-bg))]'
                            }`}
                            style={isNo ? { background: NO, borderColor: NO } : undefined}
                          >
                            <AlertCircle size={16} weight="bold" style={isNo ? undefined : { color: NO }} />
                            <span className="text-[14px]">لا</span>
                          </button>
                        </div>

                        {c.type === 'yesno_detail' && answers[c.id] === 'نعم' && (
                          <input type="text" value={details[c.id] || ''} onChange={e => handleDetail(c.id, e.target.value)}
                            className="w-full mt-3 bg-white border border-line rounded-[11px] px-3.5 py-2.5 text-[13px] text-ink focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none transition-all"
                            placeholder={c.detailLabel} />
                        )}
                        {c.type === 'yesno_multi_detail' && answers[c.id] === 'نعم' && (
                          <div className="grid grid-cols-1 gap-2.5 mt-3">
                            {c.fields.map(field => (
                              <input key={field.key} type={field.type} value={details[`${c.id}_${field.key}`] || ''}
                                onChange={e => handleDetail(`${c.id}_${field.key}`, e.target.value)}
                                className="w-full bg-white border border-line rounded-[11px] px-3.5 py-2.5 text-[13px] text-ink focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none transition-all"
                                placeholder={field.label} />
                            ))}
                          </div>
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
                              <div className="flex items-center gap-3 rounded-[11px] border p-2.5"
                                style={{ background: tint(YES, 12), borderColor: tint(YES, 28) }}>
                                <img src={photos[c.id]} alt="" className="w-14 h-14 rounded-[10px] object-cover border"
                                  style={{ borderColor: tint(YES, 28) }} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] font-bold flex items-center gap-1.5" style={{ color: YES }}>
                                    <CheckCircle2 size={13} weight="bold" /> تم رفع الصورة
                                  </p>
                                  <p className="text-[10.5px] font-medium text-muted mt-0.5">اضغط للتغيير</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button onClick={() => photoInputRefs.current[c.id]?.click()}
                                    className="px-2.5 py-1.5 rounded-[10px] text-[11px] font-bold bg-white border"
                                    style={{ color: YES, borderColor: tint(YES, 28) }}>
                                    تغيير
                                  </button>
                                  <button onClick={() => removePhoto(c.id)}
                                    className="w-7 h-7 rounded-[10px] flex items-center justify-center bg-white border"
                                    style={{ color: NO, borderColor: tint(NO, 28) }}>
                                    <X size={13} weight="bold" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => !uploadingPhotos[c.id] && photoInputRefs.current[c.id]?.click()}
                                disabled={uploadingPhotos[c.id]}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[11px] border border-dashed font-bold text-[12.5px] transition-colors disabled:opacity-60 disabled:cursor-wait"
                                style={{ background: tint(SITE, 9), borderColor: tint(SITE, 34), color: SITE }}
                              >
                                {uploadingPhotos[c.id]
                                  ? <><Loader2 size={15} className="animate-spin" /> جارٍ رفع الصورة...</>
                                  : <><Camera size={15} weight="bold" /> رفع صورة مرفقة (مطلوبة)</>}
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="fixed inset-x-0 bottom-0 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-md border-t border-line z-[100]">
        <button onClick={handleSubmit} disabled={loading}
          className="w-full max-w-md mx-auto min-h-[50px] rounded-[12px] border text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          style={{ background: SITE, borderColor: SITE }}>
          {loading ? 'جاري الإرسال...' : <><Save size={18} weight="bold" /> حفظ وإرسال التقرير</>}
        </button>
      </div>
    </div>
  );
}
