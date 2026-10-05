/**
 * Esquema de Validação do Cadastro de Tenant
 * Camada: Configurações & White-Label (config/tenants/esquema.ts)
 * 100% em Português do Brasil (pt-BR).
 *
 * Por que existe: cadastro incompleto NÃO quebrava, degradava em silêncio.
 * Loja fora do mapa virava filial 1, tenant sem credencial recebia dado
 * sintético, e o erro só aparecia como número errado na tela do comprador.
 * Aqui o cadastro é conferido de uma vez, com mensagem que diz o que falta.
 *
 * O esquema é a mesma peça para o cadastro em `.ts` de hoje e para o cadastro
 * em banco de amanhã (ADR-0001): quem valida é este arquivo, não o formato.
 */

import { z } from "zod";
import type { ConfiguracaoTenant } from "./tipos";

const textoNaoVazio = z.string().trim().min(1);
const corHex = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "cor deve ser hexadecimal (#RGB ou #RRGGBB)");

const esquemaFilial = z.object({
  filialId: z.number().int().positive(),
  nome: textoNaoVazio,
  codigo: textoNaoVazio,
  tipo: z.enum(["matriz", "filial"]),
  ativa: z.boolean(),
  cidade: z.string().optional(),
  uf: z.string().length(2).optional(),
  nomeFonte: z.string().optional(),
  identificadoresFonte: z.array(textoNaoVazio).readonly().optional(),
});

const esquemaFonte = z.object({
  adaptador: z.enum(["powerbi-dax", "sintetica"]),
  nomeERP: z.string().optional(),
  capacidadesDesligadas: z
    .array(z.enum(["pedidosERP", "cotacoesERP", "entradasConfirmadas", "sugestoesErp"]))
    .readonly()
    .optional(),
});

const esquemaCores = z.object({
  primaria: corHex,
  primariaHover: corHex,
  secundaria: corHex,
  secundariaHover: corHex,
  acento: corHex,
  fundo: corHex,
  card: corHex,
  borda: corHex,
  texto: corHex,
  textoSecundario: corHex,
  fundoDestaqueMultiplo: corHex,
});

const esquemaLotes = z.object({
  usarErp: z.boolean(),
  usarHistorico: z.boolean(),
  usarVocabulario: z.boolean(),
  multiplosPorSku: z.record(z.number().int().positive()),
});

/**
 * Esquema do cadastro. Campos que o motor não lê ficam frouxos de propósito
 * (`passthrough`): validar cor de hover com o mesmo rigor de identificador de
 * loja só aumenta o atrito de cadastrar um cliente novo sem proteger nada.
 */
