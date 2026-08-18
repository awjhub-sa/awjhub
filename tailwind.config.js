/** @type {import('tailwindcss').Config} */

/* Colours resolve to the --c-* variables declared in src/index.css.
   The <alpha-value> placeholder is what lets opacity modifiers keep working,
   so text-primary/30 and ring-primary/15 behave exactly as before. */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:       token('primary'),
        'primary-50':  token('primary-50'),
        'primary-100': token('primary-100'),
        'primary-200': token('primary-200'),
        'primary-400': token('primary-400'),
        'primary-700': token('primary-700'),
        'primary-900': token('primary-900'),

        accent:       token('accent'),
        'accent-50':  token('accent-50'),
        'accent-600': token('accent-600'),

        canvas:      token('canvas'),
        'on-canvas': token('on-canvas'),

        ink:       token('ink'),
        'ink-800': token('ink-800'),
        muted:     token('muted'),
        surface:   token('surface'),
        line:      token('line'),

        success: token('success'),
        warning: token('warning'),
        error:   token('error'),
        info:    token('info'),

        /* Legacy aliases — kept so older markup keeps compiling. */
        dark:       token('ink'),
        'dark-800': token('ink-800'),
        'dark-900': token('ink'),
        secondary:  token('muted'),
        background: token('bg'),
        appBorder:  token('line'),
      },
      fontFamily: {
        arabic: ['"Cairo"', 'Tahoma', 'sans-serif'],
      },
      /* Softer and more generous than Tailwind's defaults.
       *
       * Changed here rather than page by page: rounded-xl appears 409 times in
       * this codebase and rounded-2xl 369, so the shape of the whole system is
       * decided by these six numbers. Editing twenty screens to round a corner
       * would have guaranteed that three of them ended up different. */
      borderRadius: {
        md:    '0.625rem',   // 10px — chips, small controls
        lg:    '0.75rem',    // 12px — inputs, buttons
        xl:    '1rem',       // 16px — inner panels, icon tiles
        '2xl': '1.375rem',   // 22px — cards and sections
        '3xl': '1.75rem',    // 28px — drawers, dialogs
      },

      /* Two shadows stacked rather than one: a hairline that seats the card on
       * the page, and a wide soft pool beneath it. A single mid-blur shadow is
       * what makes an interface look like 2016 — it reads as a drop shadow
       * instead of as light. */
      boxShadow: {
        brand:      '0 2px 6px -2px rgb(var(--c-primary) / 0.24), 0 12px 32px -12px rgb(var(--c-primary) / 0.34)',
        'brand-lg': '0 4px 10px -3px rgb(var(--c-primary) / 0.28), 0 24px 56px -16px rgb(var(--c-primary) / 0.42)',
        gold:       '0 2px 6px -2px rgb(var(--c-accent) / 0.28), 0 12px 32px -12px rgb(var(--c-accent) / 0.40)',
        'gold-lg':  '0 4px 10px -3px rgb(var(--c-accent) / 0.32), 0 24px 56px -16px rgb(var(--c-accent) / 0.46)',
        card:       '0 1px 2px rgb(var(--c-ink) / 0.04), 0 8px 24px -10px rgb(var(--c-ink) / 0.14)',
        'card-lg':  '0 2px 4px rgb(var(--c-ink) / 0.05), 0 20px 48px -16px rgb(var(--c-ink) / 0.20)',
        /* For the hover lift — barely there, but the eye reads it as motion. */
        lift:       '0 4px 8px -4px rgb(var(--c-ink) / 0.10), 0 18px 40px -14px rgb(var(--c-ink) / 0.22)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, rgb(var(--c-primary-400)) 0%, rgb(var(--c-primary)) 50%, rgb(var(--c-primary-700)) 100%)',
        'gold-gradient':  'linear-gradient(135deg, rgb(var(--c-primary-400)) 0%, rgb(var(--c-primary)) 50%, rgb(var(--c-primary-700)) 100%)',
        'dark-gradient':  'linear-gradient(135deg, rgb(var(--c-ink-800)) 0%, rgb(var(--c-ink)) 100%)',
        'surface-tint':   'radial-gradient(ellipse at 20% 50%, rgb(var(--c-primary-50)) 0%, rgb(var(--c-bg)) 60%)',
        'cream-texture':  'radial-gradient(ellipse at 20% 50%, rgb(var(--c-primary-50)) 0%, rgb(var(--c-bg)) 60%)',
      },
    },
  },
  plugins: [],
}
