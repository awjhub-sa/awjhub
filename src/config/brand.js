/**
 * src/config/brand.js
 * Single source of truth for tenant identity. Rebranding the product for a new
 * customer should mean editing this file and the matching CSS variables in
 * src/index.css — nothing else.
 *
 * Colours live in index.css as RGB channel triplets so Tailwind can apply
 * opacity modifiers (text-primary/30). The hex values below are for the places
 * Tailwind cannot reach: inline SVG attributes, canvas, and generated PDFs.
 * Keep the two in sync.
 */

export const BRAND = {
  /* Shown in the header, login card, PDF cover, and document title. */
  productName: 'أوج',
  productNameEn: 'AWJ',
  companyName: 'أوج',
  companyNameEn: 'AWJ',
  /* Full legal names, spelled exactly as they appear in the logo lockup. */
  companyFullAr: 'أوج لحلول الإعاشة',
  companyFullEn: 'AWJ For catering solutions',
  tagline: 'لحلول الإعاشة',

  /* Swap these files to rebrand.
     `full` is the horizontal lockup (444×180) — use it wherever there is
     width: the login card, the sidebar header. `color`/`mono` stay square for
     the tight 40×40 slots in the observer and supervisor headers, where the
     lockup would be squashed. */
  logo: {
    full:       '/brand/logo.svg',          // lockup, navy text — light surfaces
    fullOnDark: '/brand/logo-on-dark.svg',  // lockup, white text — navy surfaces
    color:      '/brand/icon.svg',          // square lockup, light surfaces
    icon:       '/brand/icon-mark.svg',     // square, letters only — small sizes
  },
};

/* Mirrors the --c-* variables in src/index.css. */
export const COLORS = {
  primary:    '#1B2A4A',
  primary400: '#3D5A8A',
  primary700: '#101B31',
  primary900: '#0A111F',
  primary50:  '#F1F4F9',
  primary100: '#E2E8F1',

  accent:     '#30D9CB',
  accent600:  '#0D9488',
  header:     '#29D4BB',

  ink:     '#16233D',
  muted:   '#64748B',
  bg:      '#F6F8FB',
  surface: '#FFFFFF',
  line:    '#E3E8EF',

  success: '#16A34A',
  warning: '#F59E0B',
  error:   '#DC2626',
  info:    '#0891B2',
};

export default BRAND;
