import { clsx, type ClassValue } from "clsx";

/** Joins conditional class names. Brand tokens keep classes conflict-free, so no merge library is needed. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
