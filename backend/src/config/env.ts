import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_PHONE_NUMBER: z.string().startsWith('+'),

  // Onfido
  ONFIDO_API_TOKEN: z.string().min(1),
  ONFIDO_WEBHOOK_SECRET: z.string().min(1),

  // HashiCorp Vault
  VAULT_ADDR: z.string().url(),
  VAULT_TOKEN: z.string().min(1),

  // AWS
  AWS_REGION: z.string().default('eu-central-1'),
  S3_VAULT_BUCKET: z.string().default('hox-vault-files'),

  // JWT for QR share tokens
  SHARE_JWT_SECRET: z.string().min(32).default('dev-share-secret-change-in-production-32chars'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().default('sk_test_placeholder'),
  STRIPE_WEBHOOK_SECRET: z.string().default('whsec_placeholder'),

  // ePay
  EPAY_API_URL: z.string().url().default('https://demo.epay.bg'),
  EPAY_MERCHANT_ID: z.string().default(''),
  EPAY_SECRET: z.string().default(''),

  // Gmail OAuth
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),

  // Evrotrust
  EVROTRUST_API_URL: z.string().url().default('https://api.evrotrust.com'),
  EVROTRUST_API_KEY: z.string().default(''),

  // AML
  AML_DEAL_LIMIT_EUR: z.coerce.number().default(5000),

  // Security
  EGN_SALT: z.string().min(32),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
