import { describe, expect, it } from "vitest";

import { promptRequiresReferenceImage } from "./prompt-reference";

describe("promptRequiresReferenceImage", () => {
  it("detects prompts that ask for an attached facial reference image", () => {
    expect(
      promptRequiresReferenceImage(
        "Use the attached image for facial reference. Preserve the exact facial identity.",
      ),
    ).toBe(true);
  });

  it("detects Chinese reference image wording", () => {
    expect(promptRequiresReferenceImage("请根据这张图保持人脸身份，生成电影感照片")).toBe(true);
  });

  it("does not flag ordinary text-to-image prompts", () => {
    expect(promptRequiresReferenceImage("A tiny blue square icon on a plain white background.")).toBe(false);
  });

  it("does not require uploads for ordinary face or identity descriptions", () => {
    expect(promptRequiresReferenceImage("生成一张电影感人像，保持自然脸部特征和真实身份感")).toBe(false);
    expect(promptRequiresReferenceImage("A photorealistic portrait that preserves natural facial features.")).toBe(false);
  });

  it("does not require uploads for gallery prompt templates mentioning a reference image generically", () => {
    expect(
      promptRequiresReferenceImage(
        "Premium technical infographic of [OBJECT]. Use the reference image only to understand the shape and structure of the object, without copying the same photo, angle, composition, or background.",
      ),
    ).toBe(false);
  });
});
