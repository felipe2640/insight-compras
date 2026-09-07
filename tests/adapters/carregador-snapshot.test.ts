/**
 * Suíte de Testes do Carregador de Snapshot Real da Carreiro
 * Camada: Adapters / Carreiro
 * 100% em Português do Brasil (pt-BR).
 */

import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import {
  localizarDiretorioSnapshot,
  carregarSnapshotCarreiroLocal,
} from "@adapters/carreiro/carregador-snapshot-local";
import { AdaptadorInventarioCarreiro } from "@adapters/carreiro/adaptador-carreiro";

describe("Carregador de Snapshot Real Carreiro (Adapters / Carreiro)", () => {
  it("deve localizar o diretório padrão de dados da Carreiro quando presente no disco", () => {
    const dir = localizarDiretorioSnapshot();
    if (dir) {
      expect(fs.existsSync(dir)).toBe(true);
      expect(fs.existsSync(path.join(dir, "current_product.json"))).toBe(true);
    } else {
      // Se não existir no ambiente de execução, deve retornar null graciosamente
      expect(dir).toBeNull();
    }
  });

  it("deve retornar null para diretório inexistente", () => {
    const dirInexistente = path.resolve(process.cwd(), "pasta_que_nao_existe_12345");
    expect(localizarDiretorioSnapshot(dirInexistente)).toBeNull();
  });

  it("deve carregar dados reais e montar a RespostaCargaInventario com integridade caso o snapshot exista", async () => {
    const dir = localizarDiretorioSnapshot();
    if (!dir) {
      console.log("[Teste Snapshot] Snapshot não localizado neste ambiente, ignorando teste de carga pesada.");
      return;
    }

    const resultado = await carregarSnapshotCarreiroLocal(dir);

    expect(resultado.produtos.length).toBeGreaterThan(1000);
    expect(resultado.estoques.size).toBeGreaterThan(1000);
    expect(resultado.metadados.provedor).toBe("CARREIRO_SNAPSHOT_LOCAL");
    expect(resultado.metadados.emModoDegradado).toBe(false);

    // Valida primeiro produto carregado
    const primeiro = resultado.produtos[0];
    expect(primeiro.id).toBeGreaterThan(0);
    expect(primeiro.codigoSku.length).toBeGreaterThan(0);
    expect(primeiro.descricao.length).toBeGreaterThan(0);

    // Valida mapeamento de filiais
    const chavesEstoque = Array.from(resultado.estoques.keys());
    expect(chavesEstoque.length).toBeGreaterThan(0);
    const primeiraChave = chavesEstoque[0];
    expect(primeiraChave).toContain(":");
  });

  it("deve permitir que o AdaptadorInventarioCarreiro utilize o snapshot local de forma transparente", async () => {
    const dir = localizarDiretorioSnapshot();
    if (!dir) return;

    const adaptador = new AdaptadorInventarioCarreiro({
      diretorioSnapshot: dir,
    });

    const saude = await adaptador.verificarSaudeConexao();
    expect(saude).toBe(true);

    const carga = await adaptador.carregarInventarioCompleto({ fornecedoresPermitidos: null });
    expect(carga.produtos.length).toBeGreaterThan(0);
    expect(carga.metadados.provedor).toBe("CARREIRO_SNAPSHOT_LOCAL");
  });
});
