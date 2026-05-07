// Multi-model leaderboard. Aggregates eval runs into a comparison table
// that shows quality, cost, and latency tradeoffs across model versions.
// This is the table CIOs actually use to decide what to promote.

import type { EvalRun } from './regression-detector';

export interface ModelEntry {
  modelId: string;
  modelVersion: string;
  runId: string;
  passRate: number;
  averageScore: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  averageCostUsd: number;
  totalCostUsd: number;
  caseCount: number;
  qualityPerDollar: number; // pass-rate / cost = "value score"
}

export interface Leaderboard {
  datasetId: string;
  models: ModelEntry[];
  rankings: {
    bestQuality: string; // modelId@version
    bestCost: string;
    bestLatency: string;
    bestValue: string; // best quality-per-dollar
  };
}

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx];
}

export function buildLeaderboard(runs: EvalRun[]): Leaderboard {
  if (runs.length === 0) {
    throw new Error('Cannot build leaderboard from empty run list.');
  }
  const datasetIds = new Set(runs.map((r) => r.datasetId));
  if (datasetIds.size > 1) {
    throw new Error('All runs must be on the same dataset for leaderboard comparison.');
  }
  const datasetId = runs[0].datasetId;

  const models: ModelEntry[] = runs.map((run) => {
    const passed = run.cases.filter((c) => c.passed).length;
    const passRate = run.cases.length === 0 ? 0 : Math.round((passed / run.cases.length) * 1000) / 10;
    const averageScore = run.cases.length === 0 ? 0 : Math.round((run.cases.reduce((s, c) => s + c.score, 0) / run.cases.length) * 1000) / 1000;
    const totalLatency = run.cases.reduce((s, c) => s + c.latencyMs, 0);
    const averageLatencyMs = run.cases.length === 0 ? 0 : Math.round(totalLatency / run.cases.length);
    const totalCost = run.cases.reduce((s, c) => s + c.costUsd, 0);
    const averageCostUsd = run.cases.length === 0 ? 0 : Math.round((totalCost / run.cases.length) * 100000) / 100000;

    // Quality-per-dollar — pass rate divided by cost per case (higher = better value)
    // Avoid div-by-zero by guarding total cost
    const qualityPerDollar = totalCost > 0
      ? Math.round((passRate / (totalCost / run.cases.length)) * 100) / 100
      : 0;

    return {
      modelId: run.modelId,
      modelVersion: run.modelVersion,
      runId: run.runId,
      passRate,
      averageScore,
      averageLatencyMs,
      p95LatencyMs: p95(run.cases.map((c) => c.latencyMs)),
      averageCostUsd,
      totalCostUsd: Math.round(totalCost * 10000) / 10000,
      caseCount: run.cases.length,
      qualityPerDollar,
    };
  });

  // Rankings
  const fullId = (m: ModelEntry) => `${m.modelId}@${m.modelVersion}`;
  const bestQuality = [...models].sort((a, b) => b.passRate - a.passRate)[0];
  const bestCost = [...models].sort((a, b) => a.averageCostUsd - b.averageCostUsd)[0];
  const bestLatency = [...models].sort((a, b) => a.averageLatencyMs - b.averageLatencyMs)[0];
  const bestValue = [...models].sort((a, b) => b.qualityPerDollar - a.qualityPerDollar)[0];

  return {
    datasetId,
    models,
    rankings: {
      bestQuality: fullId(bestQuality),
      bestCost: fullId(bestCost),
      bestLatency: fullId(bestLatency),
      bestValue: fullId(bestValue),
    },
  };
}
