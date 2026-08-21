import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CaretRight as ChevronRight,
  CaretLeft as ChevronLeft,
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
} from '@phosphor-icons/react';
import { db, serverTimestamp, uploadFile, STORAGE_BUCKETS } from '../lib/db.js';
import { compressImage } from '../lib/imageCompression.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getCaterer } from '../config/centers.js';
import { useAssignedTasks } from '../hooks/useAssignedTasks.js';
import { computeReadinessTotals } from '../config/readinessScore.js';
import { MINA_SECTIONS, MINA_ALL_CRITERIA } from '../config/minaQuestions.js';
import { HOLY_SITE_COLOR } from '../config/fieldRecords.js';
import { IconTile, Pill } from '../components/ui/index.jsx';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

/* Every tinted surface on this screen derives from one of these three. */
const SITE = HOLY_SITE_COLOR.mina;
const OK   = '#15803D';
const BAD  = '#DC2626';

const SECTIONS = MINA_SECTIONS;
const ALL_CRITERIA = MINA_ALL_CRITERIA;
const REQUIRED_IDS = ALL_CRITERIA.filter(c => c.type !== 'choice' && c.type !== 'yesno_detail').map(c => c.id);

export default function MinaReadiness() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [answers, setAnswers] = useState({});
  const [details, setDetails] = useState({});
  const [photos, setPhotos] = useState({});                // { [qid]: photoUrl }
  const [uploadingPhotos, setUploadingPhotos] = useState({}); // { [qid]: bool }
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const photoInputRefs = useRef({});

  const { tasks, completions, loading: tasksLoading } = useAssignedTasks(profile);

  const minaTasks = tasks.filter(t => t.taskTypes?.includes('mina_readiness'));
  const isDone = (task) => completions.some(c => c.taskId === task.id && c.taskType === 'mina_readiness');
  const pendingTasks = minaTasks.filter(t => !isDone(t));
  const doneTasks = minaTasks.filter(t => isDone(t));

  const handleAnswer = (id, value) => setAnswers(prev => ({ ...prev, [id]: value }));
  const handleDetail = (id, value) => setDetails(prev => ({ ...prev, [id]: value }));

  const handlePhotoChange = async (qid, file) => {
    if (!file) return;
    setUploadingPhotos(prev => ({ ...prev, [qid]: true }));
    try {
      const compressed = await compressImage(file);
      const center = profile?.center || 'unknown';
      const date = selectedTask?.scheduledDate || 'undated';
      const url = await uploadFile(
        STORAGE_BUCKETS.phases,
        `readiness/mina/${center}/${date}/q${qid}_${Date.now()}.jpg`,
        compressed,
      );
      setPhotos(prev => ({ ...prev, [qid]: url }));
    } catch (err) {
      console.error('[MinaReadiness photo upload]', err);
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

  const totalRequired = ALL_CRITERIA.length;

  const handleSubmit = async () => {
    const unanswered = REQUIRED_IDS.filter(id => !answers[id]);
    if (unanswered.length > 0) {
      alert(`المتبقي: ${unanswered.length} بند`);
      return;
    }
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
        observer: profile?.nameAr || profile?.name || 'مراقب',
        center: profile?.center || '—',
        caterer: profile?.caterer || getCaterer(profile?.center) || '—',
        uid: profile?.uid || null,
        answers: { ...answers, __details: details, __photos: photos },
        ...scoring,
        scheduledDate: selectedTask?.scheduledDate || null,
        timestamp: serverTimestamp(),
      });
      if (selectedTask?.taskId) {
        await db.task_completions.insert({
          taskId: selectedTask.taskId,
          taskType: 'mina_readiness',
          mealType: null,
          scheduledDate: selectedTask.scheduledDate || null,
          center: profile?.center || '—',
          uid: profile?.uid || null,
          observerName: profile?.nameAr || profile?.name || 'مراقب',
          timestamp: serverTimestamp(),
        });
      }
      alert('تم إرسال التقييم بنجاح');
      setSelectedTask(null);
      setAnswers({});
      setDetails({});
      setPhotos({});
    } catch (e) {
      console.error('[MinaReadiness submit]', e);
      alert(`خطأ في الإرسال: ${e?.message || e}`);
    }
    setLoading(false);
  };

  
  if (!selectedTask) {
    return (
      <div dir="rtl" className="min-h-screen bg-canvas pb-28 font-arabic px-4 md:px-8">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-line w-full px-4 md:px-8 py-3 mb-6 shadow-sm">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <button onClick={() => navigate('/home')} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-[rgb(var(--c-bg))] rounded-[10px] transition-colors shrink-0">
              <ChevronRight className="text-primary" size={20} weight="bold" />
            </button>
            <h1 className="text-[15px] font-bold text-ink absolute left-1/2 -translate-x-1/2 whitespace-nowrap">جاهزية مشعر منى</h1>
            <div className="w-10 shrink-0" />
          </div>
        </header>

        <div className="max-w-2xl mx-auto mt-4">
          {tasksLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-9 h-9 border-[3px] border-primary/25 border-t-primary rounded-full animate-spin" />
              <p className="text-[13px] font-semibold text-muted">جاري التحميل...</p>
            </div>
          ) : minaTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <span className="w-14 h-14 rounded-[16px] bg-white border border-line flex items-center justify-center">
                <Ban size={24} weight="duotone" className="text-muted/40" />
              </span>
              <p className="text-[15px] font-bold text-ink">لا توجد مهام حالياً</p>
              <p className="text-[12.5px] font-medium text-muted max-w-xs">لم يتم إسناد مهام جاهزية منى لمركزك بعد</p>
              <button onClick={() => navigate('/home')}
                className="mt-3 inline-flex items-center gap-2 min-h-[44px] px-5 rounded-[11px] bg-white border border-line text-ink text-[13px] font-bold hover:bg-[rgb(var(--c-bg))] transition-colors">
                <ArrowLeft size={15} weight="bold" /> العودة للرئيسية
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingTasks.length > 0 && (
                <>
                  <p className="text-[11px] font-bold tracking-[0.14em] text-muted px-1 mb-2.5">المهام المعلقة</p>
                  {pendingTasks.map(task => (
                    <button key={task.id}
                      onClick={() => setSelectedTask({ taskId: task.id, scheduledDate: task.scheduledDate })}
                      className="group w-full bg-white border border-line rounded-[14px] p-4 text-start flex items-center gap-3.5
                                 shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow duration-200
                                 hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)]">
                      <IconTile Icon={Home} color={SITE} size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-ink">جاهزية مشعر منى</p>
                        {task.scheduledDate && (
                          <div className="mt-1.5">
                            <Pill color={SITE} Icon={Calendar}>{task.scheduledDate}</Pill>
                          </div>
                        )}
                      </div>
                      <ChevronLeft size={15} weight="bold" className="shrink-0 text-muted/40 group-hover:text-muted transition-colors" />
                    </button>
                  ))}
                </>
              )}

              {doneTasks.length > 0 && (
                <>
                  <p className="text-[11px] font-bold tracking-[0.14em] text-muted px-1 mt-6 mb-2.5">المهام المكتملة</p>
                  {doneTasks.map(task => (
                    <div key={task.id} className="rounded-[14px] border p-4 flex items-center gap-3.5"
                      style={{ background: tint(OK, 12), borderColor: tint(OK, 28) }}>
                      <IconTile Icon={CheckCircle2} color={OK} size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold" style={{ color: OK }}>جاهزية مشعر منى</p>
                        {task.scheduledDate && (
                          <div className="mt-1.5">
                            <Pill color={OK} Icon={Calendar}>{task.scheduledDate}</Pill>
                          </div>
                        )}
                        <p className="text-[11px] font-medium text-muted mt-1.5">تم الإرسال</p>
                      </div>
                      <CheckCircle2 size={17} weight="duotone" className="shrink-0" style={{ color: OK }} />
                    </div>
                  ))}
                </>
              )}

              {pendingTasks.length === 0 && doneTasks.length > 0 && (
                <div className="text-center pt-6">
                  <button onClick={() => navigate('/home')}
                    className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-[11px] bg-white border border-line text-ink text-[13px] font-bold hover:bg-[rgb(var(--c-bg))] transition-colors">
                    <ArrowLeft size={15} weight="bold" /> العودة للرئيسية
                  </button>
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
          <button onClick={() => { setSelectedTask(null); setAnswers({}); setDetails({}); }}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-[rgb(var(--c-bg))] rounded-[10px] transition-colors shrink-0">
            <ChevronRight className="text-primary" size={20} weight="bold" />
          </button>
          <h1 className="text-[15px] font-bold text-ink absolute left-1/2 -translate-x-1/2 whitespace-nowrap">جاهزية مشعر منى</h1>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      {/* Header Card */}
      <div className="rounded-[18px] p-5 sm:p-6 my-6 text-white relative overflow-hidden"
        style={{ background: 'rgb(var(--c-ink))' }}>
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--c-accent) / 0.6), transparent)' }} />

        <div className="flex items-center gap-3.5 mb-5">
          <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
            style={{ background: 'rgb(255 255 255 / 0.06)' }}>
            <Home size={23} weight="duotone" className="text-accent" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[19px] font-extrabold leading-tight">{totalRequired} بندًا للجاهزية</h2>
            {selectedTask?.scheduledDate && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Calendar size={12} weight="bold" className="text-accent" />
                <span className="text-[11.5px] font-bold text-accent">{selectedTask.scheduledDate}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-[10px] py-2.5 px-2 border border-white/10 text-center"
            style={{ background: 'rgb(255 255 255 / 0.06)' }}>
            <span className="block text-[10px] font-medium text-white/50 mb-1">المراقب</span>
            <span className="block text-white font-bold text-[12px] truncate">{profile?.nameAr || profile?.name || '—'}</span>
          </div>
          <div className="rounded-[10px] py-2.5 px-2 border border-white/10 text-center"
            style={{ background: 'rgb(255 255 255 / 0.06)' }}>
            <span className="block text-[10px] font-medium text-white/50 mb-1">المركز</span>
            <span className="block text-accent font-bold text-[12px] truncate">{profile?.center || '—'}</span>
          </div>
          <div className="rounded-[10px] py-2.5 px-2 border border-white/10 text-center"
            style={{ background: 'rgb(255 255 255 / 0.06)' }}>
            <span className="block text-[10px] font-medium text-white/50 mb-1">المتعهد</span>
            <span className="block text-white font-bold text-[12px] truncate">{profile?.caterer || getCaterer(profile?.center) || '—'}</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {SECTIONS.map(section => (
          <div key={section.id}>
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1.5 rounded-[10px] border text-[12px] font-bold"
                style={{ background: tint(SITE, 12), borderColor: tint(SITE, 28), color: SITE }}>
                {section.title}
              </span>
              <span aria-hidden className="h-px flex-1 bg-line" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {section.criteria.map(c => {
                const ans = answers[c.id];
                const isYes = ans === 'نعم';
                const isNo  = ans === 'لا';
                /* The answer decides the card's colour, so a screen of them reads
                   as a pass/fail map before a single line is read. */
                const rail = isYes ? OK : isNo ? BAD : ans ? SITE : null;
                return (
                  <div key={c.id}
                    className="relative bg-white rounded-[14px] border overflow-hidden
                               shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow duration-200
                               hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)]"
                    style={{ borderColor: rail ? tint(rail, 34) : 'rgb(var(--c-line))' }}>
                    {rail && (
                      <span aria-hidden className="absolute inset-y-0 start-0 w-[3px]" style={{ background: rail }} />
                    )}
                    <div className="pt-4 pb-4 pe-4 ps-5">
                      <div className="flex items-start gap-3">
                        <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 border text-[13px] font-bold tabular-nums"
                          style={{ background: tint(SITE, 9), borderColor: tint(SITE, 22), color: SITE }}>
                          {c.id}
                        </span>
                        <div className="flex-1 min-w-0">
                          {ans && (
                            <div className="mb-1.5">
                              <Pill color={OK} Icon={CheckCircle2}>مُجاب</Pill>
                            </div>
                          )}
                          <p className="text-ink font-bold text-[14px] leading-relaxed">{c.text}</p>
                        </div>
                      </div>

                      {c.type === 'choice' && (
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          {c.choices.map(choice => {
                            const sel = answers[c.id] === choice;
                            return (
                              <button key={choice} onClick={() => handleAnswer(c.id, choice)}
                                className={`min-h-[44px] px-2 rounded-[11px] border text-[12.5px] font-bold transition-colors ${
                                  sel ? 'text-white' : 'bg-white border-line text-muted hover:bg-[rgb(var(--c-bg))]'
                                }`}
                                style={sel ? { background: SITE, borderColor: SITE } : undefined}
                              >
                                {choice}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {(c.type === 'yesno' || c.type === 'yesno_detail') && (
                        <div className="grid grid-cols-2 gap-2.5 mt-3">
                          <button
                            onClick={() => handleAnswer(c.id, 'نعم')}
                            className={`min-h-[48px] rounded-[11px] border text-[14px] font-bold flex items-center justify-center gap-2 transition-colors ${
                              isYes ? 'text-white' : 'bg-white border-line text-muted hover:bg-[rgb(var(--c-bg))]'
                            }`}
                            style={isYes ? { background: OK, borderColor: OK } : undefined}
                          >
                            <CheckCircle2 size={17} weight="bold" style={isYes ? undefined : { color: OK }} />
                            نعم
                          </button>
                          <button
                            onClick={() => handleAnswer(c.id, 'لا')}
                            className={`min-h-[48px] rounded-[11px] border text-[14px] font-bold flex items-center justify-center gap-2 transition-colors ${
                              isNo ? 'text-white' : 'bg-white border-line text-muted hover:bg-[rgb(var(--c-bg))]'
                            }`}
                            style={isNo ? { background: BAD, borderColor: BAD } : undefined}
                          >
                            <AlertCircle size={17} weight="bold" style={isNo ? undefined : { color: BAD }} />
                            لا
                          </button>
                        </div>
                      )}

                      {c.type === 'yesno_detail' && answers[c.id] === 'نعم' && (
                        <input type="text"
                          className="w-full mt-2.5 min-h-[44px] border border-line rounded-[10px] px-3.5 py-2.5 text-[13px] text-ink bg-white placeholder:text-muted/70 focus:border-primary outline-none transition-colors"
                          value={details[c.id] || ''}
                          onChange={e => handleDetail(c.id, e.target.value)}
                          placeholder={c.detailLabel}
                        />
                      )}

                      {c.requiresPhoto && answers[c.id] && (
                        <div className="mt-2.5">
                          <input
                            ref={el => { photoInputRefs.current[c.id] = el; }}
                            type="file" accept="image/*" capture="environment"
                            className="hidden"
                            onChange={e => handlePhotoChange(c.id, e.target.files[0])}
                          />
                          {photos[c.id] ? (
                            <div className="flex items-center gap-3 rounded-[11px] border p-2.5"
                              style={{ background: tint(OK, 12), borderColor: tint(OK, 28) }}>
                              <img src={photos[c.id]} alt="" className="w-14 h-14 rounded-[10px] object-cover border"
                                style={{ borderColor: tint(OK, 34) }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-bold flex items-center gap-1.5" style={{ color: OK }}>
                                  <CheckCircle2 size={13} weight="bold" /> تم رفع الصورة
                                </p>
                                <p className="text-[10.5px] font-medium text-muted mt-0.5">اضغط للتغيير</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button onClick={() => photoInputRefs.current[c.id]?.click()}
                                  className="min-h-[40px] px-3 rounded-[10px] text-[11.5px] font-bold bg-white border transition-colors"
                                  style={{ color: OK, borderColor: tint(OK, 34) }}>
                                  تغيير
                                </button>
                                <button onClick={() => removePhoto(c.id)}
                                  className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-white border border-line text-muted hover:text-[#DC2626] transition-colors">
                                  <X size={13} weight="bold" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => !uploadingPhotos[c.id] && photoInputRefs.current[c.id]?.click()}
                              disabled={uploadingPhotos[c.id]}
                              className="w-full min-h-[46px] flex items-center justify-center gap-2 rounded-[11px] border border-dashed text-[13px] font-bold transition-colors disabled:opacity-60 disabled:cursor-wait"
                              style={{ background: tint(SITE, 9), borderColor: tint(SITE, 34), color: SITE }}
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

      <div className="fixed inset-x-0 bottom-0 px-4 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-sm border-t border-line z-50">
        <button onClick={handleSubmit} disabled={loading}
          className="w-full max-w-md mx-auto min-h-[52px] rounded-[12px] bg-primary border border-primary text-white font-bold text-[15px]
                     flex items-center justify-center gap-2.5 hover:opacity-90 transition-opacity disabled:opacity-60">
          {loading ? 'جاري الإرسال...' : <><Save size={19} weight="bold" /> حفظ وإرسال تقييم الجاهزية</>}
        </button>
      </div>
    </div>
  );
}
