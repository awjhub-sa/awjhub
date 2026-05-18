import { serverTimestamp } from './db.js';

export const TERMINAL_REPORT_STATUSES    = ['resolved'];
export const TERMINAL_LOGISTICS_STATUSES = ['delivered', 'rejected'];

export function toMs(ts) {
  if (ts == null) return null;
  if (typeof ts === 'number') return ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds != null) return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d.getTime();
}

export function initialStatusFields(initialStatus = 'pending') {
  return {
    status:      initialStatus,
    statusSince: serverTimestamp(),
    durations:   {},
    closedAt:    null,
  };
}

export function computeStatusUpdate(currentDoc, newStatus, terminalStatuses = []) {
  const now = Date.now();
  const oldStatus = currentDoc.status || 'pending';
  if (oldStatus === newStatus) return null;

  const sinceMs = toMs(currentDoc.statusSince) ?? toMs(currentDoc.timestamp) ?? now;
  const elapsed = Math.max(0, now - sinceMs);

  const durations = { ...(currentDoc.durations || {}) };
  durations[oldStatus] = (durations[oldStatus] || 0) + elapsed;

  const isTerminal  = terminalStatuses.includes(newStatus);
  const wasTerminal = terminalStatuses.includes(oldStatus);

  const update = {
    status:      newStatus,
    statusSince: serverTimestamp(),
    durations,
  };
  if (isTerminal)        update.closedAt = serverTimestamp();
  else if (wasTerminal)  update.closedAt = null;
  return update;
}

export function getStatusDurationMs(doc, status, nowTick = Date.now()) {
  const current = doc.status || 'pending';
  const baseMs  = (doc.durations && doc.durations[status]) || 0;
  if (status !== current) return baseMs;
  const sinceMs = toMs(doc.statusSince) ?? toMs(doc.timestamp);
  if (sinceMs == null) return baseMs;
  return baseMs + Math.max(0, nowTick - sinceMs);
}

export function getTotalElapsedMs(doc, terminalStatuses = [], nowTick = Date.now()) {
  const created = toMs(doc.timestamp);
  if (created == null) return 0;
  const closedMs = toMs(doc.closedAt);
  if (closedMs && terminalStatuses.includes(doc.status)) {
    return Math.max(0, closedMs - created);
  }
  return Math.max(0, nowTick - created);
}

export function isClosed(doc, terminalStatuses) {
  return terminalStatuses.includes(doc.status || 'pending') && toMs(doc.closedAt) != null;
}

export function fmtDuration(ms) {
  if (ms == null || isNaN(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}ث`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}د`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h < 24) return mm > 0 ? `${h}س ${mm}د` : `${h}س`;
  const d = Math.floor(h / 24);
  const hh = h % 24;
  return hh > 0 ? `${d}ي ${hh}س` : `${d}ي`;
}
