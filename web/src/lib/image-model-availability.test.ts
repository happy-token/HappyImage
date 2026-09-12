import { describe, expect, it } from "vitest";
import { isImageModelUnavailable } from "./image-model-availability";
import type { NewAPIManagementModel } from "./api";

describe("model availability", () => {
  const models: NewAPIManagementModel[] = [{
    model: "m", group: "image", billing_type: "per_request", price: 0.007,
    availability: { edit: { status: "unavailable", reason: "Unsupported" }, generate: { status: "available", reason: "OK" } },
  }];
  it("disables only the failing operation", () => {
    expect(isImageModelUnavailable(models, "m", "edit")).toBe(true);
    expect(isImageModelUnavailable(models, "m", "generate")).toBe(false);
  });
  it("allows unknown models to be verified by a real request", () => {
    expect(isImageModelUnavailable(models, "other", "edit")).toBe(false);
    expect(isImageModelUnavailable([], "m", "edit")).toBe(false);
  });
});
