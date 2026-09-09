/**
 * Ciclo de Aprendizado — Divergência modelo × comprador
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 *
 * BASE COMUM A TODOS OS CLIENTES.
 * A taxonomia de motivos é o que separa "o modelo errou" de "o mundo interferiu".
 * Herdada do diário, onde foi validada com o comprador.
 */

export const MOTIVOS_DIVERGENCIA = [
  { id: "concordo_com_modelo", rotulo: "Concordo com o modelo", afetaCalibracao: true },
  { id: "sem_verba", rotulo: "Sem verba no momento", afetaCalibracao: false },
  { id: "fornecedor_indisponivel", rotulo: "Fornecedor indisponível", afetaCalibracao: false },
  { id: "lead_time_diferente", rotulo: "Prazo de entrega diferente", afetaCalibracao: false },
  { id: "ja_tem_similar", rotulo: "Já tem similar em estoque", afetaCalibracao: false },
  { id: "quantidade_errada", rotulo: "Quantidade sugerida errada", afetaCalibracao: true },
  { id: "item_errado", rotulo: "Item não deveria ser sugerido", afetaCalibracao: true },
  { id: "outro", rotulo: "Outro motivo", afetaCalibracao: false },
] as const;

export type MotivoDivergencia = (typeof MOTIVOS_DIVERGENCIA)[number]["id"];

export function motivoValido(valor: unknown): valor is MotivoDivergencia {
  return MOTIVOS_DIVERGENCIA.some((m) => m.id === valor);
}

export type TipoDivergencia =
  | "igual"
  | "comprador_maior"
  | "comprador_menor"
  | "sem_sugestao"
  | "so_modelo";

/**
 * Classifica a divergência entre o que o comprador decidiu e o que o modelo sugeriu.
 * `qtdModelo === null` significa item inelegível (o modelo não opinou).
 */
export function classificarDivergencia(
  qtdComprador: number,
  qtdModelo: number | null
): TipoDivergencia {
  if (qtdModelo === null) return "sem_sugestao";
  if (qtdComprador === qtdModelo) return "igual";
  if (qtdComprador === 0 && qtdModelo > 0) return "so_modelo";
  return qtdComprador > qtdModelo ? "comprador_maior" : "comprador_menor";
}
