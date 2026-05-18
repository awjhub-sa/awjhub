import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/db.js';
import { getCaterer } from '../../config/centers.js';
import PageHeader from '../../components/PageHeader.jsx';
import FilterChip from '../../components/FilterChip.jsx';
import {
  Bell, AlertTriangle, Truck, Utensils, Mountain,
  User, Building2, Clock, CheckCheck, Filter, Sparkles,
} from 'lucide-react';

/* ── Sources ── */
const SOURCES = [
  { key: 'reports',           col: 'reports',            label: 'بلاغ ميداني',   icon: AlertTriangle, color: '#E53E3E' },
  { key: 'logistics_requests',col: 'logistics_requests', label: 'طلب إسناد',     icon: Truck,         color: '#3182CE' },
  { key: 'meal_evaluations',  col: 'meal_evaluations',   label: 'تقييم وجبات',   icon: Utensils,      color: '#A98159' },
  { key: 'mina_readiness',    col: 'mina_readiness',     label: 'جاهزية منى',    icon: Mountain,      color: '#2F855A' },
  { key: 'arafat_readiness',  col: 'arafat_readiness',   label: 'جاهزية عرفة',   icon: Mountain,      color: '#0987A0' },
];

const FILTERS = [
  { value: 'all', label: 'الكل', icon: Filter, color: '#6D6E71' },
  ...SOURCES.map(s => ({ value: s.key, label: s.label, color: s.color, icon: s.icon })),
];

/* ── Helpers ── */
function getTs(doc) {
  return doc.timestamp?.toMillis?.() ?? doc.createdAt?.toMillis?.() ?? 0;
}

