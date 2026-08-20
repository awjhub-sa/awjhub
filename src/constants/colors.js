/* Kept for the modules that already import COLORS from here. The palette now
   lives in src/config/brand.js, which mirrors the --c-* variables in
   src/index.css — this file only re-shapes it to the older key names, so the
   two can no longer drift apart. */
import { COLORS as BRAND } from '../config/brand.js';

export const COLORS = {
  primary:    BRAND.primary,
  dark:       BRAND.ink,
  secondary:  BRAND.muted,
  background: BRAND.bg,
  white:      '#FFFFFF',
  error:      BRAND.error,
  success:    BRAND.success,
  border:     BRAND.line,
  surface:    BRAND.surface,
};

export default COLORS;
