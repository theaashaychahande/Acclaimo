import { getSupabase } from "./supabase";
import { getDeviceId } from "./device";
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
}): Promise<{ status: "ok" } | { status: "invalid_key" } | { status: "error"; code: string }> {
  return callRpc("organizer_create_category", {
    p_edit_key_hash: input.editKeyHash,
    p_event_id: input.eventId,
    p_label: input.label,
    p_sort_order: input.sortOrder,
    p_template_path: input.templatePath ?? null,
    p_design_settings: input.designSettings ?? {},
  });
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
