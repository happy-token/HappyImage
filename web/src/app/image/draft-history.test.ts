import { describe, expect, it } from "vitest";

import { beginFreshDraftHistoryState } from "./draft-history";

describe("beginFreshDraftHistoryState", () => {
  it("keeps a new draft empty when conversation history is still loading", () => {
    const next = beginFreshDraftHistoryState({
      historyLoadInFlight: true,
      skipNextHistoryRestore: false,
    });

    expect(next.skipNextHistoryRestore).toBe(true);
  });

  it("does not leave a stale restore guard after history has loaded", () => {
    const next = beginFreshDraftHistoryState({
      historyLoadInFlight: false,
      skipNextHistoryRestore: false,
    });

    expect(next.skipNextHistoryRestore).toBe(false);
  });
});
