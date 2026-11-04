import { describe, expect, it } from "vitest";
import { normalizeIdentifier, normalizeLabel, normalizeName } from "./normalize";

/**
 * Every pair below must produce the same normalized value. The list covers
 * spacing, case, punctuation, word order, digits, accents, and Devanagari
 * with combining marks. It is deliberately long: this is the contract between
 * organizer uploads and student lookups.
 */
const nameCases: Array<[string, string]> = [
  ["Rahul Sharma", "rahul sharma"],
  ["  sharma   RAHUL ", "rahul sharma"],
  ["RAHUL SHARMA", "rahul sharma"],
  ["rahul sharma", "rahul sharma"],
  ["Sharma Rahul", "rahul sharma"],
  ["Rahul, Sharma", "rahul sharma"],
  ["Rahul. Sharma", "rahul sharma"],
  ["Rahul (Sharma)", "rahul sharma"],
  ["\tRahul\nSharma ", "rahul sharma"],
  ["Rahul  Sharma", "rahul sharma"],
  ["RAHUL, sharma.", "rahul sharma"],
  [" Rahul Sharma ", "rahul sharma"],
  ["Rahul & Sharma", "rahul sharma"],
  ["Rahul Sharma!!!", "rahul sharma"],
  ["Rahul\tSharma", "rahul sharma"],
  ["Sharma, Rahul", "rahul sharma"],

  ["Aarohi Deshmukh", "aarohi deshmukh"],
  ["DESHMUKH AAROHI", "aarohi deshmukh"],
  ["deshmukh, aarohi", "aarohi deshmukh"],
  [" Aarohi   Deshmukh ", "aarohi deshmukh"],
  ["Aarohi (Deshmukh)", "aarohi deshmukh"],
  ["AAROHI  DESHMUKH", "aarohi deshmukh"],

  ["Sana Kausar Ali", "ali kausar sana"],
  ["Ali Sana Kausar", "ali kausar sana"],
  ["kausar  ali sana", "ali kausar sana"],
  ["Sana, Kausar Ali", "ali kausar sana"],
  ["Sana Kausar Ali ", "ali kausar sana"],

  ["Rahul 2026", "rahul"],
  ["Rahul 1234", "rahul"],
  ["Rahul #2026", "rahul"],
  ["2026 Rahul", "rahul"],

  ["   ", ""],
  ["...!!!", ""],
  ["12345", ""],
  ["२३४५", ""],
  ["\n\t", ""],

  ["Rahul-Sharma", "rahulsharma"],
  ["Rahul_Sharma", "rahulsharma"],
  ["Rahul.Sharma", "rahulsharma"],
  ["Rahul/Sharma", "rahulsharma"],
  ["Rahul2Sharma", "rahulsharma"],
  ["Rahul123Sharma", "rahulsharma"],

  ["O'Brien", "obrien"],
  ["OBRIEN", "obrien"],
  ["o’brien", "obrien"],

  ["D'Souza Maria", "dsouza maria"],
  ["Maria D'Souza", "dsouza maria"],
  ["maria   dsouza", "dsouza maria"],

  ["José Álvarez", "josé álvarez"],
  ["Álvarez José", "josé álvarez"],
  ["JOSÉ ÁLVAREZ", "josé álvarez"],

  ["आरोही देशमुख", "आरोही देशमुख"],
  ["देशमुख आरोही", "आरोही देशमुख"],
  [" आरोही   देशमुख ", "आरोही देशमुख"],
  ["आरोही देशमुख".normalize("NFD"), "आरोही देशमुख"],
  ["आरोही, देशमुख", "आरोही देशमुख"],

  ["आरोही-देशमुख", "आरोहीदेशमुख"],
  ["आरोही_देशमुख", "आरोहीदेशमुख"],

  ["Rahul 2nd Sharma", "nd rahul sharma"],
];

describe("normalizeName", () => {
  it.each(nameCases)("normalizes %j", (input, expected) => {
    expect(normalizeName(input)).toBe(expected);
  });

  it("keeps duplicate words and sorts them", () => {
    expect(normalizeName("Sharma Rahul Rahul")).toBe("rahul rahul sharma");
  });

  it("does not treat an initial as the full name", () => {
    expect(normalizeName("R. Sharma")).toBe("r sharma");
    expect(normalizeName("R. Sharma")).not.toBe(normalizeName("Rahul Sharma"));
  });

  it("does not merge accented and unaccented names", () => {
    expect(normalizeName("Jose Alvarez")).not.toBe(normalizeName("José Álvarez"));
  });

  it("is deterministic for the same input", () => {
    expect(normalizeName("Rahul Sharma")).toBe(normalizeName("Rahul Sharma"));
  });
});

describe("normalizeIdentifier", () => {
  it.each([
    ["CS 21 B001", "cs21b001"],
    ["cs21b001", "cs21b001"],
    [" CS-21-B001 ", "cs21b001"],
    ["CS.21.B001", "cs21b001"],
    ["२३/४५", "२३४५"],
  ])("normalizes %j", (input, expected) => {
    expect(normalizeIdentifier(input)).toBe(expected);
  });
});

describe("normalizeLabel", () => {
  it.each([
    ["Winner", "winner"],
    [" winner ", "winner"],
    ["WINNER", "winner"],
    ["Participant", "participant"],
    ["PARTICIPANT", "participant"],
    [" participant ", "participant"],
    ["1st Runner Up", "1st runner up"],
    [" 1st   RUNNER   UP ", "1st runner up"],
    ["2nd Runner Up", "2nd runner up"],
    ["2nd  runner   up", "2nd runner up"],
  ])("matches %j", (input, expectedKey) => {
    expect(normalizeLabel(input).key).toBe(expectedKey);
  });

  it("keeps the readable form", () => {
    expect(normalizeLabel("  Winner  ").display).toBe("Winner");
    expect(normalizeLabel("1st   Runner Up").display).toBe("1st Runner Up");
  });

  it.each(["Winer", "Runner Up", "win ner", "Winner!"])(
    "does not silently match %j with a known label",
    (input) => {
      expect(normalizeLabel(input).key).not.toBe("winner");
      expect(normalizeLabel(input).key).not.toBe("1st runner up");
    },
  );

  it("treats a typo as a separate key", () => {
    expect(normalizeLabel("Winer").key).not.toBe(normalizeLabel("Winner").key);
    expect(normalizeLabel("Winer").key).toBe("winer");
  });
});
