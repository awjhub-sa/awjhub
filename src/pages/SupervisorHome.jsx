import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { 
  Utensils, AlertTriangle, Truck, Bell, User, ChevronDown, 
  TrendingUp, ClipboardCheck, MapPin, Home as HomeIcon, 
  Mountain, Building2, Package, Clock, LogOut 
} from 'lucide-react';
import logo from '../assets/logo.png';
import { useAuth } from '../context/AuthContext.jsx';
import { getCaterer } from '../config/centers.js';
import { db } from '../config/db.js';

/* ── المكونات الزخرفية ── */
const GoldRule = () => (
  <svg width="100" height="6" viewBox="0 0 100 6" fill="none">
    <line x1="0" y1="3" x2="32" y2="3" stroke="#A98159" strokeWidth="0.75" />
    <circle cx="50" cy="3" r="2.5" fill="#A98159" />
    <line x1="68" y1="3" x2="100" y2="3" stroke="#A98159" strokeWidth="0.75" />
  </svg>
);

const ACTIVITY_CFG = {
  reports: { label: 'بلاغ طارئ', Icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  meal_evaluations: { label: 'تقييم وجبات', Icon: Utensils, color: '#A98159', bg: '#FDF8F0', border: '#D1C4B9' },
  mina_readiness: { label: 'جاهزية منى', Icon: HomeIcon, color: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD' },
  arafat_readiness: { label: 'جاهزية عرفة', Icon: Mountain, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  logistics_requests: { label: 'طلب إسناد', Icon: Package, color: '#3182CE', bg: '#EFF6FF', border: '#BFDBFE' },
};

export default function SupervisorHome() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [clock, setClock] = useState({ hijri: '', time: '' });
  const [activities, setActivities] = useState([]);
  const [showAll, setShowAll] = useState(false);
  
  // المراكز المتاحة للمشرف مرتبة تصاعدياً
  const [assignedCenters, setAssignedCenters] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [showCenterMenu, setShowCenterMenu] = useState(false);

  // 1. إعداد الساعة والمراكز عند التحميل
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock({
        hijri: now.toLocaleDateString('ar-SA-u-ca-islamic', { year: 'numeric', month: 'long', day: 'numeric' }),
        time: now.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', hour12: true }),
      });
    };
    tick();
    const id = setInterval(tick, 30000);

    if (profile?.centers && Array.isArray(profile.centers)) {
      // ترتيب المراكز تصاعدياً (بافتراض أنها أرقام أو نصوص تحتوي أرقام)
      const sorted = [...profile.centers].sort((a, b) => {
        const numA = parseInt(String(a).replace(/\D/g, '')) || 0;
        const numB = parseInt(String(b).replace(/\D/g, '')) || 0;
        return numA - numB;
      });
      setAssignedCenters(sorted);
      setSelectedCenter(sorted[0]); // اختيار أصغر مركز تلقائياً
    }

    return () => clearInterval(id);
  }, [profile]);

  // 2. جلب النشاطات بناءً على المركز المختار
  useEffect(() => {
    if (!selectedCenter) return;
    
    setActivities([]); // تصفير القائمة عند تغيير المركز
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    const collectionsToTrack = Object.keys(ACTIVITY_CFG);
    const unsubs = collectionsToTrack.map(col => {
      // البحث عن كل الوثائق التي تنتمي للمركز المختار
      const q = query(collection(db, col), where('center', '==', selectedCenter));
      
      return onSnapshot(q, snap => {
        const docs = snap.docs
          .map(d => ({ id: d.id, _col: col, ...d.data() }))
          .filter(d => {
             const ts = d.timestamp?.toMillis?.() || d.createdAt?.toMillis?.() || 0;
             return ts >= todayMs;
          });

        setActivities(prev => {
          const others = prev.filter(a => a._col !== col);
          const combined = [...others, ...docs];
          return combined.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
        });
      });
    });

    return () => unsubs.forEach(unsub => unsub());
  }, [selectedCenter]);

  const name = profile?.nameAr || profile?.name || 'المشرف الميداني';
  const caterer = getCaterer(selectedCenter) || '—';

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] font-arabic pb-10">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] px-4 py-3 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Logo" className="w-10 h-10" />
            <div>
              <p className="text-xs font-bold text-[#2D2926]">ضيوف البيت</p>
              <p className="text-[10px] text-[#A98159] font-bold">لوحة تحكم المشرف</p>
            </div>
          </div>
          <button onClick={() => navigate('/profile')} className="w-10 h-10 rounded-xl bg-[#FDF8F0] border border-[#A98159]/20 flex items-center justify-center">
            <User size={18} className="text-[#A98159]" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-6 space-y-6">
        
        {/* Top Dashboard Card */}
        <div className="rounded-[2.5rem] overflow-hidden shadow-xl bg-[#2D2926] p-8 relative">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-white/50 text-sm mb-1">مرحباً بك (مشرف)،</p>
              <h2 className="text-white font-bold text-2xl">{name}</h2>
              <div className="flex items-center gap-2 mt-2 text-[#A98159]">
                <MapPin size={14} />
                <span className="text-sm font-bold">نطاق الإشراف الميداني</span>
              </div>
            </div>

            {/* Selector Center Box */}
            <div className="relative">
              <button 
                onClick={() => setShowCenterMenu(!showCenterMenu)}
                className="bg-white/10 hover:bg-white/20 transition-all rounded-2xl px-5 py-3 text-center border border-white/10 flex flex-col items-center min-w-[100px]"
              >
                <p className="text-white/50 text-[10px] mb-1">المركز الحالي</p>
                <div className="flex items-center gap-2">
                  <p className="text-[#A98159] font-bold text-2xl leading-tight">
                    {selectedCenter?.replace('مركز ', '') || '—'}
                  </p>
                  <ChevronDown size={16} className="text-white/50" />
                </div>
              </button>

              {/* Dropdown Menu */}
              {showCenterMenu && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-[#D1C4B9] z-[60] overflow-hidden animate-fade-in">
                  <p className="px-4 py-2 text-[10px] font-bold text-[#6D6E71] bg-[#FDF8F0]">اختر المركز للمتابعة</p>
                  <div className="max-height-[250px] overflow-y-auto">
                    {assignedCenters.map(c => (
                      <button
                        key={c}
                        onClick={() => { setSelectedCenter(c); setShowCenterMenu(false); }}
                        className={`w-full text-right px-4 py-3 text-sm font-bold border-b border-gray-50 last:border-0 hover:bg-[#FDF8F0] transition-colors ${selectedCenter === c ? 'text-[#A98159] bg-[#FDF8F0]' : 'text-[#2D2926]'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mb-6 w-48"><GoldRule /></div>

          <div className="bg-white/5 rounded-2xl px-5 py-4 border border-white/10">
            <div className="flex items-start gap-3">
              <Building2 size={18} className="text-[#A98159] mt-0.5" />
              <div>
                <p className="text-white/50 text-[10px] mb-1">المتعهد الحالي للمركز المختار</p>
                <p className="text-white text-sm font-bold">{caterer}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Menu for Supervisor */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
                { icon: Utensils, label: 'تقييمات الوجبات', path: '/mealcheck' },
                { icon: HomeIcon, label: 'جاهزية منى', path: '/mina-readiness' },
                { icon: Mountain, label: 'جاهزية عرفة', path: '/arafat-readiness' },
                { icon: AlertTriangle, label: 'البلاغات', path: '/report' }
            ].map((item, idx) => (
                <button 
                  key={idx}
                  onClick={() => navigate(item.path, { state: { center: selectedCenter } })}
                  className="bg-white border border-[#D1C4B9] p-4 rounded-2xl flex flex-col items-center gap-2 hover:border-[#A98159] transition-all"
                >
                    <item.icon size={20} className="text-[#A98159]" />
                    <span className="text-xs font-bold text-[#2D2926]">{item.label}</span>
                </button>
            ))}
        </div>

        {/* Activity Feed */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <ClipboardCheck size={20} className="text-[#A98159]" />
            <span className="text-lg font-black text-[#2D2926]">نشاط مراقبي {selectedCenter}</span>
          </div>

          {activities.length === 0 ? (
            <div className="bg-white border border-[#D1C4B9] rounded-3xl py-12 text-center">
              <Clock size={40} className="mx-auto text-[#D1C4B9] mb-3 opacity-40" />
              <p className="text-[#6D6E71] text-sm font-bold">لا يوجد نشاط مسجل لهذا المركز اليوم</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.slice(0, showAll ? undefined : 5).map(item => {
                const cfg = ACTIVITY_CFG[item._col];
                return (
                  <div key={item.id} className="bg-white border border-[#D1C4B9] rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: cfg.bg }}>
                      <cfg.Icon size={18} style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <p className="text-sm font-bold text-[#2D2926]">{item.reportType || item.type || cfg.label}</p>
                        <span className="text-[10px] text-[#6D6E71]">{item.monitorName || 'مراقب ميداني'}</span>
                      </div>
                      <p className="text-[10px] text-[#A98159] mt-1">بواسطة: {item.monitorName || 'مراقب'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}