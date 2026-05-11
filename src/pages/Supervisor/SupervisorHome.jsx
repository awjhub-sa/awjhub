import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';
import { 
  Utensils, AlertTriangle, Bell, User, ChevronDown, ChevronLeft,
  TrendingUp, ClipboardCheck, MapPin, Home as HomeIcon, 
  Mountain, Building2, Package, Clock, LogOut, CheckCircle2, 
  ArrowLeftRight, Loader2, Mail, Hash
} from 'lucide-react';
import logo from "../../assets/logo.png";
import { useAuth } from '../../context/AuthContext.jsx';
import { getCaterer } from '../../config/centers.js';
import { db } from '../../config/db.js';

/* ── المكونات الزخرفية ── */
const GoldRule = () => (
  <svg width="100" height="6" viewBox="0 0 100 6" fill="none">
    <line x1="0" y1="3" x2="32" y2="3" stroke="#A98159" strokeWidth="0.75" />
    <circle cx="40" cy="3" r="1.2" fill="#A98159" opacity="0.5" />
    <circle cx="50" cy="3" r="2.5" fill="#A98159" />
    <circle cx="60" cy="3" r="1.2" fill="#A98159" opacity="0.5" />
    <line x1="68" y1="3" x2="100" y2="3" stroke="#A98159" strokeWidth="0.75" />
  </svg>
);

