import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export type LoginDto = z.infer<typeof loginSchema>;
