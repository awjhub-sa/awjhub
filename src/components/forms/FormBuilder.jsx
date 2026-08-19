/**
 * src/components/forms/FormBuilder.jsx
 *
 * Two-pane authoring: blocks on the right, a live A4 page on the left rendered
 * by the same FormDocument the caterer will fill and the PDF will print. What
 * the author sees is what ships — there is no second renderer to drift.
 *
 * Field keys are generated (f1, f2, …) rather than typed. Arabic labels cannot
 * produce ASCII keys, and asking an admin to invent identifiers is asking for
 * duplicates and typos. The author names the label; the key is bookkeeping.
 */

import { useMemo, useRef, useState } from 'react';
import FormDocument from './FormDocument.jsx';
import {
  BLOCK_TYPES, BLOCK_META, FIELD_TYPES, SOURCES, OWNERS,
  tokensIn, validateForm, fieldOwner,
} from '../../config/formSchema.js';
import {
  Plus, X, Trash as Trash2, CaretUp, CaretDown, FloppyDisk as Save,
  TextT, Textbox, ListBullets, ListNumbers, Table as TableIcon, Warning, Note,
  Minus, Signature, Sparkle, Eye,
} from '@phosphor-icons/react';

const BLOCK_ICON = {
  heading: TextT, paragraph: Textbox, list: ListNumbers, fields: ListBullets,
  table: TableIcon, note: Note, divider: Minus, signature: Signature,
};

const inputCls =
  'w-full px-3 py-2 border border-line rounded-xl text-sm text-ink outline-none focus:border-primary transition placeholder-muted/40 bg-white';

let seq = 0;
const uid = (p) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

/* Blocks that hold prose and can therefore carry {{tokens}}. */
const PROSE = new Set(['heading', 'paragraph', 'note']);

