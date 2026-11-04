import { spawnSync } from 'node:child_process';
// Production secrets stay in GitHub; the Environment approval remains the deployment gate.
const result = spawnSync(
  'gh',
  [
    'workflow',
    'run',
    'migrate.yml',
    '--repo',
    'phuc220204/denimflow-bo',
    '--ref',
    'main',
    '-f',
    'seed=true',
  ],
  { stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;
