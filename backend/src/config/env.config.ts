import z from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().min(1000).max(65534).default(5000),
  NODE_ENV: z
    .enum(["production", "development", "test"])
    .default("development"),
  DATABASE_URL: z.url().min(1),
  BACKEND_URL: z.url().min(1),
  FRONTEND_URL: z.url().min(1),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  SMTP_SERVICE: z.literal("gmail"),
  SMTP_HOST: z.literal("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().pipe(z.literal(465)).default(465),
  SMTP_USER: z.email().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.log(parsed.error);
  process.exit(1);
}

const env = parsed.data;

export default env;
