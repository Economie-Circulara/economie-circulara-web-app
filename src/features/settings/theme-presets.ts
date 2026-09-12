export interface ThemePreset {
  name: string;
  primaryColor: string;
  secondaryColor: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { name: "Padure", primaryColor: "#1f5e3a", secondaryColor: "#c8862b" },
  { name: "Industrie", primaryColor: "#334155", secondaryColor: "#0f9f8f" },
  { name: "Solar", primaryColor: "#7c3f16", secondaryColor: "#d6a11f" },
  { name: "Tehnic", primaryColor: "#164e63", secondaryColor: "#65a30d" },
];

export function colorPickerValue(value: string | null | undefined, fallback: string): string {
  const color = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}
