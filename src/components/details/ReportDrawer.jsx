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
import { TERMINAL_REPORT_STATUSES } from '../../lib/statusTracking.js';
import {
  reportType as getRT, severityOf as getSV, reportStatus as getSB,
  REPORT_STATUSES as STATUS_OPTIONS, REPORT_STATUS_LOOKUP as STATUS_LOOKUP,
  MEAL_LABEL, HOLY_SITE_LABEL, timeAgo, fullDate,
} from '../../config/fieldRecords.js';

export default function ReportDrawer({ report: r, onClose, onStatus, onEdit, onDelete, onMedia, onSaveNotes }) {
  const [notes, setNotes]             = useState(r?.adminNotes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedNotes,  setSavedNotes]  = useState(false);

  useEffect(() => { setNotes(r?.adminNotes || ''); setSavedNotes(false); }, [r?.id]);

  if (!r) return null;

  const rt = getRT(r);
  const sv = getSV(r);
  const b  = getSB(r);
  const StatusIcon = b.Icon;
  const allImages = r.images?.length ? r.images : (r.photos?.length ? r.photos : []);
  const httpImages = allImages.filter(s => typeof s === 'string' && (s.startsWith('http') || s.startsWith('data:')));

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
      Icon={rt.Icon}
      accent={rt.color}
      kicker="بلاغ ميداني"
      title={rt.label}
      subtitle={`${r.center || '—'} · ${timeAgo(r.timestamp)}`}
      chips={
        <>
          {r.reportNumber && <HeroChip color={rt.color}>#{r.reportNumber}</HeroChip>}
          <HeroChip solid color={b.color === 'rgb(var(--c-muted))' ? '#CBD5E1' : b.color}>
            <StatusIcon size={11} weight="bold" /> {b.label}
          </HeroChip>
          {sv && <HeroChip color={sv.bar}>خطورة {sv.label}</HeroChip>}
          {r.mealType && MEAL_LABEL[r.mealType] && <HeroChip>{MEAL_LABEL[r.mealType]}</HeroChip>}
          {r.holySite && HOLY_SITE_LABEL[r.holySite] && <HeroChip>{HOLY_SITE_LABEL[r.holySite]}</HeroChip>}
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
      {/* Where it stands, and how to move it */}
      <Section title="الحالة" Icon={Activity} tone={b.color}>
        <StatusTimeline
          doc={r}
          terminalStatuses={TERMINAL_REPORT_STATUSES}
          statusOrder={['pending', 'in_progress', 'resolved']}
          statusMeta={STATUS_LOOKUP}
          accentColor={rt.color}
        />
        <div className="grid grid-cols-3 gap-2 mt-3">
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

      {/* What happened */}
      {r.description && (
        <Section title="وصف المشكلة" Icon={ShieldAlert} tone={rt.color}>
          <p className="text-[13px] text-ink leading-relaxed whitespace-pre-wrap">{r.description}</p>
        </Section>
      )}

      <Section title="بيانات البلاغ" Icon={Building2}>
        <Facts items={[
          { label: 'المركز',    value: r.center,   Icon: Building2, color: rt.color },
          { label: 'المراقب',   value: r.observer, Icon: User,      color: 'rgb(var(--c-primary))' },
          { label: 'المتعهد',   value: r.caterer || getCaterer(r.center), Icon: Factory, color: 'rgb(var(--c-primary))', wide: true },
          { label: 'رقم الشاخص', value: getShakhis(r.center), Icon: Hash, color: '#9E5741' },
          { label: 'وقت البلاغ', value: fullDate(r.timestamp), Icon: Calendar },
          getLocation(r.center) && {
            label: 'الموقع', value: 'فتح في خرائط Google ↗',
            href: getLocation(r.center), Icon: MapPin, color: '#16A34A', wide: true,
          },
        ]} />
      </Section>

      {/* What it looks like */}
      {(httpImages.length > 0 || r.videoUrl) && (
        <Section title={`المرفقات (${httpImages.length + (r.videoUrl ? 1 : 0)})`} Icon={ImageIcon}>
          {httpImages.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {httpImages.map((src, i) => (
                <button key={i} onClick={() => onMedia({ src, type: 'image' })}
                  className="group/img relative rounded-xl overflow-hidden border border-line hover:border-primary transition-colors">
                  <img src={src} alt="" className="w-full h-24 object-cover transition-transform group-hover/img:scale-105" />
                </button>
              ))}
            </div>
          )}
          {r.videoUrl && (
            <button onClick={() => onMedia({ src: r.videoUrl, type: 'video' })}
              className="mt-2 flex items-center gap-3 w-full rounded-xl px-3.5 py-3 text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary)), rgb(var(--c-primary-700)))' }}>
              <span className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                <Play size={17} weight="fill" className="text-white" />
              </span>
              <span className="flex-1 text-right text-[12px] font-black">تشغيل الفيديو المرفق</span>
              <ExternalLink size={13} className="text-white/50" />
            </button>
          )}
        </Section>
      )}

      {/* The plumbing */}
      <Section title="ملاحظات غرفة العمليات" Icon={Pencil}
        right={savedNotes && (
          <span className="text-[10px] font-black text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-0.5">
            ✓ حُفظت
          </span>
        )}>
        <textarea
          value={notes} rows={3}
          onChange={e => { setNotes(e.target.value); setSavedNotes(false); }}
          placeholder="اكتب ملاحظات تظهر للمراقب/المشرف الذي رفع البلاغ..."
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
