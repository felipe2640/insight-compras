/**
 * Provedor de Auditoria Durável via Supabase (PostgREST)
 * Camada: Aplicação / Auditoria / Provedores (src/lib/auditoria/provedores/supabase.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { sbExcluir, sbInserir, sbSelecionar } from "@/lib/aprendizado/supabase";
import { AuditoriaPedido, ClassificacaoDivergencia, FiltrosConsultaAuditoria, TipoAcaoAuditoria } from "../tipos";
import { RepositorioAuditoria } from "../porta-repositorio";

interface LinhaAuditoriaDb {
  id: string;
  tenant_id: string;
  timestamp: string;
  comprador_id: string;
  comprador_nome: string;
  comprador_email: string;
  comprador_papel: string;
  filial_id: number;
  filial_nome: string | null;
  produto_id: number | string;
  codigo_sku: string;
  descricao_produto: string | null;
  fornecedor_id: number | string;
  nome_fornecedor: string | null;
  quantidade_sugerida_sistema: number | string;
  quantidade_digitada_comprador: number | string;
  divergencia_quantidade: number | string;
  divergencia_percentual: number | string | null;
  preco_custo_unitario: number | string;
  impacto_financeiro_divergencia: number | string;
  tipo_acao: string;
  classificacao_divergencia: string;
  justificativa_override: string | null;
  hash_registro_anterior: string;
  hash_integridade: string;
  sequencia?: number | string;
  criado_em?: string;
}

function converterLinhaParaRegistro(linha: LinhaAuditoriaDb): AuditoriaPedido {
  return Object.freeze({
    id: String(linha.id),
    timestamp: String(linha.timestamp),
    tenantId: String(linha.tenant_id),
    compradorId: String(linha.comprador_id),
    compradorNome: String(linha.comprador_nome),
    compradorEmail: String(linha.comprador_email),
    compradorPapel: linha.comprador_papel as "COMPRADOR" | "GESTOR" | "ADMIN",
    filialId: Number(linha.filial_id),
    filialNome: linha.filial_nome ?? undefined,
    produtoId: Number(linha.produto_id),
    codigoSku: String(linha.codigo_sku),
    descricaoProduto: linha.descricao_produto ?? undefined,
    fornecedorId: Number(linha.fornecedor_id),
    nomeFornecedor: linha.nome_fornecedor ?? undefined,
    quantidadeSugeridaSistema: Number(linha.quantidade_sugerida_sistema),
    quantidadeDigitadaComprador: Number(linha.quantidade_digitada_comprador),
    divergenciaQuantidade: Number(linha.divergencia_quantidade),
    divergenciaPercentual:
      linha.divergencia_percentual === null || linha.divergencia_percentual === undefined
        ? null
        : Number(linha.divergencia_percentual),
    precoCustoUnitario: Number(linha.preco_custo_unitario),
    impactoFinanceiroDivergencia: Number(linha.impacto_financeiro_divergencia),
    tipoAcao: linha.tipo_acao as TipoAcaoAuditoria,
    classificacaoDivergencia: linha.classificacao_divergencia as ClassificacaoDivergencia,
    justificativaOverride: linha.justificativa_override,
    hashRegistroAnterior: String(linha.hash_registro_anterior),
    hashIntegridade: String(linha.hash_integridade),
  });
}

export class RepositorioAuditoriaSupabase implements RepositorioAuditoria {
  public readonly id = "supabase";

  public async adicionarRegistro(registro: AuditoriaPedido): Promise<void> {
    await sbInserir("auditoria_pedido", {
      id: registro.id,
      tenant_id: registro.tenantId,
      timestamp: registro.timestamp,
      comprador_id: registro.compradorId,
      comprador_nome: registro.compradorNome,
      comprador_email: registro.compradorEmail,
      comprador_papel: registro.compradorPapel,
      filial_id: registro.filialId,
      filial_nome: registro.filialNome ?? null,
      produto_id: registro.produtoId,
      codigo_sku: registro.codigoSku,
      descricao_produto: registro.descricaoProduto ?? null,
      fornecedor_id: registro.fornecedorId,
      nome_fornecedor: registro.nomeFornecedor ?? null,
      quantidade_sugerida_sistema: registro.quantidadeSugeridaSistema,
      quantidade_digitada_comprador: registro.quantidadeDigitadaComprador,
      divergencia_quantidade: registro.divergenciaQuantidade,
      divergencia_percentual: registro.divergenciaPercentual,
      preco_custo_unitario: registro.precoCustoUnitario,
      impacto_financeiro_divergencia: registro.impactoFinanceiroDivergencia,
      tipo_acao: registro.tipoAcao,
      classificacao_divergencia: registro.classificacaoDivergencia,
      justificativa_override: registro.justificativaOverride ?? null,
      hash_registro_anterior: registro.hashRegistroAnterior,
      hash_integridade: registro.hashIntegridade,
    }, { acesso: "privilegiado" });
  }

  public async obterUltimoRegistro(tenantId: string): Promise<AuditoriaPedido | null> {
    const linhas = await sbSelecionar<LinhaAuditoriaDb>(
      "auditoria_pedido",
      `tenant_id=eq.${encodeURIComponent(tenantId)}&order=criado_em.desc,timestamp.desc&limit=1`
    );

    if (!linhas || linhas.length === 0) return null;
    return converterLinhaParaRegistro(linhas[0]);
  }

  public async consultar(filtros: FiltrosConsultaAuditoria): Promise<readonly AuditoriaPedido[]> {
    let consulta = `tenant_id=eq.${encodeURIComponent(filtros.tenantId)}`;

    if (filtros.compradorId) {
      consulta += `&comprador_id=eq.${encodeURIComponent(filtros.compradorId)}`;
    }
    if (filtros.fornecedorId) {
      consulta += `&fornecedor_id=eq.${filtros.fornecedorId}`;
    }
    if (filtros.filialId) {
      consulta += `&filial_id=eq.${filtros.filialId}`;
    }
    if (filtros.apenasSobrecompras) {
      consulta += `&classificacao_divergencia=eq.SOBRECOMPRA`;
    }
    if (filtros.dataInicio) {
      consulta += `&timestamp=gte.${encodeURIComponent(filtros.dataInicio)}`;
    }
    if (filtros.dataFim) {
      consulta += `&timestamp=lte.${encodeURIComponent(filtros.dataFim)}`;
    }

    const limite = Math.min(5000, Math.max(1, filtros.limite ?? 1000));
    consulta += `&order=criado_em.asc,timestamp.asc&limit=${limite}`;

    const linhas = await sbSelecionar<LinhaAuditoriaDb>("auditoria_pedido", consulta);
    return linhas.map(converterLinhaParaRegistro);
  }

  public async obterTodos(tenantId: string): Promise<readonly AuditoriaPedido[]> {
    const linhas = await sbSelecionar<LinhaAuditoriaDb>(
      "auditoria_pedido",
      `tenant_id=eq.${encodeURIComponent(tenantId)}&order=criado_em.asc,timestamp.asc&limit=10000`
    );
    return linhas.map(converterLinhaParaRegistro);
  }

  public async limpar(tenantId?: string): Promise<void> {
    const consulta = tenantId
      ? `tenant_id=eq.${encodeURIComponent(tenantId)}`
      : `id=not.is.null`;
    await sbExcluir("auditoria_pedido", consulta, { acesso: "privilegiado" });
  }
}
