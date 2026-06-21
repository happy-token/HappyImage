export const externalModelAdminEnabled =
  String(process.env.NEXT_PUBLIC_EXTERNAL_MODEL_ADMIN || "").trim().toLowerCase()
    === "true";
