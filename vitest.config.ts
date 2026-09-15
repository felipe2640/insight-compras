import { defineConfig } from "vitest/config";
import path from "path";

/**
 * ATENÇÃO AO JSDOM: a dependência está fixada em ^26 de propósito.
 *
 * jsdom >= 28 puxa `html-encoding-sniffer@6` e `@asamuzakjp/css-color`, que fazem
 * `require()` de pacotes ESM-only. Isso só funciona no Node >= 22.12 (onde
 * require(esm) foi liberado); o jsdom 30 chega a declarar
 * `engines: node ^22.22.2 || ^24.15.0 || >=26`. Como o npm apenas AVISA sobre
 * engine incompatível, no Node 20 a instalação passa e a quebra aparece só na
 * execução — as suítes de UI abaixo morriam com ERR_REQUIRE_ESM antes de coletar
 * um único teste, sem falhar a suíte (viravam "unhandled error").
 *
 * Quando o projeto subir para Node >= 22.12, é seguro voltar para o jsdom mais novo.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    environmentMatchGlobs: [["tests/cockpit/**", "jsdom"]],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "./core"),
      "@adapters": path.resolve(__dirname, "./adapters"),
      "@config": path.resolve(__dirname, "./config"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
