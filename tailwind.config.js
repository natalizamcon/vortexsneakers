/** Colores de marca VORTEX: turquesa #08BFC5 · morado #7928CA · lila #B76AF2 · tinta #10142C */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Montserrat", "system-ui", "sans-serif"] },
      colors: {
        cyan: { 50: "#e6f9fa", 100: "#c5f1f3", 200: "#9fe6ea", 300: "#5fd9dd", 400: "#2ccdd2", 500: "#08BFC5", 600: "#07a9ae", 700: "#06777b", 800: "#055f62", 900: "#044548" },
        purple: { 50: "#f4ebfd", 100: "#ead7fb", 200: "#d9b8f8", 300: "#c99af5", 400: "#B76AF2", 500: "#B76AF2", 600: "#7928CA", 700: "#7928CA", 800: "#641fa8", 900: "#4e1883" },
        slate: { 900: "#10142C" },
      },
    },
  },
  plugins: [],
};
