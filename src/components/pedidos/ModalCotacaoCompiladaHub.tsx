"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Send,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
  Store,
  Layers,
  Mail,
  UserCheck,
  Building2,
  FileSpreadsheet,
  FileText,
  Tag,
  Hash,
  Check,
} from "lucide-react";
import { Pedido, ItemPedido } from "@/lib/pedidos/tipos";
import { cn } from "@/lib/utils";

interface SupplierInfo {
  id: string;
  name: string;
  email?: string;
}

const MARCAS_POPULARES = [
  "Gates",
  "Dayco",
  "Contitech",
  "Bosch",
  "Cofap",
  "Nakata",
  "Monroe",
  "TRW",
  "SABÓ",
  "Fremax",
  "Varga",
  "Magneti Marelli",
  "SKF",
  "NGK",
  "Valeo",
  "Fras-le",
] as const;

interface CatalogProductInfo {
  id: number;
  sku: string;
  descricao: string;
  marca: string;
  fabricante: string;
  referencia: string;
}

interface HubStatus {
  portalOrigin: string;
  applicationId: string;
  suppliers: SupplierInfo[];
  units?: Record<string, string>;
  catalogProducts?: CatalogProductInfo[];
  submissions: { externalId: string; quotationId?: string; state: string }[];
  drafts: { id: string; supplierExternalId: string; destinationId: string; state: string; items: Record<string, string>[] }[];
}

interface ItemComFilial extends ItemPedido {
  filialId: number;
  filialNome: string;
  pedidoId: number;
}

interface EdicaoLinhaPedido {
  quantidade: number;
  description: string;
  requested_reference: string;
  requested_brand: string;
  accepted_brands: string;
  observacao?: string;
}

interface ModalCotacaoCompiladaHubProps {
  pedidos: Pedido[];
  nomesFiliais: Record<number, string>;
  onClose: () => void;
  onSucesso: (mensagem: string) => void;
}

function resolverNomeExibicao(f: { id: string; name: string; email?: string }): string {
  if (f.name && !f.name.startsWith("Fornecedor 2000") && f.name !== `Fornecedor ${f.id}`) {
    return f.name;
  }
  if (f.email) {
    const domain = f.email.split("@")[1]?.toLowerCase();
    if (domain) {
      const parts = domain.split(".")[0];
      if (parts && !["gmail", "hotmail", "outlook", "yahoo", "bol", "uol", "terra", "live"].includes(parts)) {
        return parts.charAt(0).toUpperCase() + parts.slice(1);
      }
    }
  }
  const idLimpo = f.id.replace(/^20+/, "");
  return f.name || `Fornecedor ${idLimpo || f.id}`;
}

function extrairQuantidadeItem(it: ItemPedido): number {
  if (Number.isSafeInteger(it.qtdComprador) && it.qtdComprador !== null && it.qtdComprador !== undefined) {
    return Math.max(0, it.qtdComprador);
  }
  if (Number.isSafeInteger(it.quantidade) && it.quantidade !== null && it.quantidade !== undefined) {
    return Math.max(0, it.quantidade);
  }
  return 0;
}

