import type { Config } from "tailwindcss";

const config: Config = {
  /**
   * Identidade visual CLARA, como no sistema diário.
   *
   * Sem esta linha o Tailwind assume `darkMode: "media"` e as ~590 classes
   * `dark:` espalhadas pelos componentes ligam sozinhas quando o SISTEMA
   * OPERACIONAL do usuário está em modo escuro — a plataforma ficava escura na
   * máquina de quem apresenta sem ninguém ter escolhido isso.
   *
   * Com "class", o tema escuro só existe se alguém marcar `.dark` no <html>,
   * o que nada faz hoje. O cockpit é uma ferramenta de trabalho diurno e a
   * paleta institucional (azul/dourado Carreiro) foi desenhada sobre fundo claro.
   */
  darkMode: "class",
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
