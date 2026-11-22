// OURS: content engine E1. What each AI step really costs, from the cost log
// every AI call writes (ours_ai_usage). Read-only, and prints totals only:
// no customer content, no organisation names.
//
// Run from the repo root, against the database you want to measure:
//   DATABASE_URL="postgresql://…" node ours/scripts/ai-cost-summary.mjs
//   node ours/scripts/ai-cost-summary.mjs --days 30 --org <organisationId>
//
// --days  only calls from the last N days (default: all)
// --org   one organisation only (default: all, as an operator report)
import { PrismaClient } from '@prisma/client';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const days = Number.parseInt(arg('days') || '', 10);
const orgId = arg('org');
const where = {
  ...(Number.isFinite(days) && days > 0
    ? { createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } }
    : {}),
  ...(orgId ? { organizationId: orgId } : {}),
};

const usd = (n) => `$${n.toFixed(4)}`;
const num = (n) => Math.round(n).toLocaleString('en-GB');

const prisma = new PrismaClient();
try {
  const [byStep, orgs] = await Promise.all([
    prisma.oursAiUsage.groupBy({
      by: ['feature', 'model'],
      where,
      _count: { _all: true },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        cacheWriteTokens: true,
        costUsd: true,
      },
      _avg: { inputTokens: true, outputTokens: true, costUsd: true },
      orderBy: { feature: 'asc' },
    }),
    prisma.oursAiUsage.groupBy({ by: ['organizationId'], where, _count: { _all: true } }),
  ]);

  if (!byStep.length) {
    console.log('No AI calls logged for this selection.');
  } else {
    console.log(
      `AI cost by step${Number.isFinite(days) && days > 0 ? `, last ${days} days` : ''}${orgId ? `, one organisation` : `, ${orgs.length} organisations`}\n`
    );
    console.table(
      byStep.map((row) => ({
        step: row.feature,
        model: row.model,
        calls: row._count._all,
        'avg tokens in': num(row._avg.inputTokens || 0),
        'avg tokens out': num(row._avg.outputTokens || 0),
        'cache read': num(row._sum.cacheReadTokens || 0),
        'cache write': num(row._sum.cacheWriteTokens || 0),
        'avg cost': usd(Number(row._avg.costUsd || 0)),
        'total cost': usd(Number(row._sum.costUsd || 0)),
      }))
    );
    const total = byStep.reduce((sum, row) => sum + Number(row._sum.costUsd || 0), 0);
    console.log(`Total: ${usd(total)} (USD, list prices; calls with an unknown model count as $0)`);
  }
} finally {
  await prisma.$disconnect();
}
