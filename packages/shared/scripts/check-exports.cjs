// Proves a CommonJS consumer (like NestJS) can require the built package.
const { Role, healthResponseSchema } = require('@denimflow/shared');

const health = healthResponseSchema.parse({ status: 'ok', db: 'up' });
console.log(`CJS  require: Role.ADMIN=${Role.ADMIN}, health=${JSON.stringify(health)}`);
