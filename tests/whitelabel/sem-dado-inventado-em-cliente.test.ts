/**
 * Nenhum dado inventado na instalação de um cliente real
 * Camada: Testes / Whitelabel
 * 100% em Português do Brasil (pt-BR).
 *
 * O provedor em memória é quem atende quando não há banco configurado — e isso
 * acontece por OMISSÃO, bastando faltar a variável do Supabase no ambiente.
 * Semeado incondicionalmente, ele enchia a instalação de um cliente real com
 * pedidos e registros de auditoria fabricados.
 *
 * Medido com TENANT_ATIVO=carreiro e sem Supabase: a tela de Auditoria trazia
 * "Carlos Comprador" e "Ana Suprimentos" operando em "Loja Central 01" e
 * "Filial Norte 02" — pessoas e lojas que não existem na rede — com
 * justificativas escritas, valores em reais e hash SHA-256, sob um cabeçalho
 * que promete trilha imutável. A de Pedidos trazia quatro ordens de compra.
 *
 * A regra é a mesma da fonte de dados: quem declara fonte sintética
 * recebe conteúdo sintético; cliente real começa vazio, que é a verdade.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { obterRepositorioPedidos, reiniciarRepositorioPedidos } from "@/lib/pedidos";
import {
  obterRepositorioAuditoria,
  reiniciarRepositorioAuditoria,
} from "@/lib/auditoria/repositorio-auditoria";
import { TENANT_CARREIRO, TENANT_DEMONSTRACAO } from "@config/tenants";

const envOriginal = { ...process.env };

function prepararAmbienteSemBanco(tenantAtivo?: string) {
  process.env = { ...envOriginal };
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.PEDIDOS_PROVIDER;
  delete process.env.AUDITORIA_PROVIDER;
  if (tenantAtivo) process.env.TENANT_ATIVO = tenantAtivo;
  else delete process.env.TENANT_ATIVO;
  reiniciarRepositorioPedidos();
  reiniciarRepositorioAuditoria();
}

describe("Sem banco configurado, um cliente real não recebe dado inventado", () => {
  beforeEach(() => prepararAmbienteSemBanco());
  afterEach(() => {
    process.env = { ...envOriginal };
    reiniciarRepositorioPedidos();
    reiniciarRepositorioAuditoria();
  });

  it("o catálogo declara a fonte de cada tenant", () => {
    expect(TENANT_CARREIRO.fonte.adaptador).toBe("powerbi-dax");
    expect(TENANT_DEMONSTRACAO.fonte.adaptador).toBe("sintetica");
  });

  it("pedidos: cliente real começa VAZIO", async () => {
    prepararAmbienteSemBanco("carreiro");
    const pedidos = await obterRepositorioPedidos().listarPedidos({
      tenantId: "carreiro",
      dias: 365,
    });
    expect(pedidos).toHaveLength(0);
  });

  it("auditoria: cliente real começa com a trilha VAZIA", async () => {
    prepararAmbienteSemBanco("carreiro");
    const trilha = await obterRepositorioAuditoria().consultar({ tenantId: "carreiro" });
    expect(trilha).toHaveLength(0);
  });

  it("nenhuma pessoa ou loja fictícia sobra na trilha de um cliente real", async () => {
    prepararAmbienteSemBanco("carreiro");
    const trilha = await obterRepositorioAuditoria().consultar({ tenantId: "carreiro" });
    const texto = JSON.stringify(trilha);
    for (const invencao of ["Carlos Comprador", "Ana Suprimentos", "Loja Central", "Filial Norte"]) {
      expect(texto).not.toContain(invencao);
    }
  });

  it("a DEMONSTRAÇÃO continua com o que mostrar", async () => {
    prepararAmbienteSemBanco("demonstracao");
    const pedidos = await obterRepositorioPedidos().listarPedidos({
      tenantId: "demonstracao",
      dias: 365,
    });
    const trilha = await obterRepositorioAuditoria().consultar({ tenantId: "demonstracao" });
    expect(pedidos.length).toBeGreaterThan(0);
    expect(trilha.length).toBeGreaterThan(0);
  });

  it("sem TENANT_ATIVO cai na demonstração, e o mostruário tem conteúdo", async () => {
    prepararAmbienteSemBanco();
    const trilha = await obterRepositorioAuditoria().consultar({ tenantId: "demonstracao" });
    expect(trilha.length).toBeGreaterThan(0);
  });
});
