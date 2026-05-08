// src/pages/Home.jsx
import { useNavigate } from 'react-router-dom';
import {
  Utensils, AlertTriangle, Truck,
  Bell, User, ChevronLeft, TrendingUp,
  ClipboardCheck, Star, MapPin
} from 'lucide-react';

/* ── Reusable decorative rule ─────────────────────────────── */
const GoldRule = () => (
  <svg width="100" height="6" viewBox="0 0 100 6" fill="none">
    <line x1="0" y1="3" x2="32" y2="3" stroke="#A98159" strokeWidth="0.75" />
    <circle cx="40" cy="3" r="1.2" fill="#A98159" opacity="0.5" />
    <circle cx="50" cy="3" r="2.5" fill="#A98159" />
    <circle cx="60" cy="3" r="1.2" fill="#A98159" opacity="0.5" />
    <line x1="68" y1="3" x2="100" y2="3" stroke="#A98159" strokeWidth="0.75" />
  </svg>
);

/* ── Menu card component ──────────────────────────────────── */
const MenuCard = ({ icon: Icon, title, subtitle, badge, onClick, variant = 'default' }) => {
  const isAccent = variant === 'accent';
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-right rounded-2xl p-5
        flex items-center gap-4
        transition-all duration-200 active:scale-[0.97]
        border shadow-card
        ${isAccent
          ? 'bg-dark-gradient border-dark-800 text-white hover:shadow-card-lg'
          : 'bg-background border-appBorder hover:border-primary/40 hover:shadow-gold'}
      `}
      style={isAccent ? { background: 'linear-gradient(135deg, #3D3330 0%, #2D2926 100%)' } : {}}
    >
      {/* Icon bubble */}
      <div className={`
        flex-shrink-0 w-14 h-14 rounded-xl
        flex items-center justify-center
        ${isAccent
          ? 'bg-white/10'
          : 'bg-primary-50 border border-primary/20'}
      `}>
        <Icon
          size={26}
          className={isAccent ? 'text-primary' : 'text-primary'}
          strokeWidth={1.75}
        />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-bold text-base ${isAccent ? 'text-white' : 'text-dark'}`}>
            {title}
          </span>
          {badge && (
            <span className="bg-error text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <p className={`text-sm mt-0.5 truncate ${isAccent ? 'text-white/50' : 'text-secondary'}`}>
          {subtitle}
        </p>
      </div>

      {/* Chevron */}
      <ChevronLeft
        size={18}
        className={`flex-shrink-0 ${isAccent ? 'text-white/40' : 'text-primary/40'}`}
        strokeWidth={2}
      />
    </button>
  );
};

/* ── Stat pill ─────────────────────────────────────────── */
const StatPill = ({ label, value, icon: Icon }) => (
  <div className="bg-background border border-appBorder rounded-xl p-3 text-center flex-1">
    <div className="flex items-center justify-center gap-1.5 mb-1">
      <Icon size={13} className="text-primary" strokeWidth={2} />
      <span className="text-xs text-secondary">{label}</span>
    </div>
    <span className="text-lg font-bold text-dark">{value}</span>
  </div>
);

/* ══════════════════════════════════════════════════════════
   HOME PAGE
   ══════════════════════════════════════════════════════════ */
