import { z } from 'zod';

// Source of truth: docs/en/DATABASE_DESIGN.md §5. Names and values must stay identical
// to that table and to schema.prisma. Each enum is a const object (usable as a value),
// a type inferred from it, and a Zod schema built from the same object.

export const Role = {
  ADMIN: 'ADMIN',
  PROCESS_ENGINEER: 'PROCESS_ENGINEER',
  PRODUCTION_PLANNER: 'PRODUCTION_PLANNER',
  WAREHOUSE_KEEPER: 'WAREHOUSE_KEEPER',
  STATION_OPERATOR: 'STATION_OPERATOR',
  QC_INSPECTOR: 'QC_INSPECTOR',
  MANAGER: 'MANAGER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const roleSchema = z.enum(Role);

export const StationType = {
  CUTTING: 'CUTTING',
  SEWING: 'SEWING',
  EMBROIDERY: 'EMBROIDERY',
  DYEING: 'DYEING',
  WASH: 'WASH',
  FINISHING: 'FINISHING',
  QC: 'QC',
  PACKING: 'PACKING',
} as const;
export type StationType = (typeof StationType)[keyof typeof StationType];
export const stationTypeSchema = z.enum(StationType);

export const StretchType = {
  RIGID: 'RIGID',
  STRETCH: 'STRETCH',
} as const;
export type StretchType = (typeof StretchType)[keyof typeof StretchType];
export const stretchTypeSchema = z.enum(StretchType);

export const QcProfileType = {
  FULL_PROCESS: 'FULL_PROCESS',
  SKIP_CLEAN_WASH: 'SKIP_CLEAN_WASH',
} as const;
export type QcProfileType = (typeof QcProfileType)[keyof typeof QcProfileType];
export const qcProfileTypeSchema = z.enum(QcProfileType);

export const VersionStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  RETIRED: 'RETIRED',
} as const;
export type VersionStatus = (typeof VersionStatus)[keyof typeof VersionStatus];
export const versionStatusSchema = z.enum(VersionStatus);

export const StepType = {
  SELECTION: 'SELECTION',
  MATERIAL: 'MATERIAL',
  PRODUCTION: 'PRODUCTION',
  QC: 'QC',
  APPROVAL: 'APPROVAL',
} as const;
export type StepType = (typeof StepType)[keyof typeof StepType];
export const stepTypeSchema = z.enum(StepType);

export const TransitionKind = {
  NORMAL: 'NORMAL',
  REWORK: 'REWORK',
} as const;
export type TransitionKind = (typeof TransitionKind)[keyof typeof TransitionKind];
export const transitionKindSchema = z.enum(TransitionKind);

export const OrderStatus = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  IN_PRODUCTION: 'IN_PRODUCTION',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
export const orderStatusSchema = z.enum(OrderStatus);

export const InstanceStatus = {
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type InstanceStatus = (typeof InstanceStatus)[keyof typeof InstanceStatus];
export const instanceStatusSchema = z.enum(InstanceStatus);

export const StepStatus = {
  PENDING: 'PENDING',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_QC: 'WAITING_QC',
  REWORK: 'REWORK',
  DONE: 'DONE',
  SKIPPED: 'SKIPPED',
} as const;
export type StepStatus = (typeof StepStatus)[keyof typeof StepStatus];
export const stepStatusSchema = z.enum(StepStatus);

export const DyeMode = {
  TOTAL: 'TOTAL',
  PARTIAL: 'PARTIAL',
} as const;
export type DyeMode = (typeof DyeMode)[keyof typeof DyeMode];
export const dyeModeSchema = z.enum(DyeMode);

export const DyeSource = {
  INTERNAL: 'INTERNAL',
  OUTSOURCED: 'OUTSOURCED',
} as const;
export type DyeSource = (typeof DyeSource)[keyof typeof DyeSource];
export const dyeSourceSchema = z.enum(DyeSource);

export const MaterialType = {
  FABRIC: 'FABRIC',
  THREAD: 'THREAD',
  BUTTON: 'BUTTON',
  RIVET: 'RIVET',
  ZIPPER: 'ZIPPER',
  LABEL: 'LABEL',
  PACKAGING: 'PACKAGING',
} as const;
export type MaterialType = (typeof MaterialType)[keyof typeof MaterialType];
export const materialTypeSchema = z.enum(MaterialType);

export const RequestStatus = {
  OPEN: 'OPEN',
  ORDERED: 'ORDERED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];
export const requestStatusSchema = z.enum(RequestStatus);

export const AckType = {
  SKIP_CLEAN_WASH: 'SKIP_CLEAN_WASH',
} as const;
export type AckType = (typeof AckType)[keyof typeof AckType];
export const ackTypeSchema = z.enum(AckType);

export const QcResult = {
  PASS: 'PASS',
  REWORK: 'REWORK',
  REJECT: 'REJECT',
} as const;
export type QcResult = (typeof QcResult)[keyof typeof QcResult];
export const qcResultSchema = z.enum(QcResult);

export const ChangeRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ChangeRequestStatus = (typeof ChangeRequestStatus)[keyof typeof ChangeRequestStatus];
export const changeRequestStatusSchema = z.enum(ChangeRequestStatus);
