import { useEffect, useState } from "react";
import { buttonClasses } from "../ui/Button";
import {
  removeParticipant,
  updateParticipant,
  type DashboardEvent,
} from "../../lib/api";
import { hashName, hashNameWithIdentifier } from "../../shared";

type Notice = { tone: "ok" | "error"; text: string };

const inputClass =
  "mt-1 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-ink placeholder:text-muted";

function messageFor(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "That change was not saved. Please try again.";
}

export function ParticipantLookup({
  event,
  salt,
  editKeyHash,
  onChanged,
  onNotice,
}: {
  event: DashboardEvent;
  salt: string;
  editKeyHash: string;
  onChanged: () => Promise<void>;
  onNotice: (notice: Notice) => void;
}) {
  const fallbackCategory =
    event.default_category_id ?? event.categories[0]?.id ?? "";
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [categoryId, setCategoryId] = useState(fallbackCategory);
  const [positionText, setPositionText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!event.categories.some((category) => category.id === categoryId)) {
      setCategoryId(fallbackCategory);
    }
  }, [event.categories, fallbackCategory, categoryId]);

  const hashes = async () => {
    const cleanName = name.trim();

    if (!cleanName) {
      onNotice({ tone: "error", text: "Type the participant's name first." });
      return null;
    }

    const nameHash = await hashName(salt, cleanName);
    const identifierHash = identifier.trim()
      ? await hashNameWithIdentifier(salt, cleanName, identifier.trim())
      : null;

    return { nameHash, identifierHash };
  };

  const update = async () => {
    if (busy) return;

    if (!categoryId) {
      onNotice({ tone: "error", text: "Add a category before changing a participant." });
      return;
    }

    setBusy(true);

    try {
      const values = await hashes();
      if (!values) return;

      const response = await updateParticipant({
        editKeyHash,
        eventId: event.id,
        nameHash: values.nameHash,
        identifierHash: values.identifierHash,
        categoryId,
        positionText: positionText.trim() || null,
      });

      if (response.status === "invalid_key") {
        onNotice({ tone: "error", text: "Your session expired. Please log in again." });
        return;
      }

      if (response.status === "error") {
        onNotice({
          tone: "error",
          text:
            response.code === "participant_not_found"
              ? "No participant matched that name. If two people share the name, enter the identifier too."
              : "That participant was not updated. Please try again.",
        });
        return;
      }

      onNotice({ tone: "ok", text: "Participant updated." });
      setName("");
      setIdentifier("");
      setPositionText("");
      await onChanged();
    } catch (error) {
      onNotice({ tone: "error", text: messageFor(error) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;

    if (!name.trim()) {
      onNotice({ tone: "error", text: "Type the participant's name first." });
      return;
    }

    if (window.prompt("Type REMOVE to remove this person from the list.") !== "REMOVE") {
      return;
    }

    setBusy(true);

    try {
      const values = await hashes();
      if (!values) return;

      const response = await removeParticipant({
        editKeyHash,
        eventId: event.id,
        nameHash: values.nameHash,
        identifierHash: values.identifierHash,
      });

      if (response.status === "invalid_key") {
        onNotice({ tone: "error", text: "Your session expired. Please log in again." });
        return;
      }

      if (response.status === "error") {
        onNotice({
          tone: "error",
          text:
            response.code === "participant_not_found"
              ? "No participant matched that name. If two people share the name, enter the identifier too."
              : "That participant was not removed. Please try again.",
        });
        return;
      }

      onNotice({ tone: "ok", text: "Participant removed." });
      setName("");
      setIdentifier("");
      setPositionText("");
      await onChanged();
    } catch (error) {
      onNotice({ tone: "error", text: messageFor(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="mt-4 rounded-[6px] border border-line bg-surface p-3">
      <summary className="cursor-pointer text-sm font-medium text-ink">
        Fix one person
      </summary>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Change a category or position text, or remove one person, without touching the rest of
        the list. The name is hashed here; it is not sent.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-ink">Name</span>
          <input
            value={name}
            onChange={(changeEvent) => setName(changeEvent.target.value)}
            autoComplete="off"
            placeholder="As it appears in the list"
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Identifier (optional)</span>
          <input
            value={identifier}
            onChange={(changeEvent) => setIdentifier(changeEvent.target.value)}
            autoComplete="off"
            placeholder="Only when two people share a name"
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Category</span>
          <select
            value={categoryId}
            onChange={(changeEvent) => setCategoryId(changeEvent.target.value)}
            className={inputClass}
          >
            {event.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
                {category.id === event.default_category_id ? " (default)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Position text (optional)</span>
          <input
            value={positionText}
            onChange={(changeEvent) => setPositionText(changeEvent.target.value)}
            maxLength={60}
            placeholder="Blank removes the position text"
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void update()}
          disabled={busy || event.categories.length === 0}
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          {busy ? "Saving…" : "Update person"}
        </button>
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy}
          className={buttonClasses({ variant: "destructive", size: "sm" })}
        >
          Remove person
        </button>
      </div>
    </details>
  );
}
