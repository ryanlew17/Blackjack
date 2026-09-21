import type { Language } from "../infrastructure/save";
export function formatChips(value: number, language: Language): string {
  return (value / 100).toLocaleString(language === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: 1,
  });
}
