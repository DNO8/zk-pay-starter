import { describe, expect, test } from "bun:test";
import golden from "../vectors/golden.json";
import { decodeNote, encodeNote, parseNoteFields } from "./note";
import { commitment, nullifierHash } from "./note";

describe("GIVEN note encode/decode", () => {
  test("round-trips nullifier and secret", () => {
    const note = parseNoteFields(golden.notes[0].nullifier, golden.notes[0].secret);
    const back = decodeNote(encodeNote(note));
    expect(back.nullifier).toBe(note.nullifier);
    expect(back.secret).toBe(note.secret);
  });
});

describe("GAP-1 commitment matches vectors", () => {
  test("commitment matches vectors", () => {
    const note = parseNoteFields(golden.notes[0].nullifier, golden.notes[0].secret);
    expect(commitment(note).toString()).toBe(golden.notes[0].commitment);
  });

  test("nullifierHash matches vectors", () => {
    expect(nullifierHash(BigInt(golden.notes[0].nullifier)).toString()).toBe(
      golden.notes[0].nullifierHash,
    );
  });
});
