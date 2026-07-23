import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        nhs: { blue: "#005EB8", dark: "#003087", green: "#007F3B", red: "#DA291C", amber: "#FFB81C", grey: "#425563" }
      }
    }
  },
  plugins: []
};
export default config;
