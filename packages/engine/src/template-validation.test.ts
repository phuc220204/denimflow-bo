import { describe, expect, it } from 'vitest';
import {
  validateTemplate,
  type WorkflowStepDefinition,
  type WorkflowStepTransition,
  type WorkflowTemplateDefinition,
} from './template-validation.js';

describe('Workflow Template Validation (BR-01, FR-05)', () => {
  // Jean Standard 14 steps fixture according to BUSINESS_RECONCILIATION.md §3
  const jeanStandardSteps: WorkflowStepDefinition[] = [
    { id: 's1', code: 'ORDER_CONFIRM', name: 'Order intake and confirmation', isStart: true },
    { id: 's2', code: 'FABRIC_COLOR_SELECT', name: 'Fabric and color selection' },
    { id: 's3', code: 'BOM_ALLOCATE', name: 'BOM and material allocation' },
    { id: 's4', code: 'FABRIC_INSPECT', name: 'Fabric inspection' },
    { id: 's5', code: 'PP_SAMPLE', name: 'Pre-production sample approval' },
    { id: 's6', code: 'CUTTING', name: 'Spreading and cutting' },
    { id: 's7', code: 'EMBROIDERY', name: 'Embroidery / print' },
    { id: 's8', code: 'SEWING', name: 'Sewing', maxRework: 2 },
    { id: 's9', code: 'DYEING', name: 'Dyeing' },
    { id: 's10', code: 'EFFECT_WASH', name: 'Effect wash' },
    { id: 's11', code: 'CLEAN_WASH', name: 'Clean wash', maxRework: 2 },
    { id: 's12', code: 'FINISHING', name: 'Finishing', maxRework: 2 },
    { id: 's13', code: 'FINAL_QC', name: 'Final QC' },
    { id: 's14', code: 'PACK_HANDOVER', name: 'Packing and handover', isEnd: true },
  ];

  const jeanStandardTransitions: WorkflowStepTransition[] = [
    // Sequential normal flow s1 -> s2 -> ... -> s14
    { fromStepId: 's1', toStepId: 's2', kind: 'NORMAL' },
    { fromStepId: 's2', toStepId: 's3', kind: 'NORMAL' },
    { fromStepId: 's3', toStepId: 's4', kind: 'NORMAL' },
    { fromStepId: 's4', toStepId: 's5', kind: 'NORMAL' },
    { fromStepId: 's5', toStepId: 's6', kind: 'NORMAL' },
    { fromStepId: 's6', toStepId: 's7', kind: 'NORMAL' },
    { fromStepId: 's7', toStepId: 's8', kind: 'NORMAL' },
    { fromStepId: 's8', toStepId: 's9', kind: 'NORMAL' },
    { fromStepId: 's9', toStepId: 's10', kind: 'NORMAL' },
    { fromStepId: 's10', toStepId: 's11', kind: 'NORMAL' },
    { fromStepId: 's11', toStepId: 's12', kind: 'NORMAL' },
    { fromStepId: 's12', toStepId: 's13', kind: 'NORMAL' },
    { fromStepId: 's13', toStepId: 's14', kind: 'NORMAL' },

    // Bounded rework loops from FINAL_QC back to SEWING, CLEAN_WASH, FINISHING
    { fromStepId: 's13', toStepId: 's8', kind: 'REWORK' },
    { fromStepId: 's13', toStepId: 's11', kind: 'REWORK' },
    { fromStepId: 's13', toStepId: 's12', kind: 'REWORK' },
  ];

  it('validates a complete, valid Jean Standard workflow template', () => {
    const template: WorkflowTemplateDefinition = {
      name: 'Jean Standard',
      steps: jeanStandardSteps,
      transitions: jeanStandardTransitions,
    };

    const result = validateTemplate(template);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  describe('BR-01 violation checks', () => {
    it('detects NO_START_STEP when template has no start step', () => {
      const template: WorkflowTemplateDefinition = {
        steps: [
          { id: 's1', code: 'CUTTING', isStart: false },
          { id: 's2', code: 'SEWING', isEnd: true },
        ],
        transitions: [{ fromStepId: 's1', toStepId: 's2', kind: 'NORMAL' }],
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.code === 'NO_START_STEP')).toBe(true);
    });

    it('detects MULTIPLE_START_STEPS when more than one step is marked as start', () => {
      const template: WorkflowTemplateDefinition = {
        steps: [
          { id: 's1', code: 'START_A', isStart: true },
          { id: 's2', code: 'START_B', isStart: true },
          { id: 's3', code: 'FINISH', isEnd: true },
        ],
        transitions: [
          { fromStepId: 's1', toStepId: 's3', kind: 'NORMAL' },
          { fromStepId: 's2', toStepId: 's3', kind: 'NORMAL' },
        ],
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.violations.filter((v) => v.code === 'MULTIPLE_START_STEPS')).toHaveLength(2);
    });

    it('detects NO_END_STEP when template has no end step', () => {
      const template: WorkflowTemplateDefinition = {
        steps: [
          { id: 's1', code: 'ORDER_CONFIRM', isStart: true },
          { id: 's2', code: 'CUTTING', isEnd: false },
        ],
        transitions: [{ fromStepId: 's1', toStepId: 's2', kind: 'NORMAL' }],
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.code === 'NO_END_STEP')).toBe(true);
    });

    it('detects ORPHAN_STEP when a step cannot be reached from the start step', () => {
      const template: WorkflowTemplateDefinition = {
        steps: [
          { id: 's1', code: 'START', isStart: true },
          { id: 's2', code: 'END', isEnd: true },
          { id: 's_isolated', code: 'ORPHAN', name: 'Unreachable step' },
        ],
        transitions: [
          { fromStepId: 's1', toStepId: 's2', kind: 'NORMAL' },
          { fromStepId: 's_isolated', toStepId: 's2', kind: 'NORMAL' },
        ],
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(false);
      const orphanViolation = result.violations.find((v) => v.code === 'ORPHAN_STEP');
      expect(orphanViolation).toBeDefined();
      expect(orphanViolation?.stepCode).toBe('ORPHAN');
    });

    it('detects CANNOT_REACH_END when a step cannot reach any end step', () => {
      const template: WorkflowTemplateDefinition = {
        steps: [
          { id: 's1', code: 'START', isStart: true },
          { id: 's2', code: 'END', isEnd: true },
          { id: 's_deadend', code: 'DEAD_END' },
        ],
        transitions: [
          { fromStepId: 's1', toStepId: 's2', kind: 'NORMAL' },
          { fromStepId: 's1', toStepId: 's_deadend', kind: 'NORMAL' },
          // s_deadend has no path to s2
        ],
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(false);
      const deadEndViolation = result.violations.find((v) => v.code === 'CANNOT_REACH_END');
      expect(deadEndViolation).toBeDefined();
      expect(deadEndViolation?.stepCode).toBe('DEAD_END');
    });

    it('detects MISSING_MAX_REWORK when a REWORK transition targets a step without maxRework', () => {
      const template: WorkflowTemplateDefinition = {
        steps: [
          { id: 's1', code: 'START', isStart: true },
          { id: 's2', code: 'SEWING' }, // no maxRework defined
          { id: 's3', code: 'FINAL_QC', isEnd: true },
        ],
        transitions: [
          { fromStepId: 's1', toStepId: 's2', kind: 'NORMAL' },
          { fromStepId: 's2', toStepId: 's3', kind: 'NORMAL' },
          { fromStepId: 's3', toStepId: 's2', kind: 'REWORK' },
        ],
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(false);
      const reworkViolation = result.violations.find((v) => v.code === 'MISSING_MAX_REWORK');
      expect(reworkViolation).toBeDefined();
      expect(reworkViolation?.stepCode).toBe('SEWING');
    });

    it('detects UNBOUNDED_CYCLE when a cycle exists in normal transitions', () => {
      const template: WorkflowTemplateDefinition = {
        steps: [
          { id: 's1', code: 'START', isStart: true },
          { id: 's2', code: 'A' },
          { id: 's3', code: 'B' },
          { id: 's4', code: 'END', isEnd: true },
        ],
        transitions: [
          { fromStepId: 's1', toStepId: 's2', kind: 'NORMAL' },
          { fromStepId: 's2', toStepId: 's3', kind: 'NORMAL' },
          { fromStepId: 's3', toStepId: 's2', kind: 'NORMAL' }, // Unbounded normal loop A <-> B
          { fromStepId: 's3', toStepId: 's4', kind: 'NORMAL' },
        ],
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(false);
      const cycleViolation = result.violations.find((v) => v.code === 'UNBOUNDED_CYCLE');
      expect(cycleViolation).toBeDefined();
    });

    it('detects INVALID_TRANSITION_STEP when transition references a nonexistent step id', () => {
      const template: WorkflowTemplateDefinition = {
        steps: [
          { id: 's1', code: 'START', isStart: true },
          { id: 's2', code: 'END', isEnd: true },
        ],
        transitions: [
          { fromStepId: 's1', toStepId: 's_ghost', kind: 'NORMAL' },
          { fromStepId: 's1', toStepId: 's2', kind: 'NORMAL' },
        ],
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(false);
      const invalidStepViolation = result.violations.find(
        (v) => v.code === 'INVALID_TRANSITION_STEP',
      );
      expect(invalidStepViolation).toBeDefined();
    });
  });
});