function timeAgo(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60)    return 'الآن';
  if (s < 3600)  return `منذ ${Math.floor(s / 60)} دقيقة`;
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} ساعة`;
  return `منذ ${Math.floor(s / 86400)} يوم`;
}

function fullDate(ts) {
  if (!ts) return '—';
  return (ts.toDate ? ts.toDate() : new Date(ts))
    .toLocaleString('ar-SA', { dateStyle: 'long', timeStyle: 'short' });
}

/* ══════════════════════════════════════════════════════════ */
export default function AdminNotifications() {
  const [items,  setItems]  = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  /* capture previous lastSeen BEFORE marking as seen */
  const [prevLastSeen] = useState(() =>
    Number(localStorage.getItem('notif_last_seen') || 0)
  );

  useEffect(() => {
    /* Mark page as visited now */
    localStorage.setItem('notif_last_seen', Date.now().toString());

    const allItems = {};

    const unsubs = SOURCES.map(src => {
      allItems[src.key] = [];
      return onSnapshot(collection(db, src.col), snap => {
        allItems[src.key] = snap.docs.map(d => ({
          _id:  `${src.key}_${d.id}`,
          _src: src.key,
          ...d.data(),
        }));

        const merged = Object.values(allItems).flat();
        merged.sort((a, b) => getTs(b) - getTs(a));
        setItems(merged);
        setLoading(false);
      });
    });

    return () => unsubs.forEach(u => u());
  }, []);

  const filtered = filter === 'all'
    ? items
    : items.filter(it => it._src === filter);

  const countFor = key =>
    key === 'all' ? items.length : items.filter(it => it._src === key).length;

  const newCount = items.filter(it => getTs(it) > prevLastSeen).length;

  return (
    <div className="space-y-5">

      {/* Page header */}
      <PageHeader
        Icon={Bell}
        title="الإشعارات"
        subtitle={
          <>
            {items.length} إشعار إجمالاً
            {newCount > 0 && (
              <span className="mr-1.5 font-bold" style={{ color: '#E53E3E' }}>
                · {newCount} جديد
              </span>
            )}
          </>
        }
        right={
          newCount === 0 && items.length > 0 ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2F855A]">
              <CheckCheck size={14} strokeWidth={2} />
              تمت المراجعة
            </div>
          ) : null
        }
      />

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <FilterChip
            key={f.value}
            active={filter === f.value}
            onClick={() => setFilter(f.value)}
            count={countFor(f.value)}
            Icon={f.icon}
            color={f.color || '#6D6E71'}
          >
            {f.label}
          </FilterChip>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="bg-gradient-to-br from-white via-white to-[#FDF8F0]/40 rounded-3xl border border-[#EDE5DC] py-20 text-center shadow-[0_2px_12px_rgba(45,41,38,0.06)] transition-shadow duration-300 hover:shadow-[0_6px_24px_rgba(169,129,89,0.12)]">
            <div className="w-8 h-8 border-2 border-[#EDE5DC] border-t-[#A98159] rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-gradient-to-br from-white via-white to-[#FDF8F0]/40 rounded-3xl border border-[#EDE5DC] py-20 text-center shadow-[0_2px_12px_rgba(45,41,38,0.06)] transition-shadow duration-300 hover:shadow-[0_6px_24px_rgba(169,129,89,0.12)]">
            <div className="relative w-fit mx-auto mb-3 group">
              <div className="absolute inset-0 rounded-2xl blur-xl bg-[#C4A46E] opacity-30 group-hover:opacity-60 transition-opacity" />
              <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                style={{ background: 'linear-gradient(135deg, #FDF8F0, #F3EAE0)' }}>
                <Bell size={24} className="text-[#C4A46E]" strokeWidth={1.75} />
                <Sparkles size={9} className="absolute -top-0.5 -right-0.5 text-yellow-200 drop-shadow animate-pulse" />
              </div>
            </div>
            <p className="text-[#6D6E71] text-sm font-medium">لا توجد إشعارات في هذه الفئة</p>
          </div>
        ) : filtered.map(item => {
          const src      = SOURCES.find(s => s.key === item._src);
          const Icon     = src.icon;
          const color    = src.color;
          const ts       = item.timestamp ?? item.createdAt ?? null;
          const isNew    = getTs(item) > prevLastSeen;
          const caterer  = item.caterer || getCaterer(item.center) || '—';

          return (
            <div key={item._id}
              className={`bg-white rounded-2xl border shadow-[0_2px_10px_rgba(45,41,38,0.06)] overflow-hidden transition-all hover:shadow-[0_6px_24px_rgba(45,41,38,0.11)] ${
                isNew ? 'border-l-0' : 'border-[#EDE5DC]'
              }`}
              style={isNew ? {
                borderColor: `${color}40`,
                borderRightWidth: '3px',
                borderRightColor: color,
              } : {}}>

              <div className="flex items-start gap-3 px-4 py-3.5">

                {/* Icon */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `linear-gradient(135deg, ${color}28, ${color}14)` }}>
                  <Icon size={18} style={{ color }} strokeWidth={1.75} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${color}18`, color }}>
                      {src.label}
                    </span>
                    {isNew && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100">
                        جديد
                      </span>
                    )}
                  </div>

                  {/* Observer + center + caterer */}
                  <div className="flex items-center gap-3 flex-wrap text-xs text-[#4A3B35]">
                    <span className="flex items-center gap-1 font-bold">
                      <User size={11} strokeWidth={1.75} className="text-[#A98159]" />
                      {item.observer || '—'}
                    </span>
                    <span className="text-[#C9B8A8]">·</span>
                    <span className="flex items-center gap-1">
                      <Building2 size={11} strokeWidth={1.75} className="text-[#A98159]" />
                      مركز {item.center || '—'}
                    </span>
                    <span className="text-[#C9B8A8]">·</span>
                    <span className="text-[#A98159] font-semibold text-[11px]">
                      {caterer}
                    </span>
                  </div>

                  {/* Extra info per type */}
                  {item._src === 'reports' && item.reportType && (
                    <p className="text-[11px] text-[#6D6E71] mt-0.5">
                      نوع البلاغ: {item.reportType}
                      {item.severity && ` · خطورة: ${item.severity}`}
                    </p>
                  )}
                  {item._src === 'logistics_requests' && item.supportType && (
                    <p className="text-[11px] text-[#6D6E71] mt-0.5">
                      إسناد {item.supportType === 'internal' ? 'داخلي' : item.supportType === 'external' ? 'خارجي' : 'داخلي وخارجي'}
                      {(item.qtyInternal || item.qtyExternal) && ` · الكمية: ${item.qtyInternal ?? item.qtyExternal}`}
                    </p>
                  )}
                  {(item._src === 'mina_readiness' || item._src === 'arafat_readiness') && item.scoreOutOf10 != null && (
                    <p className="text-[11px] text-[#6D6E71] mt-0.5">
                      النتيجة: {item.scoreOutOf10}/10
                    </p>
                  )}
                </div>

                {/* Timestamp */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0 text-left">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-[#6D6E71]">
                    <Clock size={10} strokeWidth={1.75} />
                    {timeAgo(ts)}
                  </span>
                  <span className="text-[10px] text-[#B5A99E]">{fullDate(ts)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
