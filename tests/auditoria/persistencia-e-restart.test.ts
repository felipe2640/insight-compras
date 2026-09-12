/**
 * Testes Automatizados da Persistência de Auditoria e Sobrevivência a Restart
 * Camada: Testes / Auditoria (tests/auditoria/persistencia-e-restart.test.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ServicoAuditoria,
  RepositorioAuditoria,
  RepositorioAuditoriaEmMemoria,
  RepositorioAuditoriaSupabase,
  validarCadeiaAuditoria,
  calcularHashRegistro,
  AuditoriaPedido,
  obterRepositorioAuditoria,
  definirRepositorioAuditoria,
  reiniciarRepositorioAuditoria,
} from "@/lib/auditoria";
import { UsuarioAutenticado } from "@/lib/rbac";

// Duplo de repositório durável simulando um armazenamento persistente externo (banco/disco)
class RepositorioDuravelSimulado implements RepositorioAuditoria {
  public readonly id = "duravel-simulado";
  constructor(private armazem: Map<string, string[]>) {}

  public async adicionarRegistro(registro: AuditoriaPedido): Promise<void> {
    const lista = this.armazem.get(registro.tenantId) ?? [];
    // Simula serialização de rede / banco de dados real
    lista.push(JSON.stringify(registro));
    this.armazem.set(registro.tenantId, lista);
  }

  public async obterUltimoRegistro(tenantId: string): Promise<AuditoriaPedido | null> {
    const lista = this.armazem.get(tenantId);
    if (!lista || lista.length === 0) return null;
    return JSON.parse(lista[lista.length - 1]) as AuditoriaPedido;
  }

  public async consultar(filtros: { tenantId: string }): Promise<readonly AuditoriaPedido[]> {
    const lista = this.armazem.get(filtros.tenantId) ?? [];
    return lista.map((item) => JSON.parse(item) as AuditoriaPedido);
  }

  public async obterTodos(tenantId: string): Promise<readonly AuditoriaPedido[]> {
    const lista = this.armazem.get(tenantId) ?? [];
    return lista.map((item) => JSON.parse(item) as AuditoriaPedido);
  }

  public limpar(tenantId?: string): void {
    if (tenantId) {
      this.armazem.delete(tenantId);
    } else {
      this.armazem.clear();
    }
  }
}

describe("U3: Persistência de Auditoria e Integridade Criptográfica SHA-256", () => {
  const comprador: UsuarioAutenticado = {
    id: "usr-comp-01",
    nome: "Carlos Gestor",
    email: "carlos@carreiro.com.br",
    role: "COMPRADOR",
    allowedSupplierIds: [501],
    tenantId: "tenant-teste",
  };

  beforeEach(() => {
    reiniciarRepositorioAuditoria();
  });

  it("deve persistir registros e sobreviver a uma reinicialização simulada com cadeia íntegra", async () => {
    // Armazenamento externo durável compartilhado entre reinicializações
    const armazemPersistente = new Map<string, string[]>();

    // 1. Instância ANTES do restart
    const repoAntesRestart = new RepositorioDuravelSimulado(armazemPersistente);
    const servicoAntes = new ServicoAuditoria(repoAntesRestart);

    // Registra 3 decisões com divergências
    const reg1 = await servicoAntes.registrarDecisao({
      usuario: comprador,
      produtoId: 101,
      codigoSku: "SKU-001",
      fornecedorId: 501,
      filialId: 1,
      quantidadeSugerida: 10,
      quantidadeDigitada: 10,
      precoCusto: 50.0,
    });

    const reg2 = await servicoAntes.registrarDecisao({
      usuario: comprador,
      produtoId: 102,
      codigoSku: "SKU-002",
      fornecedorId: 501,
      filialId: 1,
      quantidadeSugerida: 8,
      quantidadeDigitada: 12, // +4 un sobrecompra
      precoCusto: 75.0,
    });

    const reg3 = await servicoAntes.registrarDecisao({
      usuario: comprador,
      produtoId: 103,
      codigoSku: "SKU-003",
      fornecedorId: 501,
      filialId: 2,
      quantidadeSugerida: 15,
      quantidadeDigitada: 10, // -5 un subcompra
      precoCusto: 30.0,
    });

    // 2. Simula RESTART da aplicação (destrói instâncias e recria a partir da persistência)
    const repoAposRestart = new RepositorioDuravelSimulado(armazemPersistente);
    const servicoApos = new ServicoAuditoria(repoAposRestart);

    // 3. Lê todos os registros de volta do repositório
    const registrosRecuperados = await servicoApos.consultarTrilha({ tenantId: "tenant-teste" });
    expect(registrosRecuperados).toHaveLength(3);

    // 4. Validação estrita da cadeia SHA-256 após restart
    const validacao = validarCadeiaAuditoria(registrosRecuperados);
    expect(validacao.valida).toBe(true);
    expect(validacao.indiceInvalido).toBeUndefined();

    // 5. Adiciona um novo registro APÓS o restart e confirma que o encadeamento continua
    const reg4 = await servicoApos.registrarDecisao({
      usuario: comprador,
      produtoId: 104,
      codigoSku: "SKU-004",
      fornecedorId: 501,
      filialId: 1,
      quantidadeSugerida: 20,
      quantidadeDigitada: 20,
      precoCusto: 40.0,
    });

    expect(reg4.hashRegistroAnterior).toBe(reg3.hashIntegridade);

    const todosAposQuarto = await servicoApos.consultarTrilha({ tenantId: "tenant-teste" });
    expect(todosAposQuarto).toHaveLength(4);

    const validacaoCompleta = validarCadeiaAuditoria(todosAposQuarto);
    expect(validacaoCompleta.valida).toBe(true);
  });

  it("deve detectar violação de integridade caso dado persistido seja adulterado externamente", async () => {
    const armazemPersistente = new Map<string, string[]>();
    const repo = new RepositorioDuravelSimulado(armazemPersistente);
    const servico = new ServicoAuditoria(repo);

    await servico.registrarDecisao({
      usuario: comprador,
      produtoId: 201,
      codigoSku: "SKU-201",
      fornecedorId: 501,
      filialId: 1,
      quantidadeSugerida: 5,
      quantidadeDigitada: 15,
      precoCusto: 100.0,
    });

    await servico.registrarDecisao({
      usuario: comprador,
      produtoId: 202,
      codigoSku: "SKU-202",
      fornecedorId: 501,
      filialId: 1,
      quantidadeSugerida: 10,
      quantidadeDigitada: 10,
      precoCusto: 100.0,
    });

    // Simula adulteração direta no armazenamento persistente (ex: UPDATE malicioso no banco)
    const registrosRaw = armazemPersistente.get("tenant-teste")!;
    const reg0Objeto = JSON.parse(registrosRaw[0]);
    reg0Objeto.quantidadeDigitadaComprador = 5; // Adulterou de 15 para 5 un
    registrosRaw[0] = JSON.stringify(reg0Objeto);
    armazemPersistente.set("tenant-teste", registrosRaw);

    // Após restart, a leitura deve apontar adulteração
    const repoPosAdulteracao = new RepositorioDuravelSimulado(armazemPersistente);
    const registros = await repoPosAdulteracao.obterTodos("tenant-teste");
    const validacao = validarCadeiaAuditoria(registros);

    expect(validacao.valida).toBe(false);
    expect(validacao.indiceInvalido).toBe(0);
    expect(validacao.motivo).toContain("Hash inválido");
  });

  it("deve carregar dados históricos demo com cadeia SHA-256 válida quando sem Supabase", async () => {
    // Instância com inicialização demo ativada
    const repoDemo = new RepositorioAuditoriaEmMemoria(true);
    const registros = await repoDemo.obterTodos("carreiro");

    expect(registros.length).toBeGreaterThanOrEqual(3);

    // Verifica que os registros demo contêm datas do passado
    const agora = Date.now();
    for (const reg of registros) {
      const dataReg = new Date(reg.timestamp).getTime();
      expect(dataReg).toBeLessThan(agora);
    }

    // A cadeia inteira de dados demo deve ser criptograficamente 100% válida
    const validacao = validarCadeiaAuditoria(registros);
    expect(validacao.valida).toBe(true);
  });
});
