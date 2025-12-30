import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get the API base URL from environment variables
 * Falls back to http://localhost:8000 if not set (for local development)
 */
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || "https://k.initqube.com";
}
