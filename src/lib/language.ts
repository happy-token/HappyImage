"use client";

import { useEffect, useState } from "react";

export type LanguagePreference = "system" | "zh-CN" | "en-US";
export type EffectiveLanguage = "zh-CN" | "en-US";

export const LANGUAGE_STORAGE_KEY = "happytoken:language";
export const LANGUAGE_CHANGE_EVENT = "happytoken:language-change";

export function getSystemLanguage(): EffectiveLanguage {
  if (typeof navigator === "undefined") return "zh-CN";
  return navigator.language.toLowerCase().startsWith("en") ? "en-US" : "zh-CN";
}

export function resolveLanguage(preference: LanguagePreference): EffectiveLanguage {
  return preference === "system" ? getSystemLanguage() : preference;
}

export function readLanguagePreference(): LanguagePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === "system" || stored === "zh-CN" || stored === "en-US" ? stored : "system";
}

export function saveLanguagePreference(preference: LanguagePreference) {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, preference);
  window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: preference }));
}

export function useLanguagePreference() {
  const [language, setLanguage] = useState<LanguagePreference>("system");

  useEffect(() => {
    const syncLanguage = () => setLanguage(readLanguagePreference());
    syncLanguage();
    window.addEventListener("storage", syncLanguage);
    window.addEventListener(LANGUAGE_CHANGE_EVENT, syncLanguage);
    return () => {
      window.removeEventListener("storage", syncLanguage);
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, syncLanguage);
    };
  }, []);

  return language;
}

export function useEffectiveLanguage() {
  return resolveLanguage(useLanguagePreference());
}
