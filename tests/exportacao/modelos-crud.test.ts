/**
 * Testes Automatizados do CRUD Completo de Modelos de Exportação
 * Camada: Testes / Exportação (tests/exportacao/modelos-crud.test.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "@/app/api/exportacao/modelos/route";
import * as servidorAuth from "@/lib/autenticacao/servidor";
import {
  salvarModelo,
  listarModelosSalvos,
  excluirModelo,
  limparModelosMemoria,
  modelosPersistidos,
} from "@/lib/exportacao/modelos-repositorio";
import { ModeloExportacao } from "@/lib/exportacao/modelos";

describe("CRUD Completo de Modelos de Exportação (API e Repositório)", () => {
  beforeEach(() => {
    limparModelosMemoria();

    // Usuário Gestor padrão para testes da rota
    vi.spyOn(servidorAuth, "obterUsuarioDaRequisicao").mockResolvedValue({
      id: "usr-gestor-01",
      nome: "Gestor Operações",
      email: "gestor@empresa.com.br",
      role: "GESTOR",
      allowedSupplierIds: null,
      tenantId: "carreiro",
    });
  });

  describe("Repositório em Memória / Fallback Declarado", () => {
    it("deve declarar suporte a persistência mesmo sem variáveis de ambiente do Supabase", () => {
      expect(modelosPersistidos()).toBe(true);
    });

    it("deve criar, listar, alterar e excluir modelo pelo repositório", async () => {
      const tenantId = "tenant-teste";
      const modelo: ModeloExportacao = {
        id: "modelo_personalizado_1",
        nome: "Modelo Personalizado 1",
        escopo: "compra",
        formato: "xlsx",
        colunas: ["sku", "descricao", "qtd_pedido"],
        nomeArquivo: "{tenant} teste",
        deFabrica: false,
      };

      // 1. Salvar
      await salvarModelo(tenantId, modelo, "Gestor");
      let salvos = await listarModelosSalvos(tenantId);
      expect(salvos).toHaveLength(1);
      expect(salvos[0].id).toBe("modelo_personalizado_1");
      expect(salvos[0].nome).toBe("Modelo Personalizado 1");
      expect(salvos[0].colunas).toEqual(["sku", "descricao", "qtd_pedido"]);

      // 2. Renomear (mesmo id, novo nome)
      const modeloRenomeado: ModeloExportacao = {
        ...modelo,
        nome: "Modelo Renomeado VIP",
      };
      await salvarModelo(tenantId, modeloRenomeado, "Gestor");
      salvos = await listarModelosSalvos(tenantId);
      expect(salvos).toHaveLength(1);
      expect(salvos[0].nome).toBe("Modelo Renomeado VIP");

      // 3. Alterar colunas
      const modeloColunasAlteradas: ModeloExportacao = {
        ...modeloRenomeado,
        colunas: ["sku", "descricao", "marca", "preco_custo"],
      };
      await salvarModelo(tenantId, modeloColunasAlteradas, "Gestor");
      salvos = await listarModelosSalvos(tenantId);
      expect(salvos).toHaveLength(1);
      expect(salvos[0].colunas).toEqual(["sku", "descricao", "marca", "preco_custo"]);

      // 4. Excluir
      await excluirModelo(tenantId, "modelo_personalizado_1");
      salvos = await listarModelosSalvos(tenantId);
      expect(salvos).toHaveLength(0);
    });
  });

  describe("Endpoints da API /api/exportacao/modelos", () => {
    it("GET deve retornar modelos de fábrica mesclados com modelos salvos", async () => {
      // Salva um modelo customizado antes
      await salvarModelo(
        "carreiro",
        {
          id: "modelo_semanal_especial",
          nome: "Semanal Especial",
          escopo: "compra",
          formato: "csv",
          colunas: ["sku", "descricao"],
          nomeArquivo: "arquivo",
          deFabrica: false,
        },
        "Gestor"
      );

      const req = new NextRequest("http://localhost:3000/api/exportacao/modelos");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const corpo = (await res.json()) as {
        modelos: ModeloExportacao[];
        podeSalvar: boolean;
        persistencia: boolean;
      };

      expect(Array.isArray(corpo.modelos)).toBe(true);
      expect(corpo.podeSalvar).toBe(true);
      expect(corpo.persistencia).toBe(true);

      const customSalvo = corpo.modelos.find((m) => m.id === "modelo_semanal_especial");
      expect(customSalvo).toBeDefined();
      expect(customSalvo?.nome).toBe("Semanal Especial");
      expect(customSalvo?.deFabrica).toBe(false);

      // Deve incluir também os modelos de fábrica
      const deFabrica = corpo.modelos.filter((m) => m.deFabrica);
      expect(deFabrica.length).toBeGreaterThanOrEqual(1);
    });

    it("POST deve criar um novo modelo com colunas selecionadas", async () => {
      const payload = {
        nome: "Pedido Distribuidor ABC",
        escopo: "compra",
        formato: "xlsx",
        colunas: ["sku", "descricao", "marca", "qtd_pedido"],
      };

      const req = new NextRequest("http://localhost:3000/api/exportacao/modelos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const corpo = (await res.json()) as { modelo: ModeloExportacao };
      expect(corpo.modelo.id).toBe("pedido_distribuidor_abc");
      expect(corpo.modelo.nome).toBe("Pedido Distribuidor ABC");
      expect(corpo.modelo.formato).toBe("xlsx");
      expect(corpo.modelo.colunas).toEqual(["sku", "descricao", "marca", "qtd_pedido"]);
      expect(corpo.modelo.deFabrica).toBe(false);

      // Verifica se o modelo aparece no GET
      const getReq = new NextRequest("http://localhost:3000/api/exportacao/modelos");
      const getRes = await GET(getReq);
      const getCorpo = (await getRes.json()) as { modelos: ModeloExportacao[] };
      expect(getCorpo.modelos.some((m) => m.id === "pedido_distribuidor_abc")).toBe(true);
    });

    it("POST deve permitir renomear um modelo existente enviando seu id com novo nome", async () => {
      // 1. Cria o modelo
      await salvarModelo(
        "carreiro",
        {
          id: "modelo_para_renomear",
          nome: "Nome Antigo",
          escopo: "compra",
          formato: "csv",
          colunas: ["sku", "descricao"],
          nomeArquivo: "arquivo",
          deFabrica: false,
        },
        "Gestor"
      );

      // 2. Renomeia via POST com id existente
      const req = new NextRequest("http://localhost:3000/api/exportacao/modelos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "modelo_para_renomear",
          nome: "Nome Novo Atualizado",
          escopo: "compra",
          formato: "csv",
          colunas: ["sku", "descricao"],
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const corpo = (await res.json()) as { modelo: ModeloExportacao };
      expect(corpo.modelo.id).toBe("modelo_para_renomear");
      expect(corpo.modelo.nome).toBe("Nome Novo Atualizado");

      // 3. Valida no GET
      const getRes = await GET(new NextRequest("http://localhost:3000/api/exportacao/modelos"));
      const getCorpo = (await getRes.json()) as { modelos: ModeloExportacao[] };
      const modeloAtualizado = getCorpo.modelos.find((m) => m.id === "modelo_para_renomear");
      expect(modeloAtualizado?.nome).toBe("Nome Novo Atualizado");
    });

    it("POST deve permitir alterar colunas de um modelo existente", async () => {
      // 1. Cria o modelo
      await salvarModelo(
        "carreiro",
        {
          id: "modelo_colunas_editaveis",
          nome: "Modelo Colunas Editáveis",
          escopo: "compra",
          formato: "xlsx",
          colunas: ["sku"],
          nomeArquivo: "arquivo",
          deFabrica: false,
        },
        "Gestor"
      );

      // 2. Altera colunas via POST
      const novasColunas = ["sku", "descricao", "marca", "preco_custo", "qtd_pedido"];
      const req = new NextRequest("http://localhost:3000/api/exportacao/modelos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "modelo_colunas_editaveis",
          nome: "Modelo Colunas Editáveis",
          escopo: "compra",
          formato: "xlsx",
          colunas: novasColunas,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const corpo = (await res.json()) as { modelo: ModeloExportacao };
      expect(corpo.modelo.colunas).toEqual(novasColunas);

      // 3. Valida no GET
      const getRes = await GET(new NextRequest("http://localhost:3000/api/exportacao/modelos"));
      const getCorpo = (await getRes.json()) as { modelos: ModeloExportacao[] };
      const modeloAtualizado = getCorpo.modelos.find((m) => m.id === "modelo_colunas_editaveis");
      expect(modeloAtualizado?.colunas).toEqual(novasColunas);
    });

    it("DELETE deve excluir um modelo customizado salvo", async () => {
      // 1. Cria o modelo
      await salvarModelo(
        "carreiro",
        {
          id: "modelo_a_ser_apagado",
          nome: "Modelo Para Deletar",
          escopo: "todos",
          formato: "csv",
          colunas: ["sku"],
          nomeArquivo: "arquivo",
          deFabrica: false,
        },
        "Gestor"
      );

      // 2. Exclui via DELETE
      const req = new NextRequest(
        "http://localhost:3000/api/exportacao/modelos?id=modelo_a_ser_apagado",
        { method: "DELETE" }
      );
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const corpo = (await res.json()) as { excluido: string };
      expect(corpo.excluido).toBe("modelo_a_ser_apagado");

      // 3. Valida no GET que não existe mais
      const getRes = await GET(new NextRequest("http://localhost:3000/api/exportacao/modelos"));
      const getCorpo = (await getRes.json()) as { modelos: ModeloExportacao[] };
      expect(getCorpo.modelos.some((m) => m.id === "modelo_a_ser_apagado")).toBe(false);
    });

    it("DELETE deve recusar exclusão de modelo de fábrica com 409", async () => {
      // Pega o id do primeiro modelo de fábrica
      const getRes = await GET(new NextRequest("http://localhost:3000/api/exportacao/modelos"));
      const getCorpo = (await getRes.json()) as { modelos: ModeloExportacao[] };
      const modeloFabrica = getCorpo.modelos.find((m) => m.deFabrica);
      expect(modeloFabrica).toBeDefined();

      const req = new NextRequest(
        `http://localhost:3000/api/exportacao/modelos?id=${encodeURIComponent(modeloFabrica!.id)}`,
        { method: "DELETE" }
      );
      const res = await DELETE(req);
      expect(res.status).toBe(409);
      const corpo = (await res.json()) as { erro: string };
      expect(corpo.erro).toContain("Modelo de fábrica não pode ser apagado");
    });

    it("POST deve validar nome curto e ausência de colunas", async () => {
      const reqNomeCurto = new NextRequest("http://localhost:3000/api/exportacao/modelos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "ab", escopo: "compra", formato: "csv", colunas: ["sku"] }),
      });
      const resNomeCurto = await POST(reqNomeCurto);
      expect(resNomeCurto.status).toBe(400);

      const reqSemColunas = new NextRequest("http://localhost:3000/api/exportacao/modelos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Nome Valido", escopo: "compra", formato: "csv", colunas: [] }),
      });
      const resSemColunas = await POST(reqSemColunas);
      expect(resSemColunas.status).toBe(400);
    });
  });
});
