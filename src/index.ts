import './config/demo-only';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { env } from './config/env';
import { scoreRouter, evalRouter, datasetsRouter, runsRouter } from './routes/index';

export const app = express();
const startedAt = Date.now();

app.use(helmet());
app.use(morgan('tiny'));
app.use(express.json({ limit: '8mb' }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'agent-eval-arena',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    nodeEnv: env.nodeEnv,
  });
});

app.use('/api/score', scoreRouter);
app.use('/api/eval', evalRouter);
app.use('/api/datasets', datasetsRouter);
app.use('/api/runs', runsRouter);
if (env.nodeEnv !== 'production') app.use('/demo', express.static(path.join(__dirname, '..', 'dashboard-preview')));

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (require.main === module) {
  if (env.nodeEnv === 'production') {
    console.error('[agent-eval-arena] production start disabled: this fixture API has no authentication or CI integration.');
    process.exitCode = 1;
  } else {
    app.listen(env.port, '127.0.0.1', () => {
      console.log(`agent-eval-arena demo listening on 127.0.0.1:${env.port}`);
    });
  }
}
