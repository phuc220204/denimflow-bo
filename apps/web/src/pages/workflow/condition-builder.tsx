import React, { useState } from 'react';
import { type ConditionAst, type OrderConditionField, conditionAstSchema } from '@denimflow/shared';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

interface ConditionBuilderProps {
  value: ConditionAst | null;
  onChange: (value: ConditionAst | null) => void;
  disabled?: boolean;
}

const COMMON_FIELDS: Array<{
  label: string;
  value: OrderConditionField;
  type: 'boolean' | 'string';
}> = [
  { label: 'Yêu cầu nhuộm (order.dyeRequired)', value: 'order.dyeRequired', type: 'boolean' },
  {
    label: 'Yêu cầu thêu (order.embroideryRequired)',
    value: 'order.embroideryRequired',
    type: 'boolean',
  },
  { label: 'Đơn may đo riêng (order.isCustom)', value: 'order.isCustom', type: 'boolean' },
  {
    label: 'Bỏ qua giặt sạch (order.skipCleanWash)',
    value: 'order.skipCleanWash',
    type: 'boolean',
  },
  { label: 'Mã loại giặt (order.washTypeId)', value: 'order.washTypeId', type: 'string' },
];

export const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [jsonText, setJsonText] = useState(() => (value ? JSON.stringify(value, null, 2) : ''));
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Parse simple condition if value is of format { op: 'eq'|'neq', field: OrderConditionField, value: any }
  const isSimpleCondition =
    value !== null && (value.op === 'eq' || value.op === 'neq') && typeof value.field === 'string';

  const selectedField: OrderConditionField = isSimpleCondition
    ? (value.field as OrderConditionField)
    : 'order.dyeRequired';
  const selectedOp = isSimpleCondition ? value.op : 'eq';
  const selectedVal = isSimpleCondition ? value.value : true;

  const handleSimpleFieldChange = (field: OrderConditionField) => {
    const meta = COMMON_FIELDS.find((f) => f.value === field);
    const initialVal = meta?.type === 'boolean' ? true : '';
    const newAst: ConditionAst = {
      op: selectedOp as 'eq' | 'neq',
      field,
      value: initialVal,
    };
    onChange(newAst);
  };

  const handleSimpleOpChange = (op: 'eq' | 'neq') => {
    const newAst: ConditionAst = {
      op,
      field: selectedField,
      value: selectedVal,
    };
    onChange(newAst);
  };

  const handleSimpleValChange = (rawVal: string) => {
    const meta = COMMON_FIELDS.find((f) => f.value === selectedField);
    let parsedVal: string | boolean | number = rawVal;
    if (meta?.type === 'boolean') {
      parsedVal = rawVal === 'true';
    }
    const newAst: ConditionAst = {
      op: selectedOp as 'eq' | 'neq',
      field: selectedField,
      value: parsedVal,
    };
    onChange(newAst);
  };

  const handleJsonApply = () => {
    if (!jsonText.trim()) {
      onChange(null);
      setJsonError(null);
      return;
    }
    try {
      const parsed = JSON.parse(jsonText);
      const validated = conditionAstSchema.parse(parsed);
      onChange(validated);
      setJsonError(null);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'JSON AST không hợp lệ');
    }
  };

  return (
    <div className="space-y-3 rounded border border-border bg-surface p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-text">Điều kiện rẽ nhánh (Condition AST)</span>
        <div className="flex items-center gap-2">
          {value !== null && !disabled && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setJsonText('');
              }}
              className="text-xs text-danger hover:underline"
            >
              Xoá điều kiện
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsAdvanced(!isAdvanced);
              if (!isAdvanced) {
                setJsonText(value ? JSON.stringify(value, null, 2) : '');
              }
            }}
            className="text-xs text-primary hover:underline"
          >
            {isAdvanced ? 'Chế độ cơ bản' : 'Chế độ JSON AST'}
          </button>
        </div>
      </div>

      {value === null ? (
        <div className="flex items-center justify-between rounded bg-background p-2 text-text-muted">
          <span>Không có điều kiện (luôn áp dụng)</span>
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onChange({
                  op: 'eq',
                  field: 'order.dyeRequired',
                  value: true,
                });
              }}
            >
              + Thêm điều kiện
            </Button>
          )}
        </div>
      ) : isAdvanced ? (
        <div className="space-y-2">
          <textarea
            disabled={disabled}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={5}
            className="w-full rounded border border-border bg-background p-2 font-mono text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder={`{\n  "op": "eq",\n  "field": "order.dyeRequired",\n  "value": true\n}`}
          />
          {jsonError && <p className="text-xs text-danger">{jsonError}</p>}
          {!disabled && (
            <Button type="button" size="sm" onClick={handleJsonApply}>
              Áp dụng JSON
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2 rounded bg-background p-2.5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1">
                Trường dữ liệu
              </label>
              <select
                disabled={disabled}
                value={selectedField}
                onChange={(e) => handleSimpleFieldChange(e.target.value as OrderConditionField)}
                className="w-full h-8 rounded border border-border bg-surface px-2 text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {COMMON_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1">Toán tử</label>
              <select
                disabled={disabled}
                value={selectedOp}
                onChange={(e) => handleSimpleOpChange(e.target.value as 'eq' | 'neq')}
                className="w-full h-8 rounded border border-border bg-surface px-2 text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="eq">Bằng (eq - =)</option>
                <option value="neq">Khác (neq - ≠)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1">
                Giá trị so sánh
              </label>
              {typeof selectedVal === 'boolean' ? (
                <select
                  disabled={disabled}
                  value={String(selectedVal)}
                  onChange={(e) => handleSimpleValChange(e.target.value)}
                  className="w-full h-8 rounded border border-border bg-surface px-2 text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="true">Đúng (true)</option>
                  <option value="false">Sai (false)</option>
                </select>
              ) : (
                <Input
                  disabled={disabled}
                  value={String(selectedVal ?? '')}
                  onChange={(e) => handleSimpleValChange(e.target.value)}
                  placeholder="Nhập giá trị..."
                  className="h-8 text-xs"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
