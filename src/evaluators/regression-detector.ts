// Regression detection across eval runs. Compares two runs (typically
// "baseline" vs "candidate") and flags meaningful deltas — accuracy drops,
// new failures on previously-passing cases, latency regressions, cost regressions.

export interface CaseResult {
  caseId: string;
  passed: boolean;
  score: number;
  latencyMs: number;
  costUsd: number;
}

export interface EvalRun {
  runId: string;
  modelId: string;
  modelVersion: string;
  datasetId: string;
  timestamp: string;
  cases: CaseResult[];
}

export type RegressionVerdict = 'improved' | 'no-change' | 'regression' | 'severe-regression';

export interface RegressionResult {
  baselineRunId: string;
  candidateRunId: string;
  baselineModel: string;
  candidateModel: string;
  totalCases: number;
  passRateDelta: number; // percentage points; negative = regression
  averageScoreDelta: number;
  latencyP95Delta: number; // ms
  costPerCaseDelta: number; // USD
  newFailures: string[]; // case IDs that passed in baseline, fail in candidate
  newPasses: string[]; // case IDs that failed in baseline, pass in candidate
  verdict: RegressionVerdict;
  rationale: string;
  recommendedAction: string;
}

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx];
}

export function compareRuns(baseline: EvalRun, candidate: EvalRun): RegressionResult {
  if (baseline.datasetId !== candidate.datasetId) {
    throw new Error('Cannot compare runs from different datasets.');
  }

  const baselineMap = new Map(baseline.cases.map((c) => [c.caseId, c]));
  const candidateMap = new Map(candidate.cases.map((c) => [c.caseId, c]));
  const sharedCaseIds = [...baselineMap.keys()].filter((id) => candidateMap.has(id));

  if (sharedCaseIds.length === 0) {
    throw new Error('No overlapping cases between runs.');
  }

  const baselinePassRate = (baseline.cases.filter((c) => c.passed).length / baseline.cases.length) * 100;
  const candidatePassRate = (candidate.cases.filter((c) => c.passed).length / candidate.cases.length) * 100;
  const passRateDelta = Math.round((candidatePassRate - baselinePassRate) * 100) / 100;

  const baselineAvgScore = baseline.cases.reduce((s, c) => s + c.score, 0) / baseline.cases.length;
  const candidateAvgScore = candidate.cases.reduce((s, c) => s + c.score, 0) / candidate.cases.length;
  const averageScoreDelta = Math.round((candidateAvgScore - baselineAvgScore) * 1000) / 1000;

  const latencyP95Delta = Math.round(
    p95(candidate.cases.map((c) => c.latencyMs)) - p95(baseline.cases.map((c) => c.latencyMs))
  );

  const baselineCostAvg = baseline.cases.reduce((s, c) => s + c.costUsd, 0) / baseline.cases.length;
  const candidateCostAvg = candidate.cases.reduce((s, c) => s + c.costUsd, 0) / candidate.cases.length;
  const costPerCaseDelta = Math.round((candidateCostAvg - baselineCostAvg) * 100000) / 100000;

  const newFailures: string[] = [];
  const newPasses: string[] = [];
  for (const id of sharedCaseIds) {
    const b = baselineMap.get(id)!;
    const c = candidateMap.get(id)!;
    if (b.passed && !c.passed) newFailures.push(id);
    if (!b.passed && c.passed) newPasses.push(id);
  }

  let verdict: RegressionVerdict;
  let rationale: string;
  let recommendedAction: string;

  if (passRateDelta <= -5 || newFailures.length >= Math.max(3, baseline.cases.length * 0.05)) {
    verdict = 'severe-regression';
    rationale = `Pass rate dropped ${Math.abs(passRateDelta).toFixed(2)}pp; ${newFailures.length} previously-passing cases now fail.`;
    recommendedAction = 'Block promotion of candidate; investigate failed cases before deploying.';
  } else if (passRateDelta < 0 || newFailures.length > 0) {
    verdict = 'regression';
    rationale = `Quality regressed: ${passRateDelta.toFixed(2)}pp pass rate change, ${newFailures.length} new failure(s).`;
    recommendedAction = 'Open eval review; verify failed cases are acceptable before promoting candidate.';
  } else if (passRateDelta > 0 || newPasses.length > 0) {
    verdict = 'improved';
    rationale = `Quality improved: +${passRateDelta.toFixed(2)}pp pass rate, ${newPasses.length} newly-passing case(s).`;
    recommendedAction = 'Candidate is promotable; verify cost/latency stayed within tolerance.';
  } else {
    verdict = 'no-change';
    rationale = 'No measurable change in quality or case outcomes.';
    recommendedAction = 'Promotion decision should be based on cost/latency tradeoffs.';
  }

  return {
    baselineRunId: baseline.runId,
    candidateRunId: candidate.runId,
    baselineModel: `${baseline.modelId}@${baseline.modelVersion}`,
    candidateModel: `${candidate.modelId}@${candidate.modelVersion}`,
    totalCases: sharedCaseIds.length,
    passRateDelta,
    averageScoreDelta,
    latencyP95Delta,
    costPerCaseDelta,
    newFailures,
    newPasses,
    verdict,
    rationale,
    recommendedAction,
  };
}
