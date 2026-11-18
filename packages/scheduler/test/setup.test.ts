import { describe, expect, it } from "vitest";
import { FSRS6Algorithm, FSRS6_DEFAULT_WEIGHTS, FSRS6_MODEL_BOUNDS } from "ts-fsrs/models/fsrs-6";
import pkg from "../package.json" with { type: "json" };

describe("toolchain", () => {
  it("pins ts-fsrs to an exact version", () => {
    expect(pkg.dependencies["ts-fsrs"]).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("exposes the FSRS-6 entry points the scheduler relies on", () => {
    expect(FSRS6Algorithm).toBeTypeOf("function");
    expect(FSRS6_DEFAULT_WEIGHTS).toHaveLength(21);
    expect(FSRS6_MODEL_BOUNDS).toBeDefined();
  });
});
