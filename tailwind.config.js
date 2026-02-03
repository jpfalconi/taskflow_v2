/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          zentask: {
            primary: '#7A7423',
            secondary: '#A7E82B',
            black: '#000000',
            bg: '#EAEBE9',
            orange: '#FF7628',
            blue: '#61C2FF',
            gold: '#D9B300',
            red: '#D64550',
          }
        },
        animation: {
            'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }
      }
    },
    plugins: [],
  }
