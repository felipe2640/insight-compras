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
   * paleta institucional do cliente foi desenhada sobre fundo claro.
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
        /**
         * As duas cores da marca vêm pelos canais RGB, e não pelo hex, para
         * que o Tailwind consiga aplicar opacidade: `border-secundaria/30`,
         * `bg-primaria/10`. Com `var(--cor-primaria)` cru, toda classe com
         * barra de opacidade sobre a cor do cliente deixava de pintar — que é
         * por onde os hexadecimais escritos à mão tinham entrado.
         */
        primaria: {
          DEFAULT: "rgb(var(--cor-primaria-rgb) / <alpha-value>)",
          hover: "var(--cor-primaria-hover)",
        },
        secundaria: {
          DEFAULT: "rgb(var(--cor-secundaria-rgb) / <alpha-value>)",
          hover: "var(--cor-secundaria-hover)",
        },
        acento: "var(--cor-acento)",
        fundo: "var(--cor-fundo)",
        card: "var(--cor-card)",
        borda: "var(--cor-borda)",
        texto: "var(--cor-texto)",
        textoSecundario: "var(--cor-texto-secundario)",
        destaqueMultiplo: "rgb(var(--cor-destaque-multiplo-rgb) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};

export default config;
