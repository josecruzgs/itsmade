import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { buildServicePdfForJob } from "@/lib/pdf/build-for-job";
import { createLogger } from "@/lib/logger";

const log = createLogger("api-service-pdf");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/services/[id]/pdf
 * Genera al vuelo la hoja de servicio en PDF y la devuelve como descarga.
 * Solo usuarios autenticados (admin panel). El middleware ya redirige a /login
 * si no hay sesion; aqui agregamos requireAuth como defense-in-depth.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  try {
    const { pdfBytes, fileName } = await buildServicePdfForJob(id);
    // Buffer.from para que el body sea aceptado por la firma BodyInit de Response.
    const body = Buffer.from(pdfBytes);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    log.error("download_failed", {
      error: (err as Error).message,
      serviceJobId: id,
    });
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 404 },
    );
  }
}
