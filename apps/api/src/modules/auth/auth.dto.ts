import { Role, roleSchema } from '@denimflow/shared';
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  fullName: z.string().min(1, 'Họ và tên không được để trống'),
  role: roleSchema.default(Role.PRODUCTION_PLANNER),
});

export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export type LoginDto = z.infer<typeof loginSchema>;
