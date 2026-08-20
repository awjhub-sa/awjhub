import { useEffect, useState } from 'react';
import {
  Pencil, Trash as Trash2, Pulse as Activity, Buildings as Building2, User,
  Factory, Hash, CalendarBlank as Calendar, MapPin, ShieldWarning as ShieldAlert,
  Image as ImageIcon, Play, ArrowSquareOut as ExternalLink, Warning as AlertTriangle,
  FileText,
} from '@phosphor-icons/react';
import DetailDrawer, { Section, Facts, HeroChip } from '../DetailDrawer.jsx';
import { StatusTimeline } from '../StatusTimeline.jsx';
import CenterNotesPanel from '../CenterNotesPanel.jsx';
import { getCaterer, getShakhis, getLocation } from '../../config/centers.js';
import { TERMINAL_LOGISTICS_STATUSES } from '../../lib/statusTracking.js';
import {
  logisticsStatus as getSB, supportType as getSupport,
  LOGISTICS_STATUSES as STATUS_OPTIONS, LOGISTICS_STATUS_LOOKUP as STATUS_LOOKUP,
  SUPPORT_LOOKUP, SUPPORT_TYPES, CATEGORY_LABEL, HOLY_SITE_LABEL,
  REPORT_TYPE_MAP, timeAgo, fullDate,
} from '../../config/fieldRecords.js';

const REPORT_TYPE_LABEL = Object.fromEntries(
  Object.entries(REPORT_TYPE_MAP).map(([k, v]) => [k, v.label]),
);

