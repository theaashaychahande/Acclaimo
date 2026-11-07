export type TextAlign = "left" | "center" | "right";
export type TextCasing = "keep" | "title" | "upper";

/**
 * One piece of text on a certificate. Positions are percentages of the
 * template so the same settings survive any image size.
 */
export type TextBox = {
  x: number;
  y: number;
  width: number;
  fontSize: number;
  minFontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  align: TextAlign;
  letterSpacing: number;
  casing: TextCasing;
  wrap: boolean;
};

export type DesignSettings = {
  name?: Partial<TextBox>;
  position?: Partial<TextBox> & { enabled?: boolean };
};

export type CertificateInput = {
  template: HTMLImageElement | null;
  design: DesignSettings;
  name: string;
  positionText?: string | null;
  eventName: string;
  organizationName: string;
  categoryLabel: string;
};

const MAX_EDGE = 1800;
const PAPER = "#fffdf8";
const INK = "#18211e";
const MUTED = "#626b65";
const LINE = "#d9d2c3";
const ACCENT = "#0d5c50";
const SERIF = '"Source Serif 4", "Iowan Old Style", Georgia, serif';
const SANS = '"Public Sans", ui-sans-serif, system-ui, sans-serif';

function nameDefaults(height: number): TextBox {
  return {
    x: 50,
    y: 47,
    width: 70,
    fontSize: Math.round(height * 0.075),
    minFontSize: Math.round(height * 0.03),
    fontFamily: SERIF,
    color: INK,
    bold: true,
    align: "center",
    letterSpacing: 0,
    casing: "keep",
    wrap: true,
  };
}

function positionDefaults(height: number): TextBox {
  return {
    x: 50,
    y: 61,
    width: 66,
    fontSize: Math.round(height * 0.032),
    minFontSize: Math.round(height * 0.018),
    fontFamily: SANS,
    color: ACCENT,
    bold: false,
    align: "center",
    letterSpacing: 1,
    casing: "upper",
    wrap: false,
  };
}

function withoutUndefined<T extends object>(value: T | undefined): Partial<T> {
  if (!value) return {};

  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

function resolveBox(
  partial: Partial<TextBox> | undefined,
  fallback: TextBox,
): TextBox {
  return { ...fallback, ...withoutUndefined(partial) };
}

function applyCasing(value: string, casing: TextCasing): string {
  if (casing === "upper") return value.toUpperCase();
  if (casing === "title") {
    return value.replace(/\p{L}[\p{L}\p{M}]*/gu, (word) => {
      const [first, ...rest] = Array.from(word);
      return first.toUpperCase() + rest.join("").toLowerCase();
    });
  }
  return value;
}

function fontString(box: TextBox, size: number): string {
  return `${box.bold ? "600" : "400"} ${Math.max(8, Math.round(size))}px ${box.fontFamily}`;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] | null {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = words[0];

  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;

    if (lines.length === maxLines) return null;
  }

  lines.push(current);

  return lines.length <= maxLines ? lines : null;
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let trimmed = text;
  while (trimmed.length > 0 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }

  return `${trimmed.trimEnd()}…`;
}

type LaidOutText = {
  size: number;
  lines: string[];
};

