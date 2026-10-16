// Proves an ES module consumer (like Vite) can import the built package.
import { Role, healthResponseSchema } from '@denimflow/shared';

const health = healthResponseSchema.parse({ status: 'ok', db: 'up' });
console.log(`ESM  import : Role.ADMIN=${Role.ADMIN}, health=${JSON.stringify(health)}`);
