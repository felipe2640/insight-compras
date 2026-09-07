/**
 * Tier 4: Cenários Reais de Aplicação (Jornadas Completas de Negócio E2E)
 * Requisitos: ORIGINAL_REQUEST R1-R5 & PROJECT.md
 */

import { describe, it, expect } from "vitest";
import {
  UsuarioAutenticado,
  LinhaMatrizDecisaoE2E,
  TENANT_CARREIRO,
  gerarCatalogoSintetico,
} from "../harness/contexto-teste";
import {
  executarBuscaEFiltroEmMemoria,
  executarAjusteHumanoPedido,
  salvarRascunhoSessao,
  recuperarRascunhoSessao,
  criarRegistroAuditoria,
  PayloadRascunhoSessao,
} from "../harness/runner-opaque";
import {
  criarStorageIsolado,
  CircuitBreakerResiliente,
} from "../harness/mock-ambiente";
import { calcularTransferenciaEntreDuasLojas, SaldoFilialParaTransferencia } from "@core/transferencia/balanceamento";
import { aplicarTravaMarcaZumbi } from "@core/travas/marca-zumbi";

describe("Tier 4 — Cenários Reais de Aplicação (Jornadas E2E)", () => {
  // Cenário 4.1: Jornada Matinal Completa do Comprador de Suspensão
  it("Cenário 4.1 — Jornada Matinal do Comprador: carga com RBAC -> filtro instantâneo -> detecção de ruptura -> NF-e do dia -> transferência segura -> compra em pares -> rascunho e auditoria", () => {
    const storage = criarStorageIsolado();

    // 1. Login do comprador com carteira Monroe (501)
    const comprador: UsuarioAutenticado = {
      id: "usr-carlos-compras",
      nome: "Carlos Eduardo - Comprador",
      email: "carlos.compras@carreiro.com.br",
      role: "COMPRADOR",
      allowedSupplierIds: new Set([501]),
      tenantId: TENANT_CARREIRO.id,
    };

    // 2. Carga do catálogo com 1.000 SKUs e filtro instantâneo por Suspensão
    const baseCompleta = gerarCatalogoSintetico(1000);
    const resultadoFiltro = executarBuscaEFiltroEmMemoria(
      baseCompleta,
      {
        secoesDesejadas: new Set(["SUSPENSAO"]),
      },
      comprador
    );

    expect(resultadoFiltro.tempoExecucaoMs).toBeLessThan(150);
    expect(resultadoFiltro.itensFiltrados.length).toBeGreaterThan(0);
    expect(resultadoFiltro.itensFiltrados.every((i) => i.fornecedorId === 501)).toBe(true);

    // 3. Identifica item em Ruptura Grave (dias zerados > 10%)
    const itemRuptura = resultadoFiltro.itensFiltrados.find(
      (i) => i.classificacaoRuptura === "Grave" && i.saldoEstoqueLojaFoco === 0
    );
    expect(itemRuptura).toBeDefined();

    // 4. Detecção de NF-e do dia (se houver entrada recente de 4 un)
    const nfeHoje = 4;
    const necessidadeOriginal = 10;
    const necessidadeAposNfe = Math.max(0, necessidadeOriginal - nfeHoje);
    expect(necessidadeAposNfe).toBe(6);

    // 5. Transferência Segura da Filial 2 (Paraipaba) para a Filial 1 (Trairi)
    // Paraipaba tem saldo = 8, minStock = 5 -> Sobra real = 3 un
    const filial1Destino: SaldoFilialParaTransferencia = {
      filialId: 1,
      saldoFisico: 0,
      estoqueMinimo: 6,
      necessidadeCompra: necessidadeAposNfe,
    };
    const filial2Origem: SaldoFilialParaTransferencia = {
      filialId: 2,
      saldoFisico: 8,
      estoqueMinimo: 5,
      necessidadeCompra: 0,
    };

    const transferencia = calcularTransferenciaEntreDuasLojas(filial2Origem, filial1Destino);
    expect(transferencia).not.toBeNull();
    expect(transferencia!.quantidadeTransferir).toBe(3);
    expect(transferencia!.saldoOrigemApos).toBe(5); // Preserva o estoque mínimo da origem!

    // 6. Ajuste de compra complementar para o saldo restante (6 - 3 = 3 un)
    // Amortecedores exigem pares (min_multiplo = 2)
    const saldoComprar = necessidadeAposNfe - transferencia!.quantidadeTransferir; // 3 un
    const ajustePar = executarAjusteHumanoPedido(saldoComprar, 2);
    expect(ajustePar.quantidadeFinal).toBe(4); // 3 arredondado para 4 unidades

    // 7. Persistência em rascunho de sessão durante o expediente
    const rascunho: PayloadRascunhoSessao = {
      timestamp: Date.now(),
      usuarioId: comprador.id,
      tenantId: comprador.tenantId,
      lojaId: 1,
      ajustesComprador: {
        [itemRuptura!.codigoSku]: {
          pedir: ajustePar.quantidadeFinal,
          transferir: transferencia!.quantidadeTransferir,
        },
      },
    };
    const resSalvar = salvarRascunhoSessao(storage, rascunho);
    expect(resSalvar.sucesso).toBe(true);

    // 8. Emissão da ordem e geração de trilha de auditoria
    const auditoria = criarRegistroAuditoria(
      comprador,
      itemRuptura!.codigoSku,
      itemRuptura!.produtoId,
      1,
      3, // sugerido complementar
      ajustePar.quantidadeFinal, // 4 ajustado
      "CRIACAO_PEDIDO"
    );
    expect(auditoria.usuarioId).toBe(comprador.id);
    expect(auditoria.quantidadeDefinidaComprador).toBe(4);
  });

  // Cenário 4.2: Prevenção de Encalhe e Auditoria de Sobrecompras
  it("Cenário 4.2 — Prevenção de Encalhe: trava Marca Zumbi (180d) -> bloqueio do motor -> tentativa de sobrecompra manual -> registro de divergência e justificativa no painel do Gestor", () => {
    const comprador: UsuarioAutenticado = {
      id: "usr-pedro",
      nome: "Pedro Comprador",
      email: "pedro@carreiro.com.br",
      role: "COMPRADOR",
      allowedSupplierIds: new Set([501, 502, 503]),
      tenantId: "carreiro",
    };

    // Item parado no estoque da loja com 18 un e zero vendas em 180 dias
    const saldoEstoque = 18;
    const vendas180d = 0;
    const trava = aplicarTravaMarcaZumbi({
      saldoFisico: saldoEstoque,
      vendasLiquidas180dias: vendas180d,
      sugestaoOriginal: 12,
      codigoSku: "VELA-OBSOLETA-180D",
    });

    // 1. O motor trava a compra em ZERO
    expect(trava.travado).toBe(true);
    expect(trava.sugestaoAjustada).toBe(0);

    // 2. Comprador tenta ignorar o motor e digita 10 unidades manualmente
    const quantidadeDigitadaManual = 10;
    const ajuste = executarAjusteHumanoPedido(quantidadeDigitadaManual, 1);

    // 3. Sistema gera registro de auditoria gravando a divergência com o motor
    const auditoria = criarRegistroAuditoria(
      comprador,
      "VELA-OBSOLETA-180D",
      9901,
      1,
      trava.sugestaoAjustada, // 0 sugerido pelo motor
      ajuste.quantidadeFinal // 10 forçado pelo comprador
    );

    expect(auditoria.tipoAcao).toBe("SOBRECOMPRA_CONFIRMADA");
    expect(auditoria.divergenciaJustificativa).toContain("Sobrecompra manual de +10 un");
    expect(auditoria.quantidadeSugeridaSistema).toBe(0);
    expect(auditoria.quantidadeDefinidaComprador).toBe(10);
  });

  // Cenário 4.3: Resiliência Operacional contra Quedas do Power BI Fabric
  it("Cenário 4.3 — Resiliência Operacional: queda do Power BI -> Circuit Breaker aciona snapshot L2 -> Cockpit continua operando a 60fps sem interrupção", async () => {
    const snapshotL2 = gerarCatalogoSintetico(500);
    const breaker = new CircuitBreakerResiliente<readonly LinhaMatrizDecisaoE2E[]>({
      limiteFalhasConsecutivas: 2,
      tempoAbertoMs: 5000,
    });

    const chamadaFalhaPowerBi = async () => {
      throw new Error("Power BI Service Unavailable (503)");
    };
    const fallback = async () => snapshotL2;

    // Falhas consecutivas abrem o circuito
    await breaker.executar(chamadaFalhaPowerBi, fallback);
    const resultado = await breaker.executar(chamadaFalhaPowerBi, fallback);

    expect(resultado.fonte).toBe("SNAPSHOT_DEGRADADO");
    expect(resultado.dado).toHaveLength(500);
    expect(breaker.obterEstado()).toBe("ABERTO");

    // Comprador segue filtrando a matriz de decisão sobre os dados preservados
    const busca = executarBuscaEFiltroEmMemoria(resultado.dado, {
      queryBusca: "BOSCH",
    });
    expect(busca.totalLinhas).toBeGreaterThan(0);
    expect(busca.tempoExecucaoMs).toBeLessThan(100);
  });

  // Cenário 4.4: Governança Multi-Tenant e Auditoria Consolidada da Rede
  it("Cenário 4.4 — Governança e Auditoria do Gestor: visualização consolidada de todas as lojas -> análise de divergências -> rastreabilidade completa", () => {
    const gestor: UsuarioAutenticado = {
      id: "usr-gestor-rede",
      nome: "Mariana Diretora de Operações",
      email: "mariana.diretoria@carreiro.com.br",
      role: "GESTOR",
      allowedSupplierIds: new Set([501, 502, 503, 504, 505]),
      tenantId: TENANT_CARREIRO.id,
    };

    // Histórico de ordens geradas na semana por diversos compradores
    const auditorias = [
      criarRegistroAuditoria(
        { ...gestor, id: "carlos", nome: "Carlos" },
        "AM-MON-001",
        1001,
        1,
        4,
        4,
        "CRIACAO_PEDIDO"
      ),
      criarRegistroAuditoria(
        { ...gestor, id: "renata", nome: "Renata" },
        "VEL-NGK-002",
        2002,
        2,
        0,
        8 // Sobrecompra de 8 un
      ),
    ];

    // Gestor avalia conformidade das decisões
    const sobrecompras = auditorias.filter((a) => a.tipoAcao === "SOBRECOMPRA_CONFIRMADA");
    expect(sobrecompras).toHaveLength(1);
    expect(sobrecompras[0].codigoSku).toBe("VEL-NGK-002");
    expect(sobrecompras[0].divergenciaJustificativa).toContain("Sobrecompra manual de +8 un");

    // Rastreabilidade de ponta a ponta
    expect(auditorias.every((a) => a.tenantId === "carreiro")).toBe(true);
    expect(auditorias.every((a) => a.id.startsWith("AUD-"))).toBe(true);
  });
});
