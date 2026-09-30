import { env } from './env';

if (env.nodeEnv === 'production') {
  throw new Error('[agent-eval-arena] production import disabled: this fixture API is local-demo only.');
}
