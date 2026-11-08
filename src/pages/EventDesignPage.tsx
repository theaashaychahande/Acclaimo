import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { NoticePanel, PageIntro } from "../components/layout/PageIntro";
import { buttonClasses } from "../components/ui/Button";
import { ArrowLeft, Check, Plus, Upload } from "../components/ui/Icons";
import {
  createCategory,
  deleteCategory,
  fetchDashboard,
  signTemplate,
  updateCategory,
  uploadTemplate,
  type DashboardCategory,
  type DashboardEvent,
  type DashboardResponse,
} from "../lib/api";
import {
  CERTIFICATE_FONTS,
  loadTemplateImage,
  renderCertificate,
  renderedCanvasSize,
  resolveDesign,
  type DesignSettings,
  type ResolvedDesign,
  type TextAlign,
  type TextBox,
  type TextCasing,
} from "../lib/certificate";
import { prepareTemplate, type PreparedTemplate } from "../lib/template";
import { clearSession, loadSession } from "../lib/session";
import { describeError } from "../lib/errors";

type ReadyData = Extract<DashboardResponse, { status: "ok" }>;

type PageState =
  | { kind: "loading" }
  | { kind: "ready"; data: ReadyData }
  | { kind: "error"; message: string };

type Notice = { tone: "ok" | "error"; text: string };

type BoxKey = "name" | "position";

type ImageState = "idle" | "loading" | "ready" | "none" | "error";

const DEFAULT_WIDTH = 1600;
const DEFAULT_HEIGHT = 1131;

const inputClass =
  "mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted";

export function EventDesignPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [session] = useState(() => loadSession());
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    if (!session) {
      navigate("/login", { replace: true });
      return;
    }

    let cancelled = false;

    fetchDashboard(session.editKeyHash)
      .then((response) => {
        if (cancelled) return;

        if (response.status === "invalid_key") {
          clearSession();
          navigate("/login", { replace: true });
          return;
        }

        const event = response.events.find((entry) => entry.id === eventId);

        if (!event) {
          setState({
            kind: "error",
            message: "That event could not be found. It may have been deleted.",
          });
          return;
        }

        setState({ kind: "ready", data: response });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: describeError(
            error,
            "We could not load this event. Please reload the page.",
          ),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [session, navigate, eventId]);

  const expire = useCallback(() => {
    clearSession();
    navigate("/login", { replace: true });
  }, [navigate]);

  const back = useCallback(() => navigate("/dashboard"), [navigate]);

  const refresh = useCallback(async () => {
    if (!session) return;

    const response = await fetchDashboard(session.editKeyHash);

    if (response.status === "invalid_key") {
      expire();
      return;
    }

    if (response.events.some((entry) => entry.id === eventId)) {
      setState({ kind: "ready", data: response });
    }
  }, [session, eventId, expire]);

  const patchCategory = useCallback(
    (categoryId: string, patch: Partial<DashboardCategory>) => {
      setState((previous) => {
        if (previous.kind !== "ready") return previous;

        return {
          kind: "ready",
          data: {
            ...previous.data,
            events: previous.data.events.map((event) =>
              event.id !== eventId
                ? event
                : {
                    ...event,
                    categories: event.categories.map((category) =>
                      category.id === categoryId
                        ? { ...category, ...patch }
                        : category,
                    ),
                  },
            ),
          },
        };
      });
    },
    [eventId],
  );

  if (!session) return null;

  if (state.kind === "loading") {
    return (
      <PageIntro eyebrow="Certificate designer" title="Loading the designer">
        <div className="skeleton h-72 w-full rounded" aria-live="polite" />
      </PageIntro>
    );
  }

  if (state.kind === "error") {
    return (
      <PageIntro eyebrow="Certificate designer" title="This event is not available">
        <NoticePanel title="We could not open the designer.">
          <p>{state.message}</p>
          <button
            type="button"
            onClick={back}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </button>
        </NoticePanel>
      </PageIntro>
    );
  }

  const event = state.data.events.find((entry) => entry.id === eventId);

  if (!event) return null;

  return (
    <PageIntro
      eyebrow="Certificate designer"
      title={event.name}
      intro="Upload the certificate image your department already uses, then drag the boxes to place the student name and the position text."
    >
      <DesignerWorkspace
        event={event}
        organizationName={state.data.organization.name}
        editKeyHash={session.editKeyHash}
        onBack={back}
        onRefresh={refresh}
        onPatchCategory={patchCategory}
        onSessionExpired={expire}
      />
    </PageIntro>
  );
}

