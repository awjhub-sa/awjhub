import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Globe as Earth,
  Buildings as Building2,
  Plus,
  PencilSimple,
  Trash,
  X,
  FloppyDisk,
  WarningCircle,
  CloudCheck,
  ForkKnife,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader.jsx';
import { db } from '../../lib/db.js';
import { extractCenterNum } from '../../config/nationalities.js';
import { refreshNationalities } from '../../lib/nationalityStore.js';
import { seasonLabel } from '../../lib/hijri.js';

const AR = (n) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

const MISSING_TABLE = 'جداول الجنسيات غير موجودة بعد — شغّل ملف supabase/migrations/009_nationalities.sql في لوحة Supabase.';
const explain = (err) => {
  const msg = err?.message || '';
  if (err?.code === 'PGRST205' || /schema cache|public\.(nationalities|center_nationalities)/i.test(msg))
    return MISSING_TABLE;
  return msg || 'تعذّر الحفظ — تحقّق من الاتصال';
};

/* The palette the shipped roster used: eight hues spread round the wheel, none
   inside the navy band or near the gold accent, so a chip can never be mistaken
   for a brand element. A customer picks from these rather than from a colour
   wheel that would let them choose the brand navy by accident. */
const PALETTE = [
  '#B84A5E', '#B96438', '#9C7C2A', '#6E8C3A',
  '#3F8B57', '#6F5B96', '#3D6795', '#96528F',
];

const FLAGS = ['🇮🇩','🇮🇶','🇾🇪','🇧🇩','🇦🇫','🇰🇲','🇧🇭','🇵🇰','🇮🇳','🇹🇷','🇳🇬','🇲🇾','🇪🇬','🇸🇩','🇱🇾','🕌','🏳️'];

const EMPTY = { name: '', flag: '🏳️', color: PALETTE[0], centerIds: [] };

/**
 * Who the pilgrims are, and which centres feed them.
 *
 * This used to be a list in the source with centre numbers written in by hand —
 * one operator's roster compiled into the program. A company that buys the
 * system brings its own pilgrims and its own centres, so the roster is theirs
 * to write.
 *
 * A group is defined by its centres, not by its name. That is deliberate: the
 * shipped roster already carried Bangladesh twice, because centres 7–8 and
 * 101–102 eat different food. Two groups may share a name and own separate
 * menus, and what tells them apart on screen is the centres beneath them.
 */
