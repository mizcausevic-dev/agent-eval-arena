import { z } from 'zod';

export const TextMatchSchema = z.object({
  prediction: z.string().max(2048),
  expected: z.string().max(2048),
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
  caseId: z.string().min(1).max(128),
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  latencyMs: z.number().min(0),
  costUsd: z.number().min(0),
});

export const EvalRunSchema = z.object({
  runId: z.string().min(1).max(128),
  modelId: z.string().min(1).max(128),
  modelVersion: z.string().min(1).max(128),
  datasetId: z.string().min(1).max(128),
  timestamp: z.string().datetime({ offset: true }),
  cases: z.array(CaseResultSchema).min(1).max(5000),
});

export const RegressionCheckSchema = z.object({
  baseline: EvalRunSchema,
  candidate: EvalRunSchema,
});

export const RubricCriterionSchema = z.object({
  name: z.string().min(1).max(128),
  weight: z.number().min(0).max(1),
  description: z.string().max(1000),
});

export const RubricResultSchema = z.object({
  name: z.string().min(1).max(128),
  status: z.enum(['pass', 'partial', 'fail']),
  rationale: z.string().max(2000),
});

export const RubricScoreSchema = z.object({
  caseId: z.string().min(1).max(128),
  criteria: z.array(RubricCriterionSchema).min(1).max(100),
  results: z.array(RubricResultSchema).min(1).max(100),
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
