import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Save, CheckCircle2, AlertCircle, Home, ArrowLeft, Ban, Calendar } from 'lucide-react';
import { db, serverTimestamp } from '../lib/db.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getCaterer } from '../config/centers.js';
import { useAssignedTasks } from '../hooks/useAssignedTasks.js';
import { computeReadinessTotals } from '../config/readinessScore.js';
import { MINA_SECTIONS, MINA_ALL_CRITERIA } from '../config/minaQuestions.js';

const SECTIONS = MINA_SECTIONS;
const ALL_CRITERIA = MINA_ALL_CRITERIA;
const REQUIRED_IDS = ALL_CRITERIA.filter(c => c.type !== 'choice' && c.type !== 'yesno_detail').map(c => c.id);

export default function MinaReadiness() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [answers, setAnswers] = useState({});
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const { tasks, completions, loading: tasksLoading } = useAssignedTasks(profile);

  const minaTasks = tasks.filter(t => t.taskTypes?.includes('mina_readiness'));
  const isDone = (task) => completions.some(c => c.taskId === task.id && c.taskType === 'mina_readiness');
  const pendingTasks = minaTasks.filter(t => !isDone(t));
  const doneTasks = minaTasks.filter(t => isDone(t));

  const handleAnswer = (id, value) => setAnswers(prev => ({ ...prev, [id]: value }));
  const handleDetail = (id, value) => setDetails(prev => ({ ...prev, [id]: value }));

  const totalRequired = ALL_CRITERIA.length;

  const handleSubmit = async () => {
    const unanswered = REQUIRED_IDS.filter(id => !answers[id]);
    if (unanswered.length > 0) {
      alert(`المتبقي: ${unanswered.length} بند`);
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
        answers,
        details,
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
          timestamp: serverTimestamp(),
        });
      }
      alert('تم إرسال التقييم بنجاح');
      setSelectedTask(null);
      setAnswers({});
      setDetails({});
    } catch (e) {
      alert('خطأ في الإرسال');
    }
    setLoading(false);
  };

  
  if (!selectedTask) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-28 font-arabic px-4 md:px-8">
        <header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] w-full px-4 md:px-8 py-3 mb-6 shadow-sm">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <button onClick={() => navigate('/home')} className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 rounded-xl transition shrink-0">
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
              <p className="text-[#9D8F85] text-sm max-w-xs">لم يتم إسناد مهام جاهزية منى لمركزك بعد</p>
              <button onClick={() => navigate('/home')}
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
                      onClick={() => setSelectedTask({ taskId: task.id, scheduledDate: task.scheduledDate })}
                      className="w-full bg-gradient-to-br from-white to-[#FDF8F0]/60 border border-[#D1C4B9] rounded-3xl p-5 text-right flex items-center gap-4 hover:border-[#A98159] hover:shadow-[0_8px_24px_rgba(169,129,89,0.18)] hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98]">
                      <div className="w-12 h-12 bg-[#FDF8F0] border border-[#A98159]/20 rounded-2xl flex items-center justify-center shrink-0">
                        <Home className="text-[#A98159]" size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#2D2926] text-sm">جاهزية مشعر منى</p>
                        {task.scheduledDate && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Calendar size={12} className="text-[#A98159]" />
                            <span className="text-xs text-[#A98159] font-bold">{task.scheduledDate}</span>
                          </div>
                        )}
                      </div>
                      <ChevronRight size={18} className="text-[#A98159] shrink-0" />
                    </button>
                  ))}
                </>
              )}

              {doneTasks.length > 0 && (
                <>
                  <p className="text-sm font-black text-[#9D8F85] px-1 mt-6 mb-2">المهام المكتملة</p>
                  {doneTasks.map(task => (
                    <div key={task.id} className="bg-[#F0FDF4] border border-green-200 rounded-3xl p-5 flex items-center gap-4 opacity-80">
                      <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center shrink-0">
                        <CheckCircle2 className="text-green-600" size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-green-800 text-sm">جاهزية مشعر منى</p>
                        {task.scheduledDate && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Calendar size={12} className="text-green-600" />
                            <span className="text-xs text-green-600 font-bold">{task.scheduledDate}</span>
                          </div>
                        )}
                        <p className="text-xs text-green-600 font-bold mt-0.5">تم الإرسال</p>
                      </div>
                      <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                    </div>
                  ))}
                </>
              )}

              {pendingTasks.length === 0 && doneTasks.length > 0 && (
                <div className="text-center pt-6">
                  <button onClick={() => navigate('/home')}
                    className="inline-flex items-center gap-2 text-[#A98159] font-bold text-sm border border-[#A98159]/30 px-5 py-2.5 rounded-xl hover:bg-[#FDF8F0] transition">
                    <ArrowLeft size={16} /> العودة للرئيسية
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
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-28 font-arabic px-4 md:px-8">
      <header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] w-full px-4 md:px-8 py-3 mb-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={() => { setSelectedTask(null); setAnswers({}); setDetails({}); }}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 rounded-xl transition shrink-0 border border-transparent active:border-[#A98159]/20">
            <ChevronRight className="text-[#A98159]" size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-base font-bold text-[#2D2926] absolute left-1/2 -translate-x-1/2 whitespace-nowrap">جاهزية مشعر منى</h1>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      {/* Header Card */}
      <div className="rounded-[2.5rem] p-6 my-6 text-white shadow-lg relative overflow-hidden"
        style={{ background: '#2D2926' }}>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-3 rounded-2xl">
              <Home className="text-[#A98159]" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold">{totalRequired} بندًا للجاهزية</h2>
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
          <div className="bg-white/5 rounded-2xl px-4 py-3 flex-1 min-w-[120px] flex flex-col items-center justify-center border border-white/10 shadow-sm">
            <span className="text-white/40 text-[10px] mb-1 font-medium">المراقب</span>
            <span className="text-white font-bold text-sm whitespace-nowrap">{profile?.nameAr || profile?.name || '—'}</span>
          </div>
          <div className="bg-white/5 rounded-2xl px-4 py-3 flex-1 min-w-[100px] flex flex-col items-center justify-center border border-white/10 shadow-sm">
            <span className="text-white/40 text-[10px] mb-1 font-medium">المركز</span>
            <span className="text-[#A98159] font-bold text-sm whitespace-nowrap">{profile?.center || '—'}</span>
          </div>
          <div className="bg-white/5 rounded-2xl px-4 py-3 flex-1 min-w-[140px] flex flex-col items-center justify-center border border-white/10 shadow-sm">
            <span className="text-white/40 text-[10px] mb-1 font-medium">المتعهد</span>
            <span className="text-white font-bold text-sm whitespace-nowrap">{profile?.caterer || getCaterer(profile?.center) || '—'}</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {SECTIONS.map(section => (
          <div key={section.id}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#A98159]/40 to-transparent" />
              <span className="px-5 py-2 rounded-full text-white text-xs font-black shadow-[0_4px_14px_rgba(169,129,89,0.35)]"
                style={{ background: 'linear-gradient(135deg, #C4A46E, #A98159)' }}>
                {section.title}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#A98159]/40 to-transparent" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.criteria.map(c => {
                const ans = answers[c.id];
                const isYes = ans === 'نعم';
                const isNo  = ans === 'لا';
                return (
                  <div key={c.id} className={`group/q relative bg-gradient-to-br from-white via-white to-[#FDF8F0]/40 rounded-3xl shadow-[0_2px_12px_rgba(45,41,38,0.05)] overflow-hidden transition-all duration-300 ${
                    ans
                      ? 'border-2 border-[#A98159]/40 shadow-[0_6px_24px_rgba(169,129,89,0.18)]'
                      : 'border border-[#EDE5DC] hover:shadow-[0_4px_18px_rgba(45,41,38,0.08)]'
                  }`}>
                    {ans && (
                      <div className="absolute top-0 right-0 left-0 h-1"
                        style={{ background: isYes
                          ? 'linear-gradient(90deg, #16A34A, #22C55E, #16A34A)'
                          : isNo
                            ? 'linear-gradient(90deg, #DC2626, #EF4444, #DC2626)'
                            : 'linear-gradient(90deg, #A98159, #C4A46E, #A98159)' }} />
                    )}
                    <div className="p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="relative flex-shrink-0">
                          <div className="absolute inset-0 rounded-2xl blur-md bg-[#A98159] opacity-30 group-hover/q:opacity-50 transition-opacity" />
                          <div className="relative w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-md tabular-nums"
                            style={{ background: 'linear-gradient(135deg, #C4A46E, #A98159)' }}>
                            {c.id}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          {ans && (
                            <div className="mb-1.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700">
                                <CheckCircle2 size={9} strokeWidth={2.5} />
                                مُجاب
                              </span>
                            </div>
                          )}
                          <p className="text-[#2D2926] font-bold text-[15px] leading-relaxed">{c.text}</p>
                        </div>
                      </div>

                      {c.type === 'choice' && (
                        <div className="grid grid-cols-2 gap-2">
                          {c.choices.map(choice => {
                            const sel = answers[c.id] === choice;
                            return (
                              <button key={choice} onClick={() => handleAnswer(c.id, choice)}
                                className={`py-3 rounded-2xl text-xs font-bold transition-all duration-300 ${
                                  sel
                                    ? 'text-white scale-[1.02] shadow-[0_4px_14px_rgba(169,129,89,0.4)]'
                                    : 'bg-white text-[#6D6E71] border-2 border-[#E8DDD4] hover:border-[#A98159]/40 hover:bg-[#FDF8F0]'
                                }`}
                                style={sel ? { background: 'linear-gradient(135deg, #C4A46E, #A98159)' } : undefined}
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
                                ? 'text-white scale-[1.02] shadow-[0_6px_20px_rgba(56,107,65,0.4)]'
                                : 'bg-white text-[#6D6E71] border-2 border-[#E8DDD4] hover:border-[#A98159]/40 hover:bg-[#FDF8F0]'
                            }`}
                            style={isYes ? { background: 'linear-gradient(135deg, #16A34A, #15803D)' } : undefined}
                          >
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${isYes ? 'bg-white/25 scale-110' : 'bg-[#386B41]/10'}`}>
                              <CheckCircle2 size={16} strokeWidth={2.5} className={isYes ? 'text-white' : 'text-[#386B41]'} />
                            </div>
                            <span className="text-[15px]">نعم</span>
                          </button>
                          <button
                            onClick={() => handleAnswer(c.id, 'لا')}
                            className={`min-h-[52px] py-3.5 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-2.5 active:scale-[0.98] ${
                              isNo
                                ? 'text-white scale-[1.02] shadow-[0_6px_20px_rgba(186,26,26,0.4)]'
                                : 'bg-white text-[#6D6E71] border-2 border-[#E8DDD4] hover:border-red-300 hover:bg-red-50/30'
                            }`}
                            style={isNo ? { background: 'linear-gradient(135deg, #DC2626, #B91C1C)' } : undefined}
                          >
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${isNo ? 'bg-white/25 scale-110' : 'bg-[#BA1A1A]/10'}`}>
                              <AlertCircle size={16} strokeWidth={2.5} className={isNo ? 'text-white' : 'text-[#BA1A1A]'} />
                            </div>
                            <span className="text-[15px]">لا</span>
                          </button>
                        </div>
                      )}

                      {c.type === 'yesno_detail' && answers[c.id] === 'نعم' && (
                        <input type="text"
                          className="w-full mt-3 border-2 border-[#E8DDD4] rounded-xl px-4 py-3 text-sm focus:border-[#A98159] focus:ring-2 focus:ring-[#A98159]/15 outline-none transition-all"
                          value={details[c.id] || ''}
                          onChange={e => handleDetail(c.id, e.target.value)}
                          placeholder={c.detailLabel}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white/90 border-t border-[#D1C4B9] z-50">
        <button onClick={handleSubmit} disabled={loading}
          className="w-full max-w-md mx-auto min-h-[56px] bg-gradient-to-br from-[#C4A46E] to-[#A98159] text-white py-4 rounded-2xl font-bold text-lg active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
          {loading ? 'جاري الإرسال...' : <><Save size={22} /> حفظ وإرسال تقييم الجاهزية</>}
        </button>
      </div>
    </div>
  );
}
