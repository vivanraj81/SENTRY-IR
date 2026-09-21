/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#11141A',
        panel: '#1B1E25',
        'panel-alt': '#23272F',
        accent: '#4C9EFF',
        critical: '#F24545',
        warning: '#F2A633',
        success: '#4AAC8C',
        primary: '#F1F3F5',
        secondary: '#9AA3B2',
        muted: '#6F7785',
        border: '#303642',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
