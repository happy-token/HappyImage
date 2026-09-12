import type { NewAPIManagementModel } from "./api";

export function imageModelState(
  models: NewAPIManagementModel[], model: string, mode: "generate" | "edit",
) {
  return models.find((item) => item.model === model)?.availability?.[mode];
}

export function isImageModelUnavailable(
  models: NewAPIManagementModel[], model: string, mode: "generate" | "edit",
) {
  return imageModelState(models, model, mode)?.status === "unavailable";
}
