// Published cost for the deployed app from 11/10/2026 through the moment you run it.
// Usage: node scripts/cost-today.mjs [resource-group]
// Requires: az login. Azure often publishes cost 8–24 hours late.

import { execFileSync } from 'node:child_process';

const resourceGroup = process.argv[2] ?? 'rg-veti';
const start = new Date(2026, 9, 11);

function localMidnight(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const pad = (value) => String(value).padStart(2, '0');
  const offsetMinutes = -copy.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  return (
    `${copy.getFullYear()}-${pad(copy.getMonth() + 1)}-${pad(copy.getDate())}` +
    `T00:00:00${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
  );
}

const now = new Date();
const through = new Date(now);
through.setDate(through.getDate() + 1);

const subscriptionId = execFileSync(
  'az',
  ['account', 'show', '--query', 'id', '-o', 'tsv'],
  { encoding: 'utf8' },
).trim();

const body = {
  type: 'ActualCost',
  timeframe: 'Custom',
  timePeriod: {
    from: localMidnight(start),
    to: localMidnight(through),
  },
  dataset: {
    granularity: 'Daily',
    aggregation: {
      totalCost: { name: 'Cost', function: 'Sum' },
      totalCostUSD: { name: 'CostUSD', function: 'Sum' },
    },
    grouping: [{ type: 'Dimension', name: 'ServiceName' }],
  },
};

let raw;
try {
  raw = execFileSync(
    'az',
    [
      'rest',
      '--method',
      'post',
      '--url',
      `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`,
      '--body',
      JSON.stringify(body),
    ],
    { encoding: 'utf8' },
  );
} catch (error) {
  const detail = error.stderr?.toString() || error.message;
  console.error(detail.includes('429') ? 'Azure cost API is rate limited. Wait a minute and run this again.' : detail.trim());
  process.exit(1);
}

const result = JSON.parse(raw);
const columns = result.properties.columns.map((column) => column.name);
const rows = result.properties.rows.map((row) =>
  Object.fromEntries(columns.map((name, index) => [name, row[index]])),
);

const byService = new Map();
for (const row of rows) {
  const name = row.ServiceName;
  const current = byService.get(name) ?? { cost: 0, usd: 0, currency: row.Currency };
  current.cost += Number(row.Cost);
  current.usd += Number(row.CostUSD);
  byService.set(name, current);
}

const currency = rows[0]?.Currency ?? 'BRL';
const total = [...byService.values()].reduce((sum, row) => sum + row.cost, 0);
const totalUsd = [...byService.values()].reduce((sum, row) => sum + row.usd, 0);
const stamp = now.toLocaleString('pt-BR', { hour12: false });

console.log(`${resourceGroup}  11/10/2026 → ${stamp}`);

if (rows.length === 0) {
  console.log(`published cost: 0.00 ${currency}`);
  console.log('Azure has not published charges for this period yet. Cost usually appears 8–24 hours later.');
  process.exit(0);
}

for (const [name, row] of byService) {
  console.log(
    `${name}: ${row.cost.toFixed(2)} ${row.currency} (${row.usd.toFixed(2)} USD)`,
  );
}
console.log(`total: ${total.toFixed(2)} ${currency} (${totalUsd.toFixed(2)} USD)`);
