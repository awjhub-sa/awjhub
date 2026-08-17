/**
 * src/context/BrandContext.jsx
 *
 * Loads the tenant's identity from org_settings and applies it at runtime.
 *
 * The colours are written onto :root as `--c-*` variables, which is the same
 * place index.css declares them — so every existing `text-primary`,
 * `bg-accent/10` and inline gradient in the app follows a new customer's
 * palette without one component being touched.
 *
 * brand.js remains the fallback: it is what a fresh install shows, and what
 * paints the first frame before the row arrives.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { db } from '../lib/db.js';
import { BRAND as DEFAULT_BRAND, COLORS as DEFAULT_COLORS } from '../config/brand.js';

const BrandContext = createContext(null);

/* Tailwind's <alpha-value> needs "R G B", not "#RRGGBB". */
function toChannels(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/* Mixes toward white/black so a customer supplying one primary still gets the
   tints the UI expects, instead of having to name seven colours. */
function shade(hex, amount) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const mix = (c) => Math.round(amount > 0 ? c + (255 - c) * amount : c * (1 + amount));
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `${r} ${g} ${b}`;
}

const VAR_MAP = [
  ['--c-primary',     s => toChannels(s.colorPrimary)],
  ['--c-primary-400', s => toChannels(s.colorPrimary400) || shade(s.colorPrimary, 0.25)],
  ['--c-primary-700', s => toChannels(s.colorPrimary700) || shade(s.colorPrimary, -0.35)],
  ['--c-primary-900', s => shade(s.colorPrimary700 || s.colorPrimary, -0.45)],
  ['--c-primary-50',  s => shade(s.colorPrimary, 0.94)],
  ['--c-primary-100', s => shade(s.colorPrimary, 0.87)],
  ['--c-primary-200', s => shade(s.colorPrimary, 0.76)],
  ['--c-accent',      s => toChannels(s.colorAccent)],
  ['--c-accent-600',  s => toChannels(s.colorAccent600) || shade(s.colorAccent, -0.35)],
  ['--c-accent-50',   s => shade(s.colorAccent, 0.92)],
  /* Falls back to the accent so a tenant who never touches it still gets a bar
     that matches the rest of their palette. */
  ['--c-header',      s => toChannels(s.colorHeader) || toChannels(s.colorAccent)],
  ['--c-ink',         s => toChannels(s.colorInk)],
  ['--c-ink-800',     s => shade(s.colorInk, 0.18)],
  ['--c-on-canvas',   s => toChannels(s.colorInk)],
];

export function applyPalette(settings) {
  if (!settings) return;
  const root = document.documentElement;
  for (const [name, get] of VAR_MAP) {
    const value = get(settings);
    if (value) root.style.setProperty(name, value);
  }
}

/**
 * The compiled-in identity, in the shape of a settings row.
 *
 * This is the product's own look — what a fresh install shows and what the
 * restore button returns to. It reads from brand.js so there is one definition
 * of "the original", not a copy here that drifts from it.
 *
 * Deliberately excludes the legal and contact fields: a commercial
 * registration and a phone number are facts about whoever installed the system,
 * not part of a visual identity, and wiping them on a restore would be
 * destroying data the button did not promise to touch.
 */
export function defaultIdentity() {
  return {
    nameAr:     DEFAULT_BRAND.companyName,
    nameEn:     DEFAULT_BRAND.companyNameEn,
    fullNameAr: DEFAULT_BRAND.companyFullAr,
    fullNameEn: DEFAULT_BRAND.companyFullEn,
    tagline:    DEFAULT_BRAND.tagline,

    logoFull:   DEFAULT_BRAND.logo.full,
    logoOnDark: DEFAULT_BRAND.logo.fullOnDark,
    logoSquare: DEFAULT_BRAND.logo.color,
    logoMark:   DEFAULT_BRAND.logo.icon,

    colorPrimary:    DEFAULT_COLORS.primary,
    colorPrimary400: DEFAULT_COLORS.primary400,
    colorPrimary700: DEFAULT_COLORS.primary700,
    colorAccent:     DEFAULT_COLORS.accent,
    colorAccent600:  DEFAULT_COLORS.accent600,
    colorHeader:     DEFAULT_COLORS.header,
    colorInk:        DEFAULT_COLORS.ink,
  };
}

/** Merges a settings row over the compiled-in defaults. */
export function toBrand(settings) {
  if (!settings) return { ...DEFAULT_BRAND, colors: DEFAULT_COLORS };
  return {
    ...DEFAULT_BRAND,
    productName:   settings.nameAr     || DEFAULT_BRAND.productName,
    productNameEn: settings.nameEn     || DEFAULT_BRAND.productNameEn,
    companyName:   settings.nameAr     || DEFAULT_BRAND.companyName,
    companyNameEn: settings.nameEn     || DEFAULT_BRAND.companyNameEn,
    companyFullAr: settings.fullNameAr || DEFAULT_BRAND.companyFullAr,
    companyFullEn: settings.fullNameEn || DEFAULT_BRAND.companyFullEn,
    tagline:       settings.tagline    || DEFAULT_BRAND.tagline,
    logo: {
      full:       settings.logoFull   || DEFAULT_BRAND.logo.full,
      fullOnDark: settings.logoOnDark || DEFAULT_BRAND.logo.fullOnDark,
      color:      settings.logoSquare || DEFAULT_BRAND.logo.color,
      icon:       settings.logoMark   || DEFAULT_BRAND.logo.icon,
    },
    legal: {
      crNumber: settings.crNumber, vatNumber: settings.vatNumber,
      address:  settings.address,  phone: settings.phone,
      email:    settings.email,    website: settings.website,
    },
    colors: {
      ...DEFAULT_COLORS,
      primary:    settings.colorPrimary    || DEFAULT_COLORS.primary,
      primary400: settings.colorPrimary400 || DEFAULT_COLORS.primary400,
      primary700: settings.colorPrimary700 || DEFAULT_COLORS.primary700,
      accent:     settings.colorAccent     || DEFAULT_COLORS.accent,
      accent600:  settings.colorAccent600  || DEFAULT_COLORS.accent600,
      header:     settings.colorHeader     || DEFAULT_COLORS.header,
      ink:        settings.colorInk        || DEFAULT_COLORS.ink,
    },
  };
}

export function BrandProvider({ children }) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    /* Subscribed, not fetched once: an admin editing the palette should see
       every screen change as they pick, and so should anyone else logged in. */
    return db.org_settings.subscribe(rows => {
      const row = rows[0] || null;
      setSettings(row);
      applyPalette(row);
    });
  }, []);

  const value = useMemo(() => ({ brand: toBrand(settings), settings }), [settings]);
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  const ctx = useContext(BrandContext);
  /* Falls back rather than throwing: a component rendered outside the provider
     — a PDF worker, a test — should still draw with the default identity. */
  return ctx || { brand: toBrand(null), settings: null };
}
