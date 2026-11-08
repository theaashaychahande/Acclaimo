import { getSupabase } from "./supabase";
import { getDeviceId } from "./device";
import { getSupabaseConfig } from "./env";
import { blobToBase64 } from "./template";
import type { DesignSettings } from "./certificate";

export class RpcError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "RpcError";
    this.code = code;
  }
}

async function callRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(name, args);

  if (error) {
    throw new RpcError(error.message || "The server could not complete that request.", error.code);
  }

  return data as T;
}

/* ------------------------------------------------------------------ */
/* Public / student                                                    */
/* ------------------------------------------------------------------ */

export type PublicOrganization = {
  name: string;
  department_or_club: string;
  public_contact: string | null;
  logo_path: string | null;
  salt: string;
};

export type PublicEventSummary = {
  id: string;
  name: string;
  date: string;
};

export type PublicOrgResponse =
  | {
      status: "ok";
      organization: PublicOrganization;
      events: PublicEventSummary[];
    }
  | { status: "not_found" };

export type LookupCategory = {
  id: string;
  label: string;
  template_path: string | null;
  design_settings: DesignSettings;
};

export type LookupMatch = {
  event_id: string;
  event_name: string;
  event_date: string;
  category: LookupCategory;
  position_text: string | null;
};

export type LookupResponse =
  | { status: "ok"; matches: LookupMatch[] }
  | {
      status: "needs_identifier";
      events: Array<{ event_id: string; event_name: string; event_date: string }>;
    }
  | { status: "not_found" }
  | { status: "rate_limited"; retry_after_seconds: number }
  | { status: "error"; code: string };

export function isLinkId(value: string): boolean {
  return /^[a-z2-7]{10}$/.test(value);
}

export async function fetchPublicOrg(linkId: string): Promise<PublicOrgResponse> {
  return callRpc<PublicOrgResponse>("get_public_org_info", { p_link_id: linkId });
}

export async function lookupParticipant(input: {
  linkId: string;
  nameHash: string;
  identifierHash?: string | null;
}): Promise<LookupResponse> {
  return callRpc<LookupResponse>("lookup", {
    p_link_id: input.linkId,
    p_name_hash: input.nameHash,
    p_identifier_hash: input.identifierHash ?? null,
    p_device_id: getDeviceId(),
  });
}

/**
 * The bucket is private. Storage RLS only allows signing a template that
 * belongs to a live event of an active organization, so a paused or expired
 * event cannot hand out its design even if someone kept an old path.
 */
export async function getTemplateUrl(
  path: string,
): Promise<{ status: "ok"; url: string } | { status: "not_found" }> {
  const { data, error } = await getSupabase()
    .storage.from("templates")
    .createSignedUrl(path, 300);

  if (error || !data?.signedUrl) {
    return { status: "not_found" };
  }

  return { status: "ok", url: data.signedUrl };
}

export async function recordDownload(input: {
  linkId: string;
  eventId: string;
  categoryId: string;
}): Promise<void> {
  try {
    await callRpc("record_download", {
      p_link_id: input.linkId,
      p_event_id: input.eventId,
      p_category_id: input.categoryId,
    });
  } catch {
    // Counting a download must never block the student from getting the file.
  }
}

/* ------------------------------------------------------------------ */
/* Organizer                                                           */
/* ------------------------------------------------------------------ */

export type CreatedOrganization = {
  id: string;
  link_id: string;
  name: string;
  department_or_club: string;
  public_contact: string | null;
  salt: string;
  created_at: string;
};

export type CreateOrganizationResponse =
  | { status: "ok"; organization: CreatedOrganization }
  | { status: "rate_limited"; retry_after_seconds: number }
  | { status: "error"; code: string };

export async function createOrganization(input: {
  name: string;
  departmentOrClub: string;
  publicContact: string | null;
  linkId: string;
  salt: string;
  editKeyHash: string;
}): Promise<CreateOrganizationResponse> {
  return callRpc<CreateOrganizationResponse>("create_organization", {
    p_name: input.name,
    p_department_or_club: input.departmentOrClub,
    p_public_contact: input.publicContact,
    p_link_id: input.linkId,
    p_salt: input.salt,
    p_edit_key_hash: input.editKeyHash,
    p_device_id: getDeviceId(),
  });
}

export type OrganizerOrganization = {
  id: string;
  link_id: string;
  name: string;
  department_or_club: string;
  public_contact: string | null;
  logo_path: string | null;
  created_at: string;
};

export type VerifyEditKeyResponse =
  | { status: "ok"; organization: OrganizerOrganization }
  | { status: "invalid_key" }
  | { status: "rate_limited"; retry_after_seconds: number };

