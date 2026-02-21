/* eslint-disable @typescript-eslint/no-explicit-any */

type DateLike =
  | Date
  | string
  | number
  | { toDate?: () => Date; seconds?: number }
  | null
  | undefined;

const pad2 = (value: number): string => String(value).padStart(2, '0');

export const toDateOrNull = (value: DateLike): Date | null => {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'object') {
    if (typeof (value as any).toDate === 'function') {
      const parsed = (value as any).toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }
    if (typeof (value as any).seconds === 'number') {
      const parsed = new Date((value as any).seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  const parsed = new Date(value as any);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDateDefault = (value: DateLike, fallback = '--'): string => {
  const parsed = toDateOrNull(value);
  if (!parsed) return fallback;
  return `${pad2(parsed.getDate())}/${pad2(parsed.getMonth() + 1)}/${parsed.getFullYear()}`;
};

export const formatTimeDefault = (
  value: DateLike,
  options?: { includeSeconds?: boolean; fallback?: string }
): string => {
  const includeSeconds = options?.includeSeconds ?? true;
  const fallback = options?.fallback ?? '--';
  const parsed = toDateOrNull(value);
  if (!parsed) return fallback;

  const base = `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
  if (!includeSeconds) return base;
  return `${base}:${pad2(parsed.getSeconds())}`;
};

export const formatDateTimeDefault = (
  value: DateLike,
  options?: { includeSeconds?: boolean; fallback?: string }
): string => {
  const parsed = toDateOrNull(value);
  const fallback = options?.fallback ?? '--';
  if (!parsed) return fallback;

  const dateLabel = formatDateDefault(parsed, fallback);
  const timeLabel = formatTimeDefault(parsed, {
    includeSeconds: options?.includeSeconds ?? true,
    fallback,
  });
  if (timeLabel === fallback) return fallback;
  return `${dateLabel} ${timeLabel}`;
};

