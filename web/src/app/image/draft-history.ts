export type FreshDraftHistoryState = {
  historyLoadInFlight: boolean;
  skipNextHistoryRestore: boolean;
};

export function beginFreshDraftHistoryState(
  state: FreshDraftHistoryState
): FreshDraftHistoryState {
  return {
    ...state,
    skipNextHistoryRestore:
      state.skipNextHistoryRestore || state.historyLoadInFlight,
  };
}