function layoutText(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: TextBox,
  maxWidth: number,
  maxLines: number,
): LaidOutText {
  const step = Math.max(1, box.fontSize * 0.04);

  for (let size = box.fontSize; size >= box.minFontSize; size -= step) {
    ctx.font = fontString(box, size);
    const lines = wrapLines(ctx, text, maxWidth, maxLines);

    if (lines) return { size, lines };
  }

  ctx.font = fontString(box, box.minFontSize);
  const lines = wrapLines(ctx, text, maxWidth, maxLines);

  if (lines) return { size: box.minFontSize, lines };

  return {
    size: box.minFontSize,
    lines: [truncate(ctx, text, maxWidth)],
  };
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: TextBox,
  canvasWidth: number,
  canvasHeight: number,
  maxLines: number,
) {
  const value = applyCasing(text.trim(), box.casing);
  if (!value) return;

  const maxWidth = (box.width / 100) * canvasWidth;
  const laidOut = layoutText(ctx, value, box, maxWidth, maxLines);

  ctx.font = fontString(box, laidOut.size);
  ctx.fillStyle = box.color;
  ctx.textAlign = box.align;
  ctx.textBaseline = "middle";

  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${box.letterSpacing}px`;
  }

  const x = (box.x / 100) * canvasWidth;
  const lineHeight = laidOut.size * 1.18;
  const totalHeight = lineHeight * laidOut.lines.length;
  let y = (box.y / 100) * canvasHeight - totalHeight / 2 + lineHeight / 2;

  for (const line of laidOut.lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }

  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  }
}

function drawDefaultBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  input: CertificateInput,
) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);

  const inset = Math.round(width * 0.035);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = Math.max(1, width * 0.0015);
  ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);

  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = Math.max(2, width * 0.004);
  ctx.beginPath();
  ctx.moveTo(inset, inset);
  ctx.lineTo(inset + width * 0.16, inset);
  ctx.stroke();

  ctx.fillStyle = ACCENT;
  ctx.font = `600 ${Math.round(height * 0.022)}px ${SANS}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("ACCLAIMO", inset * 1.6, inset * 1.9);

  ctx.fillStyle = MUTED;
  ctx.font = `400 ${Math.round(height * 0.02)}px ${SANS}`;
  ctx.textAlign = "right";
  ctx.fillText(input.organizationName, width - inset * 1.6, inset * 1.9);

  ctx.textAlign = "center";
  ctx.fillStyle = MUTED;
  ctx.font = `500 ${Math.round(height * 0.019)}px ${SANS}`;
  ctx.fillText(applyCasing(input.categoryLabel, "upper"), width / 2, height * 0.33);

  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width * 0.32, height * 0.53);
  ctx.lineTo(width * 0.68, height * 0.53);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = `400 ${Math.round(height * 0.02)}px ${SANS}`;
  ctx.fillText(input.eventName, width / 2, height * 0.73);

  ctx.fillStyle = LINE;
  ctx.font = `400 ${Math.round(height * 0.015)}px ${SANS}`;
  ctx.fillText("Generated with Acclaimo", width / 2, height - inset * 1.6);
}

/**
 * Draws one certificate on a canvas. The same function is used for the
 * on-screen preview and for the downloaded file, so what a student sees is
 * exactly what they get.
 */
export async function renderCertificate(
  input: CertificateInput,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("This device cannot create a certificate image.");
  }

  const sourceWidth = input.template?.naturalWidth || 1600;
  const sourceHeight = input.template?.naturalHeight || Math.round(1600 / Math.SQRT2);
  const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight));

  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));

  const width = canvas.width;
  const height = canvas.height;

  if (input.template) {
    ctx.drawImage(input.template, 0, 0, width, height);
  } else {
    drawDefaultBackground(ctx, width, height, input);
  }

  const nameBox = resolveBox(input.design.name, nameDefaults(height));
  const positionBox = resolveBox(input.design.position, positionDefaults(height));
  const positionEnabled = input.design.position?.enabled !== false;

  drawBox(ctx, input.name, nameBox, width, height, 2);

  if (positionEnabled && input.positionText?.trim()) {
    drawBox(ctx, input.positionText, positionBox, width, height, positionBox.wrap ? 2 : 1);
  }

  return canvas;
}

export function loadTemplateImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The certificate design could not be loaded."));
    image.src = url;
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The certificate could not be saved."));
    }, "image/png");
  });
}

export function safeFileName(...parts: string[]): string {
  const joined = parts
    .map((part) => part.trim().replace(/[^\p{L}\p{N}._-]+/gu, "-"))
    .filter(Boolean)
    .join("_");

  return `${joined || "certificate"}.png`;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function openPrintWindow(dataUrl: string, title: string): void {
  // `noopener` makes window.open return null in most browsers, so open
  // normally and cut the opener link before touching the new document.
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    throw new Error("Your browser blocked the print window. Allow pop-ups and try again.");
  }

  printWindow.opener = null;

  const doc = printWindow.document;
  doc.open();
  doc.write(
    "<!doctype html><html><head><meta charset=\"utf-8\">" +
      "<style>@page{size:landscape;margin:0}body{margin:0}img{width:100%;display:block}</style>" +
      "</head><body></body></html>",
  );
  doc.close();
  doc.title = title;

  // Build the image with DOM APIs instead of an inline handler, so a
  // user-supplied event name can never become markup or script.
  const image = doc.createElement("img");
  image.alt = "";
  image.onload = () => printWindow.print();
  image.src = dataUrl;
  doc.body.appendChild(image);
}
