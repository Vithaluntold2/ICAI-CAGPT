/**
 * Platform detection for keyboard-shortcut hint rendering.
 * Evaluated once at module load; never reacts to runtime platform changes
 * (not a real-world concern — platform doesn't change mid-session).
 */
export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export const MOD = isMac ? '⌘' : 'Ctrl';
export const SHIFT = isMac ? '⇧' : 'Shift';
export const RETURN = isMac ? '↵' : 'Enter';
export const OPTION = isMac ? '⌥' : 'Alt';
