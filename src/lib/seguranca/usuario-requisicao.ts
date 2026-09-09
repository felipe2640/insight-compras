/**
 * Compatibilidade: a identidade agora vem de src/lib/autenticacao (sessão validada
 * pelo provedor). Mantido só para não quebrar importações antigas.
 */
export {
  obterUsuarioDaRequisicao,
  obterUsuarioAtual,
  podeGerirAprendizado,
  respostaNaoAutenticado,
  respostaSemPermissao,
} from "@/lib/autenticacao/servidor";
