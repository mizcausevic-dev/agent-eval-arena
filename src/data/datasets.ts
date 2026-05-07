import type { EvalRun, CaseResult } from '../evaluators/regression-detector';

export interface EvalDataset {
  datasetId: string;
  name: string;
  domain: string;
  owner: string;
  ownerTeam: string;
  caseCount: number;
  scoringMethod: 'exact-match' | 'fuzzy-match' | 'rubric' | 'hybrid';
  registeredAt: string;
  lastUpdated: string;
  goldenSetVersion: string;
}

export const datasets: EvalDataset[] = [
  {
    datasetId: 'ds_support_qa',
    name: 'Customer Support Q&A Golden Set',
    domain: 'support',
    owner: 'support-eng',
    ownerTeam: 'support-engineering',
    caseCount: 240,
    scoringMethod: 'rubric',
    registeredAt: '2026-02-15T10:00:00Z',
    lastUpdated: '2026-04-28T10:00:00Z',
    goldenSetVersion: 'v3.2',
  },
  {
    datasetId: 'ds_code_completion',
    name: 'Code Completion Suite',
    domain: 'engineering',
    owner: 'devx',
    ownerTeam: 'developer-experience',
    caseCount: 480,
    scoringMethod: 'hybrid',
    registeredAt: '2026-01-20T10:00:00Z',
    lastUpdated: '2026-05-01T10:00:00Z',
    goldenSetVersion: 'v2.1',
  },
  {
    datasetId: 'ds_classification',
    name: 'Intent Classification Set',
    domain: 'support',
    owner: 'support-eng',
    ownerTeam: 'support-engineering',
    caseCount: 1200,
    scoringMethod: 'exact-match',
    registeredAt: '2025-12-10T10:00:00Z',
    lastUpdated: '2026-03-15T10:00:00Z',
    goldenSetVersion: 'v4.0',
  },
  {
    datasetId: 'ds_summarization',
    name: 'Document Summarization Bench',
    domain: 'general',
    owner: 'platform-ai',
    ownerTeam: 'platform-ai',
    caseCount: 180,
    scoringMethod: 'rubric',
    registeredAt: '2026-03-05T10:00:00Z',
    lastUpdated: '2026-04-20T10:00:00Z',
    goldenSetVersion: 'v1.4',
  },
];

// Helper to generate a synthetic CaseResult set deterministically
function generateCases(seed: string, basePass: number, count: number, baseLatency: number, baseCost: number): CaseResult[] {
  // Simple deterministic pseudo-random based on seed
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s >>> 0) / 0xffffffff;
  };

  const cases: CaseResult[] = [];
  for (let i = 0; i < count; i++) {
    const passed = rand() < basePass;
    const score = passed ? 0.85 + rand() * 0.15 : rand() * 0.6;
    cases.push({
      caseId: `case_${i.toString().padStart(4, '0')}`,
      passed,
      score: Math.round(score * 1000) / 1000,
      latencyMs: Math.round(baseLatency + (rand() - 0.5) * baseLatency * 0.4),
      costUsd: Math.round((baseCost * (0.8 + rand() * 0.4)) * 100000) / 100000,
    });
  }
  return cases;
}

export const runs: EvalRun[] = [
  {
    runId: 'run_2026_05_01_001',
    modelId: 'claude-opus',
    modelVersion: '4.6',
    datasetId: 'ds_support_qa',
    timestamp: '2026-05-01T10:00:00Z',
    cases: generateCases('opus-4.6-support', 0.92, 240, 1800, 0.012),
  },
  {
    runId: 'run_2026_05_07_002',
    modelId: 'claude-opus',
    modelVersion: '4.7',
    datasetId: 'ds_support_qa',
    timestamp: '2026-05-07T10:00:00Z',
    cases: generateCases('opus-4.7-support', 0.94, 240, 1620, 0.013),
  },
  {
    runId: 'run_2026_05_07_003',
    modelId: 'claude-sonnet',
    modelVersion: '4.6',
    datasetId: 'ds_support_qa',
    timestamp: '2026-05-07T11:00:00Z',
    cases: generateCases('sonnet-4.6-support', 0.86, 240, 1100, 0.004),
  },
  {
    runId: 'run_2026_05_05_004',
    modelId: 'claude-opus',
    modelVersion: '4.6',
    datasetId: 'ds_code_completion',
    timestamp: '2026-05-05T10:00:00Z',
    cases: generateCases('opus-4.6-code', 0.78, 480, 2400, 0.018),
  },
  {
    runId: 'run_2026_05_07_005',
    modelId: 'claude-opus',
    modelVersion: '4.7',
    datasetId: 'ds_code_completion',
    timestamp: '2026-05-07T12:00:00Z',
    cases: generateCases('opus-4.7-code', 0.82, 480, 2200, 0.019),
  },
  {
    runId: 'run_2026_05_07_006',
    modelId: 'gpt-4.5',
    modelVersion: 'turbo',
    datasetId: 'ds_code_completion',
    timestamp: '2026-05-07T13:00:00Z',
    cases: generateCases('gpt-4.5-code', 0.74, 480, 1900, 0.022),
  },
];

export function findDataset(id: string): EvalDataset | undefined {
  return datasets.find((d) => d.datasetId === id);
}

export function findRun(id: string): EvalRun | undefined {
  return runs.find((r) => r.runId === id);
}

export function runsForDataset(datasetId: string): EvalRun[] {
  return runs.filter((r) => r.datasetId === datasetId);
}