export const esquemaConfiguracaoTenant = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9-]+$/, "id deve ser slug minúsculo (a-z, 0-9, hífen)"),
    nome: textoNaoVazio,
    razaoSocial: textoNaoVazio,
    subdominioPrincipal: textoNaoVazio,
    subdominiosValidos: z.array(textoNaoVazio).min(1),
    customDomain: z.string().optional(),
    fonte: esquemaFonte,
    cores: esquemaCores,
    identidadeVisual: z
      .object({
        logoClaro: textoNaoVazio,
        logoEscuro: textoNaoVazio,
        favicon: textoNaoVazio,
        altText: textoNaoVazio,
      })
      .passthrough(),
    filiais: z.array(esquemaFilial).min(1, "o cliente precisa de ao menos uma filial"),
    assinatura: z.object({}).passthrough(),
    parametrosMotor: z
      .object({
        leadTimePadraoDias: z.number().positive(),
        filialFocoPadraoId: z.number().int().positive(),
        lotes: esquemaLotes,
      })
      .passthrough(),
    catalogo: z.object({
      classesNaoCompraveis: z.array(
        z.object({
          codigoBase: z.number().int().positive(),
          nome: textoNaoVazio,
          motivo: textoNaoVazio,
        })
      ),
      desconsiderarInativos: z.boolean().optional(),
      termosDescricaoInativos: z.array(textoNaoVazio).optional(),
    }),
    exportacao: z.object({}).passthrough(),
    curvaAbc: z
      .object({
        metodo: z.enum(["GIRO", "FATURAMENTO", "ERP"]),
        fallbackParaGiroSeErpInvalido: z.boolean().optional(),
      })
      .optional(),
  })
  .passthrough()
  .superRefine((tenant, ctx) => {
    const ehReal = tenant.fonte.adaptador !== "sintetica";

    // 1. filialFocoPadraoId precisa existir entre as filiais ATIVAS.
    //    Sem isso o cockpit abre numa loja que não existe e a grade vem vazia
    //    sem explicação — era o `?? 1` disfarçado de padrão.
    const ativas = tenant.filiais.filter((f) => f.ativa);
    if (!ativas.some((f) => f.filialId === tenant.parametrosMotor.filialFocoPadraoId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parametrosMotor", "filialFocoPadraoId"],
        message: `filialFocoPadraoId=${tenant.parametrosMotor.filialFocoPadraoId} não corresponde a nenhuma filial ativa (${ativas
          .map((f) => f.filialId)
          .join(", ")})`,
      });
    }

    // 2. filialId duplicado embaralha estoque de lojas diferentes.
    const vistos = new Set<number>();
    for (const filial of tenant.filiais) {
      if (vistos.has(filial.filialId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["filiais"],
          message: `filialId ${filial.filialId} duplicado`,
        });
      }
      vistos.add(filial.filialId);
    }

    // 3. Cliente REAL precisa dizer como a fonte identifica cada loja.
    //    É o que substitui a adivinhação por regex de cidade.
    if (ehReal) {
      for (const filial of tenant.filiais) {
        if (!filial.identificadoresFonte || filial.identificadoresFonte.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["filiais"],
            message: `filial ${filial.filialId} (${filial.nome}) não declara identificadoresFonte; fonte real exige identificação exata da loja`,
          });
        }
      }
    }

    // 4. O mesmo identificador em duas lojas manda venda para a loja errada.
    const donoPorIdentificador = new Map<string, number>();
    for (const filial of tenant.filiais) {
      for (const bruto of filial.identificadoresFonte ?? []) {
        const chave = normalizarIdentificadorFonte(bruto);
        const dono = donoPorIdentificador.get(chave);
        if (dono !== undefined && dono !== filial.filialId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["filiais"],
            message: `identificador "${bruto}" está nas filiais ${dono} e ${filial.filialId}`,
          });
        }
        donoPorIdentificador.set(chave, filial.filialId);
      }
    }
  });

/**
 * Normalização única dos identificadores de loja.
 *
 * Caixa e espaço acidental não podem derrubar uma loja; qualquer coisa além
 * disso (acento, apelido, pedaço do GUID) seria adivinhação de novo.
 */
export function normalizarIdentificadorFonte(valor: string): string {
  return valor.trim().toUpperCase().replace(/\s+/g, " ");
}

export interface ResultadoValidacaoTenant {
  readonly valido: boolean;
  readonly erros: readonly string[];
}

/** Valida um cadastro e devolve os erros em texto legível para o operador. */
export function validarConfiguracaoTenant(tenant: unknown): ResultadoValidacaoTenant {
  const resultado = esquemaConfiguracaoTenant.safeParse(tenant);
  if (resultado.success) return { valido: true, erros: [] };

  const erros = resultado.error.issues.map((issue) => {
    const caminho = issue.path.join(".");
    return caminho ? `${caminho}: ${issue.message}` : issue.message;
  });
  return { valido: false, erros };
}

/** Valida e devolve o cadastro tipado, ou lança com a lista de problemas. */
export function exigirConfiguracaoTenantValida(tenant: ConfiguracaoTenant): ConfiguracaoTenant {
  const { valido, erros } = validarConfiguracaoTenant(tenant);
  if (!valido) {
    throw new Error(
      `Cadastro do tenant "${tenant.id}" inválido:\n- ${erros.join("\n- ")}`
    );
  }
  return tenant;
}
