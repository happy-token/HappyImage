export type LoginMode = "reuse" | "sync" | "force";

export function resolveLoginMode(search: string): LoginMode {
  const params = new URLSearchParams(search);
  if (params.get("force") === "1") {
    return "force";
  }
  if (params.get("sync") === "1") {
    return "sync";
  }
  return "reuse";
}
