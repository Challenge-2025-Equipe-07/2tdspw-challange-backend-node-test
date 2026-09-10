import {
  monthLabelFromYearMonth,
  saoPauloWeekday,
  saoPauloYearMonth,
  shiftYearMonth,
  WEEKDAY_ORDER,
} from '../common/sao-paulo';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type PricedAppointment = {
  petId: string;
  appointmentName: string;
  appointmentDateTime: Date;
  price: number;
  fromCarePlan: boolean;
};

export type DashboardKpi = {
  value: number;
  changePct: number | null;
};

export type DashboardPayback = {
  value: number | null;
  change: number | null;
};

export type DashboardPacientes = {
  value: number;
  changePct: number | null;
  porDia: { dia: string; qtd: number }[];
};

export type DashboardReceita = {
  total90d: number;
  porMes: { mes: string; total: number }[];
};

export type DashboardRentabilidadeItem = {
  nome: string;
  total: number;
  share: number;
};

export type DashboardMetrics = {
  ticketMedio: DashboardKpi;
  ltvMedio: DashboardKpi;
  paybackMeses: DashboardPayback;
  pacientesUnicos: DashboardPacientes;
  receitaRecuperada: DashboardReceita;
  rentabilidade: DashboardRentabilidadeItem[];
};

function isRealized(row: PricedAppointment, now: Date): boolean {
  return row.appointmentDateTime.getTime() <= now.getTime();
}

function inRange(date: Date, from: Date, to: Date): boolean {
  const time = date.getTime();
  return time >= from.getTime() && time <= to.getTime();
}

function sumPrices(rows: PricedAppointment[]): number {
  return rows.reduce((total, row) => total + row.price, 0);
}

function averageTicket(rows: PricedAppointment[]): number {
  const priced = rows.filter((row) => row.price > 0);
  if (priced.length === 0) {
    return 0;
  }
  return sumPrices(priced) / priced.length;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - previous) / previous) * 100;
}

function paybackMonths(fee: number, revenue: number): number | null {
  if (revenue <= 0) {
    return null;
  }
  return fee / revenue;
}

function ltvMedio(rows: PricedAppointment[]): number {
  const planRows = rows.filter((row) => row.fromCarePlan && row.price > 0);
  const petIds = new Set(planRows.map((row) => row.petId));
  if (petIds.size === 0) {
    return 0;
  }
  return sumPrices(planRows) / petIds.size;
}

function uniquePets(rows: PricedAppointment[]): number {
  return new Set(rows.map((row) => row.petId)).size;
}

export function computeDashboardMetrics(
  rows: PricedAppointment[],
  saasFee: number,
  now: Date,
): DashboardMetrics {
  const last30From = new Date(now.getTime() - 30 * MS_PER_DAY);
  const prev30From = new Date(now.getTime() - 60 * MS_PER_DAY);
  const last90From = new Date(now.getTime() - 90 * MS_PER_DAY);
  const last7From = new Date(now.getTime() - 6 * MS_PER_DAY);
  const prev7From = new Date(now.getTime() - 13 * MS_PER_DAY);
  const last12From = new Date(now.getTime() - 365 * MS_PER_DAY);
  const prev12From = new Date(now.getTime() - 730 * MS_PER_DAY);

  const realizedLast30 = rows.filter(
    (row) =>
      isRealized(row, now) && inRange(row.appointmentDateTime, last30From, now),
  );
  const realizedPrev30 = rows.filter(
    (row) =>
      isRealized(row, now) &&
      inRange(row.appointmentDateTime, prev30From, last30From),
  );

  const ticketValue = averageTicket(realizedLast30);
  const ticketPrev = averageTicket(realizedPrev30);

  const revenue30 = sumPrices(realizedLast30);
  const revenuePrev30 = sumPrices(realizedPrev30);
  const paybackValue = paybackMonths(saasFee, revenue30);
  const paybackPrev = paybackMonths(saasFee, revenuePrev30);

  const currentMonth = saoPauloYearMonth(now);
  const monthKeys = Array.from({ length: 6 }, (_, index) =>
    shiftYearMonth(currentMonth, index - 5),
  );

  const fromCarePlan = rows.filter((row) => row.fromCarePlan);
  const receitaPorMes = monthKeys.map((yearMonth) => ({
    mes: monthLabelFromYearMonth(yearMonth),
    total: sumPrices(
      fromCarePlan.filter(
        (row) => saoPauloYearMonth(row.appointmentDateTime) === yearMonth,
      ),
    ),
  }));

  const receita90d = sumPrices(
    fromCarePlan.filter(
      (row) =>
        isRealized(row, now) &&
        inRange(row.appointmentDateTime, last90From, now),
    ),
  );

  const currentMonthRealized = rows.filter(
    (row) =>
      row.price > 0 &&
      isRealized(row, now) &&
      saoPauloYearMonth(row.appointmentDateTime) === currentMonth,
  );
  const byName = new Map<string, { nome: string; total: number }>();
  for (const row of currentMonthRealized) {
    const key = row.appointmentName.trim().toLocaleLowerCase('pt-BR');
    const current = byName.get(key);
    if (current) {
      current.total += row.price;
    } else {
      byName.set(key, { nome: row.appointmentName, total: row.price });
    }
  }
  const monthTotal = [...byName.values()].reduce(
    (sum, item) => sum + item.total,
    0,
  );
  const rentabilidade = [...byName.values()]
    .map((item) => ({
      nome: item.nome,
      total: item.total,
      share: monthTotal > 0 ? item.total / monthTotal : 0,
    }))
    .sort((left, right) => right.total - left.total);

  const last7 = rows.filter((row) =>
    inRange(row.appointmentDateTime, last7From, now),
  );
  const prev7 = rows.filter((row) =>
    inRange(row.appointmentDateTime, prev7From, last7From),
  );

  const petsByWeekday = new Map<string, Set<string>>();
  for (const dia of WEEKDAY_ORDER) {
    petsByWeekday.set(dia, new Set());
  }
  for (const row of last7) {
    const dia = saoPauloWeekday(row.appointmentDateTime);
    petsByWeekday.get(dia)?.add(row.petId);
  }

  const ltvCurrent = ltvMedio(
    rows.filter((row) => inRange(row.appointmentDateTime, last12From, now)),
  );
  const ltvPrev = ltvMedio(
    rows.filter((row) =>
      inRange(row.appointmentDateTime, prev12From, last12From),
    ),
  );

  return {
    ticketMedio: {
      value: ticketValue,
      changePct: pctChange(ticketValue, ticketPrev),
    },
    ltvMedio: {
      value: ltvCurrent,
      changePct: pctChange(ltvCurrent, ltvPrev),
    },
    paybackMeses: {
      value: paybackValue,
      change:
        paybackValue != null && paybackPrev != null
          ? paybackValue - paybackPrev
          : null,
    },
    pacientesUnicos: {
      value: uniquePets(last7),
      changePct: pctChange(uniquePets(last7), uniquePets(prev7)),
      porDia: WEEKDAY_ORDER.map((dia) => ({
        dia,
        qtd: petsByWeekday.get(dia)?.size ?? 0,
      })),
    },
    receitaRecuperada: {
      total90d: receita90d,
      porMes: receitaPorMes,
    },
    rentabilidade,
  };
}
