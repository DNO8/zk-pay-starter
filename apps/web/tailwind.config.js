/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0E0E0C",
        paper: "#EDE6D6",
        graphite: "#5E5C57",
        amber: "#E8A33D",
      },
    },
  },
  plugins: [],
};
