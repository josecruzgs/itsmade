import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";

/**
 * Carga el logo desde public/logo.png una sola vez al iniciar el modulo.
 * Necesita estar en outputFileTracingIncludes para que Vercel lo empaquete.
 */
const LOGO_PATH = join(process.cwd(), "public", "logo.png");
let cachedLogo: Buffer | null | undefined;

function loadLogoBytes(): Buffer | null {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    cachedLogo = readFileSync(LOGO_PATH);
  } catch {
    cachedLogo = null;
  }
  return cachedLogo;
}

// ---------------------------------------------------------------------------
// Tipos publicos
// ---------------------------------------------------------------------------

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
  employee: {
    full_name: string;
    position: string | null;
    area: string | null;
    whatsapp_phone: string;
  } | null;
  brand: {
    name: string;
    website: string;
    supportPhone?: string;
  };
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Pendiente",
  in_progress: "En proceso",
  completed: "Realizado",
  cancelled: "Cancelado",
};

// Paleta
const BRAND: RGB = rgb(0.05, 0.36, 0.62);
const BRAND_DARK: RGB = rgb(0.04, 0.28, 0.5);
const TEXT_DARK: RGB = rgb(0.1, 0.1, 0.15);
const TEXT_MUTED: RGB = rgb(0.45, 0.45, 0.55);
const BORDER: RGB = rgb(0.85, 0.85, 0.88);
const SECTION_BG: RGB = rgb(0.96, 0.97, 0.98);
const TOTAL_BG: RGB = rgb(0.95, 0.97, 1);

// Layout
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ---------------------------------------------------------------------------
// API publica
// ---------------------------------------------------------------------------

