/**
 * Suíte de Testes do Adaptador Carreiro, Cliente DAX e Fábrica
 * Camada: Adapters / Carreiro
 * Requisitos: ORIGINAL_REQUEST R1 & PROJECT.md
 */

import { describe, it, expect, vi } from "vitest";
import { ClienteDaxPowerBI } from "@adapters/carreiro/cliente-dax";
import { AdaptadorInventarioCarreiro } from "@adapters/carreiro/adaptador-carreiro";
import { AdaptadorInventarioMock } from "@adapters/mock/adaptador-mock";
import { obterAdaptadorInventario } from "@adapters/index";

describe("Adaptador Carreiro & Cliente DAX REST API (Marco 2)", () => {
  describe("ClienteDaxPowerBI", () => {
    it("deve detectar ausência de credenciais e recusar execução sem configuração", async () => {
      const clienteSemCredenciais = new ClienteDaxPowerBI({
        tenantId: "",
        clientId: "",
        clientSecret: "",
        accessTokenFixo: "",
      });

      expect(clienteSemCredenciais.possuiConfiguracaoAtiva()).toBe(false);
      await expect(
        clienteSemCredenciais.executarConsultaDax("EVALUATE ROW(\"X\", 1)")
      ).rejects.toThrow("variáveis de ambiente do Power BI Fabric não configuradas");
    });

    it("deve autenticar via OAuth2 e executar query com payload padronizado", async () => {
      const mockFetch = vi.fn();

      // 1. Resposta de Token OAuth2
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "MOCK_BEARER_TOKEN_AZURE",
          expires_in: 3600,
        }),
      });

      // 2. Resposta de executeQueries
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              tables: [
                {
                  rows: [
                    {
                      "PRODUTOS[ACODPRODUTO]": 100,
                      "PRODUTOS[ADESCRICAO]": "AMORTECEDOR FIAT",
                      "PRODUTOS[NESTOQATUAL]": 20,
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });

      const cliente = new ClienteDaxPowerBI({
        tenantId: "mock-tenant-id",
        clientId: "mock-client-id",
        clientSecret: "mock-client-secret",
        fetchCustomizado: mockFetch as unknown as typeof fetch,
      });

      expect(cliente.possuiConfiguracaoAtiva()).toBe(true);

      const linhas = await cliente.executarConsultaDax("EVALUATE PRODUTOS");
      expect(linhas).toHaveLength(1);
      expect(linhas[0].ACODPRODUTO).toBe(100);
      expect(linhas[0].ADESCRICAO).toBe("AMORTECEDOR FIAT");
      expect(linhas[0].NESTOQATUAL).toBe(20);

      // Verifica as duas chamadas de fetch (token + query)
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toContain("login.microsoftonline.com");
      expect(mockFetch.mock.calls[1][0]).toContain("executeQueries");
      expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe(
        "Bearer MOCK_BEARER_TOKEN_AZURE"
      );
    });
  });

  describe("AdaptadorInventarioCarreiro", () => {
    it("deve orquestrar consultas DAX e retornar RespostaCargaInventario consolidada", async () => {
      const mockFetch = vi.fn();

      // 4 queries paralelas do carregarInventarioCompleto:
      // 1. Produtos/Estoque
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              tables: [
                {
                  rows: [
                    {
                      "PRODUTOS[ACODPRODUTO]": 501,
                      "PRODUTOS[ACODEMPRESA]": 1,
                      "PRODUTOS[ADESCRICAO]": "DISCO DE FREIO FREMAX",
                      "PRODUTOS[AMARCA]": "FREMAX",
                      "PRODUTOS[NESTOQATUAL]": 14,
                      "PRODUTOS[NPRECOCOMPRA]": 90,
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });

      // 2. Histórico
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              tables: [
                {
                  rows: [
                    {
                      "PRODUTOS[ACODPRODUTO]": 501,
                      "CADEMP[ACODEMP]": 1,
                      VendasQtd30d: 5,
                      VendasQtd90d: 15,
                      VendasQtd180d: 30,
                      NotasVenda90d: 8,
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });

      // 3. Entradas
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              tables: [
                {
                  rows: [
                    {
                      Produto: 501,
                      Filial: 1,
                      Quantidade: 10,
                      Observacao: "NF-888999",
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });

      // 4. Similares
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              tables: [
                {
                  rows: [],
                },
              ],
            },
          ],
        }),
      });

      const clienteDax = new ClienteDaxPowerBI({
        accessTokenFixo: "TOKEN_FIXO",
        fetchCustomizado: mockFetch as unknown as typeof fetch,
      });

      const adaptador = new AdaptadorInventarioCarreiro({ clienteDax });
      const inventario = await adaptador.carregarInventarioCompleto({
        fornecedoresPermitidos: null,
      });

      expect(inventario.produtos).toHaveLength(1);
      expect(inventario.produtos[0].id).toBe(501);
      expect(inventario.produtos[0].loteMultiplo).toBe(2); // Disco de freio = lote 2 (par)
      expect(inventario.estoques.get("501:1")?.saldoFisico).toBe(14);
      expect(inventario.historicos.get("501:1")?.vendasLiquidas90dias).toBe(15);
      expect(inventario.entradasHoje).toHaveLength(1);
      expect(inventario.entradasHoje[0].numeroNotaFiscal).toBe("NF-888999");
      expect(inventario.metadados.provedor).toBe("POWERBI_FABRIC_DAX");
      expect(inventario.metadados.emModoDegradado).toBe(false);
    });

    it("deve verificar a saúde de conexão executando freshness.dax", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ tables: [{ rows: [{ UltimaDataNota: "2026-09-05" }] }] }],
        }),
      });

      const cliente = new ClienteDaxPowerBI({
        accessTokenFixo: "TOKEN",
        fetchCustomizado: mockFetch as unknown as typeof fetch,
      });

      const adaptador = new AdaptadorInventarioCarreiro({ clienteDax: cliente });
      const saude = await adaptador.verificarSaudeConexao();
      expect(saude).toBe(true);
    });
  });

  describe("Fábrica obterAdaptadorInventario", () => {
    it("deve retornar AdaptadorInventarioMock quando solicitado explicitamente", () => {
      const adapter = obterAdaptadorInventario({ tipo: "MOCK" });
      expect(adapter).toBeInstanceOf(AdaptadorInventarioMock);
    });

    it("deve retornar AdaptadorInventarioCarreiro quando tipo for CARREIRO", () => {
      const adapter = obterAdaptadorInventario({ tipo: "CARREIRO" });
      expect(adapter).toBeInstanceOf(AdaptadorInventarioCarreiro);
    });

    it("deve fazer fallback gracioso para Mock no modo AUTO quando sem credenciais Fabric", () => {
      const adapter = obterAdaptadorInventario({ tipo: "AUTO" });
      expect(adapter).toBeInstanceOf(AdaptadorInventarioMock);
    });
  });
});