/* ── بطاقة القائمة (MenuCard) ── */
const MenuCard = ({ icon: Icon, title, subtitle, badge, onClick, variant = 'default' }) => {
  const isAccent = variant === 'accent';
  return (
    <button
      onClick={onClick}
      className={`group w-full text-right rounded-2xl p-5 flex items-center gap-4 transition-all duration-300 active:scale-[0.97] border ${
        isAccent ? 'border-transparent text-white' : 'bg-white border-[#D1C4B9] hover:border-[#A98159]/50 hover:shadow-lg text-[#2D2926]'
      }`}
      style={isAccent ? { background: 'linear-gradient(135deg, #3D3330 0%, #2D2926 100%)', boxShadow: '0 4px 20px rgba(45,41,38,0.25)' } : {}}
    >
      <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
        isAccent ? 'bg-white/10' : 'bg-[#FDF8F0] border border-[#A98159]/20'
      }`}>
        <Icon size={26} className="text-[#A98159]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-base">{title}</span>
          {badge && <span className="bg-[#BA1A1A] text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">{badge}</span>}
        </div>
        <p className={`text-sm mt-0.5 truncate ${isAccent ? 'text-white/50' : 'text-[#6D6E71]'}`}>{subtitle}</p>
      </div>
      <ChevronLeft size={18} className={`flex-shrink-0 opacity-50 ${isAccent ? 'text-white' : 'text-[#A98159]'}`} />
    </button>
  );
};

const ACTIVITY_CFG = {
  reports: { label: 'بلاغ طارئ', Icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  meal_evaluations: { label: 'تقييم وجبات', Icon: Utensils, color: '#A98159', bg: '#FDF8F0', border: '#D1C4B9' },
  mina_readiness: { label: 'جاهزية منى', Icon: HomeIcon, color: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD' },
  arafat_readiness: { label: 'جاهزية عرفة', Icon: Mountain, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  logistics_requests: { label: 'طلب إسناد', Icon: Package, color: '#3182CE', bg: '#EFF6FF', border: '#BFDBFE' },
};

const STATUS_DATA = {
  pending: { label: 'قيد الانتظار', bg: '#FEF9C3', text: '#854D0E' },
  in_progress: { label: 'جارٍ التنفيذ', bg: '#DBEAFE', text: '#1E40AF' },
  resolved: { label: 'تم الحل', bg: '#DCFCE7', text: '#166534' },
};

export default function SupervisorHome() {
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();
  const [clock, setClock] = useState({ hijri: '', time: '' });
  const [activities, setActivities] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [assignedCenters, setAssignedCenters] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const fetchCenters = async () => {
      if (!user?.uid) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const centers = userDoc.data().centers || [];
          const sorted = centers.sort((a, b) => {
            const numA = parseInt(String(a).replace(/\D/g, '')) || 0;
            const numB = parseInt(String(b).replace(/\D/g, '')) || 0;
            return numA - numB;
          });
          setAssignedCenters(sorted);
          setSelectedCenter(sorted[0]);
        }
      } catch (e) { console.error(e); }
      finally { setLoadingData(false); }
    };
    fetchCenters();

    const tick = () => {
      const now = new Date();
      setClock({
        hijri: now.toLocaleDateString('ar-SA-u-ca-islamic', { year: 'numeric', month: 'long', day: 'numeric' }),
        time: now.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', hour12: true }),
      });
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [user]);

  useEffect(() => {
    if (!selectedCenter) return;
    const todayMs = new Date().setHours(0,0,0,0);
    const unsubs = Object.keys(ACTIVITY_CFG).map(col => {
      const q = query(collection(db, col), where('center', '==', selectedCenter));
      return onSnapshot(q, snap => {
        const docs = snap.docs
          .map(d => ({ id: d.id, _col: col, ...d.data() }))
          .filter(d => (d.timestamp?.toMillis?.() || 0) >= todayMs);
        setActivities(prev => {
          const others = prev.filter(a => a._col !== col);
          return [...others, ...docs].sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
        });
      });
    });
    return () => unsubs.forEach(unsub => unsub());
  }, [selectedCenter]);

  const handleLogout = async () => {
    try {
      setIsProfileOpen(false);
      localStorage.clear();
      sessionStorage.clear();
      await logout();
      window.location.replace('./login');
    } catch (e) {
      console.error("Logout Error:", e);
      window.location.replace('./login');
    }
  };

  if (loadingData) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB]">
      <Loader2 className="animate-spin text-[#A98159]" size={40} />
    </div>
  );

  const caterer = getCaterer(selectedCenter) || '—';
  const displayed = showAll ? activities : activities.slice(0, 4);

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] font-arabic pb-10 overflow-x-hidden text-right">
      
      {(isSheetOpen || isProfileOpen) && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity duration-300" 
          onClick={() => { setIsSheetOpen(false); setIsProfileOpen(false); }} 
        />
      )}

      <header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] w-full px-4 py-3 mb-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
            <div>
              <p className="text-xs font-bold text-[#2D2926]">ضيوف البيت</p>
              <p className="text-[10px] text-[#A98159] font-bold leading-tight">لوحة تحكم المشرف</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-10 h-10 rounded-xl border border-[#D1C4B9] flex items-center justify-center hover:bg-[#FDF8F0] transition-colors"><Bell size={18} className="text-[#6D6E71]" /></button>
            <button 
              onClick={() => setIsProfileOpen(true)} 
              className="w-10 h-10 rounded-xl bg-[#FDF8F0] border border-[#A98159]/20 flex items-center justify-center hover:bg-[#A98159] hover:text-white group transition-all"
            >
              <User size={18} className="text-[#A98159] group-hover:text-white" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-6">
          <div className="animate-fade-slide-up shadow-xl rounded-[2.5rem] overflow-hidden">
            <div className="p-8 relative overflow-hidden bg-[#2D2926]">
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #A98159 0, #A98159 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }} />
              <div className="flex items-start justify-between mb-6 relative">
                <div className="flex-1 min-w-0">
                  <p className="text-white/50 text-sm mb-1">مرحباً بك (مشرف)،</p>
                  <h2 className="text-white font-bold text-2xl truncate">{profile?.nameAr || profile?.name || 'المشرف الميداني'}</h2>
                  <div className="flex items-center gap-2 mt-2"><MapPin size={14} className="text-[#A98159]" /><span className="text-[#A98159] text-sm font-bold">نطاق الإشراف الميداني</span></div>
                </div>
                <button onClick={() => setIsSheetOpen(true)} className="bg-white/10 hover:bg-white/20 transition-all rounded-2xl px-5 py-3 text-center border border-white/10 flex flex-col items-center min-w-[100px]">
                  <p className="text-white/50 text-[10px] mb-1 font-bold">المركز الحالي</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[#A98159] font-bold text-2xl">{selectedCenter?.replace('مركز ', '') || '—'}</p>
                    <ChevronDown size={16} className="text-white/50" />
                  </div>
                </button>
              </div>
              <div className="mb-6 relative w-48"><GoldRule /></div>
              <div className="bg-white/5 rounded-2xl px-5 py-4 border border-white/10 backdrop-blur-sm flex items-start gap-3">
                <Building2 size={18} className="text-[#A98159] mt-0.5" />
                <div><p className="text-white/50 text-[10px] mb-1">{selectedCenter} — المتعهد المسجل</p><p className="text-white text-sm font-bold leading-snug">{caterer}</p></div>
              </div>
            </div>
            <div className="bg-[#FDF8F0] px-6 py-3 flex items-center justify-between border-t border-[#D1C4B9]/30">
              <div className="flex items-center gap-2 text-[#A98159]"><TrendingUp size={14} /><span className="text-xs font-bold text-[#2D2926]">{clock.hijri}</span></div>
              <div className="flex items-center gap-2"><Clock size={12} className="text-[#6D6E71]" /><span className="text-xs text-[#6D6E71] font-bold">{clock.time}</span></div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <ClipboardCheck size={20} className="text-[#A98159]" />
              <span className="text-lg font-black text-[#2D2926]">نشاط مراقبي {selectedCenter}</span>
            </div>
            {activities.length === 0 ? (
              <div className="bg-white border border-[#D1C4B9] rounded-3xl py-12 text-center shadow-sm">
                <Clock size={40} className="mx-auto text-[#D1C4B9] mb-3 opacity-40" />
                <p className="text-[#6D6E71] text-sm font-bold">لا يوجد نشاط مسجل للمركز اليوم</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {displayed.map(item => {
                  const cfg = ACTIVITY_CFG[item._col];
                  const statusInfo = STATUS_DATA[item.status] || { label: item.status, bg: '#F3F4F6', text: '#374151' };
                  return (
                    <div key={item.id} className="bg-white border border-[#D1C4B9] rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                      <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: cfg.color }} />
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}><cfg.Icon size={20} style={{ color: cfg.color }} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-base font-bold text-[#2D2926] truncate">{item.reportType || item.type || cfg.label}</p>
                          <span className="text-xs text-[#6D6E71] font-bold">{new Date(item.timestamp?.toMillis?.()).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="flex items-center justify-between">
                           <p className="text-[10px] text-[#A98159] font-bold flex items-center gap-1"><User size={10} /> بواسطة: {item.observer || 'مراقب ميداني'}</p>
                           {item.status && <span className="text-[10px] font-black px-3 py-0.5 rounded-full" style={{ background: statusInfo.bg, color: statusInfo.text }}>{statusInfo.label}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {activities.length > 4 && <button onClick={() => setShowAll(!showAll)} className="w-full py-3 text-[#A98159] font-bold text-sm bg-white hover:bg-gray-50 rounded-2xl transition-all border border-dashed border-[#D1C4B9] mt-2">{showAll ? 'عرض أقل' : `عرض الكل (${activities.length})`}</button>}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          <div className="flex items-center gap-3"><div className="h-px flex-1 bg-[#D1C4B9]/50" /><span className="text-[10px] font-black text-[#A98159] uppercase tracking-widest">إجراءات المشرف</span><div className="h-px flex-1 bg-[#D1C4B9]/50" /></div>
          <div className="grid grid-cols-1 gap-4">
            <MenuCard icon={Utensils} title="تقييم جودة الوجبات" onClick={() => navigate('/sup-mealcheck', { state: { centerId: selectedCenter } })} variant="accent" />
            <MenuCard icon={HomeIcon} title="جاهزية مشعر منى" onClick={() => navigate('/sup-mina-readiness', { state: { centerId: selectedCenter } })} />
            <MenuCard icon={Mountain} title="جاهزية مشعر عرفة" onClick={() => navigate('/sup-arafat-readiness', { state: { centerId: selectedCenter } })} />
            <MenuCard icon={Package} title="طلب إسناد لوجستي" onClick={() => navigate('/sup-logistics', { state: { centerId: selectedCenter } })} />
            <MenuCard icon={AlertTriangle} title="بلاغ ميداني" onClick={() => navigate('/sup-report', { state: { centerId: selectedCenter } })} badge="عاجل" />
          </div>
        </div>
      </main>

      <div className={`fixed inset-y-0 left-0 z-[101] w-full max-w-sm bg-white shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] transform border-r border-[#D1C4B9] ${isProfileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col bg-[#FDFCFB]">
          <div className="p-8 bg-[#2D2926] text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #A98159 1px, transparent 0)', backgroundSize: '20px 20px' }} />
            <button onClick={() => setIsProfileOpen(false)} className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"><ChevronLeft size={20} className="rotate-180" /></button>
            <div className="relative mt-4 text-center">
              <div className="w-20 h-20 rounded-[2rem] bg-[#A98159] flex items-center justify-center shadow-2xl mb-4 border-4 border-white/10 mx-auto"><User size={40} className="text-white" /></div>
              <h3 className="text-2xl font-bold">{profile?.nameAr || profile?.name}</h3>
              <p className="text-[#A98159] text-sm font-bold mt-1 opacity-80 uppercase tracking-widest">مشرف ميداني</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-3">
              <p className="text-[10px] font-black text-[#A98159] uppercase tracking-[0.2em] px-2 text-right">معلومات الحساب</p>
              <div className="bg-white border border-[#D1C4B9] rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#FDF8F0] flex items-center justify-center text-[#A98159]"><Mail size={18} /></div>
                <div className="min-w-0 text-right"><p className="text-[10px] text-[#6D6E71] font-bold">البريد الإلكتروني</p><p className="text-sm font-bold text-[#2D2926] truncate">{user?.email}</p></div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                 <span className="bg-[#A98159]/10 text-[#A98159] text-[10px] font-bold px-2 py-0.5 rounded-full">{assignedCenters.length} مراكز</span>
                 <p className="text-[10px] font-black text-[#A98159] uppercase tracking-[0.2em]">نطاق الإشراف</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {assignedCenters.map(center => (
                  <div key={center} className="flex items-center justify-between p-4 bg-white border border-[#D1C4B9] rounded-2xl shadow-sm">
                    {selectedCenter === center ? <CheckCircle2 size={16} className="text-[#386B41]" /> : <div />}
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#2D2926]">{center}</span>
                      <div className="w-2 h-2 rounded-full bg-[#A98159]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-6 border-t border-[#D1C4B9]">
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 py-4 bg-[#BA1A1A] text-white rounded-2xl font-bold shadow-lg transition-all active:scale-[0.98]"><LogOut size={20} /> تسجيل الخروج</button>
          </div>
        </div>
      </div>

      <div className={`fixed bottom-0 left-0 right-0 z-[101] bg-white rounded-t-[3rem] shadow-2xl transition-transform duration-500 transform border-t border-[#D1C4B9] ${isSheetOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex justify-center py-5 cursor-pointer" onClick={() => setIsSheetOpen(false)}><div className="w-14 h-1.5 bg-[#D1C4B9] rounded-full opacity-40" /></div>
        <div className="px-8 pb-12 max-h-[70vh] overflow-y-auto text-center">
          <h3 className="text-xl font-black text-[#2D2926] mb-6">تبديل مركز الإشراف</h3>
          <div className="grid grid-cols-1 gap-3">
            {assignedCenters.map(centerItem => (
              <button key={centerItem} onClick={() => { setSelectedCenter(centerItem); setTimeout(() => setIsSheetOpen(false), 200); }} className={`w-full flex items-center justify-between px-6 py-5 rounded-[1.5rem] font-bold transition-all ${selectedCenter === centerItem ? 'bg-[#FDF8F0] text-[#A98159] border-2 border-[#A98159]' : 'bg-[#F9F7F5] border-2 border-transparent hover:border-[#D1C4B9]'}`}>
                <div className="flex items-center gap-4"><div className={`w-3 h-3 rounded-full ${selectedCenter === centerItem ? 'bg-[#A98159]' : 'bg-gray-300'}`} /><span>{centerItem}</span></div>
                {selectedCenter === centerItem && <CheckCircle2 size={20} className="text-[#A98159]" />}
              </button>
            ))}
          </div>
        </div>
      </div>
      <footer className="max-w-5xl mx-auto px-8 py-6 text-center"><p className="text-[10px] text-[#6D6E71]/60 font-bold uppercase tracking-widest">© ١٤٤٧ هـ — لوحة إشراف منظومة المراقبة الميدانية</p></footer>
      <style>{`@keyframes fadeSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-slide-up { animation: fadeSlideUp 0.5s ease-out forwards; }`}</style>
    </div>
  );
}