export async function buildServiceSheetPdf(
  data: ServiceSheetData,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Hoja de servicio ${shortFolio(data.job.id)}`);
  pdf.setAuthor(data.brand.name);
  pdf.setCreator(`${data.brand.name} panel`);

  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fonts = { font, fontBold };

  // Banda decorativa superior
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 6,
    width: PAGE_W,
    height: 6,
    color: BRAND,
  });

  // Header
  let y = await drawHeader(pdf, page, fonts, data);

  // Bloque cliente + servicio (dos columnas paralelas)
  y = drawTwoColSection(page, fonts, y, data);

  // Programacion (full width)
  y = drawProgramacion(page, fonts, y, data);

  // Personal asignado
  y = drawEmpleado(page, fonts, y, data);

  // Notas (solo si existen)
  if (data.job.notes && data.job.notes.trim()) {
    y = drawNotas(page, fonts, y, data.job.notes.trim());
  }

  // Total
  y = drawTotal(page, fonts, y, data.job.cost_mxn);

  // Conformidad / firma
  y = drawConformidad(page, fonts, y, data);

  // Footer
  drawFooter(page, fonts, data);

  return await pdf.save();
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

async function drawHeader(
  pdf: PDFDocument,
  page: PDFPage,
  fonts: Fonts,
  data: ServiceSheetData,
): Promise<number> {
  const headerTop = PAGE_H - 36;
  const LOGO_HEIGHT = 50;

  // Logo (si existe)
  let textXStart = MARGIN;
  const logoBytes = loadLogoBytes();
  if (logoBytes) {
    try {
      const logoImg = await pdf.embedPng(logoBytes);
      const ratio = logoImg.width / logoImg.height;
      const logoW = LOGO_HEIGHT * ratio;
      page.drawImage(logoImg, {
        x: MARGIN,
        y: headerTop - LOGO_HEIGHT,
        width: logoW,
        height: LOGO_HEIGHT,
      });
      textXStart = MARGIN + logoW + 14;
    } catch {
      // sigue sin logo
    }
  }

  // Brand + tagline
  page.drawText(data.brand.name, {
    x: textXStart,
    y: headerTop - 16,
    size: 22,
    font: fonts.fontBold,
    color: BRAND,
  });
  page.drawText("Hoja de servicio", {
    x: textXStart,
    y: headerTop - 32,
    size: 11,
    font: fonts.font,
    color: TEXT_MUTED,
  });
  if (data.brand.website) {
    page.drawText(data.brand.website, {
      x: textXStart,
      y: headerTop - 46,
      size: 9,
      font: fonts.font,
      color: TEXT_MUTED,
    });
  }

  // Caja de folio (top-right)
  drawFolioBox(page, fonts, headerTop, data);

  // Linea separadora
  const sepY = headerTop - LOGO_HEIGHT - 16;
  page.drawLine({
    start: { x: MARGIN, y: sepY },
    end: { x: PAGE_W - MARGIN, y: sepY },
    thickness: 0.8,
    color: BORDER,
  });

  return sepY - 18;
}

function drawFolioBox(
  page: PDFPage,
  fonts: Fonts,
  headerTop: number,
  data: ServiceSheetData,
): void {
  const boxW = 160;
  const boxH = 50;
  const boxX = PAGE_W - MARGIN - boxW;
  const boxY = headerTop - boxH;

  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    color: BRAND,
  });

  page.drawText("FOLIO", {
    x: boxX + 12,
    y: boxY + boxH - 14,
    size: 8,
    font: fonts.fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(shortFolio(data.job.id), {
    x: boxX + 12,
    y: boxY + boxH - 30,
    size: 16,
    font: fonts.fontBold,
    color: rgb(1, 1, 1),
  });

  // Fecha de emision
  const emitidoLabel = "Emitido";
  const emitidoVal = formatDate(data.job.created_at);
  page.drawText(`${emitidoLabel}: ${emitidoVal}`, {
    x: boxX + 12,
    y: boxY + 8,
    size: 8,
    font: fonts.font,
    color: rgb(1, 1, 1),
  });
}

// ---------------------------------------------------------------------------
// Bloque cliente + servicio (dos columnas)
// ---------------------------------------------------------------------------

function drawTwoColSection(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  data: ServiceSheetData,
): number {
  const colWidth = (CONTENT_W - 16) / 2; // 16 de gap
  const leftX = MARGIN;
  const rightX = MARGIN + colWidth + 16;

  // Headers de cada columna
  drawColHeader(page, fonts, "CLIENTE", leftX, y, colWidth);
  drawColHeader(page, fonts, "SERVICIO", rightX, y, colWidth);
  let leftY = y - 22;
  let rightY = y - 22;

  // Columna izquierda: cliente
  if (data.customer?.name) {
    leftY = kvLine(page, fonts, "Nombre", data.customer.name, leftX, leftY, colWidth);
  }
  if (data.customer?.company_name) {
    leftY = kvLine(
      page,
      fonts,
      "Empresa",
      data.customer.company_name,
      leftX,
      leftY,
      colWidth,
    );
  }
  if (data.customer?.whatsapp_phone) {
    leftY = kvLine(
      page,
      fonts,
      "WhatsApp",
      formatPhone(data.customer.whatsapp_phone),
      leftX,
      leftY,
      colWidth,
    );
  }
  if (data.customer?.email) {
    leftY = kvLine(
      page,
      fonts,
      "Email",
      data.customer.email,
      leftX,
      leftY,
      colWidth,
    );
  }

  // Columna derecha: servicio + sucursal
  if (data.service?.category_name) {
    rightY = kvLine(
      page,
      fonts,
      "Categoria",
      data.service.category_name,
      rightX,
      rightY,
      colWidth,
    );
  }
  if (data.service) {
    rightY = kvLine(
      page,
      fonts,
      "Servicio",
      `${data.service.name} (${data.service.code})`,
      rightX,
      rightY,
      colWidth,
    );
  }
  if (data.branch) {
    const branchText = `${data.branch.name} — ${data.branch.city}${data.branch.state ? ", " + data.branch.state : ""}`;
    rightY = kvLine(page, fonts, "Sucursal", branchText, rightX, rightY, colWidth);
  }

  // Tomamos el mas bajo de los dos para continuar
  return Math.min(leftY, rightY) - 12;
}

// ---------------------------------------------------------------------------
// Programacion (full width)
// ---------------------------------------------------------------------------

function drawProgramacion(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  data: ServiceSheetData,
): number {
  y = drawSectionHeader(page, fonts, "PROGRAMACION", y);
  const colWidth = (CONTENT_W - 16) / 2;

  let leftY = y;
  let rightY = y;

  leftY = kvLine(
    page,
    fonts,
    "Fecha programada",
    data.job.scheduled_at ? formatDateTime(data.job.scheduled_at) : "Sin programar",
    MARGIN,
    leftY,
    colWidth,
  );
  if (data.job.completed_at) {
    leftY = kvLine(
      page,
      fonts,
      "Fecha realizada",
      formatDateTime(data.job.completed_at),
      MARGIN,
      leftY,
      colWidth,
    );
  }

  rightY = kvLine(
    page,
    fonts,
    "Estatus",
    STATUS_LABEL[data.job.status] ?? data.job.status,
    MARGIN + colWidth + 16,
    rightY,
    colWidth,
  );

  let bottomY = Math.min(leftY, rightY);

  // Direccion (full width abajo)
  if (data.job.address) {
    bottomY = kvLine(
      page,
      fonts,
      "Direccion",
      data.job.address,
      MARGIN,
      bottomY,
      CONTENT_W,
    );
  }

  return bottomY - 12;
}

// ---------------------------------------------------------------------------
// Personal asignado
// ---------------------------------------------------------------------------

function drawEmpleado(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  data: ServiceSheetData,
): number {
  y = drawSectionHeader(page, fonts, "PERSONAL ASIGNADO", y);

  if (!data.employee) {
    // Caja con texto en italic-ish
    page.drawText("Pendiente de asignar.", {
      x: MARGIN,
      y,
      size: 10,
      font: fonts.font,
      color: TEXT_MUTED,
    });
    return y - 24;
  }

  const colWidth = (CONTENT_W - 16) / 2;
  let leftY = y;
  let rightY = y;

  leftY = kvLine(
    page,
    fonts,
    "Nombre",
    data.employee.full_name,
    MARGIN,
    leftY,
    colWidth,
  );
  if (data.employee.position) {
    leftY = kvLine(
      page,
      fonts,
      "Puesto",
      data.employee.position,
      MARGIN,
      leftY,
      colWidth,
    );
  }

  if (data.employee.area) {
    rightY = kvLine(
      page,
      fonts,
      "Area",
      data.employee.area,
      MARGIN + colWidth + 16,
      rightY,
      colWidth,
    );
  }
  rightY = kvLine(
    page,
    fonts,
    "WhatsApp",
    formatPhone(data.employee.whatsapp_phone),
    MARGIN + colWidth + 16,
    rightY,
    colWidth,
  );

  return Math.min(leftY, rightY) - 12;
}

// ---------------------------------------------------------------------------
// Notas
// ---------------------------------------------------------------------------

function drawNotas(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  notes: string,
): number {
  y = drawSectionHeader(page, fonts, "NOTAS", y);
  const lines = wrapText(notes, fonts.font, 10, CONTENT_W);
  let lineY = y;
  for (const line of lines.slice(0, 8)) {
    page.drawText(line, {
      x: MARGIN,
      y: lineY,
      size: 10,
      font: fonts.font,
      color: TEXT_DARK,
    });
    lineY -= 13;
  }
  return lineY - 10;
}

// ---------------------------------------------------------------------------
// Total
// ---------------------------------------------------------------------------

function drawTotal(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  costMxn: number | null,
): number {
  const boxH = 36;
  const boxY = y - boxH;

  page.drawRectangle({
    x: MARGIN,
    y: boxY,
    width: CONTENT_W,
    height: boxH,
    color: TOTAL_BG,
    borderColor: BRAND,
    borderWidth: 1,
  });

  page.drawText("TOTAL DEL SERVICIO", {
    x: MARGIN + 14,
    y: boxY + boxH / 2 - 4,
    size: 11,
    font: fonts.fontBold,
    color: BRAND_DARK,
  });

  const valueText =
    costMxn !== null
      ? `$${costMxn.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`
      : "Por confirmar";
  const valueWidth = fonts.fontBold.widthOfTextAtSize(valueText, 14);
  page.drawText(valueText, {
    x: MARGIN + CONTENT_W - 14 - valueWidth,
    y: boxY + boxH / 2 - 5,
    size: 14,
    font: fonts.fontBold,
    color: BRAND_DARK,
  });

  return boxY - 24;
}

// ---------------------------------------------------------------------------
// Conformidad del cliente (firma)
// ---------------------------------------------------------------------------

function drawConformidad(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  data: ServiceSheetData,
): number {
  y = drawSectionHeader(page, fonts, "CONFORMIDAD DEL CLIENTE", y);

  const intro =
    "El cliente firma de conformidad por el servicio recibido en buenas condiciones y a satisfaccion.";
  const introLines = wrapText(intro, fonts.font, 10, CONTENT_W);
  let lineY = y;
  for (const line of introLines) {
    page.drawText(line, {
      x: MARGIN,
      y: lineY,
      size: 10,
      font: fonts.font,
      color: TEXT_MUTED,
    });
    lineY -= 13;
  }

  // Espacio para firmar (40pt)
  const signTop = lineY - 12;
  const signBottom = signTop - 50;

  // Linea de firma (izquierda) y fecha (derecha)
  const signLineW = 240;
  const dateLineW = 140;

  page.drawLine({
    start: { x: MARGIN, y: signBottom },
    end: { x: MARGIN + signLineW, y: signBottom },
    thickness: 0.8,
    color: TEXT_DARK,
  });
  page.drawLine({
    start: { x: PAGE_W - MARGIN - dateLineW, y: signBottom },
    end: { x: PAGE_W - MARGIN, y: signBottom },
    thickness: 0.8,
    color: TEXT_DARK,
  });

  // Labels debajo
  const customerLabel = data.customer?.name
    ? data.customer.name
    : "Nombre y firma del cliente";
  page.drawText(customerLabel, {
    x: MARGIN,
    y: signBottom - 12,
    size: 9,
    font: fonts.fontBold,
    color: TEXT_DARK,
  });
  page.drawText("Firma del cliente", {
    x: MARGIN,
    y: signBottom - 23,
    size: 8,
    font: fonts.font,
    color: TEXT_MUTED,
  });

  page.drawText("Fecha", {
    x: PAGE_W - MARGIN - dateLineW,
    y: signBottom - 12,
    size: 9,
    font: fonts.fontBold,
    color: TEXT_DARK,
  });
  page.drawText("DD / MM / AAAA", {
    x: PAGE_W - MARGIN - dateLineW,
    y: signBottom - 23,
    size: 8,
    font: fonts.font,
    color: TEXT_MUTED,
  });

  return signBottom - 38;
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function drawFooter(page: PDFPage, fonts: Fonts, data: ServiceSheetData): void {
  // Linea de footer
  page.drawLine({
    start: { x: MARGIN, y: 42 },
    end: { x: PAGE_W - MARGIN, y: 42 },
    thickness: 0.5,
    color: BORDER,
  });

  const left = `${data.brand.name} · ${data.brand.website}`;
  page.drawText(left, {
    x: MARGIN,
    y: 28,
    size: 9,
    font: fonts.fontBold,
    color: TEXT_MUTED,
  });

  if (data.brand.supportPhone) {
    page.drawText(`Atencion al cliente: ${formatPhone(data.brand.supportPhone)}`, {
      x: MARGIN,
      y: 16,
      size: 8,
      font: fonts.font,
      color: TEXT_MUTED,
    });
  }

  const right = `Generado ${formatDateTime(new Date().toISOString())}`;
  const rightW = fonts.font.widthOfTextAtSize(right, 8);
  page.drawText(right, {
    x: PAGE_W - MARGIN - rightW,
    y: 16,
    size: 8,
    font: fonts.font,
    color: TEXT_MUTED,
  });
}

// ---------------------------------------------------------------------------
// Helpers de layout
// ---------------------------------------------------------------------------

interface Fonts {
  font: PDFFont;
  fontBold: PDFFont;
}

function drawSectionHeader(
  page: PDFPage,
  fonts: Fonts,
  title: string,
  y: number,
): number {
  const barH = 18;
  page.drawRectangle({
    x: MARGIN,
    y: y - barH + 2,
    width: CONTENT_W,
    height: barH,
    color: SECTION_BG,
  });
  // Acento brand a la izquierda
  page.drawRectangle({
    x: MARGIN,
    y: y - barH + 2,
    width: 3,
    height: barH,
    color: BRAND,
  });
  page.drawText(title, {
    x: MARGIN + 10,
    y: y - barH + 7,
    size: 9,
    font: fonts.fontBold,
    color: BRAND_DARK,
  });
  return y - barH - 10;
}

function drawColHeader(
  page: PDFPage,
  fonts: Fonts,
  title: string,
  x: number,
  y: number,
  width: number,
): void {
  const barH = 18;
  page.drawRectangle({
    x,
    y: y - barH + 2,
    width,
    height: barH,
    color: SECTION_BG,
  });
  page.drawRectangle({
    x,
    y: y - barH + 2,
    width: 3,
    height: barH,
    color: BRAND,
  });
  page.drawText(title, {
    x: x + 10,
    y: y - barH + 7,
    size: 9,
    font: fonts.fontBold,
    color: BRAND_DARK,
  });
}

function kvLine(
  page: PDFPage,
  fonts: Fonts,
  key: string,
  value: string,
  x: number,
  y: number,
  width: number,
): number {
  const labelSize = 8;
  const valueSize = 10;
  page.drawText(key.toUpperCase(), {
    x,
    y,
    size: labelSize,
    font: fonts.fontBold,
    color: TEXT_MUTED,
  });
  const valueY = y - 12;
  const wrapped = wrapText(value, fonts.font, valueSize, width);
  let lineY = valueY;
  for (const line of wrapped.slice(0, 2)) {
    page.drawText(line, {
      x,
      y: lineY,
      size: valueSize,
      font: fonts.font,
      color: TEXT_DARK,
    });
    lineY -= 13;
  }
  return lineY - 4;
}

function shortFolio(id: string): string {
  return id.replace(/-/g, "").slice(-8).toUpperCase();
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  // pdf-lib StandardFonts solo soporta WinAnsi. Reemplazamos el resto por '?'.
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPhone(p: string): string {
  // Mexicano tipico: 5216861234567 o 6861234567 -> con espacios cada 3-4
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 12 && digits.startsWith("521")) {
    const local = digits.slice(3);
    return `+52 1 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  if (digits.length === 13 && digits.startsWith("521")) {
    const local = digits.slice(3);
    return `+52 1 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return p;
}
