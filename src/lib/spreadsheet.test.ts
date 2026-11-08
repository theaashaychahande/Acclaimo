import { describe, expect, it } from "vitest";
import { hashName, hashNameWithIdentifier } from "../shared/hash";
import {
  analyzeImport,
  categoryKey,
  cleanCell,
  decodeCsvBytes,
  detectColumns,
  detectHeaderRow,
  hashImportRows,
  parseCsv,
  suggestCategory,
  type AnalyzeImportInput,
  type CategoryOption,
  type ColumnMap,
} from "./spreadsheet";

const categories: CategoryOption[] = [
  { id: "11111111-1111-4111-8111-111111111111", label: "Participant", isDefault: true },
  { id: "22222222-2222-4222-8222-222222222222", label: "Winner" },
];

const columns: ColumnMap = { name: 0, identifier: 1, category: 2, position: 3 };

function analysis(overrides: Partial<AnalyzeImportInput> = {}) {
  return analyzeImport({
    rows: [
      ["Aashay Chahande", "", "Winner", "Winner"],
      ["Riya Sharma", "", "Participant", ""],
    ],
    headerRowNumber: 1,
    columns,
    categories,
    defaultCategoryId: categories[0].id,
    resolutions: {
      winner: { action: "existing", categoryId: categories[1].id },
      participant: { action: "existing", categoryId: categories[0].id },
    },
    conflictChoices: {},
    ...overrides,
  });
}

describe("parseCsv", () => {
  it("handles quoted commas, escaped quotes, and CRLF", () => {
    const rows = parseCsv(
      'Name,Position\r\n"Chahande, Aashay","Winner ""Best"""\r\nRiya Sharma,Participant\r\n',
    );

    expect(rows).toEqual([
      ["Name", "Position"],
      ["Chahande, Aashay", 'Winner "Best"'],
      ["Riya Sharma", "Participant"],
    ]);
  });

  it("keeps line breaks inside quoted fields", () => {
    expect(parseCsv('Name,Note\n"Aashay","line one\nline two"\n')).toEqual([
      ["Name", "Note"],
      ["Aashay", "line one\nline two"],
    ]);
  });

  it("detects semicolon and tab separated files", () => {
    expect(parseCsv("Name;Position\nAashay;Winner\n")).toEqual([
      ["Name", "Position"],
      ["Aashay", "Winner"],
    ]);
    expect(parseCsv("Name\tPosition\nAashay\tWinner\n")).toEqual([
      ["Name", "Position"],
      ["Aashay", "Winner"],
    ]);
  });

  it("honours an Excel sep= line", () => {
    expect(parseCsv("sep=;\nName;Category\nAashay;Winner\n")).toEqual([
      ["Name", "Category"],
      ["Aashay", "Winner"],
    ]);
  });

  it("drops trailing empty rows", () => {
    expect(parseCsv("Name\nAashay\n\n")).toEqual([["Name"], ["Aashay"]]);
  });
});

describe("decodeCsvBytes", () => {
  it("strips a UTF-8 BOM", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x4e, 0x61, 0x6d, 0x65]);
    expect(decodeCsvBytes(bytes)).toBe("Name");
  });

  it("reads UTF-8 Devanagari", () => {
    const bytes = new TextEncoder().encode("नाम");
    expect(decodeCsvBytes(bytes)).toBe("नाम");
  });

  it("falls back to windows-1252 for old Excel exports", () => {
    const bytes = new Uint8Array([0x41, 0x6e, 0x64, 0x72, 0xe9]); // André
    expect(decodeCsvBytes(bytes)).toBe("André");
  });
});

describe("cleanCell", () => {
  it("removes Excel force-text apostrophes and quoted formulas", () => {
    expect(cleanCell("'=Aashay")).toBe("=Aashay");
    expect(cleanCell('="Aashay Chahande"')).toBe("Aashay Chahande");
    expect(cleanCell("  Aashay   Chahande  ")).toBe("Aashay Chahande");
  });
});

describe("header detection", () => {
  it("matches common header names and punctuation", () => {
    expect(detectColumns(["Roll No.", "Student Name", "Award Category", "Position Text"])).toEqual({
      name: 1,
      identifier: 0,
      category: 2,
      position: 3,
    });
  });

  it("finds a header below a title row", () => {
    const rows = [
      ["Mechanical Department"],
      ["Name", "Identifier", "Category", "Position"],
      ["Aashay Chahande", "", "Winner", "Winner"],
    ];

    expect(detectHeaderRow(rows)).toBe(1);
  });

  it("falls back to the first row when nothing matches", () => {
    expect(detectHeaderRow([["Aashay", "Winner"]])).toBe(0);
  });
});

