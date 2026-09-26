import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(60, 'Name is too long'),
  email,
  // bcrypt only uses the first 72 bytes of a password, so longer ones would be silently truncated
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password is too long'),
});
// Note: there is no "role" field. Anyone signing up is a passenger. Drivers are onboarded
// (seeded) after vehicle verification, see DESIGN.md §2. Unknown fields are stripped.

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
