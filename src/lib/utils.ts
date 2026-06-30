import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clase Tailwind in mod sigur (folosit si de componentele shadcn/ui din T0.2).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
