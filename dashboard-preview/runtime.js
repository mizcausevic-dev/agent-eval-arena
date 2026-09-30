(async () => {
  const ui = window.evidenceUi;
  try {
    const [runList, datasetList, baseline, candidate] = await Promise.all([
      ui.fetchJson('/api/runs'), ui.fetchJson('/api/datasets'),
      ui.fetchJson('/api/runs/run_2026_05_05_004'), ui.fetchJson('/api/runs/run_2026_05_07_005'),
    ]);
    const gate = await ui.fetchJson('/api/eval/gate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseline, candidate, thresholds: {
        minPassRate: 75, maxRegressionPp: 2, maxNewFailures: 2, maxCostPerCaseUsd: 0.025,
      } }),
    });
    ui.metric('Fixture datasets', datasetList.datasets.length, 'Seeded golden sets');
    ui.metric('Fixture runs', runList.runs.length, 'No live model execution');
    ui.metric('Candidate cases', candidate.cases.length, candidate.runId);
    ui.metric('Gate verdict', gate.decision.toUpperCase(), 'Actual local /api/eval/gate result');
    ui.table(['Run', 'Dataset', 'Model', 'Pass rate'], runList.runs.map((run) => [
      run.runId, run.datasetId, `${run.modelId}@${run.modelVersion}`, `${run.passRate.toFixed(1)}%`,
    ]));
    gate.reasons.forEach((reason) => ui.item('Blocking reason', reason));
    gate.passingChecks.forEach((check) => ui.item('Threshold met', check));
    ui.state('LOCAL FIXTURE API · 5 endpoints responded');
  } catch (error) {
    ui.state(`API unavailable: ${error.message}`, true);
  }
})();
