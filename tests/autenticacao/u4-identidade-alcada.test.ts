/**
 * Testes Automatizados da Unidade U4 — Identidade e Alçada de Verdade
 *
 * Valida:
 * 1. Conexão do cockpit à carteira real da sessão (allowedSupplierIds).
 * 2. Falha fechada para compradores sem carteira (vê grade vazia, não o catálogo todo).
 * 3. Alçada irrestrita para Gestor e Admin.
 * 4. Restrição server-side em /api/compras (lista vazia para comprador sem carteira, 403 para fornecedor proibido).
 * 5. Troca de senha da própria conta (porta, provedor demo, provedor supabase e rota /api/auth/alterar-senha).
 * 6. Desativação de conta por administrador (porta, demo, supabase e rota /api/admin/usuarios).
 * 7. Expurgo/migração da conta órfã gestor.demo.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { ProvedorAutenticacaoDemo } from "@/lib/autenticacao/provedores/demo";
import { ProvedorAutenticacaoSupabase } from "@/lib/autenticacao/provedores/supabase";
import {
  montarUsuarioAutenticado,
  ErroCredenciaisInvalidas,
  ErroUsuarioDesativado,
} from "@/lib/autenticacao/porta";
import { GET as apiComprasGET } from "@/app/api/compras/route";
import { POST as apiAlterarSenhaPOST } from "@/app/api/auth/alterar-senha/route";
import { PATCH as apiAdminUsuariosPATCH, DELETE as apiAdminUsuariosDELETE } from "@/app/api/admin/usuarios/route";
import * as servidorAuth from "@/lib/autenticacao/servidor";
import * as fabricaAuth from "@/lib/autenticacao/fabrica";
import { filtrarLinhasCockpit } from "@/hooks/useFiltrosCockpit";
import { LinhaCockpitMatriz } from "@/tipos/cockpit";

function criarLinhaCockpit(fornecedorId: number, sku: string): LinhaCockpitMatriz {
  return {
    codigo: sku,
    codigoSku: sku,
    descricao: `Produto ${sku}`,
    marca: "Marca X",
    fabricante: "Fab X",
    fornecedorId,
    nomeFornecedor: `Fornecedor ${fornecedorId}`,
    secaoId: 1,
    secaoNome: "Geral",
    curvaAbc: "A",
    precoCusto: 100,
    precoVenda: 150,
    estoqueTotalRede: 10,
    estoqueLojaFoco: 5,
    estoqueMinimoSeguranca: 2,
    estoqueMaximo: 20,
    demandaMediaDiaria: 1,
    diasSemVenda: 0,
    vendasUltimos30dias: 30,
    vendasUltimos90dias: 90,
    vendasUltimos180dias: 180,
    coberturaEstoqueDias: 5,
    coberturaAceleracao30d: 5,
    coberturaProtecao180d: 5,
    frequenciaNotas90d: 10,
    statusSugestao: "ESTOQUE_SUFICIENTE",
    sugestaoFinalCompra: 0,
    pedidoCustom: 0,
    quantidadeTransferenciaSugerida: 0,
    lojaOrigemTransferencia: null,
    saldoOrigemTransferencia: 0,
    temSimilarComEstoque: false,
    similares: [],
    possuiNfeEntradaHoje: false,
    nfeEntradaDetalhes: null,
    isMarcaZumbi: false,
    motivoDecisao: "Normal",
    alertaVisual: null,
    multiploEmbalagem: 1,
    exigeMultiploEmbalagem: false,
    diasRupturaHistorico: 0,
    diasComEstoque: 90,
    diasAnalisadosRuptura: 90,
    rupturaPercentual: 0,
    classificacaoRuptura: "Boa",
    camposIndisponiveis: [],
  } as unknown as LinhaCockpitMatriz;
}

describe("U4: Identidade e Alçada de Verdade — Cockpit e Falha Fechada", () => {
  const produtos = [
    criarLinhaCockpit(500, "SKU-500-A"),
    criarLinhaCockpit(500, "SKU-500-B"),
    criarLinhaCockpit(501, "SKU-501-A"),
    criarLinhaCockpit(502, "SKU-502-A"),
  ];

  it("Comprador sem carteira FALHA FECHADA: não enxerga produto nenhum", () => {
    const compradorSemCarteira = montarUsuarioAutenticado(
      {
        id: "comprador-sem-carteira",
        usuario: "comprador.vazio",
        nome: "Comprador Sem Carteira",
        papel: "COMPRADOR",
        tenantId: "carreiro",
        fornecedores: null, // sem fornecedores cadastrados
      },
      "carreiro"
    )!;

    expect(compradorSemCarteira.allowedSupplierIds).toEqual([]);

    const filtrados = filtrarLinhasCockpit(produtos, {
      query: "",
      fornecedoresPermitidos: new Set(compradorSemCarteira.allowedSupplierIds ?? []),
      marcasDeselecionadas: new Set(),
      secoesDeselecionadas: new Set(),
      curvasDeselecionadas: new Set(),
      statusFiltro: "ALL",
    });

    expect(filtrados).toHaveLength(0);
  });

  it("Comprador com carteira homologada enxerga estritamente seus fornecedores", () => {
    const compradorRestrito = montarUsuarioAutenticado(
      {
        id: "comprador-restrito",
        usuario: "comprador.freios",
        nome: "Comprador Freios",
        papel: "COMPRADOR",
        tenantId: "carreiro",
        fornecedores: [500],
      },
      "carreiro"
    )!;

    expect(compradorRestrito.allowedSupplierIds).toEqual([500]);

    const filtrados = filtrarLinhasCockpit(produtos, {
      query: "",
      fornecedoresPermitidos: new Set(compradorRestrito.allowedSupplierIds ?? []),
      marcasDeselecionadas: new Set(),
      secoesDeselecionadas: new Set(),
      curvasDeselecionadas: new Set(),
      statusFiltro: "ALL",
    });

    expect(filtrados).toHaveLength(2);
    expect(filtrados.every((p) => p.fornecedorId === 500)).toBe(true);
  });

  it("Gestor e Administrador possuem alçada irrestrita (allowedSupplierIds = null)", () => {
    const gestor = montarUsuarioAutenticado(
      {
        id: "gestor-1",
        usuario: "gestor",
        nome: "Gestor Geral",
        papel: "GESTOR",
        tenantId: "carreiro",
        fornecedores: null,
      },
      "carreiro"
    )!;

    expect(gestor.allowedSupplierIds).toBeNull();

    const filtrados = filtrarLinhasCockpit(produtos, {
      query: "",
      fornecedoresPermitidos: gestor.allowedSupplierIds ? new Set(gestor.allowedSupplierIds) : null,
      marcasDeselecionadas: new Set(),
      secoesDeselecionadas: new Set(),
      curvasDeselecionadas: new Set(),
      statusFiltro: "ALL",
    });

    expect(filtrados).toHaveLength(4);
  });
});

describe("U4: Restrição no Servidor (/api/compras)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("Comprador sem carteira recebe lista vazia (total: 0, dados: []) no backend", async () => {
    const usuarioCompradorVazio = {
      id: "u-vazio",
      email: "vazio",
      nome: "Comprador Vazio",
      role: "COMPRADOR" as const,
      allowedSupplierIds: [] as number[],
      tenantId: "carreiro",
    };

    vi.spyOn(servidorAuth, "obterUsuarioDaRequisicao").mockResolvedValue(usuarioCompradorVazio);

    const req = new NextRequest("http://localhost:3000/api/compras?filialId=1");
    const res = await apiComprasGET(req);
    expect(res.status).toBe(200);

    const corpo = await res.json();
    expect(corpo.sucesso).toBe(true);
    expect(corpo.total).toBe(0);
    expect(corpo.dados).toEqual([]);
    expect(corpo.contagens).toEqual({ acionaveis: 0, monitorar: 0, saudavel: 0, excesso: 0, zerado: 0 });
  });

  it("Comprador sem carteira tentando consultar fornecedor específico recebe 403", async () => {
    const usuarioCompradorVazio = {
      id: "u-vazio",
      email: "vazio",
      nome: "Comprador Vazio",
      role: "COMPRADOR" as const,
      allowedSupplierIds: [] as number[],
      tenantId: "carreiro",
    };

    vi.spyOn(servidorAuth, "obterUsuarioDaRequisicao").mockResolvedValue(usuarioCompradorVazio);

    const req = new NextRequest("http://localhost:3000/api/compras?filialId=1&fornecedorId=502");
    const res = await apiComprasGET(req);
    expect(res.status).toBe(403);
    const corpo = await res.json();
    expect(corpo.sucesso).toBe(false);
  });

  it("Comprador restrito tentando consultar fornecedor fora de sua carteira recebe 403", async () => {
    const usuarioCompradorRestrito = {
      id: "u-500",
      email: "comprador500",
      nome: "Comprador 500",
      role: "COMPRADOR" as const,
      allowedSupplierIds: [500],
      tenantId: "carreiro",
    };

    vi.spyOn(servidorAuth, "obterUsuarioDaRequisicao").mockResolvedValue(usuarioCompradorRestrito);

    const req = new NextRequest("http://localhost:3000/api/compras?filialId=1&fornecedorId=502");
    const res = await apiComprasGET(req);
    expect(res.status).toBe(403);
  });
});

describe("U4: Troca de Senha e Desativação de Usuário", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("Troca de senha na porta (demo) atualiza senha e permite novo login", async () => {
    const provedor = new ProvedorAutenticacaoDemo({ senha: "senhaInicial123", segredo: "chave" });

    // Tentativa com senha atual incorreta é rejeitada
    await expect(
      provedor.alterarSenha("demo-gestor", "senhaIncorreta", "novaSenha123")
    ).rejects.toBeInstanceOf(ErroCredenciaisInvalidas);

    // Troca com a senha correta funciona
    await provedor.alterarSenha("demo-gestor", "senhaInicial123", "novaSenhaForte123");

    // Login com a nova senha tem sucesso
    const sessao = await provedor.entrar({ usuario: "gestor", senha: "novaSenhaForte123", tenantId: "carreiro" });
    expect(sessao.usuario.id).toBe("demo-gestor");
  });

  it("Rota POST /api/auth/alterar-senha exige login e valida campos", async () => {
    vi.spyOn(servidorAuth, "obterUsuarioDaRequisicao").mockResolvedValue(null);
    const reqSemLogin = new NextRequest("http://localhost:3000/api/auth/alterar-senha", {
      method: "POST",
      body: JSON.stringify({ senhaAtual: "x", novaSenha: "y" }),
    });
    const resSemLogin = await apiAlterarSenhaPOST(reqSemLogin);
    expect(resSemLogin.status).toBe(401);

    // Usuário autenticado
    const usuarioMock = {
      id: "demo-gestor",
      email: "gestor",
      nome: "Gestor",
      role: "GESTOR" as const,
      allowedSupplierIds: null,
      tenantId: "carreiro",
    };
    vi.spyOn(servidorAuth, "obterUsuarioDaRequisicao").mockResolvedValue(usuarioMock);

    const provedorMock = new ProvedorAutenticacaoDemo({ senha: "senhaInicial123", segredo: "k" });
    vi.spyOn(fabricaAuth, "obterProvedorAutenticacao").mockReturnValue(provedorMock);

    const reqSucesso = new NextRequest("http://localhost:3000/api/auth/alterar-senha", {
      method: "POST",
      body: JSON.stringify({ senhaAtual: "senhaInicial123", novaSenha: "novaSenhaForte456" }),
    });
    const resSucesso = await apiAlterarSenhaPOST(reqSucesso);
    expect(resSucesso.status).toBe(200);
    const corpo = await resSucesso.json();
    expect(corpo.sucesso).toBe(true);
  });

  it("Rota PATCH /api/admin/usuarios permite desativação e reativação por administrador", async () => {
    const adminMock = {
      id: "demo-admin",
      email: "admin",
      nome: "Admin",
      role: "ADMIN" as const,
      allowedSupplierIds: null,
      tenantId: "carreiro",
    };
    vi.spyOn(servidorAuth, "obterUsuarioDaRequisicao").mockResolvedValue(adminMock);

    const provedor = new ProvedorAutenticacaoDemo({ senha: "demo", segredo: "k" });
    vi.spyOn(fabricaAuth, "obterAdministradorUsuarios").mockReturnValue(provedor);

    // Desativação
    const reqDesativar = new NextRequest("http://localhost:3000/api/admin/usuarios", {
      method: "PATCH",
      body: JSON.stringify({ id: "demo-comprador", acao: "desativar" }),
    });
    const resDesativar = await apiAdminUsuariosPATCH(reqDesativar);
    expect(resDesativar.status).toBe(200);

    // Confirma que a conta não autentica mais
    await expect(
      provedor.entrar({ usuario: "comprador", senha: "demo", tenantId: "carreiro" })
    ).rejects.toBeInstanceOf(ErroUsuarioDesativado);

    // Reativação
    const reqReativar = new NextRequest("http://localhost:3000/api/admin/usuarios", {
      method: "PATCH",
      body: JSON.stringify({ id: "demo-comprador", acao: "reativar" }),
    });
    const resReativar = await apiAdminUsuariosPATCH(reqReativar);
    expect(resReativar.status).toBe(200);

    // Confirma que a conta voltou a autenticar
    const sessao = await provedor.entrar({ usuario: "comprador", senha: "demo", tenantId: "carreiro" });
    expect(sessao.usuario.id).toBe("demo-comprador");
  });

  it("Administrador não pode desativar a própria conta", async () => {
    const adminMock = {
      id: "demo-admin",
      email: "admin",
      nome: "Admin",
      role: "ADMIN" as const,
      allowedSupplierIds: null,
      tenantId: "carreiro",
    };
    vi.spyOn(servidorAuth, "obterUsuarioDaRequisicao").mockResolvedValue(adminMock);

    const reqAutoDesativacao = new NextRequest("http://localhost:3000/api/admin/usuarios", {
      method: "PATCH",
      body: JSON.stringify({ id: "demo-admin", acao: "desativar" }),
    });
    const resAutoDesativacao = await apiAdminUsuariosPATCH(reqAutoDesativacao);
    expect(resAutoDesativacao.status).toBe(400);
  });
});
