// CI gate decision logic — given a candidate run and a baseline + thresholds,
// decide whether the build should pass or fail. This is the integration
// point that lets agent-eval-arena gate model promotions in CI/CD.

import type { EvalRun } from './regression-detector';
import { compareRuns } from './regression-detector';

export interface GateThresholds {
  minPassRate: number; // 0-100
  maxRegressionPp: number; // max acceptable pass-rate drop in percentage points
  maxNewFailures: number;
  maxLatencyP95Ms: number; // 0 disables
  maxCostPerCaseUsd: number; // 0 disables
}

export const DEFAULT_THRESHOLDS: GateThresholds = {
  minPassRate: 80,
  maxRegressionPp: 2,
  maxNewFailures: 2,
  maxLatencyP95Ms: 0,
  maxCostPerCaseUsd: 0,
};

export interface GateDecision {
  decision: 'pass' | 'fail' | 'warn';
  reasons: string[];
  passingChecks: string[];
  recommendedAction: string;
}

export function evaluateGate(
  candidate: EvalRun,
  baseline: EvalRun | null,
  thresholds: Partial<GateThresholds> = {}
): GateDecision {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const reasons: string[] = [];
  const passingChecks: string[] = [];

  // Absolute quality threshold
  const candidatePassRate = (candidate.cases.filter((c) => c.passed).length / candidate.cases.length) * 100;
  if (candidatePassRate < t.minPassRate) {
    reasons.push(`Candidate pass rate ${candidatePassRate.toFixed(2)}% below minimum ${t.minPassRate}%.`);
  } else {
    passingChecks.push(`Candidate pass rate ${candidatePassRate.toFixed(2)}% meets minimum.`);
  }

  // Latency cap
  if (t.maxLatencyP95Ms > 0) {
    const sorted = [...candidate.cases].map((c) => c.latencyMs).sort((a, b) => a - b);
    const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const p95 = sorted[p95Idx] ?? 0;
    if (p95 > t.maxLatencyP95Ms) {
      reasons.push(`Candidate p95 latency ${p95}ms exceeds cap ${t.maxLatencyP95Ms}ms.`);
    } else {
      passingChecks.push(`Latency p95 ${p95}ms within cap.`);
    }
  }

  // Cost cap
  if (t.maxCostPerCaseUsd > 0) {
    const avgCost = candidate.cases.reduce((s, c) => s + c.costUsd, 0) / candidate.cases.length;
    if (avgCost > t.maxCostPerCaseUsd) {
      reasons.push(`Candidate avg cost $${avgCost.toFixed(5)} exceeds cap $${t.maxCostPerCaseUsd.toFixed(5)}.`);
    } else {
      passingChecks.push(`Cost per case $${avgCost.toFixed(5)} within cap.`);
    }
  }

  // Regression checks (only if baseline provided)
  if (baseline) {
    const reg = compareRuns(baseline, candidate);
    if (reg.passRateDelta < -t.maxRegressionPp) {
      reasons.push(`Pass-rate regression ${reg.passRateDelta.toFixed(2)}pp exceeds tolerance ${t.maxRegressionPp}pp.`);
    } else {
      passingChecks.push(`Pass-rate delta ${reg.passRateDelta.toFixed(2)}pp within tolerance.`);
    }
    if (reg.newFailures.length > t.maxNewFailures) {
      reasons.push(`${reg.newFailures.length} new failures exceeds tolerance ${t.maxNewFailures}.`);
    } else if (reg.newFailures.length > 0) {
      passingChecks.push(`${reg.newFailures.length} new failure(s) within tolerance.`);
    } else {
      passingChecks.push('No new failures vs baseline.');
    }
  }

  // Decision — any threshold breach fails the gate. Reserved 'warn' for
  // future non-blocking signals (currently unused; keeps the type extensible).
  let decision: 'pass' | 'fail' | 'warn';
  let recommendedAction: string;
  if (reasons.length === 0) {
    decision = 'pass';
    recommendedAction = 'Promote candidate; eval gate passed.';
  } else {
    decision = 'fail';
    recommendedAction = reasons.some((r) => r.includes('regression') || r.includes('below minimum') || r.includes('new failures'))
      ? 'Block promotion; investigate regressions before retrying.'
      : 'Block promotion; threshold breach must be remediated before retry.';
  }

  return { decision, reasons, passingChecks, recommendedAction };
}
