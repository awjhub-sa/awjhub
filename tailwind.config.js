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
      boxShadow: {
        brand:      '0 4px 24px rgb(var(--c-primary) / 0.18)',
        'brand-lg': '0 8px 40px rgb(var(--c-primary) / 0.25)',
        gold:       '0 4px 24px rgb(var(--c-primary) / 0.18)',
        'gold-lg':  '0 8px 40px rgb(var(--c-primary) / 0.25)',
        card:       '0 2px 16px rgb(var(--c-ink) / 0.08)',
        'card-lg':  '0 8px 32px rgb(var(--c-ink) / 0.12)',
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
