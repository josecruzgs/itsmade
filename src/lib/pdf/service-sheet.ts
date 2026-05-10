import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Datos necesarios para generar la hoja de servicio en PDF.
 * Coincide con la forma de ServiceJobJoined de /services pero recortada
 * a lo que aparece en el PDF.
 */
export interface ServiceSheetData {
  job: {
    id: string;
    scheduled_at: string | null;
    completed_at: string | null;
    status: string;
    notes: string | null;
    address: string | null;
    cost_mxn: number | null;
    created_at: string;
  };
  customer: {
    name: string | null;
    company_name: string | null;
    whatsapp_phone: string;
    email: string | null;
  } | null;
  branch: { name: string; city: string; state: string | null } | null;
  service: { name: string; code: string; category_name?: string | null } | null;
  brand: {
    name: string;
    website: string;
  };
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Pendiente",
  in_progress: "En proceso",
  completed: "Realizado",
  cancelled: "Cancelado",
};

/**
 * Genera el PDF de la hoja de servicio. Devuelve los bytes del archivo.
 *
 * Layout:
 *   - Cabecera con nombre de la marca + folio (ultimos 8 chars del id).
 *   - Bloque cliente: nombre, empresa, telefono, email.
 *   - Bloque servicio: categoria, nombre del servicio, codigo, sucursal, costo.
 *   - Bloque programacion: fecha programada, fecha realizada, status, direccion.
 *   - Bloque notas (si existen).
 *   - Pie con marca + sitio web.
 */
export async function buildServiceSheetPdf(
  data: ServiceSheetData,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Hoja de servicio ${shortFolio(data.job.id)}`);
  pdf.setAuthor(data.brand.name);
  pdf.setCreator(`${data.brand.name} panel`);

  const page = pdf.addPage([595.28, 841.89]); // A4 (pt)
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = page.getHeight() - margin;

  // Header
  page.drawText(data.brand.name, {
    x: margin,
    y,
    size: 22,
    font: fontBold,
    color: rgb(0.05, 0.36, 0.62),
  });
  page.drawText(`Folio ${shortFolio(data.job.id)}`, {
    x: page.getWidth() - margin - font.widthOfTextAtSize(`Folio ${shortFolio(data.job.id)}`, 11),
    y: y + 8,
    size: 11,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 8;
  page.drawText("Hoja de servicio", {
    x: margin,
    y: y - 18,
    size: 12,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 30;

  // Linea divisora
  page.drawLine({
    start: { x: margin, y },
    end: { x: page.getWidth() - margin, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 22;

  // Cliente
  y = section(page, font, fontBold, "Cliente", y);
  y = kv(page, font, fontBold, "Nombre", data.customer?.name ?? "—", y);
  if (data.customer?.company_name) {
    y = kv(page, font, fontBold, "Empresa", data.customer.company_name, y);
  }
  y = kv(page, font, fontBold, "WhatsApp", data.customer?.whatsapp_phone ?? "—", y);
  if (data.customer?.email) {
    y = kv(page, font, fontBold, "Email", data.customer.email, y);
  }
  y -= 8;

  // Servicio
  y = section(page, font, fontBold, "Servicio", y);
  if (data.service?.category_name) {
    y = kv(page, font, fontBold, "Categoria", data.service.category_name, y);
  }
  y = kv(
    page,
    font,
    fontBold,
    "Servicio",
    data.service ? `${data.service.name} (${data.service.code})` : "—",
    y,
  );
  y = kv(
    page,
    font,
    fontBold,
    "Sucursal",
    data.branch
      ? `${data.branch.name} — ${data.branch.city}${data.branch.state ? ", " + data.branch.state : ""}`
      : "—",
    y,
  );
  y = kv(
    page,
    font,
    fontBold,
    "Costo MXN",
    data.job.cost_mxn !== null
      ? `$${data.job.cost_mxn.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "Por confirmar",
    y,
  );
  y -= 8;

  // Programacion
  y = section(page, font, fontBold, "Programacion", y);
  y = kv(
    page,
    font,
    fontBold,
    "Fecha programada",
    data.job.scheduled_at ? formatDateTime(data.job.scheduled_at) : "Sin programar",
    y,
  );
  y = kv(
    page,
    font,
    fontBold,
    "Estatus",
    STATUS_LABEL[data.job.status] ?? data.job.status,
    y,
  );
  if (data.job.completed_at) {
    y = kv(
      page,
      font,
      fontBold,
      "Fecha realizada",
      formatDateTime(data.job.completed_at),
      y,
    );
  }
  y = kv(
    page,
    font,
    fontBold,
    "Direccion",
    data.job.address ?? "—",
    y,
  );
  y -= 8;

  // Notas
  if (data.job.notes && data.job.notes.trim()) {
    y = section(page, font, fontBold, "Notas internas", y);
    y = paragraph(page, font, data.job.notes.trim(), y, margin, page.getWidth() - margin * 2);
  }

  // Footer
  const footerText = `${data.brand.name} · ${data.brand.website} · Generado ${formatDateTime(new Date().toISOString())}`;
  page.drawText(footerText, {
    x: margin,
    y: 30,
    size: 9,
    font,
    color: rgb(0.55, 0.55, 0.55),
  });

  return await pdf.save();
}

// ---------------------------------------------------------------------------
// Helpers de layout
// ---------------------------------------------------------------------------

function shortFolio(id: string): string {
  return id.replace(/-/g, "").slice(-8).toUpperCase();
}

function section(
  page: PDFPage,
  _font: PDFFont,
  fontBold: PDFFont,
  title: string,
  y: number,
): number {
  page.drawText(title.toUpperCase(), {
    x: 50,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0.1, 0.45, 0.65),
  });
  return y - 18;
}

function kv(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  key: string,
  value: string,
  y: number,
): number {
  page.drawText(key, {
    x: 50,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0.3, 0.3, 0.3),
  });
  // Value en columna a la derecha del key (offset 110pt)
  const wrapped = wrapText(value, font, 10, 380);
  let lineY = y;
  for (const line of wrapped) {
    page.drawText(line, {
      x: 160,
      y: lineY,
      size: 10,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    lineY -= 13;
  }
  return Math.min(y - 16, lineY - 2);
}

function paragraph(
  page: PDFPage,
  font: PDFFont,
  text: string,
  y: number,
  x: number,
  maxWidth: number,
): number {
  const lines = wrapText(text, font, 10, maxWidth);
  let lineY = y;
  for (const line of lines) {
    page.drawText(line, {
      x,
      y: lineY,
      size: 10,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    lineY -= 13;
  }
  return lineY - 6;
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  // Sanitiza chars que pdf-lib StandardFonts no soporta (acentos comunes ya OK
  // en WinAnsi; emojis o cyrillic NO). Mantenemos solo lo que cabe en WinAnsi.
  const safe = text.replace(/[^\x00-\xff]/g, "?");
  const words = safe.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
