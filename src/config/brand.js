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
  /* Shown in the header, login card, report cover, and document title. */
  productName: 'نصاب',
  productNameEn: 'NSAB',
  companyName: 'نصاب',
  companyNameEn: 'NSAB',
  /* Full names, spelled exactly as they appear in the logo lockup. */
  companyFullAr: 'نصاب | لحلول الإعاشة',
  companyFullEn: 'NSAB Catering System',
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
  primary:    '#1E3A5F',
  primary400: '#3E6699',
  primary700: '#16304E',
  primary900: '#0D1E33',
  primary50:  '#F2F5F9',
  primary100: '#E1E8F1',

  accent:     '#B99A64',
  accent600:  '#8C7038',
  header:     '#B99A64',

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
