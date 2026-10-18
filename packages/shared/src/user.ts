import { z } from 'zod';
import { roleSchema } from './enums.js';

export const createUserSchema = z.object({
  email: z.string().trim().email('Địa chỉ email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu phải từ 6 ký tự trở lên'),
  fullName: z.string().trim().min(1, 'Họ và tên không được để trống'),
  role: roleSchema,
  stationId: z.string().uuid('ID trạm làm việc không hợp lệ').optional().nullable(),
});
export type CreateUserDto = z.infer<typeof createUserSchema>;

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});
export type UpdateUserStatusDto = z.infer<typeof updateUserStatusSchema>;

export const updateUserAssignmentSchema = z.object({
  role: roleSchema.optional(),
  stationId: z.string().uuid('ID trạm làm việc không hợp lệ').optional().nullable(),
});
export type UpdateUserAssignmentDto = z.infer<typeof updateUserAssignmentSchema>;

export const userProfileSchema = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string(),
  role: roleSchema,
  stationId: z.string().nullable().optional(),
  stationName: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string().or(z.date()),
});
export type UserProfileDto = z.infer<typeof userProfileSchema>;