export default function Home() {
  const navigate = useNavigate();

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-background font-arabic"
      style={{ fontFamily: "'IBM Plex Sans Arabic', 'Noto Kufi Arabic', Tahoma, sans-serif" }}
    >

      {/* ── Sticky Header ───────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-appBorder px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gold-gradient flex items-center justify-center shadow-gold">
              <span className="text-white font-bold text-base" style={{ fontFamily: 'serif' }}>ض</span>
            </div>
            <div>
              <p className="text-xs font-bold text-dark leading-tight">ضيوف البيت</p>
              <p className="text-[10px] text-secondary leading-tight">منظومة المراقبة الميدانية</p>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-2">
            <button className="relative w-9 h-9 rounded-xl border border-appBorder flex items-center justify-center hover:bg-primary-50 transition-colors">
              <Bell size={17} className="text-secondary" strokeWidth={1.75} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full border border-background" />
            </button>
            <button className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center hover:bg-primary/20 transition-colors">
              <User size={17} className="text-primary" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pb-10">

        {/* ── Welcome Card ────────────────────────────────────── */}
        <div
          className="mt-5 rounded-2xl overflow-hidden shadow-card-lg"
          style={{ animation: 'fadeSlideUp 0.4s ease forwards' }}
        >
          {/* Dark banner */}
          <div
            className="p-5 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #3D3330 0%, #2D2926 55%, #1A1511 100%)' }}
          >
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-[0.03]"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, #A98159 0, #A98159 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }} />

            {/* Top row */}
            <div className="flex items-start justify-between mb-4 relative">
              <div>
                <p className="text-white/50 text-xs mb-0.5">مرحباً بك،</p>
                <h2 className="text-white font-bold text-xl leading-tight">عمر الرفاعي</h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <MapPin size={11} className="text-primary" />
                  <span className="text-primary text-xs font-medium">مراقب ميداني</span>
                </div>
              </div>
              <div className="text-left">
                <div className="bg-white/10 rounded-xl px-4 py-2 text-center border border-white/10">
                  <p className="text-white/50 text-[10px]">مركز رقم</p>
                  <p className="text-primary font-bold text-2xl leading-tight">٤٥</p>
                </div>
              </div>
            </div>

            {/* Gold divider */}
            <div className="mb-4 relative"><GoldRule /></div>

            {/* Stats row */}
            <div className="flex gap-2.5">
              <StatPill label="تقييمات اليوم"  value="٣"  icon={ClipboardCheck} />
              <StatPill label="بلاغات مفتوحة" value="١"  icon={AlertTriangle} />
              <StatPill label="متوسط التقييم"  value="٤.٢" icon={Star} />
            </div>
          </div>

          {/* Season badge */}
          <div className="bg-primary-50 border-t border-appBorder px-5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-primary" strokeWidth={2} />
              <span className="text-xs font-medium text-dark">موسم الحج ١٤٤٦ هـ</span>
            </div>
            <span className="text-xs text-secondary">٨ ذو الحجة</span>
          </div>
        </div>

        {/* ── Section label ───────────────────────────────────── */}
        <div className="flex items-center gap-3 mt-7 mb-4" style={{ animation: 'fadeSlideUp 0.4s ease 0.15s both' }}>
          <div className="h-px flex-1 bg-appBorder" />
          <span className="text-xs font-semibold text-secondary uppercase tracking-widest">القائمة الرئيسية</span>
          <div className="h-px flex-1 bg-appBorder" />
        </div>

        {/* ── Menu Items ──────────────────────────────────────── */}
        <div
          className="flex flex-col gap-3"
          style={{ animation: 'fadeSlideUp 0.4s ease 0.2s both' }}
        >
          <MenuCard
            icon={Utensils}
            title="تقييم جودة الوجبات"
            subtitle="رفع تقرير جودة وجبات الحجاج"
            onClick={() => navigate('/mealcheck')}
            variant="accent"
          />
          <MenuCard
            icon={AlertTriangle}
            title="بلاغ طارئ"
            subtitle="إرسال بلاغ عاجل لغرفة العمليات"
            badge="جديد"
            onClick={() => navigate('/report')}
          />
          <MenuCard
            icon={Truck}
            title="طلب إسناد لوجستي"
            subtitle="طلب معدات أو موارد بشرية"
            onClick={() => {}}
          />
        </div>

        {/* ── Quick actions strip ─────────────────────────────── */}
        <div
          className="mt-6 grid grid-cols-3 gap-2"
          style={{ animation: 'fadeSlideUp 0.4s ease 0.3s both' }}
        >
          {[
            { icon: ClipboardCheck, label: 'سجل اليوم' },
            { icon: TrendingUp,     label: 'الإحصائيات' },
            { icon: MapPin,         label: 'موقعي' },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              className="bg-primary-50 border border-primary/15 rounded-xl py-3 flex flex-col items-center gap-1.5
                hover:bg-primary/10 hover:border-primary/30 transition-all active:scale-95"
            >
              <Icon size={20} className="text-primary" strokeWidth={1.75} />
              <span className="text-xs font-medium text-dark">{label}</span>
            </button>
          ))}
        </div>

      </main>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
