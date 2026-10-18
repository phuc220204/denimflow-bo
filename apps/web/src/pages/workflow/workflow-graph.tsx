import React, { useMemo } from 'react';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertCircle, CheckCircle, Flame, ShieldAlert, Sparkles } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import type {
  WorkflowStepItem,
  WorkflowTransitionItem,
  WorkflowValidationViolation,
} from '../../lib/api';
import { i18n } from '../../lib/i18n/dictionary';

interface WorkflowGraphProps {
  steps: WorkflowStepItem[];
  transitions: WorkflowTransitionItem[];
  selectedStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
  violations?: WorkflowValidationViolation[];
}

interface StepNodeData {
  step: WorkflowStepItem;
  hasViolation: boolean;
  isSelected: boolean;
}

const StepNode: React.FC<{ data: StepNodeData }> = ({ data }) => {
  const { step, hasViolation, isSelected } = data;

  const roleText = i18n.roles[step.responsibleRole] || step.responsibleRole;
  const stationText = step.stationType ? i18n.stationType[step.stationType] : 'Chưa gán';

  return (
    <div
      className={`w-64 rounded-lg border-2 bg-surface p-3 shadow-sm transition-all ${
        isSelected
          ? 'border-primary ring-2 ring-primary/20'
          : hasViolation
            ? 'border-danger ring-2 ring-danger/20'
            : 'border-border hover:border-text-muted'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !bg-primary border-2 border-white"
      />

      <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
            {step.seq}
          </span>
          <span className="font-mono text-xs font-semibold text-text">{step.code}</span>
        </div>
        <div className="flex items-center gap-1">
          {step.isStart && (
            <Badge tone="success" className="text-[10px] px-1 py-0 flex items-center gap-0.5">
              <Sparkles className="h-2.5 w-2.5" /> Start
            </Badge>
          )}
          {step.isEnd && (
            <Badge tone="neutral" className="text-[10px] px-1 py-0 flex items-center gap-0.5">
              <CheckCircle className="h-2.5 w-2.5" /> End
            </Badge>
          )}
          {hasViolation && (
            <span title="Bước này có vi phạm BR-01" className="text-danger">
              <AlertCircle className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </div>

      <div className="mb-2">
        <h4 className="text-xs font-bold text-text line-clamp-1">{step.name}</h4>
        <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-text-muted">
          <span>
            Trạm: <strong className="text-text">{stationText}</strong>
          </span>
          <span>&bull;</span>
          <span>
            Vai trò: <strong className="text-text">{roleText}</strong>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 pt-1 border-t border-border/50">
        {step.isMandatory ? (
          <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-medium text-text">
            Bắt buộc
          </span>
        ) : (
          <span className="rounded bg-background px-1.5 py-0.5 text-[10px] text-text-muted">
            Tùy chọn
          </span>
        )}
        {step.requiresEvidence && (
          <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
            Cần ảnh minh chứng
          </span>
        )}
        {step.requiresQc && (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 flex items-center gap-0.5">
            <ShieldAlert className="h-2.5 w-2.5" /> QC
          </span>
        )}
        {step.maxRework !== null && step.maxRework !== undefined && (
          <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 flex items-center gap-0.5">
            <Flame className="h-2.5 w-2.5" /> Max rework: {step.maxRework}
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !bg-primary border-2 border-white"
      />
    </div>
  );
};

const nodeTypes = {
  stepNode: StepNode,
};

export const WorkflowGraph: React.FC<WorkflowGraphProps> = ({
  steps,
  transitions,
  selectedStepId,
  onSelectStep,
  violations = [],
}) => {
  const violatedStepIds = useMemo(() => {
    const ids = new Set<string>();
    violations.forEach((v) => {
      v.stepIds?.forEach((id) => ids.add(id));
    });
    return ids;
  }, [violations]);

  // Compute positions automatically using topological layout
  const nodes: Node[] = useMemo(() => {
    // Sort steps by seq
    const sortedSteps = [...steps].sort((a, b) => a.seq - b.seq);
    const COLUMNS = 3;
    const HORIZONTAL_SPACING = 320;
    const VERTICAL_SPACING = 180;

    return sortedSteps.map((step, idx) => {
      const col = idx % COLUMNS;
      const row = Math.floor(idx / COLUMNS);

      return {
        id: step.id,
        type: 'stepNode',
        position: {
          x: col * HORIZONTAL_SPACING + 40,
          y: row * VERTICAL_SPACING + 40,
        },
        data: {
          step,
          hasViolation: violatedStepIds.has(step.id),
          isSelected: selectedStepId === step.id,
        },
      };
    });
  }, [steps, violatedStepIds, selectedStepId]);

  const edges: Edge[] = useMemo(() => {
    return transitions.map((t) => {
      const isRework = t.kind === 'REWORK';
      const hasCondition = Boolean(t.conditionExpr);

      let label = isRework ? 'Làm lại (Rework)' : '';
      if (hasCondition) {
        label = label ? `${label} [Có ĐK]` : 'Có điều kiện';
      }

      return {
        id: t.id,
        source: t.fromStepId,
        target: t.toStepId,
        type: isRework ? 'smoothstep' : 'default',
        animated: isRework,
        label: label || undefined,
        style: {
          stroke: isRework ? '#dc2626' : '#4f46e5',
          strokeWidth: isRework ? 2 : 1.5,
          strokeDasharray: isRework ? '5,5' : undefined,
        },
        labelStyle: {
          fontSize: 10,
          fontWeight: 600,
          fill: isRework ? '#dc2626' : '#4f46e5',
        },
        labelBgStyle: {
          fill: '#ffffff',
          fillOpacity: 0.9,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isRework ? '#dc2626' : '#4f46e5',
          width: 16,
          height: 16,
        },
      };
    });
  }, [transitions]);

  return (
    <div className="h-[600px] w-full rounded border border-border bg-slate-50/50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => {
          onSelectStep?.(node.id);
        }}
        fitView
        minZoom={0.2}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background color="#cbd5e1" gap={16} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => {
            const data = n.data as unknown as StepNodeData | undefined;
            if (data?.hasViolation) return '#ef4444';
            if (data?.step?.isStart) return '#10b981';
            if (data?.step?.isEnd) return '#64748b';
            return '#6366f1';
          }}
          className="border border-border bg-surface"
        />
      </ReactFlow>
    </div>
  );
};
