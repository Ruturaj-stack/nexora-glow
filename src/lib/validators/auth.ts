import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, { message: "Email is required" })
  .email({ message: "Enter a valid email address" })
  .max(255, { message: "Email must be under 255 characters" });

export const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(72, { message: "Password must be under 72 characters" })
  .regex(/[a-z]/, { message: "Include at least one lowercase letter" })
  .regex(/[A-Z]/, { message: "Include at least one uppercase letter" })
  .regex(/[0-9]/, { message: "Include at least one number" });

export const nameSchema = z
  .string()
  .trim()
  .min(2, { message: "Name must be at least 2 characters" })
  .max(80, { message: "Name must be under 80 characters" });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "Password is required" }),
});

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "Current password is required" }),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  name: nameSchema,
  avatar: z.string().trim().url({ message: "Avatar must be a valid URL" }).max(512).nullable(),
});

export const updateSettingsSchema = z.object({
  theme: z.enum(["dark", "light", "system"]),
  accentColor: z.string().trim().min(2).max(32),
  language: z.string().trim().min(2).max(16),
  notifications: z.boolean(),
  timezone: z.string().trim().min(2).max(64),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
