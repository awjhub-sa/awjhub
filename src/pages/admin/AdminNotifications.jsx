import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/db.js';
import { getCaterer } from '../../config/centers.js';
import PageHeader from '../../components/PageHeader.jsx';
import FilterChip from '../../components/FilterChip.jsx';
import {
  Bell,
  Warning as AlertTriangle,
  Truck,
  ForkKnife as Utensils,
  Mountains as Mountain,
  User,
  Buildings as Building2,
  Clock,
  Checks as CheckCheck,
  Funnel as Filter,
  Sparkle as Sparkles,
  FileText,
} from '@phosphor-icons/react';

/* `route` is where the row goes when it is clicked. A notification that names
   a thing and cannot take you to it makes the reader hunt for what the system
   already knows the location of. */
const SOURCES = [
  { key: 'reports',           col: 'reports',            label: 'بلاغ ميداني',   icon: AlertTriangle, color: '#E53E3E', route: '/admin/reports' },
  { key: 'logistics_requests',col: 'logistics_requests', label: 'طلب إسناد',     icon: Truck,         color: '#4E7CB0', route: '/admin/logistics' },
  { key: 'meal_evaluations',  col: 'meal_evaluations',   label: 'تقييم وجبات',   icon: Utensils,      color: 'rgb(var(--c-primary))', route: '/admin/phases' },
  { key: 'mina_readiness',    col: 'mina_readiness',     label: 'جاهزية منى',    icon: Mountain,      color: '#16A34A', route: '/admin/analytics' },
  { key: 'arafat_readiness',  col: 'arafat_readiness',   label: 'جاهزية عرفة',   icon: Mountain,      color: '#3D6795', route: '/admin/analytics' },
  /* A submitted form is something waiting on the office, which is exactly what
     this screen is for — and it was the one arrival that never reached it. */
  { key: 'forms',             col: 'form_assignments',   label: 'نموذج مُسلَّم',  icon: FileText,      color: '#B99A64', route: '/admin/forms' },
];

const FILTERS = [
  { value: 'all', label: 'الكل', icon: Filter, color: 'rgb(var(--c-muted))' },
  ...SOURCES.map(s => ({ value: s.key, label: s.label, color: s.color, icon: s.icon })),
];

/* Rows arrive from Postgres as ISO strings. This used to call `.toMillis()`,
   which only a Firestore timestamp has — so every row scored 0, the feed never
   sorted, and nothing was ever «جديد». */
