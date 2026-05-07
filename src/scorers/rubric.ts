// Rubric-based scoring for open-ended outputs. Each rubric criterion is a
// named check with a weight and a per-case pass/fail or graded result.
// Scaling note: in production, individual criterion checks would call out
// to LLM-as-judge or human reviewers. This module models the aggregation +
// reporting layer that consumes those signals.

export type CriterionStatus = 'pass' | 'partial' | 'fail';

export interface RubricCriterion {
  name: string;
  weight: number; // 0-1
  description: string;
}

export interface CriterionResult {
  name: string;
  status: CriterionStatus;
  rationale: string;
}

export interface RubricScoreInput {
  caseId: string;
  criteria: RubricCriterion[];
  results: CriterionResult[];
}

export interface RubricScoreOutput {
  caseId: string;
  weightedScore: number; // 0-100
  criteriaPassed: number;
  criteriaPartial: number;
  criteriaFailed: number;
  perCriterion: Array<CriterionResult & { weight: number; contribution: number }>;
  worstFailure: string | null;
}

const STATUS_VALUE: Record<CriterionStatus, number> = { pass: 1, partial: 0.5, fail: 0 };

export function scoreRubric(input: RubricScoreInput): RubricScoreOutput {
  const totalWeight = input.criteria.reduce((s, c) => s + c.weight, 0);
  if (totalWeight === 0) {
    throw new Error('Rubric criteria must have non-zero total weight.');
  }

  const resultByName = new Map(input.results.map((r) => [r.name, r]));
  const perCriterion: Array<CriterionResult & { weight: number; contribution: number }> = [];
  let weightedSum = 0;
  let passed = 0;
  let partial = 0;
  let failed = 0;
  let worstFailure: string | null = null;
  let worstWeight = 0;

  for (const criterion of input.criteria) {
    const result = resultByName.get(criterion.name);
    if (!result) {
      throw new Error(`Missing result for criterion "${criterion.name}".`);
    }
    const value = STATUS_VALUE[result.status];
    const contribution = (criterion.weight / totalWeight) * value * 100;
    weightedSum += contribution;
    perCriterion.push({ ...result, weight: criterion.weight, contribution: Math.round(contribution * 100) / 100 });

    if (result.status === 'pass') passed++;
    else if (result.status === 'partial') partial++;
    else {
      failed++;
      if (criterion.weight > worstWeight) {
        worstWeight = criterion.weight;
        worstFailure = criterion.name;
      }
    }
  }

  return {
    caseId: input.caseId,
    weightedScore: Math.round(weightedSum * 100) / 100,
    criteriaPassed: passed,
    criteriaPartial: partial,
    criteriaFailed: failed,
    perCriterion,
    worstFailure,
  };
}

// Aggregate multiple cases scored against the same rubric
export interface RubricRollup {
  caseCount: number;
  averageScore: number;
  passRate: number; // % cases where weightedScore >= 80
  perCriterionPassRate: Record<string, number>;
}

export function rollupRubric(scores: RubricScoreOutput[]): RubricRollup {
  if (scores.length === 0) {
    return { caseCount: 0, averageScore: 0, passRate: 0, perCriterionPassRate: {} };
  }
  const averageScore = Math.round((scores.reduce((s, c) => s + c.weightedScore, 0) / scores.length) * 100) / 100;
  const passingCases = scores.filter((c) => c.weightedScore >= 80).length;
  const passRate = Math.round((passingCases / scores.length) * 1000) / 10;

  const criterionPasses = new Map<string, number>();
  const criterionTotal = new Map<string, number>();
  for (const score of scores) {
    for (const c of score.perCriterion) {
      criterionTotal.set(c.name, (criterionTotal.get(c.name) || 0) + 1);
      if (c.status === 'pass') criterionPasses.set(c.name, (criterionPasses.get(c.name) || 0) + 1);
    }
  }
  const perCriterionPassRate: Record<string, number> = {};
  for (const [name, total] of criterionTotal.entries()) {
    const passes = criterionPasses.get(name) || 0;
    perCriterionPassRate[name] = Math.round((passes / total) * 1000) / 10;
  }

  return { caseCount: scores.length, averageScore, passRate, perCriterionPassRate };
}
