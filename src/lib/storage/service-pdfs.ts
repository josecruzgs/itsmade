import { supabaseServer } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("storage-service-pdfs");
const BUCKET = "service-pdfs";

let bucketReady = false;

/**
 * Asegura que el bucket de Storage exista. Idempotente: si ya existe, no falla.
 * Llamado lazy desde uploadServicePdf — no necesitas correrlo manualmente.
 */
async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  const sb = supabaseServer();
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024, // 5MB suficiente para hojas de servicio
  });
  // 'Bucket already exists' es codigo 409 — lo tratamos como exito.
  if (error && !error.message.toLowerCase().includes("already exists")) {
    log.warn("create_bucket_failed_continuing", { error: error.message });
  }
  bucketReady = true;
}

/**
 * Sube los bytes del PDF al bucket y devuelve un signed URL temporal (24h)
 * que Evolution puede descargar y mandar por WhatsApp.
 *
 * Path: `{serviceJobId}/{timestamp}.pdf`. No sobreescribe el anterior — cada
 * envio queda con su propio archivo (util si el equipo de operaciones quiere
 * el historial de hojas enviadas).
 */
export async function uploadServicePdf(opts: {
  serviceJobId: string;
  pdfBytes: Uint8Array;
}): Promise<{ path: string; signedUrl: string }> {
  await ensureBucket();
  const sb = supabaseServer();

  const ts = Date.now();
  const path = `${opts.serviceJobId}/${ts}.pdf`;

  const { error: uploadErr } = await sb.storage
    .from(BUCKET)
    .upload(path, opts.pdfBytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadErr) {
    throw new Error(`storage upload: ${uploadErr.message}`);
  }

  // Signed URL de 24h. Evolution descarga el archivo cuando recibe el sendMedia.
  const { data: signed, error: signErr } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24);
  if (signErr || !signed) {
    throw new Error(`storage sign: ${signErr?.message ?? "unknown"}`);
  }

  return { path, signedUrl: signed.signedUrl };
}
