import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreRubric, rollupRubric } from '../src/scorers/rubric';

const criteria = [
  { name: 'accuracy', weight: 0.5, description: 'Answer is factually correct.' },
  { name: 'helpfulness', weight: 0.3, description: 'Answer addresses user intent.' },
  { name: 'safety', weight: 0.2, description: 'No harmful content.' },
];

test('scoreRubric: all-pass yields 100', () => {
  const r = scoreRubric({
    caseId: 'c1',
    criteria,
    results: [
      { name: 'accuracy', status: 'pass', rationale: 'Correct.' },
      { name: 'helpfulness', status: 'pass', rationale: 'Helpful.' },
      { name: 'safety', status: 'pass', rationale: 'Safe.' },
    ],
  });
  assert.equal(r.weightedScore, 100);
  assert.equal(r.criteriaPassed, 3);
  assert.equal(r.worstFailure, null);
});

test('scoreRubric: partial credit halved', () => {
  const r = scoreRubric({
    caseId: 'c2',
    criteria,
    results: [
      { name: 'accuracy', status: 'partial', rationale: 'Mostly correct.' },
      { name: 'helpfulness', status: 'pass', rationale: 'Helpful.' },
      { name: 'safety', status: 'pass', rationale: 'Safe.' },
    ],
  });
  // accuracy contributes (0.5 * 0.5 * 100) = 25, helpfulness 30, safety 20 = 75
  assert.equal(r.weightedScore, 75);
  assert.equal(r.criteriaPartial, 1);
});

test('scoreRubric: worstFailure tracks highest-weight failed criterion', () => {
  const r = scoreRubric({
    caseId: 'c3',
    criteria,
    results: [
      { name: 'accuracy', status: 'fail', rationale: 'Wrong.' },
      { name: 'helpfulness', status: 'fail', rationale: 'Off-topic.' },
      { name: 'safety', status: 'pass', rationale: 'Safe.' },
    ],
  });
  assert.equal(r.worstFailure, 'accuracy'); // highest weight
});

test('scoreRubric: throws on missing criterion result', () => {
  assert.throws(() => scoreRubric({
    caseId: 'c4',
    criteria,
    results: [{ name: 'accuracy', status: 'pass', rationale: 'OK' }],
  }), /Missing result/);
});

test('scoreRubric: throws on zero-weight criteria', () => {
  assert.throws(() => scoreRubric({
    caseId: 'c5',
    criteria: [{ name: 'x', weight: 0, description: 'x' }],
    results: [{ name: 'x', status: 'pass', rationale: 'OK' }],
  }), /non-zero/);
});

test('rollupRubric: pass rate computed correctly', () => {
  const scores = [
    { caseId: 'c1', weightedScore: 90, criteriaPassed: 3, criteriaPartial: 0, criteriaFailed: 0, perCriterion: [], worstFailure: null },
    { caseId: 'c2', weightedScore: 85, criteriaPassed: 3, criteriaPartial: 0, criteriaFailed: 0, perCriterion: [], worstFailure: null },
    { caseId: 'c3', weightedScore: 60, criteriaPassed: 1, criteriaPartial: 1, criteriaFailed: 1, perCriterion: [], worstFailure: null },
  ];
  const r = rollupRubric(scores);
  assert.equal(r.caseCount, 3);
  // 2/3 cases >= 80 = 66.7%
  assert.ok(r.passRate > 66 && r.passRate < 67);
});
