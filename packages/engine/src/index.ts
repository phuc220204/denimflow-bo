// Workflow engine: pure TypeScript, no framework, database or I/O imports
// (see .agents/rules/01-architecture-boundaries.md).
export const ENGINE_NAME = '@denimflow/engine';
export * from './conditions.js';
export * from './template-validation.js';
export * from './bom.js';
export * from './gates.js';
export * from './instance-builder.js';
export * from './quantities.js';
export * from './quality.js';
