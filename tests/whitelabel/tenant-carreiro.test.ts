/**
 * Suíte de Testes Automatizados: White-Label e Configuração do Tenant Carreiro
 * Requisitos: ORIGINAL_REQUEST R5, PROJECT.md Feature #26
 * 100% em Português do Brasil (pt-BR).
 */

import { describe, it, expect } from "vitest";
import {
  TENANT_CARREIRO,
  TENANT_PADRAO,
  CATALOGO_TENANTS,
  obterConfiguracaoTenant,
  hexParaRgb,
  gerarVariaveisCssTenant,
  gerarStringCssVarsInline,
} from "@config/tenants";
import { NOMES_FILIAIS_CARREIRO } from "@adapters/carreiro/mapeador-dax";

describe("White-Label — Configuração do Tenant Carreiro e Catálogo Central", () => {
  describe("1. Identidade e Cores Institucionais", () => {
    it("deve conter identificador e nomes oficiais da Rede Carreiro", () => {
      expect(TENANT_CARREIRO.id).toBe("carreiro");
      expect(TENANT_CARREIRO.nome).toBe("Rede Carreiro Autopeças");
      expect(TENANT_CARREIRO.razaoSocial).toContain("Rede Carreiro");
      expect(TENANT_CARREIRO.subdominioPrincipal).toBe("carreiro.insightd.com.br");
      expect(TENANT_CARREIRO.customDomain).toBe("compras.carreiro.com.br");
    });

    it("deve possuir a paleta de cores institucional com Azul e Dourado Carreiro", () => {
      expect(TENANT_CARREIRO.cores.primaria).toBe("#0F2B5C"); // Azul Carreiro
      expect(TENANT_CARREIRO.cores.secundaria).toBe("#D4AF37"); // Dourado Carreiro
      expect(TENANT_CARREIRO.cores.fundoDestaqueMultiplo).toBe("#FFFFCC"); // Amarelo Pastel Cockpit
      expect(TENANT_CARREIRO.cores.primariaHover).toBe("#0A1E40");
      expect(TENANT_CARREIRO.cores.secundariaHover).toBe("#B89628");
    });

    it("deve conter identidade visual e assinatura Powered by iNSIGHT D", () => {
      expect(TENANT_CARREIRO.identidadeVisual.logoClaro).toBeDefined();
      expect(TENANT_CARREIRO.identidadeVisual.logoEscuro).toBeDefined();
      expect(TENANT_CARREIRO.identidadeVisual.favicon).toBeDefined();
      expect(TENANT_CARREIRO.assinatura.exibir).toBe(true);
      expect(TENANT_CARREIRO.assinatura.texto).toBe("Powered by iNSIGHT D");
      expect(TENANT_CARREIRO.assinatura.url).toBe("https://insightd.com.br");
    });
  });

  describe("2. Conversão Hexadecimal para RGB", () => {
    it("deve converter cores hexadecimais para canais numéricos e string CSS", () => {
      const azul = hexParaRgb("#0F2B5C");
      expect(azul.r).toBe(15);
      expect(azul.g).toBe(43);
      expect(azul.b).toBe(92);
      expect(azul.cssRgb).toBe("15, 43, 92");

      const dourado = hexParaRgb("#D4AF37");
      expect(dourado.r).toBe(212);
      expect(dourado.g).toBe(175);
      expect(dourado.b).toBe(55);
      expect(dourado.cssRgb).toBe("212, 175, 55");
    });

    it("deve aceitar hex de 3 dígitos (#FFF)", () => {
      const branco = hexParaRgb("#FFF");
      expect(branco.r).toBe(255);
      expect(branco.g).toBe(255);
      expect(branco.b).toBe(255);
      expect(branco.cssRgb).toBe("255, 255, 255");
    });

    it("deve retornar fallback seguro caso o valor hexadecimal seja inválido", () => {
      const invalido = hexParaRgb("invalido");
      expect(invalido.cssRgb).toBe("15, 43, 92"); // Fallback azul
    });
  });

  describe("3. Mapeamento das 5 Filiais Oficiais da Rede Carreiro", () => {
    it("deve conter exatamente 5 filiais ativas", () => {
      expect(TENANT_CARREIRO.filiais).toHaveLength(5);
      expect(TENANT_CARREIRO.filiais.every((f) => f.ativa)).toBe(true);
    });

    it("deve possuir a Loja 1 como Matriz e as Lojas 2 a 5 como Filiais", () => {
      const matriz = TENANT_CARREIRO.filiais.find((f) => f.filialId === 1);
      expect(matriz).toBeDefined();
      expect(matriz?.tipo).toBe("matriz");
      expect(matriz?.codigo).toBe("MATRIZ");

      const outrasFiliais = TENANT_CARREIRO.filiais.filter((f) => f.filialId !== 1);
      expect(outrasFiliais).toHaveLength(4);
      expect(outrasFiliais.every((f) => f.tipo === "filial")).toBe(true);
    });

    it("deve manter sincronia rigorosa com os nomes oficiais mapeados do DAX", () => {
      for (const filial of TENANT_CARREIRO.filiais) {
        expect(NOMES_FILIAIS_CARREIRO[filial.filialId]).toBe(filial.nome);
      }
    });

    it("deve conter IDs únicos de 1 a 5", () => {
      const ids = TENANT_CARREIRO.filiais.map((f) => f.filialId).sort();
      expect(ids).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("4. Geração de Variáveis CSS e Injeção Inline sem FOUC", () => {
    it("deve gerar mapa de variáveis CSS com canais hex e rgb", () => {
      const vars = gerarVariaveisCssTenant(TENANT_CARREIRO);
      expect(vars["--cor-primaria"]).toBe("#0F2B5C");
      expect(vars["--cor-primaria-rgb"]).toBe("15, 43, 92");
      expect(vars["--cor-secundaria"]).toBe("#D4AF37");
      expect(vars["--cor-secundaria-rgb"]).toBe("212, 175, 55");
      expect(vars["--cor-destaque-multiplo"]).toBe("#FFFFCC");
      expect(vars["--cor-fundo"]).toBe("#F8FAFC");
    });

    it("deve formatar string CSS inline válida para o <style> do SSR", () => {
      const cssString = gerarStringCssVarsInline(TENANT_CARREIRO);
      expect(cssString).toContain("--cor-primaria: #0F2B5C;");
      expect(cssString).toContain("--cor-secundaria: #D4AF37;");
      expect(cssString).toContain("--cor-destaque-multiplo: #FFFFCC;");
    });
  });

  describe("5. Catálogo e Resolução O(1) de Tenants", () => {
    it("deve resolver tenant por slug/id (case-insensitive)", () => {
      expect(obterConfiguracaoTenant("carreiro")).toBe(TENANT_CARREIRO);
      expect(obterConfiguracaoTenant("CARREIRO")).toBe(TENANT_CARREIRO);
      expect(obterConfiguracaoTenant(" Carreiro ")).toBe(TENANT_CARREIRO);
    });

    it("deve resolver tenant por subdomínio principal ou alternativo", () => {
      expect(obterConfiguracaoTenant("carreiro.insightd.com.br")).toBe(TENANT_CARREIRO);
      expect(obterConfiguracaoTenant("carreiro.local")).toBe(TENANT_CARREIRO);
    });

    it("deve resolver tenant por domínio customizado", () => {
      expect(obterConfiguracaoTenant("compras.carreiro.com.br")).toBe(TENANT_CARREIRO);
    });

    it("deve retornar TENANT_PADRAO quando o identificador for nulo, indefinido ou vazio", () => {
      expect(obterConfiguracaoTenant(null)).toBe(TENANT_PADRAO);
      expect(obterConfiguracaoTenant(undefined)).toBe(TENANT_PADRAO);
      expect(obterConfiguracaoTenant("")).toBe(TENANT_PADRAO);
    });

    it("deve retornar TENANT_PADRAO em fallback para identificador não cadastrado", () => {
      expect(obterConfiguracaoTenant("tenant-inexistente")).toBe(TENANT_PADRAO);
    });

    it("deve conter o tenant Carreiro no catálogo indexado", () => {
      expect(CATALOGO_TENANTS["carreiro"]).toBe(TENANT_CARREIRO);
    });
  });
});
