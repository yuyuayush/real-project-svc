import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().url().default('http://localhost:5000'),
  CLIENT_URL: z.string().url().default('http://localhost:5000'),
  
  // Stripe
  STRIPE_SECRET_KEY: z.string().default('sk_test_placeholder'),
  STRIPE_PUBLISHABLE_KEY: z.string().default('pk_test_placeholder'),
  STRIPE_WEBHOOK_SECRET: z.string().default('whsec_placeholder'),
  STRIPE_CURRENCY: z.string().default('usd'),
  
  // Resend
  RESEND_API_KEY: z.string().default('re_placeholder'),
  EMAIL_FROM: z.string().default('Store Orders <onboarding@resend.dev>'),
  SUPPORT_EMAIL: z.string().email().default('support@example.com'),
  STORE_NAME: z.string().default('PrimeStore Direct'),

  // Database
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/payment-gateway'),

  // Authentication & Security Salt
  AUTH_SALT: z.string().default('payflow_system_salt_sec_9831728347102938'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = {
  ...parsedEnv.data,
  isMockStripe:
    !parsedEnv.data.STRIPE_SECRET_KEY ||
    parsedEnv.data.STRIPE_SECRET_KEY.includes('placeholder') ||
    parsedEnv.data.STRIPE_SECRET_KEY.startsWith('sk_test_placeholder'),
  isMockResend:
    !parsedEnv.data.RESEND_API_KEY ||
    parsedEnv.data.RESEND_API_KEY.includes('placeholder') ||
    parsedEnv.data.RESEND_API_KEY.startsWith('re_placeholder'),
};
