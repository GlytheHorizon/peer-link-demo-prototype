/**
 * Date/time helpers for sessions.
 *
 * The backend stores scheduled_start / scheduled_end as naive UTC strings
 * ("YYYY-MM-DD HH:MM:SS" — produced via `toISOString().slice(0, 19)`) and the
 * DB client is configured with `dateStrings: true`, so the API returns those
 * strings to the frontend. JavaScript parses "YYYY-MM-DD HH:MM:SS" as LOCAL
 * time, which shifted every session time/date by the UTC offset (a 2:00 PM
 * Manila session showed as 6:00 AM). Parse these strings as UTC instants and
 * format in the user's local timezone.
 */

/** Parses backend date strings (naive UTC like "2026-10-30 06:00:00") or full ISO strings as a Date. */
export const asDate = (v) => {
  if (v instanceof Date) return v;
  if (v === null || v === undefined || v === '') return new Date(NaN);
  const s = String(v).trim();
  const normalized = /^\d{4}-\d{2}-\d{2}T/.test(s) ? s : `${s.replace(' ', 'T')}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? new Date(NaN) : d;
};

/** 12-hour time label, e.g. "2:00 PM". */
export const fmtTime = (d) => asDate(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** "2:00 PM - 3:00 PM" style range label. */
export const fmtRange = (start, end) => `${fmtTime(start)} - ${fmtTime(end)}`;

/** Date + time label, e.g. "Oct 30, 2026, 2:00 PM". */
export const fmtDateTime = (d) => asDate(d).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

/** Date-only label, e.g. "Oct 30, 2026". */
export const fmtDate = (d) => asDate(d).toLocaleDateString('en-PH', { dateStyle: 'medium' });

/** "Today" / "Tomorrow" / weekday label for a date.
 *  Clones the date first: callers often format the same Date right after this
 *  (e.g. `dayTag(start) · fmtRange(start, end)`), and zeroing the time on the
 *  caller's object made every one of those render "12:00 AM". */
export const dayTag = (d) => {
  const day = new Date(asDate(d).getTime());
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((day - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return day.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};
