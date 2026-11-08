import { useMemo, useRef, useState } from "react";
import { buttonClasses } from "../ui/Button";
import { Download, Spreadsheet, Upload } from "../ui/Icons";
import {
  addParticipants,
  createCategory,
  replaceParticipants,
  type DashboardEvent,
} from "../../lib/api";
import { downloadBlob } from "../../lib/certificate";
import {
  analyzeImport,
  categoryKey,
  detectColumns,
  detectHeaderRow,
  distinctCategoryValues,
  emptyColumnMap,
  hashImportRows,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  readSpreadsheetFile,
  sampleCsv,
  suggestCategory,
  type CategoryResolution,
  type ColumnKey,
  type ColumnMap,
  type SpreadsheetSheet,
} from "../../lib/spreadsheet";

type Notice = { tone: "ok" | "error"; text: string };

const COLUMN_FIELDS: Array<{ key: ColumnKey; label: string; hint: string }> = [
  { key: "name", label: "Name", hint: "Required" },
  { key: "identifier", label: "Identifier", hint: "Used only when two people share a name" },
  { key: "category", label: "Category", hint: "Chooses the certificate design" },
  { key: "position", label: "Position text", hint: "Printed under the name" },
];

function messageFor(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Please try again.";
}

function importMessage(code: string): string {
  switch (code) {
    case "participant_limit_reached":
      return "Adding this file would pass 5,000 participants. Replace the list or split the event.";
    case "invalid_category":
      return "One of the rows points at a category that no longer exists. Reload and try again.";
    case "event_not_found":
      return "This event no longer exists. Reload the dashboard.";
    case "category_limit_reached":
      return "An event can have at most 6 categories.";
    case "category_label_taken":
      return "A category with that name already exists.";
    case "invalid_category_label":
      return "Category names must be between 1 and 40 characters.";
    default:
      return "Your list was not saved. Nothing was changed. Please try again.";
  }
}

function headerName(sheet: SpreadsheetSheet, row: number, column: number): string {
  const value = sheet.rows[row]?.[column]?.trim();
  return value || `Column ${column + 1}`;
}

