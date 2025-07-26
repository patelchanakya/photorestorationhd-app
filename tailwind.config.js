/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        'playfair': ['PlayfairDisplay-Regular'],
        'playfair-medium': ['PlayfairDisplay-Medium'],
        'playfair-semibold': ['PlayfairDisplay-SemiBold'],
        'playfair-bold': ['PlayfairDisplay-Bold'],
        'playfair-italic': ['PlayfairDisplay-Italic'],
        'space-mono': ['SpaceMono'],
      },
    },
  },
  plugins: [],
}