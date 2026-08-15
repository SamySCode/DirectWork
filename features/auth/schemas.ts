import { z } from "zod";

export const signUpSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(
    Object.entries(flattened).map(([key, messages]) => [key, messages?.[0] ?? ""]),
  );
}
