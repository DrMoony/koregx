// Self-contained cn — kept local to avoid pulling the shared barrel
// (which transitively imports server-only Clerk modules) into client bundles.
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