describe("category suggestions", () => {
  it("ignores case and extra spaces", () => {
    expect(categoryKey("  WINNER ")).toBe("winner");
  });

  it("suggests the closest category for typos", () => {
    expect(suggestCategory("Winer", categories)?.label).toBe("Winner");
    expect(suggestCategory("Partcipant", categories)?.label).toBe("Participant");
  });

  it("returns null when nothing is close", () => {
    expect(suggestCategory("Photography", categories)).toBeNull();
  });
});

describe("analyzeImport", () => {
  it("counts clean rows per category and position text", () => {
    const result = analysis();

    expect(result.totalRows).toBe(2);
    expect(result.validCount).toBe(2);
    expect(result.errorCount).toBe(0);

    const winner = result.categoryCounts.find((entry) => entry.label === "Winner");
    expect(winner).toMatchObject({ count: 1, withPosition: 1 });

    const participant = result.categoryCounts.find((entry) => entry.label === "Participant");
    expect(participant).toMatchObject({ count: 1, withPosition: 0 });
  });

  it("blocks blank names and long position text", () => {
    const result = analysis({
      rows: [
        ["", "", "Winner", "Winner"],
        ["Riya Sharma", "", "Participant", "x".repeat(61)],
      ],
    });

    expect(result.validCount).toBe(0);
    expect(result.issues.some((issue) => issue.code === "blank_name")).toBe(true);
    expect(result.issues.some((issue) => issue.code === "position_too_long")).toBe(true);
  });

  it("uses the default category for blank values", () => {
    const result = analysis({
      rows: [["Aashay Chahande", "", "", ""]],
    });

    expect(result.validCount).toBe(1);
    expect(result.rows[0].categoryId).toBe(categories[0].id);
    expect(result.issues.some((issue) => issue.code === "blank_category_all")).toBe(true);
  });

  it("blocks a name that appears in two categories until one is kept", () => {
    const rows = [
      ["Aashay Chahande", "", "Winner", ""],
      ["Aashay Chahande", "", "Participant", ""],
    ];

    const blocked = analysis({ rows });
    expect(blocked.validCount).toBe(0);
    expect(blocked.conflicts).toHaveLength(1);
    expect(blocked.issues.some((issue) => issue.code === "name_conflict")).toBe(true);

    const resolved = analysis({
      rows,
      conflictChoices: {
        [`aashay chahande\u0000`]: 3,
      },
    });

    expect(resolved.validCount).toBe(1);
    expect(resolved.rows[0].keep).toBe(false);
    expect(resolved.rows[1].keep).toBe(true);
  });

  it("merges the same person listed twice in one category", () => {
    const result = analysis({
      rows: [
        ["Aashay Chahande", "", "Winner", ""],
        ["Aashay Chahande", "", "Winner", ""],
      ],
    });

    expect(result.validCount).toBe(1);
    expect(result.mergedDuplicates).toBe(1);
    expect(result.rows[1].keep).toBe(false);
  });

  it("allows two people with the same name when identifiers differ", () => {
    const result = analysis({
      rows: [
        ["Aashay Chahande", "CS21B001", "Winner", ""],
        ["Aashay Chahande", "CS21B002", "Winner", ""],
      ],
    });

    expect(result.validCount).toBe(2);
    expect(result.conflicts).toHaveLength(0);
  });

  it("flags unmapped category values", () => {
    const result = analysis({
      rows: [["Aashay Chahande", "", "Winer", ""]],
      resolutions: { winer: { action: "unmapped" } },
    });

    expect(result.validCount).toBe(0);
    expect(result.hasUnresolvedCategories).toBe(true);
    expect(result.issues.some((issue) => issue.code === "unmapped_category")).toBe(true);
  });
});

describe("hashImportRows", () => {
  it("hashes names and identifiers without sending plain text anywhere", async () => {
    const salt = "test-salt";
    const result = analysis({
      rows: [
        ["Aashay Chahande", "CS21B001", "Winner", "Winner"],
        ["Riya Sharma", "", "Participant", ""],
      ],
    });

    const hashed = await hashImportRows({ rows: result.rows, salt });

    expect(hashed).toHaveLength(2);

    expect(hashed[0].name_hash).toBe(await hashName(salt, "Aashay Chahande"));
    expect(hashed[0].identifier_hash).toBe(
      await hashNameWithIdentifier(salt, "Aashay Chahande", "CS21B001"),
    );
    expect(hashed[0].duplicate_flag).toBe(true);
    expect(hashed[0].position_text).toBe("Winner");

    expect(hashed[1].name_hash).toBe(await hashName(salt, "Riya Sharma"));
    expect(hashed[1].identifier_hash).toBeNull();
    expect(hashed[1].duplicate_flag).toBe(false);
    expect(hashed[1].position_text).toBeNull();
  });
});
