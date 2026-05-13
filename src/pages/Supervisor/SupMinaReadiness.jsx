import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight, Save, CheckCircle2, AlertCircle, Home, ArrowLeft, Ban, Calendar } from 'lucide-react';
import { db } from '../../config/db.js';
import { collection, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext.jsx';
import { getCaterer } from '../../config/centers.js';
import { extractCenterNum } from '../../hooks/useAssignedTasks.js';
import { computeReadinessTotals } from '../../config/readinessScore.js';
import { MINA_SECTIONS, MINA_ALL_CRITERIA } from '../../config/minaQuestions.js';

const SECTIONS      = MINA_SECTIONS;
const ALL_CRITERIA  = MINA_ALL_CRITERIA;
const REQUIRED_IDS  = ALL_CRITERIA.filter(c => c.type !== 'choice' && c.type !== 'yesno_detail').map(c => c.id);

export default function SupMinaReadiness() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { profile } = useAuth();

  const centerId    = state?.centerId || '—';
  const catererName = getCaterer(centerId) || '—';

  const [answers,     setAnswers]     = useState({});
  const [details,     setDetails]     = useState({});
  const [loading,     setLoading]     = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  /* ── Load tasks for this center ── */
  const [tasks,        setTasks]        = useState([]);
  const [completions,  setCompletions]  = useState([]);
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

  const minaTasks   = tasks.filter(t => t.task_types?.includes('mina_readiness'));
  const isDone      = (task) => completions.some(c => c.taskId === task.id && c.taskType === 'mina_readiness');
  const pendingTasks = minaTasks.filter(t => !isDone(t));
  const doneTasks    = minaTasks.filter(t => isDone(t));

  const handleAnswer = (id, value) => setAnswers(prev => ({ ...prev, [id]: value }));
  const handleDetail = (id, value) => setDetails(prev => ({ ...prev, [id]: value }));

  const handleSubmit = async () => {
    const unanswered = REQUIRED_IDS.filter(id => !answers[id]);
    if (unanswered.length > 0) { alert(`المتبقي: ${unanswered.length} بند`); return; }
    setLoading(true);
    try {
      const scoring = computeReadinessTotals(ALL_CRITERIA, answers);
      await addDoc(collection(db, 'mina_readiness'), {
        observer:      profile?.nameAr || profile?.name || 'مشرف',
        center:        centerId,
        caterer:       catererName,
        uid:           profile?.uid || '',
        answers,
        details,
        ...scoring,
        taskId:        selectedTask?.taskId || null,
        scheduledDate: selectedTask?.scheduledDate || null,
        role:          'supervisor',
        timestamp:     serverTimestamp(),
        status:        'completed',
      });
      if (selectedTask?.taskId) {
        await addDoc(collection(db, 'task_completions'), {
          taskId:        selectedTask.taskId,
          taskType:      'mina_readiness',
          mealType:      null,
          scheduledDate: selectedTask.scheduledDate || null,
          center:        centerId,
          uid:           profile?.uid || '',
          observerName:  profile?.nameAr || profile?.name || '—',
          completedAt:   serverTimestamp(),
        });
      }
      alert('تم إرسال التقييم بنجاح');
      setSelectedTask(null);
      setAnswers({});
      setDetails({});
    } catch { alert('خطأ في الإرسال'); }
    setLoading(false);
  };

  /* ── Gate Screen ── */
  if (!selectedTask) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-28 font-arabic px-4 md:px-8">
        <header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] w-full px-4 md:px-8 py-3 mb-6 shadow-sm">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <button onClick={() => navigate('/supervisor-home')} className="p-2 hover:bg-gray-100 rounded-xl transition shrink-0">
              <ChevronRight className="text-[#A98159]" size={22} strokeWidth={2.5} />
            </button>
            <h1 className="text-base font-bold text-[#2D2926] absolute left-1/2 -translate-x-1/2 whitespace-nowrap">جاهزية مشعر منى</h1>
            <div className="w-10 shrink-0" />
          </div>
        </header>

        <div className="max-w-2xl mx-auto mt-4">
          {tasksLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-10 h-10 border-4 border-[#A98159]/30 border-t-[#A98159] rounded-full animate-spin" />
              <p className="text-[#6D6E71] font-bold text-sm">جاري التحميل...</p>
            </div>
          ) : minaTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
              <div className="w-20 h-20 bg-[#F5F0EB] rounded-full flex items-center justify-center mb-2">
                <Ban size={36} className="text-[#D1C4B9]" strokeWidth={1.5} />
              </div>
              <p className="text-[#2D2926] font-bold text-lg">لا توجد مهام حالياً</p>
              <p className="text-[#9D8F85] text-sm max-w-xs">لم يتم إسناد مهام جاهزية منى لهذا المركز بعد</p>
              <button onClick={() => navigate('/supervisor-home')}
                className="mt-4 flex items-center gap-2 text-[#A98159] font-bold text-sm border border-[#A98159]/30 px-5 py-2.5 rounded-xl hover:bg-[#FDF8F0] transition">
                <ArrowLeft size={16} /> العودة للرئيسية
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingTasks.length > 0 && (
                <>
                  <p className="text-sm font-black text-[#2D2926] px-1 mb-2">المهام المعلقة</p>
                  {pendingTasks.map(task => (
                    <button key={task.id}
                      onClick={() => setSelectedTask({ taskId: task.id, scheduledDate: task.scheduled_date })}
                      className="w-full bg-white border border-[#D1C4B9] rounded-3xl p-5 text-right flex items-center gap-4 hover:border-[#A98159] hover:shadow-md transition-all active:scale-[0.98]">
                      <div className="w-12 h-12 bg-[#FDF8F0] border border-[#A98159]/20 rounded-2xl flex items-center justify-center shrink-0">
                        <Home className="text-[#A98159]" size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-[#2D2926] text-sm">جاهزية مشعر منى</p>
                          <span className="text-[9px] font-black text-[#A98159] bg-[#FDF8F0] border border-[#A98159]/30 px-1.5 py-0.5 rounded-full">معلقة</span>
                        </div>
                        {task.scheduled_date && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Calendar size={12} className="text-[#A98159]" />
                            <span className="text-xs text-[#A98159] font-bold">{task.scheduled_date}</span>
                          </div>
                        )}
                      </div>
                      <ChevronRight size={18} className="text-[#A98159] shrink-0" />
                    </button>
                  ))}
                </>
              )}

              {minaTasks.length > 0 && pendingTasks.length === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-2xl py-10 text-center">
                  <CheckCircle2 size={32} className="mx-auto text-green-400 mb-2" strokeWidth={1.5} />
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

  /* ── Form Screen ── */
  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-28 font-arabic px-4 md:px-8">
      <header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] w-full px-4 md:px-8 py-3 mb-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={() => { setSelectedTask(null); setAnswers({}); setDetails({}); }}
            className="p-2 hover:bg-gray-100 rounded-xl transition shrink-0">
            <ChevronRight className="text-[#A98159]" size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-base font-bold text-[#2D2926] absolute left-1/2 -translate-x-1/2 whitespace-nowrap">جاهزية مشعر منى</h1>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      <div className="rounded-[2.5rem] p-6 my-6 text-white shadow-lg relative overflow-hidden" style={{ background: '#2D2926' }}>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-3 rounded-2xl"><Home className="text-[#A98159]" size={28} /></div>
            <div>
              <h2 className="text-xl font-bold">{ALL_CRITERIA.length} بندًا للجاهزية</h2>
              {selectedTask?.scheduledDate && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Calendar size={12} className="text-[#A98159]" />
                  <span className="text-xs text-[#A98159] font-bold">{selectedTask.scheduledDate}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-4 w-full">
          {[
            { lbl: 'المشرف',  val: profile?.nameAr || '—',  cls: 'text-white' },
            { lbl: 'المركز',  val: centerId,                  cls: 'text-[#A98159]' },
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
              <div className="h-px flex-1 bg-[#D1C4B9]" />
              <span className="text-xs font-bold text-[#A98159] bg-[#FDF8F0] border border-[#D1C4B9] px-4 py-1.5 rounded-full">{section.title}</span>
              <div className="h-px flex-1 bg-[#D1C4B9]" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.criteria.map(c => (
                <div key={c.id} className="bg-white rounded-3xl p-6 border border-[#D1C4B9] shadow-sm">
                  <span className="text-[#A98159] font-bold text-sm block mb-2">#{c.id}</span>
                  <p className="text-[#2D2926] font-bold text-sm mb-4 leading-relaxed">{c.text}</p>
                  {c.type === 'choice' && (
                    <div className="grid grid-cols-2 gap-2">
                      {c.choices.map(choice => (
                        <button key={choice} onClick={() => handleAnswer(c.id, choice)}
                          className={`py-3 rounded-2xl text-xs font-bold transition-all ${answers[c.id] === choice ? 'bg-[#A98159] text-white' : 'bg-gray-50 text-[#6D6E71] border border-gray-100'}`}>
                          {choice}
                        </button>
                      ))}
                    </div>
                  )}
                  {(c.type === 'yesno' || c.type === 'yesno_detail') && (
                    <div className="flex gap-3">
                      <button onClick={() => handleAnswer(c.id, 'نعم')}
                        className={`flex-1 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 ${answers[c.id] === 'نعم' ? 'bg-[#386B41] text-white' : 'bg-gray-50 border border-gray-100 text-[#6D6E71]'}`}>
                        <CheckCircle2 size={18} /> نعم
                      </button>
                      <button onClick={() => handleAnswer(c.id, 'لا')}
                        className={`flex-1 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 ${answers[c.id] === 'لا' ? 'bg-[#BA1A1A] text-white' : 'bg-gray-50 border border-gray-100 text-[#6D6E71]'}`}>
                        <AlertCircle size={18} /> لا
                      </button>
                    </div>
                  )}
                  {c.type === 'yesno_detail' && answers[c.id] === 'نعم' && (
                    <input type="text" className="w-full mt-3 border rounded-xl px-4 py-3 text-sm focus:border-[#A98159] outline-none"
                      value={details[c.id] || ''} onChange={e => handleDetail(c.id, e.target.value)}
                      placeholder={c.detailLabel} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 border-t border-[#D1C4B9] z-50">
        <button onClick={handleSubmit} disabled={loading}
          className="w-full max-w-md mx-auto bg-[#A98159] text-white py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
          {loading ? 'جاري الإرسال...' : <><Save size={22} /> حفظ وإرسال تقييم الجاهزية</>}
        </button>
      </div>
    </div>
  );
}
