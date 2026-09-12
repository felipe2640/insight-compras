/**
 * Provedor em Memória do Ciclo de Vida de Pedidos (Fallback para Modo Demo e Testes)
 * Camada: Aplicação / Pedidos / Provedores (src/lib/pedidos/provedores/memoria.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import {
  FiltrosListagemPedidos,
  ParametrosTransicaoPedido,
  RepositorioPedidos,
} from "../porta-repositorio";
import { ItemPedido, Pedido, StatusPedido, TransicaoPedido } from "../tipos";
import { criarRegistroTransicao, validarTransicaoStatus } from "../ciclo-vida";

function criarPedidosDemo(tenantId: string): { pedidos: Pedido[]; itensPorPedido: Map<number, ItemPedido[]> } {
  const agora = Date.now();
  const diaMs = 86_400_000;

  const itens1001: ItemPedido[] = [
    {
      id: 1,
      sku: "AM-MON-001",
      descricao: "Amortecedor Dianteiro Monr. G8000",
      qtdComprador: 12,
      qtdTransferencia: 0,
      qtdModelo: 12,
      custo: 150.0,
      valorTotal: 1800.0,
    },
    {
      id: 2,
      sku: "KT-MON-002",
      descricao: "Kit Batente + Coifa Diant. Monroe",
      qtdComprador: 12,
      qtdTransferencia: 0,
      qtdModelo: 10,
      custo: 45.0,
      valorTotal: 540.0,
    },
  ];

  const itens1002: ItemPedido[] = [
    {
      id: 3,
      sku: "PA-COF-002",
      descricao: "Pastilha Freio Diant. Cerâmica Cofap",
      qtdComprador: 20,
      qtdTransferencia: 4,
      qtdModelo: 20,
      custo: 75.0,
      valorTotal: 1500.0,
    },
    {
      id: 4,
      sku: "PA-COF-003",
      descricao: "Pastilha Freio Traseira Cofap",
      qtdComprador: 10,
      qtdTransferencia: 0,
      qtdModelo: 10,
      custo: 60.0,
      valorTotal: 600.0,
    },
  ];

  const itens1003: ItemPedido[] = [
    {
      id: 5,
      sku: "DS-VAR-003",
      descricao: "Disco Freio Ventilado BD0540 Varga",
      qtdComprador: 8,
      qtdTransferencia: 2,
      qtdModelo: 10,
      custo: 110.0,
      valorTotal: 880.0,
    },
  ];

  const itens1004: ItemPedido[] = [
    {
      id: 6,
      sku: "CX-DIR-004",
      descricao: "Caixa Direção Hidráulica Reman. TRW",
      qtdComprador: 4,
      qtdTransferencia: 0,
      qtdModelo: 4,
      custo: 650.0,
      valorTotal: 2600.0,
    },
    {
      id: 7,
      sku: "BD-DIR-005",
      descricao: "Bomba Direção Hidráulica ZF",
      qtdComprador: 4,
      qtdTransferencia: 0,
      qtdModelo: 3,
      custo: 320.0,
      valorTotal: 1280.0,
    },
  ];

  // Pedido 1001: Recebido (ciclo completo)
  const hist1001: TransicaoPedido[] = [
    {
      de: "exportado",
      para: "enviado",
      dataHora: new Date(agora - 3 * diaMs).toISOString(),
      responsavel: "carlos.comprador@insightcompras.com.br",
      observacao: "Pedido formal enviado por e-mail e portal B2B.",
    },
    {
      de: "enviado",
      para: "confirmado",
      dataHora: new Date(agora - 2 * diaMs).toISOString(),
      responsavel: "carlos.comprador@insightcompras.com.br",
      observacao: "Fornecedor faturou NF-e 45892 com previsão de entrega 24h.",
    },
    {
      de: "confirmado",
      para: "recebido",
      dataHora: new Date(agora - 1 * diaMs).toISOString(),
      responsavel: "almoxarifado.loja1@insightcompras.com.br",
      observacao: "Mercadoria conferida e guardada no estoque físico.",
    },
  ];

  const p1001: Pedido = {
    id: 1001,
    tenantId,
    exportadoEm: new Date(agora - 4 * diaMs).toISOString(),
    usuario: "carlos.comprador@insightcompras.com.br",
    filialId: 1,
    modeloId: "pedido_fornecedor",
    formato: "xlsx",
    totalItens: itens1001.length,
    status: "recebido",
    enviadoEm: hist1001[0].dataHora,
    enviadoPor: hist1001[0].responsavel,
    confirmadoEm: hist1001[1].dataHora,
    confirmadoPor: hist1001[1].responsavel,
    recebidoEm: hist1001[2].dataHora,
    recebidoPor: hist1001[2].responsavel,
    historico: hist1001,
  };

  // Pedido 1002: Confirmado
  const hist1002: TransicaoPedido[] = [
    {
      de: "exportado",
      para: "enviado",
      dataHora: new Date(agora - 2 * diaMs).toISOString(),
      responsavel: "ana.suprimentos@insightcompras.com.br",
      observacao: "Transmitido via EDI ao fornecedor Cofap.",
    },
    {
      de: "enviado",
      para: "confirmado",
      dataHora: new Date(agora - 1 * diaMs).toISOString(),
      responsavel: "ana.suprimentos@insightcompras.com.br",
      observacao: "Confirmação recebida com número de pedido fornecedor #COF-8821.",
    },
  ];

  const p1002: Pedido = {
    id: 1002,
    tenantId,
    exportadoEm: new Date(agora - 3 * diaMs).toISOString(),
    usuario: "ana.suprimentos@insightcompras.com.br",
    filialId: 2,
    modeloId: "pedido_fornecedor",
    formato: "csv",
    totalItens: itens1002.length,
    status: "confirmado",
    enviadoEm: hist1002[0].dataHora,
    enviadoPor: hist1002[0].responsavel,
    confirmadoEm: hist1002[1].dataHora,
    confirmadoPor: hist1002[1].responsavel,
    recebidoEm: null,
    recebidoPor: null,
    historico: hist1002,
  };

  // Pedido 1003: Enviado
  const hist1003: TransicaoPedido[] = [
    {
      de: "exportado",
      para: "enviado",
      dataHora: new Date(agora - 1 * diaMs).toISOString(),
      responsavel: "carlos.comprador@insightcompras.com.br",
      observacao: "Enviado por e-mail com espelho de pedido anexo.",
    },
  ];

  const p1003: Pedido = {
    id: 1003,
    tenantId,
    exportadoEm: new Date(agora - 2 * diaMs).toISOString(),
    usuario: "carlos.comprador@insightcompras.com.br",
    filialId: 1,
    modeloId: "pedido_fornecedor",
    formato: "pdf",
    totalItens: itens1003.length,
    status: "enviado",
    enviadoEm: hist1003[0].dataHora,
    enviadoPor: hist1003[0].responsavel,
    confirmadoEm: null,
    confirmadoPor: null,
    recebidoEm: null,
    recebidoPor: null,
    historico: hist1003,
  };

  // Pedido 1004: Exportado (aguardando envio)
  const p1004: Pedido = {
    id: 1004,
    tenantId,
    exportadoEm: new Date(agora - 4 * 3600 * 1000).toISOString(),
    usuario: "carlos.comprador@insightcompras.com.br",
    filialId: 1,
    modeloId: "pedido_fornecedor",
    formato: "xlsx",
    totalItens: itens1004.length,
    status: "exportado",
    enviadoEm: null,
    enviadoPor: null,
    confirmadoEm: null,
    confirmadoPor: null,
    recebidoEm: null,
    recebidoPor: null,
    historico: [],
  };

  const mapa = new Map<number, ItemPedido[]>();
  mapa.set(1001, itens1001);
  mapa.set(1002, itens1002);
  mapa.set(1003, itens1003);
  mapa.set(1004, itens1004);

  return { pedidos: [p1004, p1003, p1002, p1001], itensPorPedido: mapa };
}

export class RepositorioPedidosMemoria implements RepositorioPedidos {
  public readonly id = "memoria" as const;
  private readonly pedidosPorTenant = new Map<string, Pedido[]>();
  private readonly itensPorPedido = new Map<number, ItemPedido[]>();

  constructor(private readonly inicializarComDemo: boolean = true) {}

  private assegurarDados(tenantId: string): Pedido[] {
    let lista = this.pedidosPorTenant.get(tenantId);
    if (!lista) {
      if (this.inicializarComDemo) {
        const demo = criarPedidosDemo(tenantId);
        lista = demo.pedidos;
        this.pedidosPorTenant.set(tenantId, lista);
        for (const [pId, itens] of demo.itensPorPedido.entries()) {
          this.itensPorPedido.set(pId, itens);
        }
      } else {
        lista = [];
        this.pedidosPorTenant.set(tenantId, lista);
      }
    }
    return lista;
  }

  public async listarPedidos(filtros: FiltrosListagemPedidos): Promise<readonly Pedido[]> {
    const lista = this.assegurarDados(filtros.tenantId);
    const desde = Date.now() - filtros.dias * 86_400_000;

    return lista
      .filter((p) => {
        if (Date.parse(p.exportadoEm) < desde) return false;
        if (filtros.filialId && p.filialId !== filtros.filialId) return false;
        if (filtros.status && p.status !== filtros.status) return false;
        return true;
      })
      .slice(0, filtros.limite ?? 100);
  }

  public async obterPedidoPorId(tenantId: string, pedidoId: number): Promise<Pedido | null> {
    const lista = this.assegurarDados(tenantId);
    const p = lista.find((item) => item.id === pedidoId);
    return p ? { ...p } : null;
  }

  public async listarItensDoPedido(tenantId: string, pedidoId: number): Promise<readonly ItemPedido[]> {
    this.assegurarDados(tenantId);
    const itens = this.itensPorPedido.get(pedidoId) ?? [];
    return [...itens];
  }

  public async atualizarStatusPedido(params: ParametrosTransicaoPedido): Promise<Pedido> {
    const lista = this.assegurarDados(params.tenantId);
    const indice = lista.findIndex((p) => p.id === params.pedidoId);

    if (indice === -1) {
      throw new Error(`Pedido #${params.pedidoId} não encontrado para o tenant '${params.tenantId}'.`);
    }

    const pedidoAtual = lista[indice];
    const validacao = validarTransicaoStatus(pedidoAtual.status, params.novoStatus);
    if (!validacao.valido) {
      throw new Error(validacao.motivo);
    }

    const dataHoraTransicao = params.dataHora ?? new Date().toISOString();
    const transicao = criarRegistroTransicao({
      de: pedidoAtual.status,
      para: params.novoStatus,
      responsavel: params.responsavel,
      observacao: params.observacao,
      dataHora: dataHoraTransicao,
    });

    const dadosTransicao: {
      enviadoEm?: string | null;
      enviadoPor?: string | null;
      confirmadoEm?: string | null;
      confirmadoPor?: string | null;
      recebidoEm?: string | null;
      recebidoPor?: string | null;
    } = {};

    if (params.novoStatus === "enviado") {
      dadosTransicao.enviadoEm = dataHoraTransicao;
      dadosTransicao.enviadoPor = params.responsavel;
    } else if (params.novoStatus === "confirmado") {
      dadosTransicao.confirmadoEm = dataHoraTransicao;
      dadosTransicao.confirmadoPor = params.responsavel;
    } else if (params.novoStatus === "recebido") {
      dadosTransicao.recebidoEm = dataHoraTransicao;
      dadosTransicao.recebidoPor = params.responsavel;
    }

    const pedidoAtualizado: Pedido = Object.freeze({
      ...pedidoAtual,
      ...dadosTransicao,
      status: params.novoStatus,
      historico: [...pedidoAtual.historico, transicao],
    });

    lista[indice] = pedidoAtualizado;
    this.pedidosPorTenant.set(params.tenantId, lista);

    return pedidoAtualizado;
  }

  public adicionarPedido(pedido: Pedido, itens?: readonly ItemPedido[]): void {
    const lista = this.assegurarDados(pedido.tenantId);
    const normalizado: Pedido = Object.freeze({
      enviadoEm: null,
      enviadoPor: null,
      confirmadoEm: null,
      confirmadoPor: null,
      recebidoEm: null,
      recebidoPor: null,
      ...pedido,
    });
    lista.unshift(normalizado);
    this.pedidosPorTenant.set(pedido.tenantId, lista);
    if (itens) {
      this.itensPorPedido.set(pedido.id, [...itens]);
    }
  }

  public limpar(tenantId?: string): void {
    if (tenantId) {
      this.pedidosPorTenant.delete(tenantId);
    } else {
      this.pedidosPorTenant.clear();
      this.itensPorPedido.clear();
    }
  }
}
