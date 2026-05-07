import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareRuns } from '../src/evaluators/regression-detector';
import { buildLeaderboard } from '../src/evaluators/leaderboard';
import { evaluateGate } from '../src/evaluators/ci-gate';
import type { EvalRun } from '../src/evaluators/regression-detector';

function makeRun(modelId: string, version: string, datasetId: string, perCase: Array<{passed: boolean, score: number, latencyMs: number, costUsd: number}>): EvalRun {
  return {
    runId: `run_${modelId}_${version}_${datasetId}`,
    modelId,
    modelVersion: version,
    datasetId,
    timestamp: '2026-05-07T10:00:00Z',
    cases: perCase.map((c, i) => ({ caseId: `case_${i}`, ...c })),
  };
}

const baseline = makeRun('claude-opus', '4.6', 'ds_test', [
  { passed: true, score: 0.95, latencyMs: 1500, costUsd: 0.01 },
  { passed: true, score: 0.88, latencyMs: 1600, costUsd: 0.011 },
  { passed: true, score: 0.92, latencyMs: 1700, costUsd: 0.012 },
  { passed: false, score: 0.45, latencyMs: 1800, costUsd: 0.013 },
]);

test('compareRuns: improved run yields improved verdict', () => {
  const candidate = makeRun('claude-opus', '4.7', 'ds_test', [
    { passed: true, score: 0.96, latencyMs: 1400, costUsd: 0.011 },
    { passed: true, score: 0.91, latencyMs: 1500, costUsd: 0.012 },
    { passed: true, score: 0.94, latencyMs: 1600, costUsd: 0.013 },
    { passed: true, score: 0.85, latencyMs: 1700, costUsd: 0.014 },
  ]);
  const r = compareRuns(baseline, candidate);
  assert.equal(r.verdict, 'improved');
  assert.equal(r.newPasses.length, 1);
  assert.ok(r.passRateDelta > 0);
});

test('compareRuns: regression in pass rate detected', () => {
  const candidate = makeRun('claude-opus', '4.7', 'ds_test', [
    { passed: true, score: 0.95, latencyMs: 1500, costUsd: 0.01 },
    { passed: false, score: 0.4, latencyMs: 1600, costUsd: 0.011 },
    { passed: false, score: 0.5, latencyMs: 1700, costUsd: 0.012 },
    { passed: false, score: 0.45, latencyMs: 1800, costUsd: 0.013 },
  ]);
  const r = compareRuns(baseline, candidate);
  assert.ok(['regression', 'severe-regression'].includes(r.verdict));
  assert.ok(r.newFailures.length >= 2);
});

test('compareRuns: throws on dataset mismatch', () => {
  const other = makeRun('x', 'y', 'ds_other', [{ passed: true, score: 1, latencyMs: 1, costUsd: 0 }]);
  assert.throws(() => compareRuns(baseline, other), /different datasets/);
});

test('buildLeaderboard: ranks by quality / cost / latency / value', () => {
  const fastCheap = makeRun('sonnet', '4.6', 'ds_test', [
    { passed: true, score: 0.85, latencyMs: 800, costUsd: 0.003 },
    { passed: true, score: 0.82, latencyMs: 850, costUsd: 0.003 },
    { passed: false, score: 0.5, latencyMs: 900, costUsd: 0.003 },
  ]);
  const accuratePremium = makeRun('opus', '4.7', 'ds_test', [
    { passed: true, score: 0.96, latencyMs: 1800, costUsd: 0.015 },
    { passed: true, score: 0.94, latencyMs: 1900, costUsd: 0.016 },
    { passed: true, score: 0.91, latencyMs: 2000, costUsd: 0.017 },
  ]);
  const r = buildLeaderboard([fastCheap, accuratePremium]);
  assert.equal(r.rankings.bestQuality, 'opus@4.7');
  assert.equal(r.rankings.bestCost, 'sonnet@4.6');
  assert.equal(r.rankings.bestLatency, 'sonnet@4.6');
});

test('buildLeaderboard: throws on mixed datasets', () => {
  const a = makeRun('m1', 'v1', 'ds_a', [{ passed: true, score: 1, latencyMs: 1, costUsd: 0.001 }]);
  const b = makeRun('m2', 'v1', 'ds_b', [{ passed: true, score: 1, latencyMs: 1, costUsd: 0.001 }]);
  assert.throws(() => buildLeaderboard([a, b]), /same dataset/);
});

test('evaluateGate: passes when candidate exceeds thresholds', () => {
  const candidate = makeRun('opus', '4.7', 'ds_test', [
    { passed: true, score: 0.95, latencyMs: 1500, costUsd: 0.01 },
    { passed: true, score: 0.88, latencyMs: 1600, costUsd: 0.011 },
    { passed: true, score: 0.92, latencyMs: 1700, costUsd: 0.012 },
    { passed: true, score: 0.85, latencyMs: 1800, costUsd: 0.013 },
    { passed: true, score: 0.91, latencyMs: 1500, costUsd: 0.011 },
  ]);
  const r = evaluateGate(candidate, null, { minPassRate: 80 });
  assert.equal(r.decision, 'pass');
});

test('evaluateGate: fails on below-threshold pass rate', () => {
  const bad = makeRun('opus', '4.7', 'ds_test', [
    { passed: false, score: 0.3, latencyMs: 1500, costUsd: 0.01 },
    { passed: false, score: 0.4, latencyMs: 1600, costUsd: 0.011 },
    { passed: true, score: 0.92, latencyMs: 1700, costUsd: 0.012 },
  ]);
  const r = evaluateGate(bad, null, { minPassRate: 80 });
  assert.equal(r.decision, 'fail');
  assert.ok(r.reasons.some((s) => s.includes('below minimum')));
});

test('evaluateGate: detects regression vs baseline', () => {
  const candidate = makeRun('opus', '4.7', 'ds_test', [
    { passed: false, score: 0.3, latencyMs: 1500, costUsd: 0.01 },
    { passed: false, score: 0.4, latencyMs: 1600, costUsd: 0.011 },
    { passed: false, score: 0.5, latencyMs: 1700, costUsd: 0.012 },
    { passed: false, score: 0.45, latencyMs: 1800, costUsd: 0.013 },
  ]);
  const r = evaluateGate(candidate, baseline, { minPassRate: 50 });
  assert.equal(r.decision, 'fail');
});

test('evaluateGate: cost cap enforced', () => {
  const expensive = makeRun('opus', '4.7', 'ds_test', [
    { passed: true, score: 0.9, latencyMs: 1500, costUsd: 0.05 },
    { passed: true, score: 0.9, latencyMs: 1500, costUsd: 0.05 },
  ]);
  const r = evaluateGate(expensive, null, { minPassRate: 50, maxCostPerCaseUsd: 0.02 });
  assert.equal(r.decision, 'fail');
  assert.ok(r.reasons.some((s) => s.toLowerCase().includes('cost')));
});

test('evaluateGate: latency cap enforced', () => {
  const slow = makeRun('opus', '4.7', 'ds_test', [
    { passed: true, score: 0.9, latencyMs: 5000, costUsd: 0.01 },
    { passed: true, score: 0.9, latencyMs: 5500, costUsd: 0.01 },
  ]);
  const r = evaluateGate(slow, null, { minPassRate: 50, maxLatencyP95Ms: 3000 });
  assert.equal(r.decision, 'fail');
  assert.ok(r.reasons.some((s) => s.toLowerCase().includes('latency')));
});