export async function verifyEditKey(editKeyHash: string): Promise<VerifyEditKeyResponse> {
  return callRpc<VerifyEditKeyResponse>("verify_edit_key", {
    p_edit_key_hash: editKeyHash,
    p_device_id: getDeviceId(),
  });
}

export type EventStatus = "draft" | "live" | "paused" | "expired";

export type DashboardCategory = {
  id: string;
  label: string;
  sort_order: number;
  template_path: string | null;
  design_settings: DesignSettings;
  downloads: number;
  participant_count: number;
};

export type DashboardEvent = {
  id: string;
  name: string;
  date: string;
  description: string | null;
  status: EventStatus;
  expiry_date: string | null;
  default_category_id: string | null;
  searches: number;
  downloads: number;
  not_found: number;
  categories: DashboardCategory[];
};

export type DashboardResponse =
  | {
      status: "ok";
      organization: OrganizerOrganization & {
        status: "active" | "disabled";
        salt: string;
      };
      events: DashboardEvent[];
    }
  | { status: "invalid_key" };

export async function fetchDashboard(editKeyHash: string): Promise<DashboardResponse> {
  return callRpc<DashboardResponse>("organizer_get_dashboard", {
    p_edit_key_hash: editKeyHash,
  });
}

export type CreatedEvent = {
  id: string;
  name: string;
  date: string;
  description: string | null;
  status: EventStatus;
  default_category_id: string | null;
};

export async function createEvent(input: {
  editKeyHash: string;
  name: string;
  date: string;
  description: string | null;
}): Promise<{ status: "ok"; event: CreatedEvent } | { status: "invalid_key" }> {
  return callRpc("organizer_create_event", {
    p_edit_key_hash: input.editKeyHash,
    p_name: input.name,
    p_date: input.date,
    p_description: input.description,
  });
}

export async function createCategory(input: {
  editKeyHash: string;
  eventId: string;
  label: string;
  sortOrder: number;
  templatePath?: string | null;
  designSettings?: DesignSettings;
}): Promise<
  | { status: "ok"; category: { id: string } }
  | { status: "invalid_key" }
  | { status: "error"; code: string }
> {
  return callRpc("organizer_create_category", {
    p_edit_key_hash: input.editKeyHash,
    p_event_id: input.eventId,
    p_label: input.label,
    p_sort_order: input.sortOrder,
    p_template_path: input.templatePath ?? null,
    p_design_settings: input.designSettings ?? {},
  });
}

export async function updateCategory(input: {
  editKeyHash: string;
  categoryId: string;
  templatePath: string | null;
  designSettings: DesignSettings;
}): Promise<
  { status: "ok" } | { status: "invalid_key" } | { status: "error"; code: string }
> {
  return callRpc("organizer_update_category", {
    p_edit_key_hash: input.editKeyHash,
    p_category_id: input.categoryId,
    p_template_path: input.templatePath,
    p_design_settings: input.designSettings,
  });
}

export async function deleteCategory(input: {
  editKeyHash: string;
  categoryId: string;
}): Promise<
  { status: "ok" } | { status: "invalid_key" } | { status: "error"; code: string }
> {
  return callRpc("organizer_delete_category", {
    p_edit_key_hash: input.editKeyHash,
    p_category_id: input.categoryId,
  });
}

export type TemplateUploadResponse =
  | { status: "ok"; template_path: string }
  | { status: "invalid_key" }
  | { status: "error"; code: string };

/**
 * Sends the compressed image to the upload function. That function checks the
 * edit key hash, confirms the category belongs to the caller, and writes to
 * the private bucket with the service role. The service key never reaches the
 * browser.
 */
export async function uploadTemplate(input: {
  editKeyHash: string;
  eventId: string;
  categoryId: string;
  blob: Blob;
  contentType: "image/png" | "image/jpeg" | "image/webp";
}): Promise<TemplateUploadResponse> {
  const { url, anonKey } = getSupabaseConfig();
  const dataBase64 = await blobToBase64(input.blob);

  let response: Response;

  try {
    response = await fetch(`${url}/functions/v1/upload-template`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        edit_key_hash: input.editKeyHash,
        event_id: input.eventId,
        category_id: input.categoryId,
        content_type: input.contentType,
        data_base64: dataBase64,
      }),
    });
  } catch {
    return { status: "error", code: "network_error" };
  }

  let body: { status?: string; code?: string; template_path?: string } | null = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status === 403 && body?.status === "invalid_key") {
    return { status: "invalid_key" };
  }

  if (!response.ok || body?.status !== "ok" || !body.template_path) {
    return { status: "error", code: body?.code ?? "upload_failed" };
  }

  return { status: "ok", template_path: body.template_path };
}

export type TemplateSignResponse =
  | { status: "ok"; url: string }
  | { status: "invalid_key" }
  | { status: "error"; code: string };

