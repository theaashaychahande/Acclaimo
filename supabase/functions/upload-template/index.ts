// Stores and previews organizer certificate templates in the private
// templates bucket.
//
// Acclaimo does not use Supabase Auth, so this function cannot rely on a JWT.
// Instead the browser sends the edit-key hash, which is the same credential
// every organizer RPC already uses. The function checks that hash with the
// service role, confirms the event and category belong to that organization,
// and only then reads or writes Storage.
//
// Actions:
//   upload (default) - validate and store an image, update the category path
//   sign             - short-lived URL so the organizer can preview a draft
//
// The service key never leaves this function.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil((MAX_BYTES * 4) / 3) + 16;
const ALLOWED = {
  "image/png": { extension: "png", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  "image/jpeg": { extension: "jpg", magic: [0xff, 0xd8, 0xff] },
  "image/webp": { extension: "webp", magic: [] },
} as const;

type ContentType = keyof typeof ALLOWED;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isEditKeyHash(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function hasMagic(bytes: Uint8Array, type: ContentType): boolean {
  if (type === "image/webp") {
    return bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }

  const magic = ALLOWED[type].magic;
  return bytes.length >= magic.length && magic.every((byte, index) => bytes[index] === byte);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method !== "POST") {
    return json(405, { status: "error", code: "method_not_allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEY") ??
    Deno.env.get("SB_SECRET_KEY");

  if (!supabaseUrl || !serviceKey) {
    return json(500, { status: "error", code: "storage_not_configured" });
  }

  let payload: Record<string, unknown>;

  try {
    payload = await request.json();
  } catch {
    return json(400, { status: "error", code: "invalid_json" });
  }

  const editKeyHash = payload.edit_key_hash;

  if (!isEditKeyHash(editKeyHash)) {
    return json(400, { status: "error", code: "invalid_edit_key_hash" });
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };

  const orgResponse = await fetch(
    `${supabaseUrl}/rest/v1/organizations?select=id&edit_key_hash=eq.${editKeyHash}&status=eq.active&limit=1`,
    { headers },
  );

  if (!orgResponse.ok) {
    return json(500, { status: "error", code: "lookup_failed" });
  }

  const organizations = await orgResponse.json() as Array<{ id: string }>;
  const organizationId = organizations[0]?.id;

  if (!organizationId) {
    return json(403, { status: "invalid_key" });
  }

  if (payload.action === "sign") {
    const categoryId = payload.category_id;

    if (!isUuid(categoryId)) {
      return json(400, { status: "error", code: "invalid_target" });
    }

    const categoryResponse = await fetch(
      `${supabaseUrl}/rest/v1/categories?select=id,template_path,event_id&id=eq.${categoryId}&limit=1`,
      { headers },
    );

    if (!categoryResponse.ok) {
      return json(500, { status: "error", code: "lookup_failed" });
    }

    const categories = await categoryResponse.json() as Array<{
      id: string;
      template_path: string | null;
      event_id: string;
    }>;
    const category = categories[0];

    if (!category) {
      return json(404, { status: "error", code: "category_not_found" });
    }

    // Check the event separately: categories and events are linked twice (the
    // event owns its categories and also points at its default category), so a
    // single embedded query is ambiguous.
    const ownerResponse = await fetch(
      `${supabaseUrl}/rest/v1/events?select=id&id=eq.${category.event_id}&organization_id=eq.${organizationId}&limit=1`,
      { headers },
    );

    if (!ownerResponse.ok) {
      return json(500, { status: "error", code: "lookup_failed" });
    }

    const owners = await ownerResponse.json() as Array<{ id: string }>;

    if (owners.length === 0) {
      return json(404, { status: "error", code: "category_not_found" });
    }

    if (!category.template_path) {
      return json(404, { status: "error", code: "no_template" });
    }

    const signResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/sign/templates/${encodePath(category.template_path)}`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: 300 }),
      },
    );

    if (!signResponse.ok) {
      return json(502, { status: "error", code: "sign_failed" });
    }

    const signed = await signResponse.json() as { signedURL?: string };
    if (!signed.signedURL) {
      return json(502, { status: "error", code: "sign_failed" });
    }

    const url = signed.signedURL.startsWith("http")
      ? signed.signedURL
      : `${supabaseUrl}/storage/v1${signed.signedURL}`;

    return json(200, { status: "ok", template_path: category.template_path, url });
  }

  const eventId = payload.event_id;
  const categoryId = payload.category_id;
  const contentType = payload.content_type;
  const dataBase64 = payload.data_base64;

  if (!isUuid(eventId) || !isUuid(categoryId)) {
    return json(400, { status: "error", code: "invalid_target" });
  }
  if (typeof contentType !== "string" || !(contentType in ALLOWED)) {
    return json(400, { status: "error", code: "invalid_image_type" });
  }
  if (
    typeof dataBase64 !== "string" ||
    dataBase64.length === 0 ||
    dataBase64.length > MAX_BASE64_LENGTH
  ) {
    return json(413, { status: "error", code: "image_too_large" });
  }

  let bytes: Uint8Array;

  try {
    bytes = decodeBase64(dataBase64);
  } catch {
    return json(400, { status: "error", code: "invalid_image_data" });
  }

  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    return json(413, { status: "error", code: "image_too_large" });
  }
  if (!hasMagic(bytes, contentType as ContentType)) {
    return json(400, { status: "error", code: "invalid_image_data" });
  }

  const eventResponse = await fetch(
    `${supabaseUrl}/rest/v1/events?select=id&id=eq.${eventId}&organization_id=eq.${organizationId}&limit=1`,
    { headers },
  );

  if (!eventResponse.ok) {
    return json(500, { status: "error", code: "lookup_failed" });
  }

  const events = await eventResponse.json() as Array<{ id: string }>;
  if (events.length === 0) {
    return json(404, { status: "error", code: "event_not_found" });
  }

  const categoryResponse = await fetch(
    `${supabaseUrl}/rest/v1/categories?select=id,template_path&id=eq.${categoryId}&event_id=eq.${eventId}&limit=1`,
    { headers },
  );

  if (!categoryResponse.ok) {
    return json(500, { status: "error", code: "lookup_failed" });
  }

  const categories = await categoryResponse.json() as Array<{
    id: string;
    template_path: string | null;
  }>;
  const category = categories[0];

  if (!category) {
    return json(404, { status: "error", code: "category_not_found" });
  }

  const extension = ALLOWED[contentType as ContentType].extension;
  const path = `${organizationId}/${eventId}/${categoryId}-${Date.now()}.${extension}`;

  const uploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/templates/${encodePath(path)}`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": contentType,
        "cache-control": "max-age=3600",
        "x-upsert": "false",
      },
      body: bytes,
    },
  );

  if (!uploadResponse.ok) {
    return json(502, { status: "error", code: "upload_failed" });
  }

  const updateResponse = await fetch(
    `${supabaseUrl}/rest/v1/categories?id=eq.${categoryId}&event_id=eq.${eventId}`,
    {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ template_path: path }),
    },
  );

  if (!updateResponse.ok) {
    // Do not leave an unreferenced object behind if the row could not be saved.
    await fetch(
      `${supabaseUrl}/storage/v1/object/templates/${encodePath(path)}`,
      { method: "DELETE", headers },
    ).catch(() => undefined);

    return json(502, { status: "error", code: "save_failed" });
  }

  // Replacing a template should not leave the old object in the bucket. Only
  // remove paths inside this organization's folder.
  if (
    category.template_path &&
    category.template_path !== path &&
    category.template_path.startsWith(`${organizationId}/`)
  ) {
    await fetch(
      `${supabaseUrl}/storage/v1/object/templates/${encodePath(category.template_path)}`,
      { method: "DELETE", headers },
    ).catch(() => undefined);
  }

  return json(200, { status: "ok", template_path: path });
});