function ms(v) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function getTs(doc) {
  return ms(doc.submittedAt) || ms(doc.timestamp) || ms(doc.createdAt) || 0;
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

export default function AdminNotifications() {
  const nav = useNavigate();
  const [items,  setItems]  = useState([]);
  const [templates, setTemplates] = useState([]);
  const [caterers,  setCaterers]  = useState([]);
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
      return db[src.col].subscribe(rows => {
        /* An assignment becomes news when the caterer hands it back, not when
           the office sends it out. */
        const useful = src.key === 'forms'
          ? rows.filter(r => r.status === 'submitted')
          : rows;
        allItems[src.key] = useful.map(d => ({
          _id:  `${src.key}_${d.id}`,
          _src: src.key,
          ...d,
        }));

        const merged = Object.values(allItems).flat();
        merged.sort((a, b) => getTs(b) - getTs(a));
        setItems(merged);
        setLoading(false);
      });
    });

    const uT = db.form_templates.subscribe(setTemplates);
    const uC = db.caterers.subscribe(setCaterers);

    return () => { unsubs.forEach(u => u()); uT(); uC(); };
  }, []);

  const templateById = useMemo(
    () => Object.fromEntries(templates.map(t => [t.id, t])), [templates]);
  const catererById = useMemo(
    () => Object.fromEntries(caterers.map(c => [c.id, c])), [caterers]);

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
        kicker="التنبيهات"
        Icon={Bell}
        title="الإشعارات"
        stats={[
          { value: items.length, label: 'إشعار' },
          { value: newCount, label: 'جديد', tone: newCount > 0 ? 'alert' : undefined },
        ]}
        right={
          newCount === 0 && items.length > 0 ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#16A34A]">
              <CheckCheck size={14} weight="regular" />
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
            color={f.color || 'rgb(var(--c-muted))'}
          >
            {f.label}
          </FilterChip>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="bg-gradient-to-br from-white via-white to-background/40 rounded-3xl border border-line py-20 text-center shadow-[0_2px_12px_rgb(var(--c-ink)/0.06)] transition-shadow duration-300 hover:shadow-[0_6px_24px_rgb(var(--c-primary)/0.12)]">
            <div className="w-8 h-8 border-2 border-line border-t-primary rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-gradient-to-br from-white via-white to-background/40 rounded-3xl border border-line py-20 text-center shadow-[0_2px_12px_rgb(var(--c-ink)/0.06)] transition-shadow duration-300 hover:shadow-[0_6px_24px_rgb(var(--c-primary)/0.12)]">
            <div className="relative w-fit mx-auto mb-3 group">
              <div className="absolute inset-0 rounded-2xl blur-xl bg-primary-400 opacity-30 group-hover:opacity-60 transition-opacity" />
              <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                style={{ background: 'linear-gradient(135deg, rgb(var(--c-bg)), rgb(var(--c-primary-100)))' }}>
                <Bell size={24} className="text-primary-400" weight="regular" />
                <Sparkles size={9} className="absolute -top-0.5 -right-0.5 text-yellow-200 drop-shadow animate-pulse" />
              </div>
            </div>
            <p className="text-muted text-sm font-medium">لا توجد إشعارات في هذه الفئة</p>
          </div>
        ) : filtered.map(item => {
          const src      = SOURCES.find(s => s.key === item._src);
          const Icon     = src.icon;
          const color    = src.color;
          const ts       = item.submittedAt ?? item.timestamp ?? item.createdAt ?? null;
          const isNew    = getTs(item) > prevLastSeen;
          const isForm   = item._src === 'forms';
          const caterer  = isForm
            ? (catererById[item.catererId]?.name || '—')
            : (item.caterer || getCaterer(item.center) || '—');

          return (
            <button key={item._id}
              onClick={() => src.route && nav(src.route)}
              className={`w-full text-right bg-white rounded-2xl border shadow-[0_2px_10px_rgb(var(--c-ink)/0.06)] overflow-hidden transition-all hover:shadow-[0_6px_24px_rgb(var(--c-ink)/0.11)] hover:-translate-y-px ${
                isNew ? 'border-l-0' : 'border-line'
              }`}
              style={isNew ? {
                borderColor: `${color}40`,
                borderRightWidth: '3px',
                borderRightColor: color,
              } : {}}>

              <div className="group flex items-start gap-3 px-4 py-3.5">

                {/* Icon — lifts and deepens on hover, so the row reads as a way in */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-105"
                  style={{ background: `linear-gradient(135deg, ${color}28, ${color}14)` }}>
                  <Icon size={18} style={{ color }} weight={isNew ? 'fill' : 'regular'} />
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
                  <div className="flex items-center gap-3 flex-wrap text-xs text-ink-800">
                    <span className="flex items-center gap-1 font-bold">
                      {isForm ? <FileText size={11} weight="regular" className="text-primary" />
                              : <User size={11} weight="regular" className="text-primary" />}
                      {isForm
                        ? (templateById[item.templateId]?.title || 'نموذج')
                        : (item.observer || '—')}
                    </span>
                    <span className="text-muted">·</span>
                    <span className="flex items-center gap-1">
                      <Building2 size={11} weight="regular" className="text-primary" />
                      مركز {item.center || '—'}
                    </span>
                    <span className="text-muted">·</span>
                    <span className="text-primary font-semibold text-[11px]">
                      {caterer}
                    </span>
                  </div>

                  {/* Extra info per type */}
                  {item._src === 'reports' && item.reportType && (
                    <p className="text-[11px] text-muted mt-0.5">
                      نوع البلاغ: {item.reportType}
                      {item.severity && ` · خطورة: ${item.severity}`}
                    </p>
                  )}
                  {item._src === 'logistics_requests' && item.supportType && (
                    <p className="text-[11px] text-muted mt-0.5">
                      إسناد {item.supportType === 'internal' ? 'داخلي' : item.supportType === 'external' ? 'خارجي' : 'داخلي وخارجي'}
                      {(item.qtyInternal || item.qtyExternal) && ` · الكمية: ${item.qtyInternal ?? item.qtyExternal}`}
                    </p>
                  )}
                  {(item._src === 'mina_readiness' || item._src === 'arafat_readiness') && item.scoreOutOf10 != null && (
                    <p className="text-[11px] text-muted mt-0.5">
                      النتيجة: {item.scoreOutOf10}/10
                    </p>
                  )}
                  {isForm && (
                    <p className="text-[11px] text-muted mt-0.5">
                      {item.formNumber ? `رقم ${item.formNumber} · ` : ''}بانتظار مراجعة الإدارة
                    </p>
                  )}
                </div>

                {/* Timestamp */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0 text-left">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-muted">
                    <Clock size={10} weight="regular" />
                    {timeAgo(ts)}
                  </span>
                  <span className="text-[10px] text-muted">{fullDate(ts)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
