import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Teach tailwind-merge our custom tokens so e.g. `text-2` (colour) and `text-body` (size) don't
 * cancel each other, and `shadow-float` / `rounded-composer` merge like the built-ins.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['hero', 'title', 'body', 'caption', 'meta', 'code'],
      shadow: ['float', 'input'],
      radius: ['composer'],
    },
    classGroups: {
      'text-color': [{ text: ['1', '2', '3', '4'] }],
    },
  },
})

/** Merge class names; later Tailwind classes win over earlier conflicting ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