export default function FormBuilder({ value, onChange }) {
  const definition = value || { blocks: [], fields: {} };
  const { blocks, fields } = definition;

  const [openBlock, setOpenBlock] = useState(null);
  const [showFields, setShowFields] = useState(true);
  const caret = useRef({ blockId: null, pos: 0 });

  const set = (next) => onChange({ ...definition, ...next });

  const errors = useMemo(() => {
    const all = validateForm(definition, {});
    return Object.entries(all).filter(([k]) => k.startsWith('__token_')).map(([, m]) => m);
  }, [definition]);

  const usedKeys = useMemo(() => {
    const keys = new Set(tokensIn(blocks));
    for (const b of blocks) {
      if (b.type === 'fields') (b.keys || []).forEach(k => keys.add(k));
      if (b.type === 'table' && b.key) keys.add(b.key);
    }
    return keys;
  }, [blocks]);

  /* ── Blocks ─────────────────────────────── */
  const addBlock = (type) => {
    const block = { id: uid('b'), type };
    if (type === 'heading')   block.text = 'عنوان القسم';
    if (type === 'paragraph') block.text = '';
    if (type === 'note')      block.text = '';
    if (type === 'list')    { block.items = ['']; block.ordered = false; }
    if (type === 'fields')  { block.keys = []; block.style = 'list'; }
    if (type === 'signature') block.slots = [
      { label: 'التوقيع', key: 'signature' },
      { label: 'الختم',   key: 'stamp' },
    ];
    set({ blocks: [...blocks, block] });
    setOpenBlock(block.id);
  };

  const patchBlock = (id, patch) =>
    set({ blocks: blocks.map(b => (b.id === id ? { ...b, ...patch } : b)) });

  const removeBlock = (id) =>
    set({ blocks: blocks.filter(b => b.id !== id) });

  const moveBlock = (id, dir) => {
    const i = blocks.findIndex(b => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    set({ blocks: next });
  };

  /* ── Fields ─────────────────────────────── */
  const addField = () => {
    let n = 1;
    while (fields[`f${n}`]) n++;
    const key = `f${n}`;
    set({ fields: { ...fields, [key]: { label: `حقل ${n}`, type: 'text' } } });
    return key;
  };

  const patchField = (key, patch) =>
    set({ fields: { ...fields, [key]: { ...fields[key], ...patch } } });

  const removeField = (key) => {
    const nextFields = { ...fields };
    delete nextFields[key];
    /* Strip the token from prose and drop the key from any fields block, so
       deleting never leaves a dangling {{key}} to print raw in the PDF. */
    const nextBlocks = blocks.map(b => {
      const out = { ...b };
      if (PROSE.has(b.type) && typeof b.text === 'string') {
        out.text = b.text.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), '');
      }
      if (b.type === 'fields') out.keys = (b.keys || []).filter(k => k !== key);
      if (b.type === 'table' && b.key === key) out.key = undefined;
      return out;
    });
    set({ fields: nextFields, blocks: nextBlocks });
  };

  /* Inserts {{key}} where the author last had the cursor, so they never type
     braces by hand. */
  const insertToken = (key) => {
    const { blockId, pos } = caret.current;
    const target = blocks.find(b => b.id === blockId && PROSE.has(b.type));
    if (!target) return;
    const text = target.text || '';
    const at = Math.min(pos, text.length);
    patchBlock(blockId, { text: `${text.slice(0, at)}{{${key}}}${text.slice(at)}` });
    caret.current.pos = at + key.length + 4;
  };

  const trackCaret = (blockId) => (e) => {
    caret.current = { blockId, pos: e.target.selectionStart ?? 0 };
  };

  const tableFields = Object.entries(fields).filter(([, d]) => d.type === 'table');

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-5 items-start" dir="rtl">

      {/* ── Editor ───────────────────────────── */}
      <div className="space-y-3 xl:sticky xl:top-0 xl:max-h-[calc(100vh-140px)] xl:overflow-y-auto pl-1">

        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-xs font-medium space-y-1">
            {errors.map((e, i) => (
              <p key={i} className="flex items-start gap-1.5">
                <Warning size={13} className="mt-0.5 flex-shrink-0" /> {e}
              </p>
            ))}
          </div>
        )}

        {/* Fields registry */}
        <section className="bg-white rounded-2xl border border-line overflow-hidden">
          <button
            onClick={() => setShowFields(p => !p)}
            className="w-full px-4 py-3 flex items-center justify-between bg-background/50 border-b border-line"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-ink">
              <Sparkle size={15} className="text-primary" />
              الحقول ({Object.keys(fields).length})
            </span>
            <CaretDown size={13} className={`text-muted transition-transform ${showFields ? 'rotate-180' : ''}`} />
          </button>

          {showFields && (
            <div className="p-3 space-y-2">
              
              {Object.entries(fields).map(([key, def]) => (
                <div key={key} className="rounded-xl border border-line p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={def.label || ''}
                      onChange={e => patchField(key, { label: e.target.value })}
                      placeholder="اسم الحقل"
                      className={`${inputCls} py-1.5 text-xs flex-1`}
                    />
                    <button
                      onClick={() => removeField(key)}
                      title="حذف الحقل"
                      className="w-7 h-7 rounded-lg border border-red-200 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center flex-shrink-0 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={def.type || 'text'}
                      onChange={e => patchField(key, { type: e.target.value })}
                      className={`${inputCls} py-1.5 text-xs`}
                    >
                      {FIELD_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                    </select>

                    <select
                      value={fieldOwner(def)}
                      onChange={e => {
                        const owner = e.target.value;
                        patchField(key, { owner, source: owner === 'system' ? (def.source || SOURCES[0].key) : def.source });
                      }}
                      className={`${inputCls} py-1.5 text-xs`}
                      title="من يكتب في هذه الخانة"
                    >
                      {OWNERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>

                  {/* Prefill is a separate question from ownership: a blank the
                      caterer owns may still open with what the registry knows. */}
                  <select
                    value={def.source || ''}
                    onChange={e => patchField(key, { source: e.target.value || undefined })}
                    className={`${inputCls} py-1.5 text-xs`}
                  >
                    <option value="">
                      {fieldOwner(def) === 'system' ? '— اختر المصدر —' : 'بدون تعبئة مسبقة'}
                    </option>
                    {SOURCES.map(s => (
                      <option key={s.key} value={s.key}>
                        {fieldOwner(def) === 'system' ? s.label : `يبدأ بـ: ${s.label}`}
                      </option>
                    ))}
                  </select>

                  {def.type === 'select' && (
                    <input
                      value={(def.options || []).join('، ')}
                      onChange={e => patchField(key, {
                        options: e.target.value.split(/[،,]/).map(s => s.trim()).filter(Boolean),
                      })}
                      placeholder="الخيارات مفصولة بفاصلة"
                      className={`${inputCls} py-1.5 text-xs`}
                    />
                  )}

                  {def.type === 'table' && (
                    <input
                      value={(def.columns || []).map(c => c.label).join('، ')}
                      onChange={e => patchField(key, {
                        columns: e.target.value.split(/[،,]/).map(s => s.trim()).filter(Boolean)
                          .map((label, i) => ({ key: `c${i + 1}`, label })),
                      })}
                      placeholder="أعمدة الجدول مفصولة بفاصلة"
                      className={`${inputCls} py-1.5 text-xs`}
                    />
                  )}

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!def.required}
                        disabled={fieldOwner(def) === 'system'}
                        onChange={e => patchField(key, { required: e.target.checked })}
                        className="accent-primary w-3.5 h-3.5"
                      />
                      مطلوب
                    </label>
                    {!usedKeys.has(key) ? (
                      <span className="text-[10px] text-amber-600 font-medium">غير مُدرَج في المستند</span>
                    ) : (
                      <span className="text-[10px] text-muted">{`{{${key}}}`}</span>
                    )}
                  </div>
                </div>
              ))}

              <button
                onClick={addField}
                className="w-full py-2 rounded-xl border border-dashed border-line text-xs font-bold text-primary hover:bg-background transition-colors"
              >
                + حقل جديد
              </button>
            </div>
          )}
        </section>

        {/* Blocks */}
        <section className="bg-white rounded-2xl border border-line overflow-hidden">
          <div className="px-4 py-3 bg-background/50 border-b border-line">
            <span className="text-sm font-bold text-ink">بلوكات المستند ({blocks.length})</span>
          </div>

          <div className="p-3 space-y-2">
            {blocks.map((b, i) => {
              const Icon = BLOCK_ICON[b.type] || Textbox;
              const open = openBlock === b.id;
              return (
                <div key={b.id} className={`rounded-xl border transition-colors ${open ? 'border-primary/40 bg-background/40' : 'border-line'}`}>
                  <div className="flex items-center gap-1.5 px-2.5 py-2">
                    <button onClick={() => setOpenBlock(open ? null : b.id)} className="flex items-center gap-2 flex-1 min-w-0 text-right">
                      <Icon size={14} className="text-primary flex-shrink-0" />
                      <span className="text-xs font-bold text-ink flex-shrink-0">{BLOCK_META[b.type]?.label}</span>
                      <span className="text-[11px] text-muted truncate">
                        {b.text?.slice(0, 34) || (b.keys?.length ? `${b.keys.length} حقل` : '')}
                      </span>
                    </button>
                    <button onClick={() => moveBlock(b.id, -1)} disabled={i === 0}
                      className="w-6 h-6 rounded-md text-muted hover:text-primary disabled:opacity-25 flex items-center justify-center">
                      <CaretUp size={12} />
                    </button>
                    <button onClick={() => moveBlock(b.id, 1)} disabled={i === blocks.length - 1}
                      className="w-6 h-6 rounded-md text-muted hover:text-primary disabled:opacity-25 flex items-center justify-center">
                      <CaretDown size={12} />
                    </button>
                    <button onClick={() => removeBlock(b.id)}
                      className="w-6 h-6 rounded-md text-red-400 hover:text-red-600 flex items-center justify-center">
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {open && (
                    <div className="px-2.5 pb-2.5 space-y-2">
                      {PROSE.has(b.type) && (
                        <>
                          <textarea
                            value={b.text || ''}
                            onChange={e => patchBlock(b.id, { text: e.target.value })}
                            onSelect={trackCaret(b.id)}
                            onFocus={trackCaret(b.id)}
                            rows={b.type === 'heading' ? 1 : 4}
                            placeholder="اكتب النص، وأدرج الحقول من الأسفل"
                            className={`${inputCls} text-xs resize-none leading-relaxed`}
                          />
                          {Object.keys(fields).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-[10px] text-muted self-center ml-1">أدرج:</span>
                              {Object.entries(fields).map(([key, def]) => (
                                <button
                                  key={key}
                                  onClick={() => insertToken(key)}
                                  className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary hover:text-white transition-colors"
                                >
                                  {def.label || key}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {b.type === 'list' && (
                        <>
                          <div className="flex gap-1.5">
                            {[
                              { v: false, label: 'نقاط' },
                              { v: true,  label: 'مرقّمة' },
                            ].map(o => (
                              <button
                                key={String(o.v)}
                                onClick={() => patchBlock(b.id, { ordered: o.v })}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                                  !!b.ordered === o.v
                                    ? 'bg-primary text-white border-primary'
                                    : 'border-line text-muted hover:border-primary/40'
                                }`}
                              >
                                {o.label}
                              </button>
                            ))}
                            <span className="text-[10px] text-muted self-center">
                              {(b.items || []).filter(Boolean).length} بند
                            </span>
                          </div>
                          {/* One clause per line: the simplest editor that lets an
                              author paste a whole set of terms at once. */}
                          <textarea
                            value={(b.items || []).join('\n')}
                            onChange={e => patchBlock(b.id, { items: e.target.value.split('\n') })}
                            onSelect={trackCaret(b.id)}
                            onFocus={trackCaret(b.id)}
                            rows={8}
                            placeholder="بند في كل سطر"
                            className={`${inputCls} text-xs resize-none leading-relaxed`}
                          />
                        </>
                      )}

                      {b.type === 'fields' && (
                        <>
                          <div className="flex gap-1.5">
                            {[
                              { v: 'list', label: 'نقاط' },
                              { v: 'grid', label: 'شبكة' },
                            ].map(o => (
                              <button
                                key={o.v}
                                onClick={() => patchBlock(b.id, { style: o.v })}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                                  (b.style || 'list') === o.v
                                    ? 'bg-primary text-white border-primary'
                                    : 'border-line text-muted hover:border-primary/40'
                                }`}
                              >
                                {o.label}
                              </button>
                            ))}
                            {(b.style || 'list') === 'grid' && (
                              <button
                                onClick={() => patchBlock(b.id, { columns: b.columns === 2 ? 1 : 2 })}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-line text-muted hover:border-primary/40"
                              >
                                {b.columns === 2 ? 'عمودان' : 'عمود'}
                              </button>
                            )}
                          </div>
                          <div className="space-y-1">
                            {Object.entries(fields).map(([key, def]) => (
                              <label key={key} className="flex items-center gap-2 text-[11px] text-ink cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={(b.keys || []).includes(key)}
                                  onChange={e => patchBlock(b.id, {
                                    keys: e.target.checked
                                      ? [...(b.keys || []), key]
                                      : (b.keys || []).filter(k => k !== key),
                                  })}
                                  className="accent-primary w-3.5 h-3.5"
                                />
                                {def.label || key}
                              </label>
                            ))}
                          </div>
                        </>
                      )}

                      {b.type === 'table' && (
                        <select
                          value={b.key || ''}
                          onChange={e => patchBlock(b.id, { key: e.target.value })}
                          className={`${inputCls} py-1.5 text-xs`}
                        >
                          <option value="">— اختر حقل جدول —</option>
                          {tableFields.map(([key, def]) => (
                            <option key={key} value={key}>{def.label || key}</option>
                          ))}
                        </select>
                      )}

                      {b.type === 'signature' && (
                        <div className="space-y-1.5">
                          {(b.slots || []).map((s, si) => (
                            <div key={si} className="flex gap-1.5">
                              <input
                                value={s.label}
                                onChange={e => patchBlock(b.id, {
                                  slots: b.slots.map((x, xi) => (xi === si ? { ...x, label: e.target.value } : x)),
                                })}
                                className={`${inputCls} py-1.5 text-xs flex-1`}
                              />
                              <button
                                onClick={() => patchBlock(b.id, { slots: b.slots.filter((_, xi) => xi !== si) })}
                                className="w-7 h-7 rounded-lg border border-red-200 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => patchBlock(b.id, {
                              slots: [...(b.slots || []), { label: 'خانة', key: uid('s') }],
                            })}
                            className="w-full py-1.5 rounded-lg border border-dashed border-line text-[11px] font-bold text-primary hover:bg-background transition-colors"
                          >
                            + خانة
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex flex-wrap gap-1.5 pt-1">
              {BLOCK_TYPES.map(t => {
                const Icon = BLOCK_ICON[t.type];
                return (
                  <button
                    key={t.type}
                    onClick={() => addBlock(t.type)}
                    title={t.hint}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-dashed border-line text-[11px] font-bold text-muted hover:text-primary hover:border-primary/40 transition-colors"
                  >
                    <Icon size={12} /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* ── Live page ────────────────────────── */}
      <div className="bg-background/60 rounded-2xl border border-line p-4 sm:p-6">
        <FormDocument definition={definition} mode="preview" formNumber="FRM-••••" />
      </div>
    </div>
  );
}
