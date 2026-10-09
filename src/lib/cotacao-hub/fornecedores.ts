import type { InventoryAdapter } from "@adapters/AdaptadorInventario";
import type { Supplier, ConnectorConfig } from "./types";
import type { SupplierInfo } from "./payload";

/**
 * Autoridade de cadastro de fornecedores da integração.
 *
 * O navegador sugere (suppliersData), o servidor decide: um fornecedor só
 * entra na cotação se existir na FONTE AUTORIZADA — a capacidade tipada
 * `contatosFornecedores` do adaptador (ex.: AEMAIL do Power BI da Carreiro)
 * e/ou o cadastro da própria conexão. O e-mail é conferido em qualidade e
 * pode ser corrigido explicitamente pelo comprador; o NOME vem sempre da
 * fonte, nunca do browser.
 */

/** E-mail de contato em qualidade mínima (trim + formato + tamanho). */
export function emailValido(valor: string): boolean {
  const email = valor.trim();
  return email.length >= 6 && email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Mapa id -> dados oficiais da fonte autorizada (conexão + adaptador).
 * Falha na fonte não inventa fornecedor: cai no aviso e segue só com o
 * cadastro da conexão.
 */
export async function fonteFornecedoresAutorizada(
  config: ConnectorConfig,
  fonte: InventoryAdapter,
): Promise<Map<string, { name: string; email?: string }>> {
  const mapa = new Map<string, { name: string; email?: string }>();
  for (const s of config.suppliers) {
    mapa.set(s.external_id, { name: s.legal_name, email: s.contacts[0]?.email });
  }
  const capacidade = fonte.contatosFornecedores;
  if (!capacidade) return mapa;
  try {
    for (const f of await capacidade.carregarFornecedoresComEmail()) {
      const atual = mapa.get(f.id);
      mapa.set(f.id, { name: f.name || atual?.name || "", email: f.email || atual?.email });
    }
  } catch (erro) {
    console.warn("[cotacao-hub] fonte de fornecedores indisponível; seguindo só com o cadastro da conexão:", erro);
  }
  return mapa;
}

/**
 * Revalida os suppliersData da seleção contra a fonte autorizada e devolve
 * a configuração efetiva com apenas fornecedores homologados.
 *
 * - id inexistente na fonte autorizada → rejeitado (o browser não cria
 *   cadastro);
 * - e-mail sem qualidade → rejeitado com identificação clara;
 * - nome → sempre da fonte oficial; e-mail → o do comprador (correção
 *   explícita), com qualidade conferida no servidor.
 */
export function revalidarSuppliersDaSelecao(
  config: ConnectorConfig,
  fonteAutorizada: ReadonlyMap<string, { name: string; email?: string }>,
  suppliersData: readonly SupplierInfo[] | undefined,
): { efetiva: ConnectorConfig; rejeitados: string[] } {
  if (!suppliersData || suppliersData.length === 0) return { efetiva: config, rejeitados: [] };
  const rejeitados: string[] = [];
  const validados: Supplier[] = [];
  for (const s of suppliersData) {
    const oficial = fonteAutorizada.get(s.id);
    if (!oficial) {
      rejeitados.push(s.id);
      continue;
    }
    const email = (s.email ?? "").trim();
    if (!emailValido(email)) {
      rejeitados.push(s.id);
      continue;
    }
    const nome = oficial.name || s.name;
    validados.push({
      external_id: s.id,
      legal_name: nome,
      contacts: [{ name: nome, email }],
    });
  }
  if (rejeitados.length > 0) {
    throw new Error(
      `Fornecedores fora da fonte autorizada ou sem e-mail válido: ${rejeitados.join(", ")}. ` +
      "Use apenas fornecedores do cadastro da conexão e corrija o e-mail na tela.",
    );
  }
  const idsValidados = new Set(validados.map(v => v.external_id));
  return {
    efetiva: {
      ...config,
      suppliers: [...validados, ...config.suppliers.filter(s => !idsValidados.has(s.external_id))],
    },
    rejeitados: [],
  };
}
