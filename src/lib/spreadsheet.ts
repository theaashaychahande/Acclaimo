import { hashName, hashNameWithIdentifier } from "../shared/hash";
import { normalizeIdentifier, normalizeLabel, normalizeName } from "../shared/normalize";

/**
 * Everything in this module runs in the browser. Plain names are kept only
 * long enough to validate and hash them, then the caller discards the sheet.
 */

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;

export type ColumnKey = "name" | "identifier" | "category" | "position";
export type ColumnMap = Record<ColumnKey, number | null>;

export type SpreadsheetSheet = {
  name: string;
  rows: string[][];
};

export type CategoryOption = {
  id: string;
  label: string;
  isDefault?: boolean;
};

export type CategoryResolution =
  | { action: "existing"; categoryId: string }
  | { action: "default" }
  | { action: "new"; label: string }
  | { action: "unmapped" };

export type IssueSeverity = "error" | "warning";

export type ImportIssue = {
  rowNumber: number;
  severity: IssueSeverity;
  code: string;
  message: string;
  column?: ColumnKey;
};

export type ImportRow = {
  rowNumber: number;
  name: string;
  normalizedName: string;
  identifier: string;
  categoryValue: string;
  categoryId: string | null;
  categoryLabel: string | null;
  categoryResolved: boolean;
  positionText: string;
  duplicateKey: string;
  keep: boolean;
  issues: ImportIssue[];
};

export type CategoryCount = {
  key: string;
  categoryId: string | null;
  label: string;
  count: number;
  withPosition: number;
};

export type ConflictGroup = {
  duplicateKey: string;
  name: string;
  rows: Array<{
    rowNumber: number;
    categoryLabel: string;
    identifier: string;
  }>;
};