/**
 * Draft templates are not readable through the normal storage policy, so the
 * designer asks the upload function for a short-lived signed URL. That function
 * confirms the category belongs to the caller before signing.
 */
export async function signTemplate(input: {
  editKeyHash: string;
  categoryId: string;
}): Promise<TemplateSignResponse> {
  const { url, anonKey } = getSupabaseConfig();

  let response: Response;

  try {
    response = await fetch(`${url}/functions/v1/upload-template`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "sign",
        edit_key_hash: input.editKeyHash,
        category_id: input.categoryId,
      }),
    });
  } catch {
    return { status: "error", code: "network_error" };
  }

  let body: { status?: string; code?: string; url?: string } | null = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status === 403 && body?.status === "invalid_key") {
    return { status: "invalid_key" };
  }

  if (!response.ok || body?.status !== "ok" || !body.url) {
    return { status: "error", code: body?.code ?? "sign_failed" };
  }

  return { status: "ok", url: body.url };
}

export async function setEventStatus(input: {
  editKeyHash: string;
  eventId: string;
  status: EventStatus;
  expiryDate?: string | null;
}): Promise<
  { status: "ok" } | { status: "invalid_key" } | { status: "error"; code: string }
> {
  return callRpc("organizer_set_event_status", {
    p_edit_key_hash: input.editKeyHash,
    p_event_id: input.eventId,
    p_status: input.status,
    p_expiry_date: input.expiryDate ?? null,
  });
}

export type ParticipantRow = {
  name_hash: string;
  category_id: string;
  identifier_hash: string | null;
  position_text: string | null;
  duplicate_flag: boolean;
};

export async function addParticipants(input: {
  editKeyHash: string;
  eventId: string;
  rows: ParticipantRow[];
}): Promise<
  | { status: "ok"; inserted: number; skipped: number }
  | { status: "invalid_key" }
  | { status: "error"; code: string }
> {
  return callRpc("organizer_add_participants", {
    p_edit_key_hash: input.editKeyHash,
    p_event_id: input.eventId,
    p_rows: input.rows,
  });
}

export async function clearParticipants(input: {
  editKeyHash: string;
  eventId: string;
}): Promise<{ status: "ok" } | { status: "invalid_key" } | { status: "error"; code: string }> {
  return callRpc("organizer_clear_participants", {
    p_edit_key_hash: input.editKeyHash,
    p_event_id: input.eventId,
  });
}

export async function deleteEvent(input: {
  editKeyHash: string;
  eventId: string;
}): Promise<{ status: "ok" } | { status: "invalid_key" } | { status: "error"; code: string }> {
  return callRpc("organizer_delete_event", {
    p_edit_key_hash: input.editKeyHash,
    p_event_id: input.eventId,
  });
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export type AdminOrganization = {
  id: string;
  name: string;
  department_or_club: string;
  link_id: string;
  status: "active" | "disabled";
  created_at: string;
  event_count: number;
  category_count: number;
  participant_count: number;
  lookup_count: number;
  not_found_count: number;
};

export type AdminError =
  | { status: "invalid_secret" }
  | { status: "rate_limited"; retry_after_seconds: number }
  | { status: "error"; code: string };

export type AdminListResponse =
  | { status: "ok"; organizations: AdminOrganization[] }
  | AdminError;

/**
 * The admin secret is kept in memory by the page and sent only with these
 * calls. It is never written to localStorage or the URL.
 */
export async function adminListOrganizations(secret: string): Promise<AdminListResponse> {
  return callRpc<AdminListResponse>("admin_list_organizations", {
    p_secret: secret,
    p_device_id: getDeviceId(),
  });
}

export async function adminSetOrganizationStatus(input: {
  secret: string;
  organizationId: string;
  status: "active" | "disabled";
}): Promise<{ status: "ok" } | AdminError> {
  return callRpc("admin_set_organization_status", {
    p_secret: input.secret,
    p_organization_id: input.organizationId,
    p_status: input.status,
    p_device_id: getDeviceId(),
  });
}

export async function adminRegenerateEditKey(input: {
  secret: string;
  organizationId: string;
  newEditKeyHash: string;
}): Promise<{ status: "ok" } | AdminError> {
  return callRpc("admin_regenerate_edit_key", {
    p_secret: input.secret,
    p_organization_id: input.organizationId,
    p_new_edit_key_hash: input.newEditKeyHash,
    p_device_id: getDeviceId(),
  });
}

export async function adminDeleteOrganization(input: {
  secret: string;
  organizationId: string;
}): Promise<{ status: "ok" } | AdminError> {
  return callRpc("admin_delete_organization", {
    p_secret: input.secret,
    p_organization_id: input.organizationId,
    p_device_id: getDeviceId(),
  });
}