function DesignerWorkspace({
  event,
  organizationName,
  editKeyHash,
  onBack,
  onRefresh,
  onPatchCategory,
  onSessionExpired,
}: {
  event: DashboardEvent;
  organizationName: string;
  editKeyHash: string;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onPatchCategory: (categoryId: string, patch: Partial<DashboardCategory>) => void;
  onSessionExpired: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    () => event.categories[0]?.id ?? null,
  );
  const [design, setDesign] = useState<ResolvedDesign>(() =>
    resolveDesign(null, DEFAULT_WIDTH, DEFAULT_HEIGHT),
  );
  const [templatePath, setTemplatePath] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageState, setImageState] = useState<ImageState>("idle");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [selectedBox, setSelectedBox] = useState<BoxKey>("name");
  const [sampleName, setSampleName] = useState("Aashay Chahande");
  const [samplePosition, setSamplePosition] = useState("Winner");
  const [templateWarning, setTemplateWarning] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const loadSequence = useRef(0);
  const savedDesign = useRef<DesignSettings>({});

  const category =
    event.categories.find((entry) => entry.id === selectedId) ??
    event.categories[0] ??
    null;

  const sourceWidth = image?.naturalWidth ?? DEFAULT_WIDTH;
  const sourceHeight = image?.naturalHeight ?? DEFAULT_HEIGHT;
  const rendered = renderedCanvasSize(sourceWidth, sourceHeight);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(null), 6000);

    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const current =
      event.categories.find((entry) => entry.id === selectedId) ??
      event.categories[0] ??
      null;
    const sequence = ++loadSequence.current;

    if (!current) {
      savedDesign.current = {};
      setTemplatePath(null);
      setImage(null);
      setImageState("none");
      setDesign(resolveDesign(null, DEFAULT_WIDTH, DEFAULT_HEIGHT));
      setDirty(false);
      return;
    }

    const saved = current.design_settings ?? {};
    savedDesign.current = saved;
    setTemplatePath(current.template_path);
    setImage(null);
    setImageState(current.template_path ? "loading" : "none");
    setTemplateWarning(null);
    setRenderError(null);
    setSelectedBox("name");
    setDirty(false);
    setDesign(resolveDesign(saved, DEFAULT_WIDTH, DEFAULT_HEIGHT));

    if (!current.template_path) return;

    signTemplate({ editKeyHash, categoryId: current.id })
      .then(async (result) => {
        if (sequence !== loadSequence.current) return;

        if (result.status === "invalid_key") {
          onSessionExpired();
          return;
        }

        if (result.status !== "ok") {
          setImageState("error");
          return;
        }

        try {
          const loaded = await loadTemplateImage(result.url);

          if (sequence !== loadSequence.current) return;

          setImage(loaded);
          setDesign(
            resolveDesign(saved, loaded.naturalWidth, loaded.naturalHeight),
          );
          setImageState("ready");
        } catch {
          if (sequence === loadSequence.current) setImageState("error");
        }
      })
      .catch(() => {
        if (sequence === loadSequence.current) setImageState("error");
      });
  }, [selectedId, editKeyHash, onSessionExpired]);

  useEffect(() => {
    if (!category) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      renderCertificate({
        template: image,
        design,
        name: sampleName.trim() || "Student name",
        positionText: samplePosition.trim() || null,
        eventName: event.name,
        organizationName,
        categoryLabel: category.label,
      })
        .then((renderedCanvas) => {
          if (cancelled) return;

          const target = canvasRef.current;
          if (!target) return;

          target.width = renderedCanvas.width;
          target.height = renderedCanvas.height;

          const context = target.getContext("2d");
          if (!context) return;

          context.clearRect(0, 0, target.width, target.height);
          context.drawImage(renderedCanvas, 0, 0);
          setRenderError(null);
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setRenderError(describeError(error, "The preview could not be drawn."));
          }
        });
    }, 60);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    image,
    design,
    sampleName,
    samplePosition,
    event.name,
    organizationName,
    category?.label,
  ]);

  const updateBox = (key: BoxKey, patch: Partial<TextBox>) => {
    setDesign((previous) => {
      if (key === "name") {
        const next = { ...previous.name, ...patch };

        if (patch.fontSize !== undefined) {
          next.minFontSize = Math.min(next.minFontSize, patch.fontSize);
        }

        return { ...previous, name: next };
      }

      const next = { ...previous.position, ...patch };

      if (patch.fontSize !== undefined) {
        next.minFontSize = Math.min(next.minFontSize, patch.fontSize);
      }

      return { ...previous, position: next };
    });
    setDirty(true);
  };

  const togglePosition = (enabled: boolean) => {
    setDesign((previous) => ({
      ...previous,
      position: { ...previous.position, enabled },
    }));
    setDirty(true);

    if (!enabled) setSelectedBox("name");
  };

  const resetPlacement = () => {
    setDesign(resolveDesign(null, sourceWidth, sourceHeight));
    setSelectedBox("name");
    setDirty(true);
    setNotice({ tone: "ok", text: "Placement reset. Save to keep it." });
  };

  const leave = () => {
    if (dirty && !window.confirm("Leave without saving the placement changes?")) {
      return;
    }

    onBack();
  };

  const save = async () => {
    if (!category || saving) return;

    const sequence = loadSequence.current;
    setSaving(true);

    try {
      const response = await updateCategory({
        editKeyHash,
        categoryId: category.id,
        templatePath,
        designSettings: design,
      });

      if (response.status === "invalid_key") {
        onSessionExpired();
        return;
      }

      if (response.status !== "ok") {
        setNotice({ tone: "error", text: designMessage(response.code) });
        return;
      }

      onPatchCategory(category.id, {
        template_path: templatePath,
        design_settings: design,
      });

      if (sequence === loadSequence.current) {
        setDirty(false);
        setNotice({
          tone: "ok",
          text: `Saved. Students who pick ${category.label} will see this layout.`,
        });
      }
    } catch (error) {
      setNotice({
        tone: "error",
        text: describeError(error, "The design was not saved. Please try again."),
      });
    } finally {
      setSaving(false);
    }
  };

  const pickFile = () => fileInput.current?.click();

  const onFileChange = async (change: ChangeEvent<HTMLInputElement>) => {
    const file = change.target.files?.[0];
    change.target.value = "";

    if (!file || !category) return;

    const sequence = loadSequence.current;
    setUploading(true);
    setNotice(null);
    setTemplateWarning(null);

    let prepared: PreparedTemplate | null = null;

    try {
      prepared = await prepareTemplate(file);
      setTemplateWarning(prepared.warning);

      const response = await uploadTemplate({
        editKeyHash,
        eventId: event.id,
        categoryId: category.id,
        blob: prepared.blob,
        contentType: prepared.contentType,
      });

      if (sequence !== loadSequence.current) return;

      if (response.status === "invalid_key") {
        onSessionExpired();
        return;
      }

      if (response.status !== "ok") {
        setNotice({ tone: "error", text: uploadMessage(response.code) });
        return;
      }

      const loaded = await loadTemplateImage(prepared.objectUrl);
      URL.revokeObjectURL(prepared.objectUrl);
      prepared = null;

      if (sequence !== loadSequence.current) return;

      setTemplatePath(response.template_path);
      onPatchCategory(category.id, { template_path: response.template_path });
      setImage(loaded);
      setImageState("ready");
      setDesign(
        resolveDesign(savedDesign.current, loaded.naturalWidth, loaded.naturalHeight),
      );
      setDirty(false);
      setNotice({
        tone: "ok",
        text: "Image uploaded. Drag the boxes into place, then save the design.",
      });
    } catch (error) {
      if (sequence === loadSequence.current) {
        setNotice({
          tone: "error",
          text: describeError(error, "That image could not be uploaded."),
        });
      }
    } finally {
      if (prepared) URL.revokeObjectURL(prepared.objectUrl);
      setUploading(false);
    }
  };

  const addCategory = async () => {
    if (event.categories.length >= 6) {
      setNotice({ tone: "error", text: "An event can have at most six categories." });
      return;
    }

    const answer = window.prompt(
      "Name this category. For example Winner, Runner Up, or Participant.",
    );

    if (!answer) return;

    const label = answer.trim();

    if (!label) return;

    try {
      const response = await createCategory({
        editKeyHash,
        eventId: event.id,
        label,
        sortOrder: Math.min(event.categories.length, 5),
      });

      if (response.status === "invalid_key") {
        onSessionExpired();
        return;
      }

      if (response.status !== "ok") {
        setNotice({ tone: "error", text: categoryMessage(response.code) });
        return;
      }

      await onRefresh();
      setSelectedId(response.category.id);
      setNotice({
        tone: "ok",
        text: `"${label}" added. Upload its certificate image next.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: describeError(error, "The category was not added."),
      });
    }
  };

  const removeCategory = async () => {
    if (!category) return;

    if (event.default_category_id === category.id) {
      setNotice({
        tone: "error",
        text: "The default category cannot be deleted. Rename or design it instead.",
      });
      return;
    }

    if (category.participant_count > 0) {
      setNotice({
        tone: "error",
        text: "Remove this category's participants before deleting it.",
      });
      return;
    }

    if (!window.confirm(`Delete the "${category.label}" category?`)) return;

    try {
      const response = await deleteCategory({
        editKeyHash,
        categoryId: category.id,
      });

      if (response.status === "invalid_key") {
        onSessionExpired();
        return;
      }

      if (response.status !== "ok") {
        setNotice({ tone: "error", text: categoryMessage(response.code) });
        return;
      }

      const remaining = event.categories.filter((entry) => entry.id !== category.id);
      await onRefresh();
      setSelectedId(remaining[0]?.id ?? null);
      setNotice({ tone: "ok", text: "Category deleted." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: describeError(error, "The category was not deleted."),
      });
    }
  };

  if (!category) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={leave}
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </button>
          {notice ? <NoticeLine notice={notice} /> : null}
        </div>

        <NoticePanel title="Add a category first.">
          <p>
            A category is one design, for example Participant, Winner, or Runner Up.
            Each category gets its own certificate image and text placement.
          </p>
          <button
            type="button"
            onClick={() => void addCategory()}
            className={buttonClasses({ variant: "primary", size: "sm" })}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add category
          </button>
        </NoticePanel>
      </div>
    );
  }

  const activeBox = selectedBox === "name" ? design.name : design.position;
  const positionEnabled = design.position.enabled;
  const missingTemplates = event.categories.filter(
    (entry) => !entry.template_path,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={leave}
          className={buttonClasses({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to dashboard
        </button>

        {notice ? <NoticeLine notice={notice} /> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {event.categories.map((entry) => {
          const active = entry.id === category.id;

          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                if (entry.id === category.id) return;
                if (dirty && !window.confirm("Discard the unsaved placement changes?")) {
                  return;
                }
                setSelectedId(entry.id);
              }}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${
                active
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line bg-surface text-ink-soft hover:bg-surface-muted"
              }`}
            >
              {entry.label}
              {entry.template_path ? null : (
                <span
                  className="size-1.5 rounded-full bg-danger"
                  title="No certificate image yet"
                />
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => void addCategory()}
          disabled={event.categories.length >= 6}
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add category
        </button>

        <button
          type="button"
          onClick={() => void removeCategory()}
          disabled={
            event.default_category_id === category.id ||
            category.participant_count > 0
          }
          title={
            event.default_category_id === category.id
              ? "The default category cannot be deleted"
              : category.participant_count > 0
                ? "Remove the participants first"
                : "Delete this category"
          }
          className={buttonClasses({
            variant: "destructive",
            size: "sm",
            className: "ml-auto",
          })}
        >
          Delete category
        </button>
      </div>

      {missingTemplates > 0 ? (
        <p className="rounded-[8px] border border-line bg-surface-muted px-4 py-3 text-sm text-muted">
          {missingTemplates === 1
            ? "One category still uses the built-in certificate design. Upload an image for it."
            : `${missingTemplates} categories still use the built-in certificate design. Upload an image for each one.`}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section className="space-y-4">
          <div className="rounded-[8px] border border-line bg-surface-sunken p-3 sm:p-5">
            <div className="relative mx-auto max-w-3xl">
              <canvas
                ref={canvasRef}
                className="block h-auto w-full rounded-[4px] bg-surface shadow-sm"
                aria-label="Certificate preview with sample text"
              />

              <div
                ref={overlayRef}
                className="absolute inset-0"
                aria-hidden={false}
              >
                <PlacementBox
                  kind="name"
                  box={design.name}
                  renderedHeight={rendered.height}
                  selected={selectedBox === "name"}
                  containerRef={overlayRef}
                  onSelect={() => setSelectedBox("name")}
                  onChange={(patch) => updateBox("name", patch)}
                />

                {positionEnabled ? (
                  <PlacementBox
                    kind="position"
                    box={design.position}
                    renderedHeight={rendered.height}
                    selected={selectedBox === "position"}
                    containerRef={overlayRef}
                    onSelect={() => setSelectedBox("position")}
                    onChange={(patch) => updateBox("position", patch)}
                  />
                ) : null}
              </div>

              {imageState === "loading" ? (
                <div className="absolute inset-0 grid place-items-center rounded-[4px] bg-surface/80">
                  <p className="text-sm text-muted" role="status">
                    Loading the certificate image…
                  </p>
                </div>
              ) : null}
            </div>

            <p className="mt-4 text-center text-xs text-muted">
              Drag a box to move it. Drag the small handle to change its width.
              Arrow keys nudge the selected box.
            </p>

            {imageState === "none" ? (
              <p className="mt-2 text-center text-xs text-muted">
                This is the built-in design. Upload your own image to replace it.
              </p>
            ) : null}

            {imageState === "error" ? (
              <p className="mt-2 text-center text-xs text-danger" role="status">
                The uploaded image could not be loaded. Try replacing it.
              </p>
            ) : null}

            {renderError ? (
              <p className="mt-2 text-center text-xs text-danger" role="status">
                {renderError}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-ink">
              Sample name
              <input
                value={sampleName}
                onChange={(change) => setSampleName(change.target.value)}
                maxLength={80}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium text-ink">
              Sample position
              <input
                value={samplePosition}
                onChange={(change) => setSamplePosition(change.target.value)}
                maxLength={40}
                className={inputClass}
              />
            </label>
          </div>
        </section>

        <aside className="space-y-5 rounded-[8px] border border-line bg-surface p-5">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-xl font-semibold">Certificate image</h2>
              <span
                className={`text-xs font-medium ${
                  templatePath ? "text-accent" : "text-danger"
                }`}
              >
                {templatePath ? "Uploaded" : "Not uploaded"}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted">
              PNG, JPG, or WebP. Up to 12 MB. We shrink it in your browser before
              uploading, so phone photos work too.
            </p>

            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(change) => void onFileChange(change)}
              className="sr-only"
            />

            <button
              type="button"
              onClick={pickFile}
              disabled={uploading}
              className={buttonClasses({
                variant: "secondary",
                size: "sm",
                className: "mt-3",
              })}
            >
              <Upload className="size-4" aria-hidden="true" />
              {uploading
                ? "Uploading…"
                : templatePath
                  ? "Replace image"
                  : "Upload certificate image"}
            </button>

            {templateWarning ? (
              <p className="mt-3 text-xs text-muted" role="status">
                {templateWarning}
              </p>
            ) : null}
          </div>

          <div className="border-t border-line pt-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-xl font-semibold">Text placement</h2>
              {dirty ? (
                <span className="text-xs font-medium text-accent">Unsaved</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  <Check className="size-3.5" aria-hidden="true" />
                  Saved
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={selectedBox === "name"}
                onClick={() => setSelectedBox("name")}
                className={buttonClasses({
                  variant: selectedBox === "name" ? "primary" : "secondary",
                  size: "sm",
                })}
              >
                Student name
              </button>
              <button
                type="button"
                aria-pressed={selectedBox === "position"}
                onClick={() => setSelectedBox("position")}
                disabled={!positionEnabled}
                className={buttonClasses({
                  variant: selectedBox === "position" ? "primary" : "secondary",
                  size: "sm",
                })}
              >
                Position text
              </button>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={positionEnabled}
                onChange={(change) => togglePosition(change.target.checked)}
                className="size-4 accent-accent"
              />
              Print the position text
            </label>

            <p className="mt-2 text-xs text-muted">
              Position text comes from the participant list, for example Winner or
              Participant. People without a position keep a plain name certificate.
            </p>
          </div>

          <div className="space-y-4 border-t border-line pt-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-ink">
                Font
                <select
                  value={activeBox.fontFamily}
                  onChange={(change) =>
                    updateBox(selectedBox, { fontFamily: change.target.value })
                  }
                  className={inputClass}
                >
                  {CERTIFICATE_FONTS.map((font) => (
                    <option key={font.label} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-ink">
                Colour
                <input
                  type="color"
                  value={activeBox.color}
                  onChange={(change) =>
                    updateBox(selectedBox, { color: change.target.value })
                  }
                  className="mt-2 h-[42px] w-full rounded-md border border-line bg-surface px-1"
                />
              </label>
            </div>

            <RangeField
              label="Text size"
              value={activeBox.fontSize}
              min={8}
              max={Math.max(
                48,
                Math.round(rendered.height * 0.2),
                activeBox.fontSize,
              )}
              suffix=" px"
              onChange={(value) => updateBox(selectedBox, { fontSize: value })}
            />

            <RangeField
              label="Box width"
              value={activeBox.width}
              min={10}
              max={100}
              suffix="%"
              onChange={(value) => updateBox(selectedBox, { width: value })}
            />

            <RangeField
              label="Letter spacing"
              value={activeBox.letterSpacing}
              min={0}
              max={8}
              step={0.5}
              suffix=" px"
              onChange={(value) =>
                updateBox(selectedBox, { letterSpacing: value })
              }
            />

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-ink">
                Align
                <select
                  value={activeBox.align}
                  onChange={(change) =>
                    updateBox(selectedBox, {
                      align: change.target.value as TextAlign,
                    })
                  }
                  className={inputClass}
                >
                  <option value="left">Left</option>
                  <option value="center">Centre</option>
                  <option value="right">Right</option>
                </select>
              </label>

              <label className="text-sm font-medium text-ink">
                Letter case
                <select
                  value={activeBox.casing}
                  onChange={(change) =>
                    updateBox(selectedBox, {
                      casing: change.target.value as TextCasing,
                    })
                  }
                  className={inputClass}
                >
                  <option value="keep">As typed</option>
                  <option value="title">Title Case</option>
                  <option value="upper">UPPERCASE</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={activeBox.bold}
                  onChange={(change) =>
                    updateBox(selectedBox, { bold: change.target.checked })
                  }
                  className="size-4 accent-accent"
                />
                Bold
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={activeBox.wrap}
                  onChange={(change) =>
                    updateBox(selectedBox, { wrap: change.target.checked })
                  }
                  className="size-4 accent-accent"
                />
                Wrap long text
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <RangeField
                label="Horizontal"
                value={activeBox.x}
                min={0}
                max={100}
                step={0.5}
                suffix="%"
                onChange={(value) => updateBox(selectedBox, { x: value })}
              />
              <RangeField
                label="Vertical"
                value={activeBox.y}
                min={0}
                max={100}
                step={0.5}
                suffix="%"
                onChange={(value) => updateBox(selectedBox, { y: value })}
              />
            </div>

            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !dirty}
                className={buttonClasses({ variant: "primary", size: "sm" })}
              >
                {saving ? "Saving…" : "Save design"}
              </button>
              <button
                type="button"
                onClick={resetPlacement}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                Reset placement
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PlacementBox({
  kind,
  box,
  renderedHeight,
  selected,
  containerRef,
  onSelect,
  onChange,
}: {
  kind: BoxKey;
  box: TextBox;
  renderedHeight: number;
  selected: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onChange: (patch: Partial<TextBox>) => void;
}) {
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    boxX: number;
    boxY: number;
    rect: DOMRect;
  } | null>(null);
  const resize = useRef<{
    pointerId: number;
    x: number;
    align: TextAlign;
    rect: DOMRect;
  } | null>(null);

  let left = box.x;

  if (box.align === "center") left -= box.width / 2;
  else if (box.align === "right") left -= box.width;

  const height = Math.min(
    100,
    Math.max(3, ((box.fontSize * 1.18) / renderedHeight) * 100),
  );

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      boxX: box.x,
      boxY: box.y,
      rect,
    };

    onSelect();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;

    const x = state.boxX + ((event.clientX - state.startX) / state.rect.width) * 100;
    const y =
      state.boxY + ((event.clientY - state.startY) / state.rect.height) * 100;

    onChange({ x: round(clamp(x, 0, 100)), y: round(clamp(y, 0, 100)) });
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    event.stopPropagation();
    event.preventDefault();
    resize.current = {
      pointerId: event.pointerId,
      x: box.x,
      align: box.align,
      rect,
    };
    onSelect();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = resize.current;
    if (!state || state.pointerId !== event.pointerId) return;

    const pointer = ((event.clientX - state.rect.left) / state.rect.width) * 100;
    const width =
      state.align === "center"
        ? Math.abs(pointer - state.x) * 2
        : state.align === "left"
          ? pointer - state.x
          : state.x - pointer;

    event.stopPropagation();
    onChange({ width: round(clamp(width, 10, 100)) });
  };

  const endResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (resize.current?.pointerId === event.pointerId) resize.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const nudge = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 5 : 0.5;
    let dx = 0;
    let dy = 0;

    if (event.key === "ArrowLeft") dx = -step;
    else if (event.key === "ArrowRight") dx = step;
    else if (event.key === "ArrowUp") dy = -step;
    else if (event.key === "ArrowDown") dy = step;
    else return;

    event.preventDefault();
    onChange({
      x: round(clamp(box.x + dx, 0, 100)),
      y: round(clamp(box.y + dy, 0, 100)),
    });
  };

  return (
    <div
      role="group"
      aria-label={`${kind === "name" ? "Student name" : "Position text"} placement`}
      tabIndex={0}
      onKeyDown={nudge}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`absolute cursor-move touch-none rounded-[3px] border-2 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
        selected
          ? "border-accent bg-accent/10"
          : "border-dashed border-accent/60 bg-accent/5"
      }`}
      style={{
        left: `${left}%`,
        top: `${box.y - height / 2}%`,
        width: `${box.width}%`,
        height: `${height}%`,
        minHeight: "12px",
      }}
    >
      <span
        className={`pointer-events-none absolute left-1 top-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
          kind === "name" ? "bg-accent text-accent-ink" : "bg-ink text-white"
        }`}
      >
        {kind === "name" ? "Name" : "Position"}
      </span>

      {selected ? (
        <button
          type="button"
          aria-label="Resize this box"
          onPointerDown={startResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          className="absolute right-0 top-1/2 size-3 -translate-y-1/2 translate-x-1/2 cursor-ew-resize touch-none rounded-sm border border-white bg-accent"
        />
      ) : null}
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const display = Math.round(value * 10) / 10;

  return (
    <label className="block text-sm font-medium text-ink">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="font-mono text-xs font-normal text-muted">
          {display}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(change) => onChange(Number(change.target.value))}
        className="mt-2 w-full accent-accent"
      />
    </label>
  );
}

function NoticeLine({ notice }: { notice: Notice }) {
  return (
    <p
      role="status"
      className={`max-w-xl rounded-[8px] border px-4 py-2 text-sm ${
        notice.tone === "error"
          ? "border-danger bg-danger-soft text-ink"
          : "border-accent-soft bg-accent-soft text-ink"
      }`}
    >
      {notice.text}
    </p>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function uploadMessage(code: string): string {
  switch (code) {
    case "image_too_large":
      return "That image is still over 5 MB after resizing. Try a simpler export.";
    case "invalid_image_type":
      return "Choose a PNG, JPG, or WebP image.";
    case "invalid_image_data":
      return "That file did not look like a real image. Try exporting it again.";
    case "storage_not_configured":
      return "Uploads are not configured on this deployment yet.";
    case "network_error":
      return "The upload was interrupted. Check your connection and try again.";
    default:
      return "The image was not uploaded. Please try again.";
  }
}

function designMessage(code: string): string {
  switch (code) {
    case "category_not_found":
      return "That category no longer exists. Reload the page.";
    case "invalid_template_path":
      return "The image path was rejected. Replace the image and save again.";
    default:
      return "The design was not saved. Please try again.";
  }
}

function categoryMessage(code: string): string {
  switch (code) {
    case "category_limit_reached":
      return "An event can have at most six categories.";
    case "category_has_participants":
      return "Remove this category's participants before deleting it.";
    case "default_category_required":
      return "The default category cannot be deleted.";
    case "invalid_category_label":
      return "Give the category a name between 1 and 40 characters.";
    case "event_not_found":
      return "That event no longer exists.";
    default:
      return "That change was not saved.";
  }
}