export type ImportAnalysis = {
  rows: ImportRow[];
  issues: ImportIssue[];
  conflicts: ConflictGroup[];
  categoryCounts: CategoryCount[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  warningCount: number;
  mergedDuplicates: number;
  hasUnresolvedCategories: boolean;
};

export type AnalyzeImportInput = {
  rows: string[][];
  headerRowNumber: number;
  columns: ColumnMap;
  categories: CategoryOption[];
  defaultCategoryId: string | null;
  resolutions: Record<string, CategoryResolution>;
  conflictChoices: Record<string, number>;
};

export type HashedParticipant = {
  name_hash: string;
  category_id: string;
  identifier_hash: string | null;
  position_text: string | null;
  duplicate_flag: boolean;
};

const ALIASES: Record<ColumnKey, string[]> = {
  name: [
    "name",
    "full name",
    "student name",
    "participant name",
    "candidate name",
    "attendee name",
    "name of student",
    "name of participant",
    "student",
    "participant",
  ],
  identifier: [
    "identifier",
    "id",
    "student id",
    "roll",
    "roll no",
    "roll number",
    "reg no",
    "reg number",
    "registration",
    "registration no",
    "registration number",
    "enrollment",
    "enrollment no",
    "enrollment number",
    "enrolment",
    "enrolment no",
    "enrolment number",
    "regd no",
    "regd number",
  ],
  category: [
    "category",
    "category name",
    "group",
    "team",
    "design",
    "certificate type",
    "award category",
    "type",
  ],
  position: [
    "position",
    "position text",
    "prize",
    "prize position",
    "award",
    "rank",
    "role",
    "title",
    "result",
    "position prize",
  ],
};

const COLUMN_ORDER: ColumnKey[] = ["name", "identifier", "category", "position"];

export function emptyColumnMap(): ColumnMap {
  return { name: null, identifier: null, category: null, position: null };
}

function headerKey(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function columnForKey(value: string): ColumnKey | null {
  const key = headerKey(value);
  if (!key) return null;

  for (const column of COLUMN_ORDER) {
    if (ALIASES[column].includes(key)) return column;
  }

  return null;
}

export function detectColumns(header: string[]): ColumnMap {
  const map = emptyColumnMap();

  for (let index = 0; index < header.length; index += 1) {
    const column = columnForKey(header[index] ?? "");
    if (column && map[column] === null) map[column] = index;
  }

  return map;
}

/**
 * Finds the most header-like row in the first ten rows. A sheet with no
 * recognizable headers falls back to row one, and the organizer can map
 * columns by hand.
 */
export function detectHeaderRow(rows: string[][]): number {
  let bestIndex = 0;
  let bestScore = 0;
  const limit = Math.min(rows.length, 10);

  for (let index = 0; index < limit; index += 1) {
    const columns = detectColumns(rows[index] ?? []);
    const matched = COLUMN_ORDER.filter((column) => columns[column] !== null).length;
    const score = matched + (columns.name !== null ? 2 : 0);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestScore > 0 ? bestIndex : 0;
}

function countDelimiter(line: string, delimiter: string): number {
  let quoted = false;
  let count = 0;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      count += 1;
    }
  }

  return count;
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t"];

  let best = ",";
  let bestCount = 0;

  for (const candidate of candidates) {
    const count = countDelimiter(firstLine, candidate);
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }

  return best;
}

export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const separator = input.match(/^sep=(.)\r?\n/i);
  const delimiter = separator?.[1] ?? detectDelimiter(input);
  const body = separator ? input.slice(separator[0].length) : input;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];

    if (quoted) {
      if (char === '"') {
        if (body[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && body[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  while (rows.length > 0 && rows[rows.length - 1].every((cell) => cell.trim() === "")) {
    rows.pop();
  }

  return rows;
}

/**
 * Excel can export CSV as UTF-8 with a BOM, UTF-16, or the Windows ANSI code
 * page. Falling back to windows-1252 keeps Devanagari intact when it was
 * actually saved as UTF-8, and readable for older Excel exports.
 */
export function decodeCsvBytes(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function cleanCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  const raw =
    value instanceof Date ? value.toISOString().slice(0, 10) : String(value);

  let text = raw.replace(/^\uFEFF/, "").replace(/\u0000/g, "").trim();

  // Excel's force-text apostrophe and quoted formula results.
  if (text.startsWith("'") && text.length > 1) text = text.slice(1);
  const formulaText = text.match(/^="([\s\S]*)"$/);
  if (formulaText) text = formulaText[1];

  return text.replace(/\s+/g, " ").trim();
}

export async function readSpreadsheetFile(file: File): Promise<SpreadsheetSheet[]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv") || file.type === "text/csv") {
    const text = decodeCsvBytes(new Uint8Array(await file.arrayBuffer()));
    const rows = parseCsv(text).map((row) => row.map(cleanCell));
    return [{ name: file.name.replace(/\.[^.]+$/, "") || "Sheet 1", rows }];
  }

  if (name.endsWith(".xlsx")) {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const sheets = await readXlsxFile(file, { trim: true });

    return sheets
      .filter((sheet) => sheet.data.length > 0)
      .map((sheet) => ({
        name: sheet.sheet,
        rows: sheet.data.map((row) => row.map(cleanCell)),
      }));
  }

  if (name.endsWith(".xls")) {
    throw new Error(
      "Old .xls files are not supported. Open the file in Excel and save it as .xlsx or .csv.",
    );
  }

  throw new Error("That file type is not supported. Upload a .csv or .xlsx file.");
}

export function categoryKey(value: string): string {
  return normalizeLabel(value).key;
}

function editDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];

    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }

    previous = current;
  }

  return previous[right.length];
}

export function suggestCategory(
  value: string,
  categories: CategoryOption[],
): CategoryOption | null {
  const key = categoryKey(value);
  if (!key) return null;

  let best: CategoryOption | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const category of categories) {
    const distance = editDistance(key, categoryKey(category.label));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = category;
    }
  }

  const threshold = Math.max(1, Math.floor(key.length * 0.34));
  return best && bestDistance <= threshold ? best : null;
}

