const TIME_ZONE = 'America/Sao_Paulo';
const WEEKDAY_SUNDAY = 'Sun';
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type PlanRecurrency = 'single' | 'recurrent';

export type ScheduleItem = {
  planItemName: string;
  planRecurrency: PlanRecurrency;
  planRecurrencyRate?: number | null;
  planDurationInMonths: number;
  notifyWhatsapp?: boolean;
  notifyWeb?: boolean;
};

export type ScheduledAppointment = {
  appointmentName: string;
  appointmentDateTime: Date;
  notifyWhatsapp: boolean;
  notifyWeb: boolean;
};

function saoPauloWeekday(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'short',
  }).format(date);
}

export function nudgeToWeekday(date: Date): Date {
  const next = new Date(date.getTime());
  while (saoPauloWeekday(next) === WEEKDAY_SUNDAY) {
    next.setTime(next.getTime() + MS_PER_DAY);
  }
  return next;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function occurrenceDates(
  createdAt: Date,
  recurrency: PlanRecurrency,
  rate: number | null | undefined,
  durationInMonths: number,
): Date[] {
  const start = nudgeToWeekday(createdAt);

  if (recurrency !== 'recurrent' || !rate || rate <= 0) {
    return [start];
  }

  const dates: Date[] = [];
  for (let offset = 0; offset < durationInMonths; offset += rate) {
    dates.push(nudgeToWeekday(addMonths(start, offset)));
  }
  return dates.length > 0 ? dates : [start];
}

export function buildAppointments(
  createdAt: Date,
  items: ScheduleItem[],
): ScheduledAppointment[] {
  return items.flatMap((item) =>
    occurrenceDates(
      createdAt,
      item.planRecurrency,
      item.planRecurrencyRate,
      item.planDurationInMonths,
    ).map((appointmentDateTime) => ({
      appointmentName: item.planItemName,
      appointmentDateTime,
      notifyWhatsapp: item.notifyWhatsapp ?? false,
      notifyWeb: item.notifyWeb ?? true,
    })),
  );
}