export function ModalCotacaoCompiladaHub({
  pedidos,
  nomesFiliais,
  onClose,
  onSucesso,
}: ModalCotacaoCompiladaHubProps) {
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [hubStatus, setHubStatus] = useState<HubStatus | null>(null);
  const [itensCompilados, setItensCompilados] = useState<ItemComFilial[]>([]);

  // Edição de itens e observações
  const [edicoesLinhas, setEdicoesLinhas] = useState<Record<string, EdicaoLinhaPedido>>({});
  const [linhaEmEdicao, setLinhaEmEdicao] = useState<string | null>(null);
  const [skuEmEdicao, setSkuEmEdicao] = useState<string | null>(null);
  const [observacoesGerais, setObservacoesGerais] = useState("");
  const attemptRef = React.useRef<{ fingerprint: string; externalId: string; deadline: string }>();

  // Fornecedores e e-mails
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [supplierEmails, setSupplierEmails] = useState<Record<string, string>>({});
  const [buscaFornecedor, setBuscaFornecedor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [feedbackEnvio, setFeedbackEnvio] = useState<string | null>(null);
  const [cotacaoEnviadaId, setCotacaoEnviadaId] = useState<string | null>(null);

  // Carregar itens dos pedidos selecionados e status do Cotação Hub
  useEffect(() => {
    let ativo = true;

    async function inicializar() {
      setCarregando(true);
      setErroCarregamento(null);

      try {
        // 1. Carregar status do Hub e lista de fornecedores com e-mails
        const rHub = await fetch("/api/cotacao-hub", { cache: "no-store" });
        const dadosHub: HubStatus = rHub.ok ? await rHub.json() : null;

        // 2. Carregar itens de cada um dos pedidos selecionados
        const buscasItens = pedidos.map(async (p) => {
          try {
            const r = await fetch(`/api/pedidos/historico?pedidoId=${p.id}`);
            if (!r.ok) return [];
            const corpo = (await r.json()) as { itens?: ItemPedido[] };
            const lista = corpo.itens ?? [];
            const filialId = p.filialId ?? 1;
            const filialNome = p.filialNome ?? nomesFiliais[filialId] ?? `Loja ${filialId}`;

            return lista.map((item) => ({
              ...item,
              filialId,
              filialNome,
              pedidoId: p.id,
            }));
          } catch {
            return [];
          }
        });

        const resultadosItens = await Promise.all(buscasItens);
        const todosItens: ItemComFilial[] = resultadosItens.flat();

        if (ativo) {
          setHubStatus(dadosHub);
          setItensCompilados(todosItens);
        }
      } catch (err) {
        if (ativo) {
          setErroCarregamento("Não foi possível carregar os dados dos pedidos ou da conexão do Cotação Hub.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void inicializar();

    return () => {
      ativo = false;
    };
  }, [pedidos, nomesFiliais]);

  // Função pura para resolver o produto no catálogo com ID real e dados de fabricante
  const obterProdutoResolvido = React.useCallback((it: ItemComFilial) => {
    // 1. Tenta por produtoId exato
    if (it.produtoId && it.produtoId > 0 && hubStatus?.catalogProducts) {
      const cat = hubStatus.catalogProducts.find((cp) => cp.id === it.produtoId);
      if (cat) {
        return {
          produtoId: cat.id,
          sku: cat.sku || it.sku || `PROD-${cat.id}`,
          descricao: it.descricao || cat.descricao || "Sem descrição",
          marca: cat.marca || it.marca || "",
          referencia: cat.referencia || it.referenciaFabricante || "",
        };
      }
    }
    // 2. Tenta por SKU no catálogo (exato ou sem zeros à esquerda)
    if (it.sku && hubStatus?.catalogProducts) {
      const skuLimpo = it.sku.trim().toUpperCase();
      const skuSemZeros = skuLimpo.replace(/^0+/, "");
      const cat = hubStatus.catalogProducts.find((cp) => {
        const cpSku = cp.sku.trim().toUpperCase();
        const cpSkuSemZeros = cpSku.replace(/^0+/, "");
        return (
          cpSku === skuLimpo ||
          (skuSemZeros.length > 0 && cpSkuSemZeros === skuSemZeros) ||
          (skuSemZeros.length > 0 && cpSku === skuSemZeros)
        );
      });
      if (cat) {
        return {
          produtoId: cat.id,
          sku: cat.sku,
          descricao: it.descricao || cat.descricao,
          marca: cat.marca || it.marca || "",
          referencia: cat.referencia || it.referenciaFabricante || "",
        };
      }
    }

    // 3. Fallback seguro se ainda não estiver no catálogo carregado
    const idNum =
      it.produtoId && it.produtoId > 0
        ? it.produtoId
        : it.id > 0
        ? it.id
        : Number(it.sku?.replace(/\D/g, "")) || 0;

    return {
      produtoId: idNum,
      sku: it.sku || `PROD-${idNum}`,
      descricao: it.descricao || "Sem descrição",
      marca: it.marca || "",
      referencia: it.referenciaFabricante || "",
    };
  }, [hubStatus]);

  // Inicializa e atualiza o estado de edição quando itens ou catálogo forem carregados
  useEffect(() => {
    if (!itensCompilados.length) return;
    setEdicoesLinhas((prev) => {
      const next = { ...prev };
      for (const it of itensCompilados) {
        const key = `${it.pedidoId}-${it.id}`;
        const prod = obterProdutoResolvido(it);
        const qtdOriginal = extrairQuantidadeItem(it);
        const atual = next[key];
        next[key] = {
          quantidade: atual ? atual.quantidade : qtdOriginal,
          description: atual?.description || it.descricao || prod?.descricao || "",
          requested_reference:
            atual?.requested_reference || it.referenciaFabricante || prod?.referencia || "",
          requested_brand:
            atual?.requested_brand || it.marca || prod?.marca || "",
          accepted_brands: atual?.accepted_brands || "",
          observacao: atual?.observacao || "",
        };
      }
      return next;
    });
  }, [itensCompilados, hubStatus?.catalogProducts, obterProdutoResolvido]);

  // Atualiza marca, referência, alternativas ou observação para todas as filiais de um produto
  const atualizarAtributosPorSku = React.useCallback(
    (sku: string, campos: Partial<EdicaoLinhaPedido>, itensDoSku: { key: string }[]) => {
      setEdicoesLinhas((prev) => {
        const next = { ...prev };
        for (const { key } of itensDoSku) {
          if (next[key]) {
            next[key] = {
              ...next[key],
              ...campos,
            };
          }
        }
        return next;
      });
    },
    []
  );

  // Adiciona ou remove marca alternativa aceita com um único clique
  const toggleMarcaAlternativa = React.useCallback(
    (sku: string, marca: string, itensDoSku: { key: string }[]) => {
      const primeiraKey = itensDoSku[0]?.key;
      const edAtual = primeiraKey ? edicoesLinhas[primeiraKey] : undefined;
      const listaAtual = edAtual?.accepted_brands
        ? edAtual.accepted_brands.split(",").map((b) => b.trim()).filter(Boolean)
        : [];

      const jaTem = listaAtual.some((m) => m.toLowerCase() === marca.toLowerCase());
      const novaLista = jaTem
        ? listaAtual.filter((m) => m.toLowerCase() !== marca.toLowerCase())
        : [...listaAtual, marca];

      atualizarAtributosPorSku(sku, { accepted_brands: novaLista.join(", ") }, itensDoSku);
    },
    [edicoesLinhas, atualizarAtributosPorSku]
  );

  // Verificação de segurança: itens que não puderam ser homologados no catálogo
  const itensNaoResolvidos = useMemo(() => {
    if (carregando || !itensCompilados.length) return [];
    const naoEncontrados: string[] = [];
    for (const it of itensCompilados) {
      const res = obterProdutoResolvido(it);
      if (!res) {
        naoEncontrados.push(it.sku || `Item #${it.id}`);
      }
    }
    return Array.from(new Set(naoEncontrados));
  }, [itensCompilados, obterProdutoResolvido, carregando]);

  // Lista de fornecedores associados aos pedidos
  const fornecedoresDosPedidos = useMemo(() => {
    const mapa = new Map<string, { id: string; name: string }>();

    for (const p of pedidos) {
      if (p.fornecedorId && p.fornecedorNome) {
        mapa.set(String(p.fornecedorId), {
          id: String(p.fornecedorId),
          name: p.fornecedorNome,
        });
      }
    }

    return Array.from(mapa.values());
  }, [pedidos]);

  // Todos os fornecedores disponíveis unificados
  const todosFornecedores = useMemo(() => {
    const mapa = new Map<string, { id: string; name: string; emailOrigem?: string; doPedido?: boolean }>();

    // 1. Fornecedores diretos dos pedidos
    for (const f of fornecedoresDosPedidos) {
      let emailOrigem: string | undefined;
      let idFinal = f.id;

      if (hubStatus?.suppliers) {
        const match = hubStatus.suppliers.find((s) => {
          if (s.id === f.id || Number(s.id) === Number(f.id)) return true;
          if (s.name && f.name && (s.name.toLowerCase().includes(f.name.toLowerCase()) || f.name.toLowerCase().includes(s.name.toLowerCase()))) {
            return true;
          }
          return false;
        });
        if (match) {
          emailOrigem = match.email;
          idFinal = match.id;
        }
      }

      mapa.set(idFinal, {
        id: idFinal,
        name: f.name,
        emailOrigem,
        doPedido: true,
      });
    }

    // 2. Todos os demais fornecedores do Power BI / cadastro
    if (hubStatus?.suppliers) {
      for (const s of hubStatus.suppliers) {
        if (!mapa.has(s.id)) {
          mapa.set(s.id, {
            id: s.id,
            name: resolverNomeExibicao(s),
            emailOrigem: s.email,
            doPedido: false,
          });
        }
      }
    }

    return Array.from(mapa.values());
  }, [hubStatus, fornecedoresDosPedidos]);

  // Inicializar seleção e e-mails conhecidos
  useEffect(() => {
    if (todosFornecedores.length > 0) {
      setSupplierEmails((prev) => {
        const next = { ...prev };
        for (const f of todosFornecedores) {
          if (!next[f.id] && f.emailOrigem) {
            next[f.id] = f.emailOrigem;
          }
        }
        return next;
      });

      if (selectedSuppliers.length === 0) {
        // Pré-selecionar fornecedores vinculados aos pedidos ou os que já têm e-mail
        const dosPedidos = todosFornecedores.filter((f) => f.doPedido).map((f) => f.id);
        if (dosPedidos.length > 0) {
          setSelectedSuppliers(dosPedidos);
        } else {
          // Seleciona o primeiro fornecedor com e-mail cadastrado
          const primeiroComEmail = todosFornecedores.find((f) => f.emailOrigem && f.emailOrigem.includes("@"));
          if (primeiroComEmail) {
            setSelectedSuppliers([primeiroComEmail.id]);
          } else if (todosFornecedores[0]) {
            setSelectedSuppliers([todosFornecedores[0].id]);
          }
        }
      }
    }
  }, [todosFornecedores, selectedSuppliers.length]);

  // Fornecedores filtrados
  const fornecedoresFiltrados = useMemo(() => {
    if (!buscaFornecedor.trim()) return todosFornecedores;
    const termo = buscaFornecedor.toLowerCase().trim();
    return todosFornecedores.filter(
      (f) =>
        f.name.toLowerCase().includes(termo) ||
        (supplierEmails[f.id] ?? "").toLowerCase().includes(termo) ||
        f.id.includes(termo)
    );
  }, [todosFornecedores, buscaFornecedor, supplierEmails]);

  // Identificar fornecedores selecionados que faltam e-mail
  const fornecedoresFaltandoEmail = useMemo(() => {
    return selectedSuppliers
      .map((id) => todosFornecedores.find((f) => f.id === id))
      .filter((f): f is { id: string; name: string; emailOrigem?: string; doPedido?: boolean } => {
        if (!f) return false;
        const email = (supplierEmails[f.id] || "").trim();
        return !email || !email.includes("@");
      });
  }, [selectedSuppliers, todosFornecedores, supplierEmails]);

  // Agrupamento consolidado dos itens por SKU (considerando as edições)
  const itensConsolidados = useMemo(() => {
    const mapa = new Map<string, {
      sku: string;
      descricao: string;
      quantidadeTotal: number;
      porLoja: {
        key: string;
        itemOriginal: ItemComFilial;
        filialId: number;
        filialNome: string;
        quantidade: number;
      }[];
    }>();

    for (const it of itensCompilados) {
      const prod = obterProdutoResolvido(it);
      const sku = prod?.sku || it.sku || `PROD-${it.id}`;
      const desc = it.descricao || prod?.descricao || "Item sem descrição";
      const key = `${it.pedidoId}-${it.id}`;
      const ed = edicoesLinhas[key];
      const qtd = ed !== undefined ? ed.quantidade : extrairQuantidadeItem(it);

      if (!mapa.has(sku)) {
        mapa.set(sku, {
          sku,
          descricao: desc,
          quantidadeTotal: 0,
          porLoja: [],
        });
      }

      const registro = mapa.get(sku)!;
      registro.quantidadeTotal += qtd;
      registro.porLoja.push({
        key,
        itemOriginal: it,
        filialId: it.filialId,
        filialNome: it.filialNome,
        quantidade: qtd,
      });
    }

    return Array.from(mapa.values());
  }, [itensCompilados, edicoesLinhas, obterProdutoResolvido]);

  // Totalizadores sem converter 0 em 1
  const totalLojas = new Set(pedidos.map((p) => p.filialId ?? 1)).size;
  const totalValorEstimado = itensCompilados.reduce((s, i) => s + (i.valorTotal || 0), 0);
  const totalUnidades = itensCompilados.reduce((s, it) => {
    const key = `${it.pedidoId}-${it.id}`;
    const ed = edicoesLinhas[key];
    return s + (ed !== undefined ? ed.quantidade : extrairQuantidadeItem(it));
  }, 0);

  // Desmarcar fornecedores sem e-mail
  const desmarcarSemEmail = () => {
    const idsSemEmail = new Set(fornecedoresFaltandoEmail.map((f) => f.id));
    setSelectedSuppliers((prev) => prev.filter((id) => !idsSemEmail.has(id)));
  };

  // Disparo da cotação compilada com validação rígida de produto e idempotência
  const enviarCotacao = async () => {
    if (itensNaoResolvidos.length > 0) {
      setFeedbackEnvio(`Não é possível enviar a cotação: os seguintes itens não foram encontrados no catálogo de produtos: ${itensNaoResolvidos.join(", ")}.`);
      return;
    }

    if (fornecedoresFaltandoEmail.length > 0) {
      setFeedbackEnvio(`Preencha o e-mail ou desmarque os fornecedores sem e-mail: ${fornecedoresFaltandoEmail.map((f) => f.name).join(", ")}`);
      return;
    }

    if (selectedSuppliers.length === 0) {
      setFeedbackEnvio("Selecione ao menos um fornecedor para enviar a solicitação de cotação.");
      return;
    }

    setEnviando(true);
    setFeedbackEnvio(null);

    try {
      // 1. Mapear dados dos fornecedores
      const suppliersData = selectedSuppliers.map((id) => {
        const f = todosFornecedores.find((x) => x.id === id);
        return {
          id,
          name: f?.name || `Fornecedor ${id}`,
          email: (supplierEmails[id] || "").trim(),
        };
      });

      // 2. Mapear destinos
      const destinationsMap = new Map<string, { external_id: string; name: string; address: string }>();
      for (const p of pedidos) {
        const fid = String(p.filialId ?? 1);
        const fnome = p.filialNome ?? nomesFiliais[Number(fid)] ?? `Loja ${fid}`;
        destinationsMap.set(fid, {
          external_id: fid,
          name: fnome,
          address: `Filial ${fnome} - Rede Carreiro`,
        });
      }

      // 3. Mapear itens para envio utilizando IDs reais e permitindo customizações confirmadas
      const itemsPayload = itensCompilados.map((it) => {
        const prod = obterProdutoResolvido(it);
        if (!prod) {
          throw new Error(`Item ${it.sku || it.id} não possui produto homologado no catálogo.`);
        }

        const key = `${it.pedidoId}-${it.id}`;
        const ed = edicoesLinhas[key] ?? {
          quantidade: extrairQuantidadeItem(it),
          description: it.descricao || prod.descricao,
          requested_reference: it.referenciaFabricante || prod.referencia,
          requested_brand: it.marca || prod.marca,
          accepted_brands: "",
        };

        const acceptedList = ed.accepted_brands
          ? ed.accepted_brands.split(",").map(b => b.trim()).filter(Boolean)
          : [];

        const qtd = Math.max(1, Number(ed.quantidade) || extrairQuantidadeItem(it) || 1);

        let descFinal = (ed.description && ed.description.trim()) ? ed.description.trim() : (it.descricao || prod.descricao);
        if (ed.observacao && ed.observacao.trim()) {
          descFinal = `${descFinal} | Obs: ${ed.observacao.trim()}`;
        }
        if (observacoesGerais.trim()) {
          descFinal = `${descFinal} [Obs Geral: ${observacoesGerais.trim()}]`;
        }
        if (descFinal.length > 500) {
          descFinal = descFinal.slice(0, 500);
        }

        return {
          produtoId: prod.produtoId,
          quantity: String(qtd),
          filialId: it.filialId,
          description: descFinal,
          ...(ed.requested_reference.trim() ? { requested_reference: ed.requested_reference.trim() } : {}),
          ...(ed.requested_brand.trim() ? { requested_brand: ed.requested_brand.trim() } : {}),
          ...(acceptedList.length > 0 ? { accepted_brands: acceptedList } : {}),
        };
      });

      // Impede envios duplicados com fingerprint e preserva externalId em retentativas
      const fingerprint = JSON.stringify({
        pedidoIds: pedidos.map(p => p.id).sort(),
        supplierIds: [...selectedSuppliers].sort(),
        items: itemsPayload.map(i => ({ p: i.produtoId, q: i.quantity, f: i.filialId, r: i.requested_reference, b: i.requested_brand, ab: i.accepted_brands })),
      });

      if (attemptRef.current?.fingerprint !== fingerprint) {
        attemptRef.current = {
          fingerprint,
          externalId: crypto.randomUUID(),
          deadline: new Date(Date.now() + 24 * 3600_000).toISOString(),
        };
      }

      const payload = {
        externalId: attemptRef.current.externalId,
        deadline: attemptRef.current.deadline,
        pedidoIds: pedidos.map((p) => p.id),
        supplierIds: [...selectedSuppliers].sort(),
        suppliersData,
        destinations: Array.from(destinationsMap.values()),
        items: itemsPayload,
      };

      const resp = await fetch("/api/cotacao-hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resultado = await resp.json().catch(() => null);

      if (!resp.ok) {
        throw new Error(resultado?.erro || "Falha na comunicação com o Cotação Hub.");
      }

      setCotacaoEnviadaId(resultado?.quotationId || attemptRef.current.externalId);
      onSucesso(`Cotação compilada disparada com sucesso para ${selectedSuppliers.length} fornecedor(es)!`);
    } catch (err) {
      setFeedbackEnvio(err instanceof Error ? err.message : "Erro desconhecido ao enviar cotação.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Compilar Pedidos para Cotação Unificada — Cotação Hub
              </h2>
              <p className="text-xs text-slate-500">
                Junte pedidos de múltiplas lojas em uma única solicitação de compra para obter melhores preços.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {carregando ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium text-slate-700">
                Carregando itens dos {pedidos.length} pedidos e fornecedores com e-mails...
              </p>
              <p className="text-xs text-slate-400">
                Consultando dados no Power BI e base de homologação da Rede Carreiro.
              </p>
            </div>
          ) : erroCarregamento ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
              <div>
                <p className="font-semibold">{erroCarregamento}</p>
                <p className="text-xs text-rose-600 mt-0.5">Verifique a conectividade com os serviços.</p>
              </div>
            </div>
          ) : cotacaoEnviadaId ? (
            /* Tela de Sucesso */
            <div className="py-10 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Cotação Enviada com Sucesso ao Cotação Hub!
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  A solicitação unificada foi disparada com sucesso. Os {pedidos.length} pedidos selecionados foram avançados para o estado <strong className="text-amber-800">"Enviado"</strong>.
                </p>
              </div>

              <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">ID da Cotação:</span>
                  <span className="font-mono font-bold text-slate-800">{cotacaoEnviadaId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fornecedores Notificados:</span>
                  <span className="font-semibold text-slate-800">{selectedSuppliers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lojas Atendidas:</span>
                  <span className="font-semibold text-slate-800">{totalLojas} loja(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Itens / Volume Físico:</span>
                  <span className="font-semibold text-slate-800">{itensConsolidados.length} SKUs ({totalUnidades} un)</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
                >
                  Concluir e Voltar aos Pedidos
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Feedback de erro/aviso */}
              {feedbackEnvio && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>{feedbackEnvio}</span>
                  </div>
                  {fornecedoresFaltandoEmail.length > 0 && (
                    <button
                      type="button"
                      onClick={desmarcarSemEmail}
                      className="shrink-0 rounded bg-amber-200/80 px-2 py-1 text-[11px] font-bold text-amber-950 hover:bg-amber-300 transition-colors"
                    >
                      Desmarcar fornecedores sem e-mail
                    </button>
                  )}
                </div>
              )}

              {/* Alerta bloqueante para itens não homologados no catálogo */}
              {itensNaoResolvidos.length > 0 && (
                <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 flex items-start gap-2.5 shadow-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <span className="font-bold text-rose-950">
                      Itens sem homologação no catálogo identificados ({itensNaoResolvidos.length}):
                    </span>{" "}
                    <span className="font-mono text-rose-800">{itensNaoResolvidos.join(", ")}</span>
                    <p className="text-[11px] text-rose-700 mt-1">
                      Para manter a integridade dos pedidos multi-loja e do catálogo, o envio foi travado. Cadastre os itens no catálogo antes de disparar.
                    </p>
                  </div>
                </div>
              )}

              {/* Cards de Resumo da Compilação */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                    <Store className="h-3.5 w-3.5 text-blue-600" />
                    Lojas nos Pedidos
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-blue-950">{totalLojas}</span>
                    <span className="text-xs text-blue-700">loja(s) envolvida(s)</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {pedidos.map((p) => (
                      <span
                        key={p.id}
                        className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-blue-900 border border-blue-200/60 shadow-2xs"
                      >
                        {p.filialNome ?? (p.filialId ? nomesFiliais[p.filialId] ?? `Loja ${p.filialId}` : "—")} (#{p.id})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-indigo-600" />
                    Volume Consolidado
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-indigo-950">{itensConsolidados.length}</span>
                    <span className="text-xs text-indigo-700">SKUs distintos</span>
                  </div>
                  <p className="mt-1 text-[11px] text-indigo-800 font-medium">
                    Total de <strong>{totalUnidades.toLocaleString("pt-BR")}</strong> unidades físicas
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    Valor Estimado
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-emerald-950">
                      {totalValorEstimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-emerald-700">
                    Soma de custo dos pedidos selecionados
                  </p>
                </div>
              </div>

              {/* Sanfona / Lista de Itens Compilados por Loja com Edição */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                    Itens Consolidados para Cotação ({itensConsolidados.length} produtos)
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Discriminação e edição por filial de entrega
                  </span>
                </div>

                <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/40 text-xs divide-y divide-slate-100">
                  {itensConsolidados.map((item) => {
                    const primeiraLoja = item.porLoja[0];
                    const edPrincipal = (primeiraLoja && edicoesLinhas[primeiraLoja.key]) ?? {
                      quantidade: item.quantidadeTotal,
                      description: item.descricao,
                      requested_reference: "",
                      requested_brand: "",
                      accepted_brands: "",
                      observacao: "",
                    };
                    const prodResolvido = primeiraLoja ? obterProdutoResolvido(primeiraLoja.itemOriginal) : undefined;
                    const marcaExibida = edPrincipal.requested_brand || prodResolvido?.marca || "";
                    const refExibida = edPrincipal.requested_reference || prodResolvido?.referencia || "";
                    const aceitasExibidas = edPrincipal.accepted_brands || "";
                    const isExpanded = skuEmEdicao === item.sku;

                    return (
                      <div key={item.sku} className="p-3 bg-white space-y-2.5 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] border border-slate-200">
                                {item.sku}
                              </span>
                              <span className="text-slate-800 font-semibold">{item.descricao}</span>
                            </div>

                            {/* Badges de Atributos Críticos: Marca, Ref, Aceitas e Obs */}
                            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                              {marcaExibida ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                                  <Tag className="h-3 w-3 text-blue-600" />
                                  Marca: <strong>{marcaExibida}</strong>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                  ⚠️ Marca não informada
                                </span>
                              )}

                              {refExibida ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-300">
                                  <Hash className="h-3 w-3 text-slate-600" />
                                  Ref: <strong>{refExibida}</strong>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                  ⚠️ Ref. não informada
                                </span>
                              )}

                              {aceitasExibidas && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-800 border border-purple-200">
                                  <Check className="h-3 w-3 text-purple-600" />
                                  Aceita: <strong>{aceitasExibidas}</strong>
                                </span>
                              )}

                              {edPrincipal.observacao && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  💬 Obs: <strong>{edPrincipal.observacao}</strong>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0 sm:pt-0.5">
                            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 text-xs">
                              Total: {item.quantidadeTotal} un
                            </span>
                            <button
                              type="button"
                              onClick={() => setSkuEmEdicao(isExpanded ? null : item.sku)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                                isExpanded
                                  ? "bg-slate-200 text-slate-800 hover:bg-slate-300"
                                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-xs"
                              }`}
                            >
                              {isExpanded ? "✕ Fechar" : "✏️ Ajustar Marca / Ref. / Marcas Aceitas"}
                            </button>
                          </div>
                        </div>

                        {/* Painel de Edição Expandido do SKU */}
                        {isExpanded && (
                          <div className="mt-2.5 rounded-lg border border-blue-200 bg-blue-50/30 p-3 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                  Marca Solicitada (Preferencial)
                                </label>
                                <input
                                  type="text"
                                  placeholder="Ex: Gates, Bosch, Dayco..."
                                  value={edPrincipal.requested_brand}
                                  onChange={(e) =>
                                    atualizarAtributosPorSku(item.sku, { requested_brand: e.target.value }, item.porLoja)
                                  }
                                  className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                  Referência do Fabricante / Código de Fábrica
                                </label>
                                <input
                                  type="text"
                                  placeholder="Ex: K015433XS, 10098, CT488..."
                                  value={edPrincipal.requested_reference}
                                  onChange={(e) =>
                                    atualizarAtributosPorSku(item.sku, { requested_reference: e.target.value }, item.porLoja)
                                  }
                                  className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            {/* Seleção de Múltiplas Marcas Alternativas Aceitas */}
                            <div className="rounded-md border border-slate-200 bg-white p-2.5 space-y-1.5">
                              <label className="block text-[11px] font-semibold text-slate-700">
                                Marcas Alternativas Aceitas (clique para marcar ou desmarcar):
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {MARCAS_POPULARES.map((marca) => {
                                  const list = edPrincipal.accepted_brands
                                    ? edPrincipal.accepted_brands.split(",").map((s) => s.trim().toLowerCase())
                                    : [];
                                  const selecionada = list.includes(marca.toLowerCase());
                                  return (
                                    <button
                                      key={marca}
                                      type="button"
                                      onClick={() => toggleMarcaAlternativa(item.sku, marca, item.porLoja)}
                                      className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                                        selecionada
                                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                          : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                                      }`}
                                    >
                                      {selecionada ? `✓ ${marca}` : `+ ${marca}`}
                                    </button>
                                  );
                                })}
                              </div>
                              <input
                                type="text"
                                placeholder="Outras marcas alternativas (separadas por vírgula)..."
                                value={edPrincipal.accepted_brands}
                                onChange={(e) =>
                                  atualizarAtributosPorSku(item.sku, { accepted_brands: e.target.value }, item.porLoja)
                                }
                                className="w-full px-2.5 py-1 rounded border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>

                            {/* Observação comercial do item */}
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Observação Comercial do Item (específico para os fornecedores)
                              </label>
                              <input
                                type="text"
                                placeholder="Ex: Produto de primeira linha, homologado montadora, garantia 1 ano..."
                                value={edPrincipal.observacao || ""}
                                onChange={(e) =>
                                  atualizarAtributosPorSku(item.sku, { observacao: e.target.value }, item.porLoja)
                                }
                                className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>

                            {/* Discriminação por Filial */}
                            <div className="pt-2 border-t border-blue-200/60 space-y-1.5">
                              <span className="text-[11px] font-semibold text-slate-700 block">
                                Quantidade e Destino por Filial:
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {item.porLoja.map((l) => {
                                  const edLoja = edicoesLinhas[l.key] ?? {
                                    quantidade: l.quantidade,
                                    description: item.descricao,
                                    requested_reference: edPrincipal.requested_reference,
                                    requested_brand: edPrincipal.requested_brand,
                                    accepted_brands: edPrincipal.accepted_brands,
                                    observacao: edPrincipal.observacao,
                                  };
                                  const prod = obterProdutoResolvido(l.itemOriginal);
                                  const prodId = prod?.produtoId;
                                  const unidade = (prodId && hubStatus?.units?.[String(prodId)]) || hubStatus?.units?.["default"] || "UN";

                                  return (
                                    <div
                                      key={l.key}
                                      className="flex items-center justify-between p-2 rounded bg-white border border-slate-200 text-xs"
                                    >
                                      <span className="font-medium text-slate-800 truncate mr-2">{l.filialNome}</span>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <input
                                          type="number"
                                          min="1"
                                          value={edLoja.quantidade}
                                          onChange={(e) => {
                                            const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                            setEdicoesLinhas((prev) => ({
                                              ...prev,
                                              [l.key]: { ...prev[l.key], quantidade: val },
                                            }));
                                          }}
                                          className="w-16 px-2 py-0.5 rounded border border-slate-300 text-xs text-center font-bold text-blue-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <span className="text-[11px] font-semibold text-slate-500">{unidade}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Visualização compacta das filiais quando recolhido */}
                        {!isExpanded && (
                          <div className="flex flex-wrap gap-2 pl-2 border-l-2 border-blue-200 text-[11px] text-slate-600">
                            {item.porLoja.map((l) => {
                              const edLoja = edicoesLinhas[l.key];
                              const qtd = edLoja !== undefined ? edLoja.quantidade : l.quantidade;
                              const prod = obterProdutoResolvido(l.itemOriginal);
                              const prodId = prod?.produtoId;
                              const unidade = (prodId && hubStatus?.units?.[String(prodId)]) || hubStatus?.units?.["default"] || "UN";
                              return (
                                <span key={l.key} className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                  <strong>{l.filialNome}</strong>: {qtd} {unidade}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bloco de Observações Gerais da Cotação */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-2">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <label htmlFor="obs-gerais" className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Observações Gerais da Cotação (opcional)
                  </label>
                </div>
                <p className="text-[11px] text-slate-500">
                  Instruções comerciais para os fornecedores: condições de pagamento desejadas, prazo de entrega ou faturamento.
                </p>
                <textarea
                  id="obs-gerais"
                  rows={2}
                  value={observacoesGerais}
                  onChange={(e) => setObservacoesGerais(e.target.value)}
                  placeholder="Ex: Pagamento 28/35/42 ddl. Frete CIF. Entregas até as 17h."
                  className="w-full rounded-lg border border-slate-300 bg-slate-50/50 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Seleção de Fornecedores */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-blue-600" />
                      Fornecedores para Receber a Cotação ({selectedSuppliers.length} selecionados)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Selecione quais fornecedores e distribuidoras receberão o convite e o formulário de proposta.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {fornecedoresFaltandoEmail.length > 0 && (
                      <button
                        type="button"
                        onClick={desmarcarSemEmail}
                        className="rounded-lg bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-200 transition-colors"
                      >
                        ⚡ Desmarcar sem e-mail ({fornecedoresFaltandoEmail.length})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedSuppliers([])}
                      className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                {/* Aviso claro sobre e-mails pendentes */}
                {fornecedoresFaltandoEmail.length > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-2.5 text-xs text-amber-900 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>Atenção:</strong> {fornecedoresFaltandoEmail.length} fornecedor(es) marcado(s) ainda não possui(em) e-mail informado abaixo. Digite o e-mail ou desmarque-os.
                      </span>
                    </div>
                  </div>
                )}

                {/* Busca de Fornecedores */}
                <div>
                  <input
                    type="text"
                    value={buscaFornecedor}
                    onChange={(e) => setBuscaFornecedor(e.target.value)}
                    placeholder="🔍 Buscar fornecedor por nome, e-mail ou código..."
                    className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Lista com Checkbox e Campo de E-mail */}
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {fornecedoresFiltrados.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-400">
                      Nenhum fornecedor encontrado no filtro.
                    </p>
                  ) : (
                    fornecedoresFiltrados.map((f) => {
                      const isSelected = selectedSuppliers.includes(f.id);
                      const email = supplierEmails[f.id] ?? "";
                      const emailValido = email.trim().length > 0 && email.includes("@");

                      return (
                        <div
                          key={f.id}
                          className={cn(
                            "rounded-lg border p-2.5 transition-all",
                            isSelected
                              ? "border-blue-300 bg-blue-50/30 shadow-2xs"
                              : "border-slate-200 bg-slate-50/40 opacity-70 hover:opacity-100"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) =>
                                  setSelectedSuppliers((curr) =>
                                    e.target.checked ? [...curr, f.id] : curr.filter((id) => id !== f.id)
                                  )
                                }
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <span className="text-xs font-bold text-slate-900">{f.name}</span>
                              {f.doPedido && (
                                <span className="rounded-full bg-blue-100 px-2 py-0.2 text-[9px] font-bold text-blue-800">
                                  ⭐ Fornecedor do Pedido
                                </span>
                              )}
                            </label>

                            {f.emailOrigem && (
                              <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-800 flex items-center gap-1">
                                <Mail className="h-2.5 w-2.5" />
                                Power BI (AEMAIL)
                              </span>
                            )}
                          </div>

                          {isSelected && (
                            <div className="mt-2 pl-6">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap">
                                  E-mail de envio:
                                </span>
                                <input
                                  type="email"
                                  value={email}
                                  onChange={(e) =>
                                    setSupplierEmails((prev) => ({ ...prev, [f.id]: e.target.value }))
                                  }
                                  placeholder="contato@fornecedor.com.br"
                                  className={cn(
                                    "flex-1 rounded border px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500",
                                    !emailValido
                                      ? "border-rose-300 bg-rose-50/40 text-rose-900 placeholder:text-rose-400"
                                      : "border-slate-300 bg-white text-slate-900"
                                  )}
                                />
                              </div>
                              {!emailValido && (
                                <p className="mt-0.5 text-[10px] text-rose-600">
                                  ⚠️ E-mail obrigatório para envio do convite de cotação.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Rodapé / Ações */}
        {!cotacaoEnviadaId && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3">
            <div className="text-xs text-slate-500">
              {itensNaoResolvidos.length > 0 ? (
                <span className="text-rose-700 font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                  {itensNaoResolvidos.length} item(ns) não homologado(s) no catálogo.
                </span>
              ) : fornecedoresFaltandoEmail.length > 0 ? (
                <span className="text-amber-800 font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  {fornecedoresFaltandoEmail.length} fornecedor(es) precisa(m) de e-mail.
                </span>
              ) : selectedSuppliers.length === 0 ? (
                <span>Selecione ao menos 1 fornecedor com e-mail.</span>
              ) : (
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Tudo pronto para envio ({selectedSuppliers.length} fornecedores aptos).
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={enviando}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={enviarCotacao}
                disabled={
                  enviando ||
                  carregando ||
                  selectedSuppliers.length === 0 ||
                  fornecedoresFaltandoEmail.length > 0 ||
                  itensConsolidados.length === 0 ||
                  itensNaoResolvidos.length > 0
                }
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-sm transition-all",
                  enviando ||
                  carregando ||
                  selectedSuppliers.length === 0 ||
                  fornecedoresFaltandoEmail.length > 0 ||
                  itensConsolidados.length === 0 ||
                  itensNaoResolvidos.length > 0
                    ? "bg-slate-400 cursor-not-allowed opacity-60"
                    : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                )}
                title={
                  itensNaoResolvidos.length > 0
                    ? `Itens não homologados no catálogo: ${itensNaoResolvidos.join(", ")}`
                    : fornecedoresFaltandoEmail.length > 0
                    ? "Preencha ou desmarque os fornecedores sem e-mail para prosseguir"
                    : selectedSuppliers.length === 0
                    ? "Selecione ao menos 1 fornecedor"
                    : "Disparar cotação unificada"
                }
              >
                {enviando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Disparando cotação unificada...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>
                      Disparar Cotação Unificada ({selectedSuppliers.length})
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