function valuesFor(
  rows: string[][],
  columns: ColumnMap,
): Array<{ key: string; display: string; count: number }> {
  if (columns.category === null) return [];

  const found = new Map<string, { display: string; count: number }>();

  for (const row of rows) {
    const value = cleanCell(row[columns.category]);
    if (!value) continue;

    const key = categoryKey(value);
    if (!key) continue;

    const existing = found.get(key);
    if (existing) existing.count += 1;
    else found.set(key, { display: normalizeLabel(value).display, count: 1 });
  }

  return [...found.entries()]
    .map(([key, value]) => ({ key, display: value.display, count: value.count }))
    .sort((left, right) => left.display.localeCompare(right.display));
}

/** Distinct category values found in the selected sheet. */
export function distinctCategoryValues(
  rows: string[][],
  columns: ColumnMap,
): Array<{ key: string; display: string; count: number }> {
  return valuesFor(rows, columns);
}

function isRowEmpty(row: string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

function valueAt(row: string[], index: number | null): string {
  return index === null ? "" : cleanCell(row[index]);
}

export function analyzeImport(input: AnalyzeImportInput): ImportAnalysis {
  const categoryById = new Map(input.categories.map((category) => [category.id, category]));
  const rows: ImportRow[] = [];
  const blankCategoryRows: ImportRow[] = [];
  let totalRows = 0;

  for (let index = 0; index < input.rows.length; index += 1) {
    const source = input.rows[index];
    if (isRowEmpty(source)) continue;

    totalRows += 1;
    const rowNumber = input.headerRowNumber + 1 + index;
    const name = valueAt(source, input.columns.name);
    const identifier = valueAt(source, input.columns.identifier);
    const categoryValue = valueAt(source, input.columns.category);
    const positionText = valueAt(source, input.columns.position);

    const issues: ImportIssue[] = [];
    const normalizedName = name ? normalizeName(name) : "";
    let categoryId: string | null = null;
    let categoryLabel: string | null = null;
    let categoryResolved = true;

    if (!name) {
      issues.push({
        rowNumber,
        severity: "error",
        code: "blank_name",
        message: "This row has no name.",
        column: "name",
      });
    } else if (!normalizedName) {
      issues.push({
        rowNumber,
        severity: "error",
        code: "invalid_name",
        message: "The name has no letters we can match.",
        column: "name",
      });
    } else {
      if (!normalizedName.includes(" ")) {
        issues.push({
          rowNumber,
          severity: "warning",
          code: "one_word_name",
          message: "The name has only one word. Check the spelling before importing.",
          column: "name",
        });
      }

      if (/[0-9]/.test(name)) {
        issues.push({
          rowNumber,
          severity: "warning",
          code: "numbers_in_name",
          message: "The name contains numbers. They are ignored when matching.",
          column: "name",
        });
      }

      if (/[^\p{L}\p{M}\s.'’-]/u.test(name)) {
        issues.push({
          rowNumber,
          severity: "warning",
          code: "symbols_in_name",
          message: "The name contains symbols. They are ignored when matching.",
          column: "name",
        });
      }
    }

    if (input.columns.category === null || !categoryValue) {
      const fallback = input.defaultCategoryId
        ? categoryById.get(input.defaultCategoryId) ?? null
        : null;

      if (fallback) {
        categoryId = fallback.id;
        categoryLabel = fallback.label;
      } else {
        categoryResolved = false;
        issues.push({
          rowNumber,
          severity: "error",
          code: "no_default_category",
          message: "This event has no default category for rows with a blank category.",
          column: "category",
        });
      }

      if (input.columns.category !== null && !categoryValue && name) {
        issues.push({
          rowNumber,
          severity: "warning",
          code: "blank_category",
          message: "No category in this row, so the default category will be used.",
          column: "category",
        });
      }
    } else {
      const resolution = input.resolutions[categoryKey(categoryValue)] ?? {
        action: "unmapped",
      };

      if (resolution.action === "existing") {
        const category = categoryById.get(resolution.categoryId);
        if (category) {
          categoryId = category.id;
          categoryLabel = category.label;
        } else {
          categoryResolved = false;
          issues.push({
            rowNumber,
            severity: "error",
            code: "unmapped_category",
            message: `"${categoryValue}" is mapped to a category that no longer exists.`,
            column: "category",
          });
        }
      } else if (resolution.action === "default") {
        const fallback = input.defaultCategoryId
          ? categoryById.get(input.defaultCategoryId) ?? null
          : null;

        if (fallback) {
          categoryId = fallback.id;
          categoryLabel = fallback.label;
        } else {
          categoryResolved = false;
          issues.push({
            rowNumber,
            severity: "error",
            code: "no_default_category",
            message: "This event has no default category.",
            column: "category",
          });
        }
      } else if (resolution.action === "new") {
        categoryLabel = normalizeLabel(resolution.label).display;
      } else {
        categoryResolved = false;
        issues.push({
          rowNumber,
          severity: "error",
          code: "unmapped_category",
          message: `"${categoryValue}" is not mapped to a category yet.`,
          column: "category",
        });
      }
    }

    if (positionText.length > 60) {
      issues.push({
        rowNumber,
        severity: "error",
        code: "position_too_long",
        message: `The position text is ${positionText.length} characters; the limit is 60.`,
        column: "position",
      });
    } else if (positionText && /[^\p{L}\p{M}\p{N}\s.,'’&()\/-]/u.test(positionText)) {
      issues.push({
        rowNumber,
        severity: "warning",
        code: "position_symbols",
        message: "The position text contains unusual symbols. Check how it will print.",
        column: "position",
      });
    }

    const duplicateKey = `${normalizedName}\u0000${normalizeIdentifier(identifier)}`;

    const row: ImportRow = {
      rowNumber,
      name,
      normalizedName,
      identifier,
      categoryValue,
      categoryId,
      categoryLabel,
      categoryResolved,
      positionText,
      duplicateKey,
      keep: true,
      issues,
    };

    rows.push(row);
    if (categoryValue === "" && input.columns.category !== null) blankCategoryRows.push(row);
  }

  // One warning reads better than one per row when the column was never filled.
  if (blankCategoryRows.length > 0 && blankCategoryRows.length === totalRows) {
    for (const row of blankCategoryRows) {
      row.issues = row.issues.filter((issue) => issue.code !== "blank_category");
    }

    const fallback = input.defaultCategoryId
      ? categoryById.get(input.defaultCategoryId) ?? null
      : null;

    rows[0]?.issues.push({
      rowNumber: rows[0].rowNumber,
      severity: "warning",
      code: "blank_category_all",
      message: fallback
        ? `The Category column is empty for every row. Everyone will use "${fallback.label}".`
        : "The Category column is empty for every row.",
      column: "category",
    });
  }

  if (input.columns.position === null && rows.length > 0) {
    rows[0].issues.push({
      rowNumber: rows[0].rowNumber,
      severity: "warning",
      code: "no_position_column",
      message: "No position column is mapped, so position text will stay blank.",
      column: "position",
    });
  }

  const groups = new Map<string, ImportRow[]>();

  for (const row of rows) {
    if (!row.normalizedName) continue;
    const list = groups.get(row.duplicateKey);
    if (list) list.push(row);
    else groups.set(row.duplicateKey, [row]);
  }

  const conflicts: ConflictGroup[] = [];
  let mergedDuplicates = 0;

  for (const [duplicateKey, group] of groups) {
    if (group.length < 2) continue;

    const categoryKeys = new Set(
      group.map((row) => row.categoryId ?? `new:${row.categoryLabel ?? "unresolved"}`),
    );

    if (categoryKeys.size > 1) {
      const choice = input.conflictChoices[duplicateKey];

      for (const row of group) {
        if (choice === undefined) {
          row.issues.push({
            rowNumber: row.rowNumber,
            severity: "error",
            code: "name_conflict",
            message: "This name appears in more than one category. Choose one row to keep.",
            column: "category",
          });
        } else if (choice === row.rowNumber) {
          row.keep = true;
        } else {
          row.keep = false;
          row.issues.push({
            rowNumber: row.rowNumber,
            severity: "warning",
            code: "conflict_dropped",
            message: "Another row with this name was kept instead.",
            column: "category",
          });
        }
      }

      conflicts.push({
        duplicateKey,
        name: group[0].name,
        rows: group.map((row) => ({
          rowNumber: row.rowNumber,
          categoryLabel: row.categoryLabel ?? row.categoryValue ?? "No category",
          identifier: row.identifier,
        })),
      });
    } else {
      for (let index = 1; index < group.length; index += 1) {
        group[index].keep = false;
        group[index].issues.push({
          rowNumber: group[index].rowNumber,
          severity: "warning",
          code: "merged_duplicate",
          message: "This name is already listed in the same category; the first row will be imported.",
        });
        mergedDuplicates += 1;
      }
    }
  }

  const issues = rows.filter((row) => row.keep).flatMap((row) => row.issues);
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const validRows = rows.filter(
    (row) => row.keep && !row.issues.some((issue) => issue.severity === "error"),
  );

  const counts = new Map<string, CategoryCount>();

  for (const category of input.categories) {
    counts.set(`id:${category.id}`, {
      key: `id:${category.id}`,
      categoryId: category.id,
      label: category.label,
      count: 0,
      withPosition: 0,
    });
  }

  for (const row of validRows) {
    const key = row.categoryId
      ? `id:${row.categoryId}`
      : `new:${row.categoryLabel ?? "unresolved"}`;

    let entry = counts.get(key);

    if (!entry) {
      entry = {
        key,
        categoryId: row.categoryId,
        label: row.categoryLabel ?? "New category",
        count: 0,
        withPosition: 0,
      };
      counts.set(key, entry);
    }

    entry.count += 1;
    if (row.positionText) entry.withPosition += 1;
  }

  return {
    rows,
    issues,
    conflicts,
    categoryCounts: [...counts.values()].filter((entry) => entry.count > 0 || entry.categoryId),
    totalRows,
    validCount: validRows.length,
    errorCount,
    warningCount,
    mergedDuplicates,
    hasUnresolvedCategories: rows.some((row) => !row.categoryResolved),
  };
}

/**
 * Hashes the valid rows in small batches. Names never leave the browser; only
 * these hashes, category ids, and position text go to the database.
 */
export async function hashImportRows(input: {
  rows: ImportRow[];
  salt: string;
  onProgress?: (hashed: number, total: number) => void;
}): Promise<HashedParticipant[]> {
  const usable = input.rows.filter(
    (row) =>
      row.keep &&
      row.categoryId !== null &&
      !row.issues.some((issue) => issue.severity === "error"),
  );

  const result: HashedParticipant[] = [];
  const chunkSize = 100;

  for (let start = 0; start < usable.length; start += chunkSize) {
    const chunk = usable.slice(start, start + chunkSize);
    const hashed = await Promise.all(
      chunk.map(async (row) => {
        const nameHash = await hashName(input.salt, row.name);
        const identifierHash = row.identifier
          ? await hashNameWithIdentifier(input.salt, row.name, row.identifier)
          : null;

        return {
          name_hash: nameHash,
          category_id: row.categoryId!,
          identifier_hash: identifierHash,
          position_text: row.positionText || null,
          duplicate_flag: identifierHash !== null,
        } satisfies HashedParticipant;
      }),
    );

    result.push(...hashed);
    input.onProgress?.(result.length, usable.length);
  }

  return result;
}

export function sampleCsv(categories: CategoryOption[]): string {
  const labels = categories.map((category) => category.label);
  const first = labels[0] ?? "Participant";
  const second = labels[1] ?? first;

  return [
    "Name,Identifier,Category,Position",
    `Aashay Chahande,,${first},Winner`,
    `Riya Sharma,,${second},Participant`,
  ].join("\n");
}
