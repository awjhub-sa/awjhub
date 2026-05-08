/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:    '#A98159',
        dark:       '#2D2926',
        secondary:  '#6D6E71',
        background: '#FDFCFB',
        appBorder:  '#D1C4B9',
        success:    '#386B41',
        error:      '#BA1A1A',
        // tints
        'primary-50':  '#FAF6F1',
        'primary-100': '#F3EAE0',
        'primary-200': '#E5D0B8',
        'primary-900': '#3A2C1E',
        'dark-800':    '#4A3F3A',
        'dark-900':    '#1A1511',
      },
      fontFamily: {
        arabic: ['"IBM Plex Sans Arabic"', '"Noto Kufi Arabic"', 'Tahoma', 'sans-serif'],
      },
      boxShadow: {
        'gold':    '0 4px 24px rgba(169,129,89,0.18)',
        'gold-lg': '0 8px 40px rgba(169,129,89,0.25)',
        'card':    '0 2px 16px rgba(45,41,38,0.08)',
        'card-lg': '0 8px 32px rgba(45,41,38,0.12)',
      },
      backgroundImage: {
        'gold-gradient':    'linear-gradient(135deg, #C4A46E 0%, #A98159 50%, #8B6840 100%)',
        'dark-gradient':    'linear-gradient(135deg, #3D3330 0%, #2D2926 100%)',
        'cream-texture':    'radial-gradient(ellipse at 20% 50%, #F5EFE8 0%, #FDFCFB 60%)',
      },
    },
  },
  plugins: [],
}
