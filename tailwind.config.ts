import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primaria: {
          DEFAULT: "var(--cor-primaria)",
          hover: "var(--cor-primaria-hover)",
        },
        secundaria: {
          DEFAULT: "var(--cor-secundaria)",
          hover: "var(--cor-secundaria-hover)",
        },
        acento: "var(--cor-acento)",
        fundo: "var(--cor-fundo)",
        card: "var(--cor-card)",
        borda: "var(--cor-borda)",
        texto: "var(--cor-texto)",
        textoSecundario: "var(--cor-texto-secundario)",
        destaqueMultiplo: "var(--cor-destaque-multiplo)",
      },
    },
  },
  plugins: [],
};

export default config;
