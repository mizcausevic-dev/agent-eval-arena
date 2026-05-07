import { Router } from 'express';
import { TextMatchSchema, RegressionCheckSchema, RubricScoreSchema, GateEvalSchema } from '../schemas/validation-schemas';
import { exactMatch, fuzzyMatch, tokenOverlap } from '../scorers/text-match';
import { scoreRubric } from '../scorers/rubric';
import { compareRuns } from '../evaluators/regression-detector';
import { evaluateGate } from '../evaluators/ci-gate';
import { buildLeaderboard } from '../evaluators/leaderboard';
import { datasets, runs, findDataset, findRun, runsForDataset } from '../data/datasets';

export const scoreRouter = Router();

scoreRouter.post('/exact-match', (req, res) => {
  const parsed = TextMatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues }); return; }
  res.json(exactMatch(parsed.data.prediction, parsed.data.expected, parsed.data.options));
});

scoreRouter.post('/fuzzy-match', (req, res) => {
  const parsed = TextMatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues }); return; }
  res.json(fuzzyMatch(parsed.data.prediction, parsed.data.expected, parsed.data.threshold ?? 0.85, parsed.data.options));
});

scoreRouter.post('/token-overlap', (req, res) => {
  const parsed = TextMatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues }); return; }
  res.json(tokenOverlap(parsed.data.prediction, parsed.data.expected, parsed.data.threshold ?? 0.6, parsed.data.options));
});

scoreRouter.post('/rubric', (req, res) => {
  const parsed = RubricScoreSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues }); return; }
  try {
    res.json(scoreRubric(parsed.data));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

export const evalRouter = Router();

evalRouter.post('/compare', (req, res) => {
  const parsed = RegressionCheckSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues }); return; }
  try {
    res.json(compareRuns(parsed.data.baseline, parsed.data.candidate));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

evalRouter.post('/gate', (req, res) => {
  const parsed = GateEvalSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues }); return; }
  try {
    res.json(evaluateGate(parsed.data.candidate, parsed.data.baseline ?? null, parsed.data.thresholds));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

export const datasetsRouter = Router();

datasetsRouter.get('/', (_req, res) => {
  res.json({ datasets });
});

datasetsRouter.get('/:id', (req, res) => {
  const d = findDataset(req.params.id);
  if (!d) { res.status(404).json({ error: `Dataset ${req.params.id} not found.` }); return; }
  res.json(d);
});

datasetsRouter.get('/:id/runs', (req, res) => {
  const list = runsForDataset(req.params.id);
  res.json({ datasetId: req.params.id, runs: list.map((r) => ({
    runId: r.runId,
    modelId: r.modelId,
    modelVersion: r.modelVersion,
    timestamp: r.timestamp,
    caseCount: r.cases.length,
    passRate: Math.round((r.cases.filter((c) => c.passed).length / r.cases.length) * 1000) / 10,
  })) });
});

datasetsRouter.get('/:id/leaderboard', (req, res) => {
  const list = runsForDataset(req.params.id);
  if (list.length === 0) { res.status(404).json({ error: `No runs for dataset ${req.params.id}.` }); return; }
  try {
    res.json(buildLeaderboard(list));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

export const runsRouter = Router();

runsRouter.get('/', (_req, res) => {
  res.json({ runs: runs.map((r) => ({
    runId: r.runId,
    modelId: r.modelId,
    modelVersion: r.modelVersion,
    datasetId: r.datasetId,
    timestamp: r.timestamp,
    caseCount: r.cases.length,
    passRate: Math.round((r.cases.filter((c) => c.passed).length / r.cases.length) * 1000) / 10,
  })) });
});

runsRouter.get('/:id', (req, res) => {
  const r = findRun(req.params.id);
  if (!r) { res.status(404).json({ error: `Run ${req.params.id} not found.` }); return; }
  res.json(r);
});
