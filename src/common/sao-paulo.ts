export const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

const WEEKDAY_PT: Record<string, string> = {
  Sun: 'Dom',
  Mon: 'Seg',
  Tue: 'Ter',
  Wed: 'Qua',
  Thu: 'Qui',
  Fri: 'Sex',
  Sat: 'Sáb',
};

export const WEEKDAY_ORDER = [
  'Seg',
  'Ter',
  'Qua',
  'Qui',
  'Sex',
  'Sáb',
  'Dom',
] as const;

export const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

function part(date: Date, type: Intl.DateTimeFormatPartTypes): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  return parts.find((item) => item.type === type)?.value ?? '';
}

export function saoPauloWeekday(date: Date): string {
  const key = part(date, 'weekday');
  return WEEKDAY_PT[key] ?? key;
}

export function saoPauloYearMonth(date: Date): string {
  return `${part(date, 'year')}-${part(date, 'month')}`;
}

export function monthLabelFromYearMonth(yearMonth: string): string {
  const month = Number(yearMonth.slice(5, 7));
  return MONTH_LABELS[month - 1] ?? yearMonth;
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}