export default function LogisticsDrawer({ request: r, onClose, onStatus, onEdit, onDelete, onSaveNotes }) {
  const [notes, setNotes]             = useState(r?.adminNotes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedNotes,  setSavedNotes]  = useState(false);

  useEffect(() => { setNotes(r?.adminNotes || ''); setSavedNotes(false); }, [r?.id]);

  if (!r) return null;

  const b  = getSB(r);
  const st = SUPPORT_LOOKUP[r.supportType] || SUPPORT_TYPES[0];
  const StatusIcon = b.Icon;

  const hasInternal = r.qtyInternal != null && r.qtyInternal !== '';
  const hasExternal = r.qtyExternal != null && r.qtyExternal !== '';

  const saveNotes = async () => {
    if (savingNotes) return;
    setSavingNotes(true);
    try {
      await onSaveNotes?.(r.id, notes);
      setSavedNotes(true);
      setTimeout(() => setSavedNotes(false), 4000);
    } catch (err) { alert(`فشل حفظ الملاحظات: ${err?.message || err}`); }
    setSavingNotes(false);
  };

  return (
    <DetailDrawer
      open={!!r}
      onClose={onClose}
      Icon={st.Icon}
      accent={st.color}
      kicker="طلب إسناد"
      title={CATEGORY_LABEL[r.category] || r.category || 'طلب إسناد لوجستي'}
      subtitle={`${r.center || '—'} · ${timeAgo(r.timestamp)}`}
      chips={
        <>
          {r.requestNumber && <HeroChip color={st.color}>#{r.requestNumber}</HeroChip>}
          <HeroChip solid color={b.color}>
            <StatusIcon size={11} weight="bold" /> {b.label}
          </HeroChip>
          <HeroChip color={st.color}>{st.label}</HeroChip>
          {r.holySite && HOLY_SITE_LABEL[r.holySite] && <HeroChip>{HOLY_SITE_LABEL[r.holySite]}</HeroChip>}
          {r.reportNumber && <HeroChip color="#F59E0B">مرتبط ببلاغ #{r.reportNumber}</HeroChip>}
        </>
      }
      footer={
        <>
          <button onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-black bg-background text-primary border border-line hover:bg-primary hover:text-white hover:border-primary transition-all">
            <Pencil size={13} weight="bold" /> تعديل
          </button>
          <button onClick={onDelete}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black bg-red-50 text-red-600 border border-red-200 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all">
            <Trash2 size={13} weight="bold" /> حذف
          </button>
        </>
      }
    >
      <Section title="الحالة" Icon={Activity} tone={b.color}>
        <StatusTimeline
          doc={r}
          terminalStatuses={TERMINAL_LOGISTICS_STATUSES}
          statusOrder={['pending', 'approved', 'delivered', 'rejected']}
          statusMeta={STATUS_LOOKUP}
          accentColor={st.color}
        />
        <div className="grid grid-cols-2 gap-2 mt-3">
          {STATUS_OPTIONS.map(s => {
            const SIcon = s.Icon;
            const active = (r.status || 'pending') === s.value;
            return (
              <button key={s.value} onClick={() => onStatus(r.id, s.value)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black border transition-all ${
                  active ? 'shadow-sm' : 'bg-white border-line text-muted hover:border-primary/40'
                }`}
                style={active ? { background: s.bg, borderColor: s.color, color: s.color } : undefined}>
                <SIcon size={12} weight="bold" />
                {s.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* The quantities are the request. They lead. */}
      {(hasInternal || hasExternal) && (
        <Section title="الكميات المطلوبة" Icon={st.Icon} tone={st.color}>
          <div className="grid grid-cols-2 gap-2.5">
            {hasInternal && (
              <div className="rounded-xl border p-3.5 text-center"
                style={{ borderColor: '#C4D8ED', background: 'linear-gradient(180deg,#EEF4FB,#fff)' }}>
                <p className="text-[10px] font-bold" style={{ color: '#2F5580' }}>داخلي</p>
                <p className="text-3xl font-black tabular-nums leading-tight mt-1" style={{ color: '#2F5580' }}>
                  {r.qtyInternal}
                </p>
              </div>
            )}
            {hasExternal && (
              <div className="rounded-xl border p-3.5 text-center"
                style={{ borderColor: '#EBCFC3', background: 'linear-gradient(180deg,#FBF3EF,#fff)' }}>
                <p className="text-[10px] font-bold" style={{ color: '#9E5741' }}>خارجي</p>
                <p className="text-3xl font-black tabular-nums leading-tight mt-1" style={{ color: '#9E5741' }}>
                  {r.qtyExternal}
                </p>
              </div>
            )}
          </div>
        </Section>
      )}

      {r.notes && (
        <Section title="ملاحظات مقدّم الطلب" Icon={FileText} tone={st.color}>
          <p className="text-[13px] text-ink leading-relaxed whitespace-pre-wrap">{r.notes}</p>
        </Section>
      )}

      <Section title="بيانات الطلب" Icon={Building2}>
        <Facts items={[
          { label: 'المركز',   value: r.center,   Icon: Building2, color: st.color },
          { label: 'المراقب',  value: r.observer, Icon: User,      color: 'rgb(var(--c-primary))' },
          { label: 'المتعهد',  value: r.caterer || getCaterer(r.center), Icon: Factory, color: 'rgb(var(--c-primary))', wide: true },
          { label: 'رقم الشاخص', value: getShakhis(r.center), Icon: Hash, color: '#9E5741' },
          { label: 'وقت الطلب',  value: fullDate(r.timestamp), Icon: Calendar },
          r.reportNumber && {
            label: 'البلاغ المرتبط',
            value: `${REPORT_TYPE_LABEL[r.reportType] || r.reportType || 'بلاغ ميداني'} · #${r.reportNumber}`,
            Icon: AlertTriangle, color: '#B45309', wide: true,
          },
          getLocation(r.center) && {
            label: 'الموقع', value: 'فتح في خرائط Google ↗',
            href: getLocation(r.center), Icon: MapPin, color: '#16A34A', wide: true,
          },
        ]} />
      </Section>

      <Section title="ملاحظات غرفة العمليات" Icon={Pencil}
        right={savedNotes && (
          <span className="text-[10px] font-black text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-0.5">
            ✓ حُفظت
          </span>
        )}>
        <textarea
          value={notes} rows={3}
          onChange={e => { setNotes(e.target.value); setSavedNotes(false); }}
          placeholder="اكتب ملاحظات تظهر للمراقب/المشرف الذي رفع الطلب..."
          className="w-full px-3 py-2.5 border border-line rounded-xl text-[13px] text-ink placeholder-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none transition-all bg-white resize-none"
        />
        <button onClick={saveNotes} disabled={savingNotes || notes === (r.adminNotes || '')}
          className="mt-2 w-full py-2.5 rounded-xl text-white text-[12px] font-black transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}>
          {savingNotes ? 'جارٍ الحفظ…' : 'حفظ الملاحظات'}
        </button>
      </Section>

      <CenterNotesPanel centerId={r.center} variant="card" />
    </DetailDrawer>
  );
}