export default function AdminNationalities() {
  const [seasons, setSeasons] = useState([]);
  const [seasonId, setSeasonId] = useState(null);
  const [nats, setNats] = useState([]);
  const [links, setLinks] = useState([]);
  const [centers, setCenters] = useState([]);
  const [menus, setMenus] = useState([]);

  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [editing, setEditing] = useState(null);   // row being edited, or EMPTY for new
  const [toast, setToast] = useState('');

  useEffect(() => {
    const unsub = db.seasons.subscribe(list => {
      setSeasons(list);
      setSeasonId(prev => prev ?? (list.find(s => s.isActive)?.id ?? list[0]?.id ?? null));
    });
    return unsub;
  }, []);

  useEffect(() => {
    let alive = true;
    db.nationalities.probe().then(r => { if (alive) setTableMissing(!r.ok); });
    return () => { alive = false; };
  }, []);

  const reload = useCallback(async () => {
    if (!seasonId) return;
    setLoading(true);
    const [n, l, c, m] = await Promise.all([
      db.nationalities.list({ filter: { seasonId } }),
      db.center_nationalities.list(),
      db.centers.list({ filter: { seasonId } }),
      db.menus.list(),
    ]);
    setNats(n.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
    setLinks(l);
    setCenters(c.slice().sort((a, b) =>
      (extractCenterNum(a.code) ?? 0) - (extractCenterNum(b.code) ?? 0)));
    setMenus(m);
    setLoading(false);
    await refreshNationalities(seasonId);
  }, [seasonId]);

  useEffect(() => { reload(); }, [reload]);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2600); };

  /* Which centres belong to which group, and which belong to none — the second
     is the number worth showing, because an unassigned centre is invisible in
     the menu and in the phase alerts, and nothing else in the system says so. */
  const centersOf = useCallback(
    (natId) => links.filter(l => l.nationalityId === natId).map(l => l.centerId),
    [links],
  );

  const assigned = useMemo(() => new Set(links.map(l => l.centerId)), [links]);
  const orphans = useMemo(
    () => centers.filter(c => !assigned.has(c.id)),
    [centers, assigned],
  );

  const menuCount = useCallback(
    (natId) => menus.filter(m => m.nationalityId === natId).length,
    [menus],
  );

  const save = async (draft) => {
    const name = draft.name.trim();
    if (!name) throw new Error('اكتب اسم الجنسية');

    let id = draft.id;
    try {
      if (id) {
        await db.nationalities.update(id, {
          name, flag: draft.flag, color: draft.color,
        });
      } else {
        const created = await db.nationalities.insert({
          seasonId, name, flag: draft.flag, color: draft.color,
          sortOrder: nats.length,
        });
        id = created.id;
      }

      /* The links are rewritten wholesale rather than diffed: the set is a
         handful of rows, and a diff that drifts would silently mis-assign a
         centre — the one failure this screen exists to prevent. */
      const current = centersOf(id);
      const wanted = draft.centerIds;
      const toRemove = current.filter(c => !wanted.includes(c));
      const toAdd = wanted.filter(c => !current.includes(c));

      for (const centerId of toRemove) {
        await db.center_nationalities.deleteWhere({ centerId, nationalityId: id });
      }
      if (toAdd.length) {
        await db.center_nationalities.insertMany(
          toAdd.map(centerId => ({ centerId, nationalityId: id })));
      }
    } catch (err) {
      throw new Error(explain(err));
    }

    await reload();
    flash(draft.id ? 'حُدّثت الجنسية' : 'أُضيفت الجنسية');
  };

  const remove = async (row) => {
    try {
      /* The menus go with it — the database cascades. Said out loud in the
         confirm below, because a menu is a season's worth of typing. */
      await db.nationalities.delete(row.id);
    } catch (err) {
      throw new Error(explain(err));
    }
    await reload();
    flash('حُذفت الجنسية');
  };

  const season = seasons.find(s => s.id === seasonId) || null;

  return (
    <div className="space-y-4 pb-6" dir="rtl">
      <PageHeader
        kicker="إدارة المتعهدين"
        Icon={Earth}
        title="جنسيات الحجاج"
        subtitle={season ? `موسم ${seasonLabel(season)}` : 'اختر موسماً'}
        stats={[
          { value: AR(nats.length), label: 'جنسية' },
          { value: AR(centers.length), label: 'مركز' },
          { value: AR(orphans.length), label: 'مركز بلا جنسية', tone: orphans.length ? 'alert' : undefined },
        ]}
        heroActions={!tableMissing && seasonId && (
          <button onClick={() => setEditing({ ...EMPTY, color: PALETTE[nats.length % PALETTE.length] })}
            className="h-9 px-4 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25
                       text-white text-[12px] font-black flex items-center gap-1.5 transition-colors">
            <Plus size={14} weight="bold" />
            إضافة جنسية
          </button>
        )}
      />

      {tableMissing && (
        <div className="rounded-2xl border p-3.5 flex gap-2.5"
          style={{ borderColor: '#EBCFC3', background: 'color-mix(in srgb, #B4674E 8%, #fff)' }}>
          <WarningCircle size={17} weight="bold" style={{ color: '#B4674E' }} className="flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[12px] font-black text-ink">القسم غير مفعّل بعد</p>
            <p className="text-[11px] text-ink/80 leading-relaxed mt-0.5">{MISSING_TABLE}</p>
          </div>
        </div>
      )}

      {seasons.length > 1 && (
        <section className="bg-white rounded-2xl border border-line p-3">
          <p className="text-[10px] font-black text-muted/70 tracking-widest mb-2 px-1">الموسم</p>
          <div className="flex gap-2 flex-wrap">
            {seasons.map(s => (
              <button key={s.id} onClick={() => setSeasonId(s.id)}
                className={`px-3.5 py-1.5 rounded-xl border text-[12px] font-black transition-all ${
                  s.id === seasonId
                    ? 'text-white border-transparent shadow-[0_3px_12px_rgb(var(--c-primary)/0.3)]'
                    : 'bg-white border-line text-ink hover:border-primary/40'
                }`}
                style={s.id === seasonId
                  ? { background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }
                  : undefined}>
                {seasonLabel(s)}
                {s.isActive && <span className="mr-1.5 text-[9px] opacity-70">نشط</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── An unassigned centre is invisible downstream, so it is named here ── */}
      {!loading && orphans.length > 0 && (
        <section className="rounded-2xl border p-3.5"
          style={{ borderColor: '#EBCFC3', background: 'color-mix(in srgb, #B4674E 7%, #fff)' }}>
          <p className="text-[12px] font-black text-ink flex items-center gap-1.5">
            <WarningCircle size={14} weight="bold" style={{ color: '#B4674E' }} />
            {AR(orphans.length)} مركز بلا جنسية
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {orphans.map(c => (
              <span key={c.id} className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-white border border-line text-ink">
                {c.code}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── The roster ── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-line py-16 flex justify-center">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : nats.length === 0 && !tableMissing ? (
        <div className="bg-white rounded-2xl border border-line py-14 flex flex-col items-center gap-2">
          <Earth size={26} weight="bold" className="text-muted/40" />
          <p className="text-[13px] font-black text-ink">لا جنسيات في هذا الموسم</p>
          <button onClick={() => setEditing({ ...EMPTY })}
            className="mt-2 h-9 px-5 rounded-xl text-white text-[12px] font-black flex items-center gap-1.5"
            style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}>
            <Plus size={14} weight="bold" />
            إضافة أول جنسية
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {nats.map(n => {
            const ids = centersOf(n.id);
            const codes = centers.filter(c => ids.includes(c.id));
            const meals = menuCount(n.id);
            /* Two groups may share a name — the centres are what tell them
               apart, so they are the subtitle, not a detail. */
            const twin = nats.some(o => o.id !== n.id && o.name === n.name);
            return (
              <section key={n.id} className="relative bg-white rounded-2xl border border-line overflow-hidden flex flex-col">
                <span className="absolute inset-x-0 top-0 h-1" style={{ background: n.color || '#6F5B96' }} />
                <header className="px-4 pt-4 pb-3 border-b border-line flex items-center gap-2.5">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${n.color || '#6F5B96'} 14%, #fff)` }}>
                    {n.flag || '🏳️'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-black truncate" style={{ color: n.color || '#6F5B96' }}>
                      {n.name}
                    </p>
                    <p className="text-[10px] font-bold text-muted mt-0.5 flex items-center gap-1">
                      <Building2 size={10} weight="bold" />
                      {codes.length ? `${AR(codes.length)} مركز` : 'بلا مراكز'}
                      {twin && codes.length > 0 && (
                        <span className="text-muted/60">· يميّزها مراكزها</span>
                      )}
                    </p>
                  </div>
                  <button onClick={() => setEditing({
                    id: n.id, name: n.name, flag: n.flag || '🏳️',
                    color: n.color || PALETTE[0], centerIds: ids,
                  })}
                    className="w-8 h-8 rounded-lg border border-line flex items-center justify-center flex-shrink-0
                               text-muted hover:text-ink hover:bg-background">
                    <PencilSimple size={14} weight="bold" />
                  </button>
                </header>

                <div className="p-4 flex-1 space-y-2.5">
                  <div className="flex flex-wrap gap-1">
                    {codes.length === 0 ? (
                      <p className="text-[11px] font-bold text-muted/70">
                        لم تُسنَد مراكز
                      </p>
                    ) : codes.map(c => (
                      <span key={c.id} className="text-[10.5px] font-bold px-2 py-0.5 rounded-md border border-line bg-background text-ink">
                        {c.code}
                      </span>
                    ))}
                  </div>

                  <p className="text-[10.5px] font-bold text-muted flex items-center gap-1.5 pt-1 border-t border-line">
                    <ForkKnife size={11} weight="bold" />
                    {meals > 0
                      ? <>محفوظ لها <span className="text-ink">{AR(meals)}</span> وجبة في المنيو</>
                      : <>لا منيو محفوظ بعد{n.legacyKey ? ' — تعرض المنيو المرفق' : ''}</>}
                  </p>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {editing && (
        <NationalityEditor
          draft={editing}
          centers={centers}
          links={links}
          nats={nats}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={remove}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2
                        px-4 py-2.5 rounded-xl bg-ink text-white text-[12px] font-black
                        shadow-[0_10px_30px_rgb(var(--c-ink)/0.4)]">
          <CloudCheck size={15} weight="bold" className="text-success" />
          {toast}
        </div>
      )}
    </div>
  );
}

/* Name, flag, colour — and the centres, which are the substance of the thing. */
function NationalityEditor({ draft, centers, links, nats, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* Who else already claims a centre. Not forbidden — centre 26 genuinely
     serves two nationalities — but worth showing, because most double
     assignments are a slip rather than an intent. */
  const claimedBy = useMemo(() => {
    const map = new Map();
    for (const l of links) {
      if (l.nationalityId === form.id) continue;
      const nat = nats.find(n => n.id === l.nationalityId);
      if (nat) map.set(l.centerId, nat);
    }
    return map;
  }, [links, nats, form.id]);

  const shown = useMemo(() => {
    const needle = q.trim();
    if (!needle) return centers;
    return centers.filter(c => String(c.code).includes(needle)
      || String(c.catererName || '').includes(needle));
  }, [centers, q]);

  const toggle = (id) => setForm(f => ({
    ...f,
    centerIds: f.centerIds.includes(id)
      ? f.centerIds.filter(x => x !== id)
      : [...f.centerIds, id],
  }));

  const submit = async () => {
    setBusy(true); setErr('');
    try { await onSave(form); onClose(); }
    catch (e) { setErr(e?.message || 'تعذّر الحفظ'); setBusy(false); }
  };

  const doDelete = async () => {
    setBusy(true); setErr('');
    try { await onDelete(form); onClose(); }
    catch (e) { setErr(e?.message || 'تعذّر الحذف'); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" dir="rtl">
      <button className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} aria-label="إغلاق" />

      <div className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[88vh] bg-background
                      rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col
                      shadow-[0_20px_70px_rgb(var(--c-ink)/0.35)]">

        <header className="px-4 sm:px-6 py-4 bg-white border-b border-line flex items-center gap-3 flex-shrink-0">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${form.color} 14%, #fff)` }}>
            {form.flag}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black text-ink">
              {form.id ? 'تعديل جنسية' : 'إضافة جنسية'}
            </p>
            <p className="text-[10.5px] font-bold text-muted mt-0.5">
              {form.centerIds.length ? `${AR(form.centerIds.length)} مركز محدَّد` : 'لم تُحدَّد مراكز بعد'}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg border border-line bg-white hover:bg-background
                       flex items-center justify-center flex-shrink-0">
            <X size={15} weight="bold" className="text-muted" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">

          <section className="bg-white rounded-2xl border border-line p-4 space-y-3">
            <label className="block">
              <span className="text-[10px] font-black text-muted/70 tracking-widest block mb-1.5">اسم الجنسية</span>
              <input autoFocus value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="بنغلاديش"
                className="w-full h-9 px-3 rounded-lg border border-line bg-background text-[12.5px] font-bold text-ink
                           focus:outline-none focus:border-primary/50 focus:bg-white" />
            </label>

            <div>
              <span className="text-[10px] font-black text-muted/70 tracking-widest block mb-1.5">العلم</span>
              <div className="flex flex-wrap gap-1">
                {FLAGS.map(f => (
                  <button key={f} type="button" onClick={() => setForm(p => ({ ...p, flag: f }))}
                    className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center border transition-all ${
                      form.flag === f ? 'border-primary bg-primary/10' : 'border-line bg-white hover:border-primary/40'
                    }`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-black text-muted/70 tracking-widest block mb-1.5">اللون</span>
              <div className="flex flex-wrap gap-1.5">
                {PALETTE.map(c => (
                  <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      form.color === c ? 'border-ink scale-110' : 'border-transparent'
                    }`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
          </section>

          {/* ── The centres ── */}
          <section className="bg-white rounded-2xl border border-line overflow-hidden">
            <div className="px-4 py-2.5 border-b border-line flex items-center gap-2">
              <p className="text-[11.5px] font-black text-ink">مراكز هذه الجنسية</p>
              <span className="text-[10px] font-black tabular-nums text-muted mr-auto">
                {form.centerIds.length ? AR(form.centerIds.length) : '—'}
              </span>
            </div>

            <div className="px-4 py-2.5 border-b border-line flex items-center gap-2">
              <MagnifyingGlass size={13} weight="bold" className="text-muted/50 flex-shrink-0" />
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="ابحث برقم المركز أو اسم المتعهد"
                className="flex-1 h-7 text-[11.5px] bg-transparent focus:outline-none text-ink" />
              {form.centerIds.length > 0 && (
                <button type="button" onClick={() => setForm(f => ({ ...f, centerIds: [] }))}
                  className="text-[10.5px] font-bold text-muted hover:text-error flex-shrink-0">
                  إلغاء الكل
                </button>
              )}
            </div>

            <div className="max-h-[38vh] overflow-y-auto p-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {shown.map(c => {
                const on = form.centerIds.includes(c.id);
                const other = claimedBy.get(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => toggle(c.id)}
                    className={`text-right px-2.5 py-2 rounded-xl border transition-all ${
                      on ? 'border-primary' : 'bg-white border-line hover:border-primary/40'
                    }`}
                    style={on ? { background: `color-mix(in srgb, ${form.color} 12%, #fff)` } : undefined}>
                    <span className="block text-[11.5px] font-black text-ink truncate">{c.code}</span>
                    {other ? (
                      <span className="block text-[9px] font-bold truncate mt-0.5" style={{ color: other.color }}>
                        {other.flag} {other.name}
                      </span>
                    ) : (
                      <span className="block text-[9px] font-bold text-muted/60 truncate mt-0.5">
                        {c.catererName || '—'}
                      </span>
                    )}
                  </button>
                );
              })}
              {shown.length === 0 && (
                <p className="col-span-full text-[11px] font-bold text-muted/70 text-center py-6">
                  لا مراكز مطابقة
                </p>
              )}
            </div>
          </section>

        </div>

        <footer className="px-4 sm:px-6 py-3 bg-white border-t border-line flex items-center gap-2 flex-shrink-0">
          {err && <p className="text-[11px] font-bold text-error flex-1">{err}</p>}
          {!err && form.id && !confirmDel && (
            <button type="button" onClick={() => setConfirmDel(true)} disabled={busy}
              className="text-[11px] font-bold text-error/80 hover:text-error flex items-center gap-1 disabled:opacity-40">
              <Trash size={12} weight="bold" />
              حذف
            </button>
          )}
          {!err && confirmDel && (
            <div className="flex-1 flex items-center gap-2">
              <p className="text-[11px] font-bold text-error">
                سيُحذف معها منيوها كاملاً. متأكد؟
              </p>
              <button type="button" onClick={doDelete} disabled={busy}
                className="h-7 px-3 rounded-lg bg-error text-white text-[11px] font-black disabled:opacity-40">
                نعم، احذف
              </button>
              <button type="button" onClick={() => setConfirmDel(false)}
                className="text-[11px] font-bold text-muted">تراجع</button>
            </div>
          )}
          <div className="mr-auto flex items-center gap-2">
            <button type="button" onClick={onClose} disabled={busy}
              className="h-9 px-4 rounded-lg border border-line bg-white text-[12px] font-bold text-muted
                         hover:text-ink disabled:opacity-40">
              إلغاء
            </button>
            <button type="button" onClick={submit} disabled={busy || !form.name.trim()}
              className="h-9 px-5 rounded-lg text-white text-[12px] font-black flex items-center gap-1.5
                         disabled:opacity-50 shadow-[0_3px_12px_rgb(var(--c-primary)/0.3)]"
              style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}>
              <FloppyDisk size={14} weight="bold" />
              {busy ? 'جارٍ الحفظ…' : 'حفظ'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
