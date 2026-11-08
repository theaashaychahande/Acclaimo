import { MAX_TEMPLATE_EDGE } from "./certificate";

export type PreparedTemplate = {
  blob: Blob;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  extension: "png" | "jpg" | "webp";
  width: number;
  height: number;
  objectUrl: string;
  warning: string | null;
};

const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const TARGET_BYTES = 900 * 1024;
const HARD_LIMIT_BYTES = 5 * 1024 * 1024;

const CONTENT_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

type AllowedType = keyof typeof CONTENT_TYPES;

function detectType(file: File): AllowedType | null {
  if (file.type in CONTENT_TYPES) return file.type as AllowedType;

  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";

  return null;
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the image element path for browsers that cannot
      // decode this file with the bitmap API.
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file is not an image we can read. Try a PNG, JPG, or WebP."));
    };
    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Re-encodes a chosen certificate image in the browser so a phone photo or a
 * print export does not have to travel at full size. The longest edge is capped
 * to the same limit the renderer uses, which keeps previews and downloads
 * consistent on low-memory devices.
 */
export async function prepareTemplate(file: File): Promise<PreparedTemplate> {
  const type = detectType(file);

  if (!type) {
    throw new Error("Choose a PNG, JPG, or WebP image.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("That image is larger than 12 MB. Export a smaller copy and try again.");
  }

  const source = await loadBitmap(file);
  const sourceWidth = source.width;
  const sourceHeight = source.height;

  if (sourceWidth < 2 || sourceHeight < 2) {
    throw new Error("That image looks empty. Choose a different file.");
  }

  let scale = Math.min(1, MAX_TEMPLATE_EDGE / Math.max(sourceWidth, sourceHeight));
  const transparent = type !== "image/jpeg";
  let fallback: { blob: Blob; contentType: AllowedType; width: number; height: number } | null =
    null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const width = Math.max(2, Math.round(sourceWidth * scale));
    const height = Math.max(2, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("This device cannot prepare the image. Try another browser.");
    }

    if (!transparent) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }

    context.drawImage(source, 0, 0, width, height);

    const preferred = transparent ? "image/webp" : "image/jpeg";
    const qualities = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5];

    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, preferred, quality);

      if (!blob) continue;
      if (blob.type !== preferred) continue;

      if (blob.size <= TARGET_BYTES) {
        return finalize(blob, preferred, width, height, sourceWidth, sourceHeight);
      }

      if (!fallback || blob.size < fallback.blob.size) {
        fallback = { blob, contentType: preferred, width, height };
      }
    }

    // Some browsers cannot encode WebP. A JPEG is still a valid template and
    // keeps the upload under the storage limit.
    if (preferred === "image/webp") {
      const jpegCanvas = document.createElement("canvas");
      jpegCanvas.width = width;
      jpegCanvas.height = height;
      const jpegContext = jpegCanvas.getContext("2d");

      if (jpegContext) {
        jpegContext.fillStyle = "#ffffff";
        jpegContext.fillRect(0, 0, width, height);
        jpegContext.drawImage(source, 0, 0, width, height);

        for (const quality of qualities) {
          const blob = await canvasToBlob(jpegCanvas, "image/jpeg", quality);
          if (!blob || blob.type !== "image/jpeg") continue;

          if (blob.size <= TARGET_BYTES) {
            return finalize(blob, "image/jpeg", width, height, sourceWidth, sourceHeight);
          }

          if (!fallback || blob.size < fallback.blob.size) {
            fallback = { blob, contentType: "image/jpeg", width, height };
          }
        }
      }
    }

    scale *= 0.75;
  }

  if (fallback && fallback.blob.size <= HARD_LIMIT_BYTES) {
    return finalize(
      fallback.blob,
      fallback.contentType,
      fallback.width,
      fallback.height,
      sourceWidth,
      sourceHeight,
    );
  }

  throw new Error("We could not compress that image below 5 MB. Try a simpler design.");
}

function finalize(
  blob: Blob,
  contentType: AllowedType,
  width: number,
  height: number,
  sourceWidth: number,
  sourceHeight: number,
): PreparedTemplate {
  const warning =
    Math.max(sourceWidth, sourceHeight) < 1200
      ? "This image is a little small. A wider export (about 1754 × 1240 or more) will print sharper."
      : null;

  return {
    blob,
    contentType,
    extension: CONTENT_TYPES[contentType],
    width,
    height,
    objectUrl: URL.createObjectURL(blob),
    warning,
  };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunk = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }

  return btoa(binary);
}