function previewRow(row: string[]): string {
  const text = row
    .map((cell) => cell.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(" · ");

  if (!text) return "(empty)";
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

export function ParticipantImport({
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [sheets, setSheets] = useState<SpreadsheetSheet[] | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [columns, setColumns] = useState<ColumnMap>(emptyColumnMap());
  const [resolutions, setResolutions] = useState<Record<string, CategoryResolution>>({});
  const [conflictChoices, setConflictChoices] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const activeSheet = sheets?.[sheetIndex] ?? null;
  const headerCells = activeSheet?.rows[headerRowIndex] ?? [];
  const dataRows = useMemo(
    () => (activeSheet ? activeSheet.rows.slice(headerRowIndex + 1) : []),
    [activeSheet, headerRowIndex],
  );
  const distinct = useMemo(
    () => distinctCategoryValues(dataRows, columns),
    [dataRows, columns],
  );

  const effectiveResolutions = useMemo(() => {
    const result: Record<string, CategoryResolution> = {};

    for (const entry of distinct) {
      const chosen = resolutions[entry.key];
      if (chosen) {
        result[entry.key] = chosen;
        continue;
      }

      const match = event.categories.find(
        (category) => categoryKey(category.label) === entry.key,
      );

      result[entry.key] = match
        ? { action: "existing", categoryId: match.id }
        : { action: "unmapped" };
    }

    return result;
  }, [distinct, resolutions, event.categories]);

  const defaultCategoryId =
    event.default_category_id ?? event.categories[0]?.id ?? null;

  const analysis = useMemo(
    () =>
      analyzeImport({
        rows: dataRows,
        headerRowNumber: headerRowIndex + 1,
        columns,
        categories: event.categories,
        defaultCategoryId,
        resolutions: effectiveResolutions,
        conflictChoices,
      }),
    [
      dataRows,
      headerRowIndex,
      columns,
      event.categories,
      defaultCategoryId,
      effectiveResolutions,
      conflictChoices,
    ],
  );

  const newCategories = distinct.filter(
    (entry) => effectiveResolutions[entry.key]?.action === "new",
  );
  const unresolvedCategories = distinct.filter(
    (entry) => effectiveResolutions[entry.key]?.action === "unmapped",
  );
  const currentParticipants = event.categories.reduce(
    (total, category) => total + category.participant_count,
    0,
  );
  const tooManyCategories = event.categories.length + newCategories.length > 6;
  const tooManyRows = analysis.totalRows > MAX_IMPORT_ROWS;
  const appendWouldOverflow =
    mode === "append" && currentParticipants + analysis.validCount > MAX_IMPORT_ROWS;

  let blockingReason: string | null = null;

  if (sheets && columns.name === null) {
    blockingReason = "Choose the column that contains participant names.";
  } else if (sheets && unresolvedCategories.length > 0) {
    blockingReason = "Map every category value, or send it to the default category.";
  } else if (sheets && analysis.totalRows === 0) {
    blockingReason = "The selected sheet has no data rows below the header.";
  } else if (tooManyRows) {
    blockingReason = `This sheet has ${analysis.totalRows.toLocaleString()} rows. The limit is 5,000.`;
  } else if (tooManyCategories) {
    blockingReason = "An event can have at most 6 categories, including any new ones in this file.";
  } else if (appendWouldOverflow) {
    blockingReason = `Appending would pass 5,000 participants. Choose Replace instead.`;
  } else if (analysis.errorCount > 0) {
    blockingReason = "Fix the errors in the report before importing.";
  } else if (sheets && analysis.validCount === 0) {
    blockingReason = "There are no valid rows to import.";
  }

  const resetFile = () => {
    setSheets(null);
    setSheetIndex(0);
    setHeaderRowIndex(0);
    setColumns(emptyColumnMap());
    setResolutions({});
    setConflictChoices({});
    setFileName("");
    setFileError(null);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const applySheet = (nextSheets: SpreadsheetSheet[], index: number) => {
    const sheet = nextSheets[index];
    const headerIndex = sheet ? detectHeaderRow(sheet.rows) : 0;
    const nextColumns = sheet
      ? detectColumns(sheet.rows[headerIndex] ?? [])
      : emptyColumnMap();

    setSheetIndex(index);
    setHeaderRowIndex(headerIndex);
    setColumns(nextColumns);
    setResolutions({});
    setConflictChoices({});
  };

  const chooseFile = async (file: File) => {
    setFileError(null);
    setProgress(null);

    if (file.size > MAX_IMPORT_BYTES) {
      setFileError("That file is larger than 2 MB. Remove extra columns or split the sheet.");
      return;
    }

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      setFileError("Upload a .csv or .xlsx file.");
      return;
    }

    try {
      const nextSheets = await readSpreadsheetFile(file);

      if (nextSheets.length === 0) {
        setFileError("That file has no readable rows.");
        return;
      }

      setSheets(nextSheets);
      setFileName(file.name);
      setMode("append");
      applySheet(nextSheets, 0);
    } catch (error) {
      setSheets(null);
      setFileName("");
      setFileError(messageFor(error));
    }
  };

  const changeSheet = (index: number) => {
    if (!sheets) return;
    applySheet(sheets, index);
  };

  const changeHeaderRow = (index: number) => {
    if (!activeSheet) return;
    setHeaderRowIndex(index);
    setColumns(detectColumns(activeSheet.rows[index] ?? []));
    setResolutions({});
    setConflictChoices({});
  };

  const changeColumn = (key: ColumnKey, value: string) => {
    setColumns((previous) => ({
      ...previous,
      [key]: value === "" ? null : Number(value),
    }));
    setResolutions({});
    setConflictChoices({});
  };

  const changeResolution = (key: string, value: string, display: string) => {
    setResolutions((previous) => {
      let resolution: CategoryResolution;

      if (value === "default") resolution = { action: "default" };
      else if (value === "new") resolution = { action: "new", label: display };
      else if (value === "unmapped") resolution = { action: "unmapped" };
      else resolution = { action: "existing", categoryId: value.replace("existing:", "") };

      return { ...previous, [key]: resolution };
    });
    setConflictChoices({});
  };

  const changeNewLabel = (key: string, label: string) => {
    setResolutions((previous) => ({
      ...previous,
      [key]: { action: "new", label },
    }));
  };

  const runImport = async () => {
    if (busy || blockingReason || !sheets) return;

    setBusy(true);
    let createdCategories = 0;

    try {
      const workingCategories = event.categories.map((category) => ({
        id: category.id,
        label: category.label,
      }));
      const workingResolutions = { ...effectiveResolutions };
      let sortOrder = event.categories.length;

      for (const entry of newCategories) {
        const resolution = effectiveResolutions[entry.key];

        if (resolution?.action !== "new") continue;

        const label = resolution.label.trim();

        if (!label) {
          onNotice({ tone: "error", text: "Give the new category a name." });
          return;
        }

        setProgress(`Adding the "${label}" category…`);
        const created = await createCategory({
          editKeyHash,
          eventId: event.id,
          label,
          sortOrder,
        });

        if (created.status === "invalid_key") {
          onNotice({ tone: "error", text: "Your session expired. Please log in again." });
          return;
        }

        if (created.status === "error") {
          onNotice({ tone: "error", text: importMessage(created.code) });
          return;
        }

        workingCategories.push({ id: created.category.id, label });
        workingResolutions[entry.key] = {
          action: "existing",
          categoryId: created.category.id,
        };
        createdCategories += 1;
        sortOrder += 1;
      }

      const finalAnalysis = analyzeImport({
        rows: dataRows,
        headerRowNumber: headerRowIndex + 1,
        columns,
        categories: workingCategories,
        defaultCategoryId,
        resolutions: workingResolutions,
        conflictChoices,
      });

      if (finalAnalysis.errorCount > 0 || finalAnalysis.validCount === 0) {
        onNotice({
          tone: "error",
          text: "The list still has errors or no valid rows, so nothing was imported.",
        });
        return;
      }

      setProgress(`Hashing ${finalAnalysis.validCount} names on this device…`);
      const rows = await hashImportRows({
        rows: finalAnalysis.rows,
        salt,
        onProgress: (done, total) => setProgress(`Hashing ${done} of ${total} names…`),
      });

      setProgress(mode === "replace" ? "Replacing the list…" : "Saving the list…");
      const response =
        mode === "replace"
          ? await replaceParticipants({ editKeyHash, eventId: event.id, rows })
          : await addParticipants({ editKeyHash, eventId: event.id, rows });

      if (response.status === "ok") {
        onNotice({
          tone: "ok",
          text:
            mode === "replace"
              ? `Imported ${response.inserted} participants and replaced the old list.`
              : response.skipped > 0
                ? `Added ${response.inserted} participants. Skipped ${response.skipped} duplicate row${response.skipped === 1 ? "" : "s"}.`
                : `Added ${response.inserted} participant${response.inserted === 1 ? "" : "s"}.`,
        });
        resetFile();
        await onChanged();
      } else if (response.status === "invalid_key") {
        onNotice({ tone: "error", text: "Your session expired. Please log in again." });
      } else {
        onNotice({ tone: "error", text: importMessage(response.code) });
      }
    } catch (error) {
      onNotice({
        tone: "error",
        text:
          createdCategories > 0
            ? `${messageFor(error)} The new categories were added, but no participants were imported.`
            : messageFor(error),
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const visibleIssues = [...analysis.issues]
    .sort((left, right) => {
      if (left.severity !== right.severity) return left.severity === "error" ? -1 : 1;
      return left.rowNumber - right.rowNumber;
    })
    .slice(0, 40);

  const downloadSample = () => {
    const blob = new Blob([sampleCsv(event.categories)], {
      type: "text/csv;charset=utf-8",
    });
    downloadBlob(blob, "acclaimo-participants-sample.csv");
  };

  return (
    <div className="mt-4 rounded-[8px] border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Spreadsheet className="size-4 text-accent" aria-hidden="true" />
            Import a spreadsheet
          </h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
            CSV or Excel, up to 2 MB and 5,000 rows. The file is read here in your browser;
            only hashes are sent.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadSample}
          className={buttonClasses({ variant: "ghost", size: "sm" })}
        >
          <Download className="size-4" aria-hidden="true" />
          Sample CSV
        </button>
      </div>

      {!sheets ? (
        <div className="mt-4 rounded-[6px] border border-dashed border-line-strong bg-surface-muted p-5 text-center">
          <label
            className={`${buttonClasses({ variant: "secondary", size: "sm" })} cursor-pointer`}
          >
            <Upload className="size-4" aria-hidden="true" />
            Choose a CSV or Excel file
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              disabled={busy}
              onChange={(changeEvent) => {
                const file = changeEvent.target.files?.[0];
                if (file) void chooseFile(file);
              }}
            />
          </label>
          <p className="mt-2 text-xs text-muted">
            Required: Name. Optional: Identifier, Category, Position.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-line bg-surface-muted px-3 py-2 text-sm">
            <span className="min-w-0 break-all font-medium text-ink">{fileName}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className={buttonClasses({ variant: "ghost", size: "sm" })}
              >
                Change file
              </button>
              <button
                type="button"
                onClick={resetFile}
                disabled={busy}
                className={buttonClasses({ variant: "ghost", size: "sm" })}
              >
                Remove
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              disabled={busy}
              onChange={(changeEvent) => {
                const file = changeEvent.target.files?.[0];
                if (file) void chooseFile(file);
              }}
            />
          </div>

          {sheets.length > 1 ? (
            <label className="block text-sm">
              <span className="font-medium text-ink">Sheet</span>
              <select
                value={sheetIndex}
                onChange={(changeEvent) => changeSheet(Number(changeEvent.target.value))}
                className="mt-1 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base"
              >
                {sheets.map((sheet, index) => (
                  <option key={`${sheet.name}-${index}`} value={index}>
                    {sheet.name} · {sheet.rows.length} rows
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted">
                Excel files can contain several sheets. Pick the one with your list.
              </span>
            </label>
          ) : null}

          {activeSheet ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-ink">Header row</span>
                <select
                  value={headerRowIndex}
                  onChange={(changeEvent) => changeHeaderRow(Number(changeEvent.target.value))}
                  className="mt-1 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base"
                >
                  {activeSheet.rows.slice(0, 10).map((row, index) => (
                    <option key={index} value={index}>
                      Row {index + 1}: {previewRow(row)}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-muted">
                  Change this if the sheet starts with a title or a blank row.
                </span>
              </label>
            </div>
          ) : null}

          <fieldset>
            <legend className="text-sm font-semibold text-ink">Columns</legend>
            <p className="mt-1 text-xs text-muted">
              We matched the usual names. Correct any that look wrong.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {COLUMN_FIELDS.map((field) => (
                <label key={field.key} className="block text-sm">
                  <span className="font-medium text-ink">
                    {field.label}
                    <span className="ml-1 font-normal text-muted">({field.hint})</span>
                  </span>
                  <select
                    value={columns[field.key] ?? ""}
                    onChange={(changeEvent) =>
                      changeColumn(field.key, changeEvent.target.value)
                    }
                    className="mt-1 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base"
                  >
                    <option value="">Not used</option>
                    {headerCells.map((_, index) => (
                      <option key={index} value={index}>
                        {headerName(activeSheet as SpreadsheetSheet, headerRowIndex, index)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </fieldset>

          {columns.category !== null && distinct.length > 0 ? (
            <fieldset>
              <legend className="text-sm font-semibold text-ink">Category mapping</legend>
              <p className="mt-1 text-xs text-muted">
                Each value in the sheet must point at one of this event&apos;s categories.
              </p>
              <div className="mt-3 space-y-3">
                {distinct.map((entry) => {
                  const resolution = effectiveResolutions[entry.key];
                  const suggestion = suggestCategory(entry.display, event.categories);
                  const selectValue =
                    resolution?.action === "existing"
                      ? `existing:${resolution.categoryId}`
                      : resolution?.action === "default"
                        ? "default"
                        : resolution?.action === "new"
                          ? "new"
                          : "unmapped";

                  return (
                    <div
                      key={entry.key}
                      className="rounded-[6px] border border-line bg-surface-muted p-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-ink">
                          {entry.display}
                          <span className="ml-2 text-xs font-normal text-muted">
                            {entry.count} row{entry.count === 1 ? "" : "s"}
                          </span>
                        </span>
                        {resolution?.action === "unmapped" && suggestion ? (
                          <button
                            type="button"
                            onClick={() =>
                              changeResolution(
                                entry.key,
                                `existing:${suggestion.id}`,
                                entry.display,
                              )
                            }
                            className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                          >
                            Did you mean {suggestion.label}?
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr]">
                        <select
                          value={selectValue}
                          onChange={(changeEvent) =>
                            changeResolution(
                              entry.key,
                              changeEvent.target.value,
                              entry.display,
                            )
                          }
                          className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm"
                        >
                          <option value="unmapped">Choose a category…</option>
                          <option value="default">
                            Use the default category
                            {defaultCategoryId
                              ? ` (${event.categories.find((category) => category.id === defaultCategoryId)?.label ?? ""})`
                              : ""}
                          </option>
                          {event.categories.map((category) => (
                            <option key={category.id} value={`existing:${category.id}`}>
                              {category.label}
                            </option>
                          ))}
                          <option value="new">Create a new category</option>
                        </select>
                        {resolution?.action === "new" ? (
                          <input
                            value={resolution.label}
                            onChange={(changeEvent) =>
                              changeNewLabel(entry.key, changeEvent.target.value)
                            }
                            maxLength={40}
                            placeholder="New category name"
                            className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm"
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <div className="rounded-[6px] border border-line p-3">
            <h4 className="text-sm font-semibold text-ink">Check before importing</h4>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              {[
                ["Rows read", analysis.totalRows],
                ["Clean rows", analysis.validCount],
                ["Errors", analysis.errorCount],
                ["Warnings", analysis.warningCount],
              ].map(([label, value]) => (
                <div key={label} className="rounded border border-line bg-surface-muted px-2 py-2">
                  <dt className="text-[0.68rem] uppercase tracking-[0.08em] text-muted">
                    {label}
                  </dt>
                  <dd className="mt-1 font-serif text-lg font-semibold">{value}</dd>
                </div>
              ))}
            </dl>

            {analysis.categoryCounts.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[20rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-[0.06em] text-muted">
                      <th className="py-2 pr-3 font-medium">Category</th>
                      <th className="py-2 pr-3 text-right font-medium">People</th>
                      <th className="py-2 text-right font-medium">With position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.categoryCounts.map((entry) => (
                      <tr key={entry.key} className="border-b border-line last:border-0">
                        <td className="py-2 pr-3">{entry.label}</td>
                        <td className="py-2 pr-3 text-right">{entry.count}</td>
                        <td className="py-2 text-right">{entry.withPosition}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {analysis.conflicts.length > 0 ? (
              <div className="mt-4 space-y-3">
                <h5 className="text-sm font-semibold text-ink">Same name, different categories</h5>
                <p className="text-xs text-muted">
                  Keep one row, or add an Identifier column and re-import. Each row below is a
                  separate line in the file.
                </p>
                {analysis.conflicts.map((group) => (
                  <fieldset
                    key={group.duplicateKey}
                    className="rounded-[6px] border border-danger/40 bg-danger-soft/40 p-3"
                  >
                    <legend className="px-1 text-sm font-medium text-ink">{group.name}</legend>
                    <div className="mt-2 space-y-2">
                      {group.rows.map((row) => (
                        <label key={row.rowNumber} className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={`conflict-${group.duplicateKey}`}
                            checked={conflictChoices[group.duplicateKey] === row.rowNumber}
                            onChange={() =>
                              setConflictChoices((previous) => ({
                                ...previous,
                                [group.duplicateKey]: row.rowNumber,
                              }))
                            }
                            className="size-4 accent-[var(--c-accent)]"
                          />
                          <span>
                            Row {row.rowNumber} · {row.categoryLabel}
                            {row.identifier ? ` · ${row.identifier}` : ""}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            ) : null}

            {visibleIssues.length > 0 ? (
              <div className="mt-4">
                <h5 className="text-sm font-semibold text-ink">Row issues</h5>
                <ul className="mt-2 space-y-1 text-sm">
                  {visibleIssues.map((issue, index) => (
                    <li
                      key={`${issue.code}-${issue.rowNumber}-${index}`}
                      className={
                        issue.severity === "error"
                          ? "text-danger"
                          : "text-muted"
                      }
                    >
                      <span className="font-medium">
                        Row {issue.rowNumber}
                        {issue.severity === "warning" ? " · warning" : ""}:
                      </span>{" "}
                      {issue.message}
                    </li>
                  ))}
                </ul>
                {analysis.issues.length > visibleIssues.length ? (
                  <p className="mt-2 text-xs text-muted">
                    Showing the first {visibleIssues.length} of {analysis.issues.length} issues.
                  </p>
                ) : null}
              </div>
            ) : null}

            {analysis.mergedDuplicates > 0 ? (
              <p className="mt-3 text-xs text-muted">
                {analysis.mergedDuplicates} duplicate row
                {analysis.mergedDuplicates === 1 ? "" : "s"} will be merged into the first
                listing.
              </p>
            ) : null}
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-ink">What should happen?</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="flex items-start gap-2 rounded-[6px] border border-line p-3 text-sm">
                <input
                  type="radio"
                  name={`import-mode-${event.id}`}
                  checked={mode === "append"}
                  onChange={() => setMode("append")}
                  className="mt-0.5 size-4 accent-[var(--c-accent)]"
                />
                <span>
                  <span className="font-medium text-ink">Add to the current list</span>
                  <span className="mt-1 block text-xs text-muted">
                    Existing participants stay.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-[6px] border border-line p-3 text-sm">
                <input
                  type="radio"
                  name={`import-mode-${event.id}`}
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                  className="mt-0.5 size-4 accent-[var(--c-accent)]"
                />
                <span>
                  <span className="font-medium text-ink">Replace the whole list</span>
                  <span className="mt-1 block text-xs text-muted">
                    The old list is removed only after every row passes.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          {blockingReason ? (
            <p className="rounded-[6px] border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-ink">
              {blockingReason}
            </p>
          ) : (
            <p className="text-sm text-muted">
              Ready to {mode === "replace" ? "replace the list with" : "add"}{" "}
              <strong className="text-ink">{analysis.validCount}</strong> participant
              {analysis.validCount === 1 ? "" : "s"}.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void runImport()}
              disabled={busy || blockingReason !== null}
              className={buttonClasses({ variant: "primary", size: "sm" })}
            >
              {busy
                ? "Importing…"
                : mode === "replace"
                  ? "Replace list"
                  : "Import participants"}
            </button>
            {progress ? (
              <span className="text-sm text-muted" role="status" aria-live="polite">
                {progress}
              </span>
            ) : null}
          </div>
        </div>
      )}

      {fileError ? (
        <p className="mt-3 rounded-[6px] border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-ink">
          {fileError}
        </p>
      ) : null}
    </div>
  );
}
