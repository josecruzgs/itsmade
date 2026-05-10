import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("feedback"),

  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-4-6"),

  EVOLUTION_API_URL: z.string().url(),
  EVOLUTION_API_KEY: z.string().min(1),
  EVOLUTION_INSTANCE_NAME: z.string().min(1).default("itsmade"),
  // Token por-instancia que Evolution v2 envia firmando los webhooks.
  EVOLUTION_INSTANCE_TOKEN: z.string().min(1).optional(),
  EVOLUTION_WEBHOOK_GLOBAL_URL: z.string().url().optional(),

  // Bearer secret que Vercel Cron envia en Authorization. Si no se setea,
  // el endpoint cron acepta llamadas sin auth (util en dev local).
  CRON_SECRET: z.string().min(1).optional(),

  // Cron auto-cierre: conversaciones inactivas mas de N horas pasan a 'closed'.
  CONVERSATION_AUTO_CLOSE_HOURS: z.coerce.number().int().positive().default(72),
  // Cron expiracion: feedback_requests sin respuesta del cliente > N horas.
  FEEDBACK_REQUEST_EXPIRY_HOURS: z.coerce.number().int().positive().default(48),

  // Branding (placeholders editables por env)
  ITSMADE_BRAND_NAME: z.string().min(1).default("itsMade"),
  ITSMADE_SUPPORT_PHONE: z.string().default(""),
  ITSMADE_WEBSITE: z.string().default("itsmade.com.mx"),
});

type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

/**
 * Limpia el cache para que la proxima llamada a env() vuelva a leer process.env.
 * Util cuando se actualiza una variable en runtime (ej: cambio de API key desde /settings).
 */
export function resetEnvCache(): void {
  cached = null;
}

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.flatten().fieldErrors;
    const missing = Object.entries(formatted)
      .map(([key, errors]) => `  - ${key}: ${errors?.join(", ")}`)
      .join("\n");
    throw new Error(
      `[env] Variables de entorno invalidas o faltantes. Revisa tu .env.local:\n${missing}`,
    );
  }
  cached = parsed.data;
  return cached;
}
