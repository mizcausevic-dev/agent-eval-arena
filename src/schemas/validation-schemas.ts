import { z } from 'zod';

export const TextMatchSchema = z.object({
  prediction: z.string(),
  expected: z.string(),
  threshold: z.number().min(0).max(1).optional(),
  options: z
    .object({
      caseSensitive: z.boolean().optional(),
      normalizeWhitespace: z.boolean().optional(),
      trim: z.boolean().optional(),
    })
    .optional(),
});

const CaseResultSchema = z.object({
  caseId: z.string().min(1),
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  latencyMs: z.number().min(0),
  costUsd: z.number().min(0),
});

export const EvalRunSchema = z.object({
  runId: z.string().min(1),
  modelId: z.string().min(1),
  modelVersion: z.string().min(1),
  datasetId: z.string().min(1),
  timestamp: z.string().min(1),
  cases: z.array(CaseResultSchema).min(1),
});

export const RegressionCheckSchema = z.object({
  baseline: EvalRunSchema,
  candidate: EvalRunSchema,
});

export const RubricCriterionSchema = z.object({
  name: z.string().min(1),
  weight: z.number().min(0).max(1),
  description: z.string(),
});

export const RubricResultSchema = z.object({
  name: z.string().min(1),
  status: z.enum(['pass', 'partial', 'fail']),
  rationale: z.string(),
});

export const RubricScoreSchema = z.object({
  caseId: z.string().min(1),
  criteria: z.array(RubricCriterionSchema).min(1),
  results: z.array(RubricResultSchema).min(1),
});

export const GateThresholdsSchema = z.object({
  minPassRate: z.number().min(0).max(100).optional(),
  maxRegressionPp: z.number().min(0).optional(),
  maxNewFailures: z.number().min(0).optional(),
  maxLatencyP95Ms: z.number().min(0).optional(),
  maxCostPerCaseUsd: z.number().min(0).optional(),
});

export const GateEvalSchema = z.object({
  candidate: EvalRunSchema,
  baseline: EvalRunSchema.optional(),
  thresholds: GateThresholdsSchema.optional(),
});
