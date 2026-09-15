import fs from "fs";
import {
  CONSULTA_DAX_FRESCOR,
  CONSULTA_DAX_LOJAS,
  gerarConsultaDaxProdutosEstoque,
  gerarConsultaDaxHistoricoVendas,
} from "../adapters/carreiro/consultas-homologadas.ts";

// Carrega .env.local
const envContent = fs.readFileSync(".env.local", "utf8").replace(/^\uFEFF/, "");
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
}

async function testarConsultasVivas() {
  const tenantId = process.env.POWERBI_TENANT_ID;
  const clientId = process.env.POWERBI_CLIENT_ID;
  const clientSecret = process.env.POWERBI_CLIENT_SECRET;
  const workspaceId = process.env.POWERBI_WORKSPACE_ID;
  const datasetId = process.env.POWERBI_DATASET_ID;

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://analysis.windows.net/powerbi/api/.default",
  });

  const resToken = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const tokenData = await resToken.json();
  const token = tokenData.access_token;
  const daxUrl = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/executeQueries`;

  async function rodarDax(nome, query) {
    const t0 = Date.now();
    const res = await fetch(daxUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ queries: [{ query }], serializerSettings: { includeNulls: true } }),
    });

    if (!res.ok) {
      console.error(`❌ Erro em ${nome} (HTTP ${res.status}):`, await res.text());
      return null;
    }

    const json = await res.json();
    const linhas = json.results?.[0]?.tables?.[0]?.rows ?? [];
    console.log(`✅ ${nome}: ${linhas.length} linhas em ${Date.now() - t0} ms`);
    return linhas;
  }

  console.log("\n--- TESTANDO CONSULTAS HOMOLOGADAS NO FABRIC VIVO ---");
  const lojas = await rodarDax("1. Lojas da Rede (store_map)", CONSULTA_DAX_LOJAS);
  console.log("   Lojas:", lojas?.map((l) => `${l["CADEMP[ANOMEFANTASIA]"] || l["[Loja]"]}`));

  const frescor = await rodarDax("2. Frescor dos Dados (freshness)", CONSULTA_DAX_FRESCOR);
  console.log("   Frescor:", frescor?.[0]);

  // Executa gerarConsultaDaxProdutosEstoque diretamente
  const queryProdutos = gerarConsultaDaxProdutosEstoque(
    { apenasComEstoqueOuVenda: true, filialId: 1 },
    null,
    "CARREIRO PEDRO II"
  );
  const produtos = await rodarDax("3. Produtos com Venda 180d na Pedro II", queryProdutos);
  if (produtos && produtos.length > 0) {
    console.log(`   Total produtos retornados: ${produtos.length}`);
    console.log("   Primeiro produto retornado do Fabric:", produtos[0]);
  }

  // Executa gerarConsultaDaxHistoricoVendas diretamente
  const queryHistorico = gerarConsultaDaxHistoricoVendas();
  const historicos = await rodarDax("4. Histórico de Vendas 30d/90d/180d", queryHistorico);
  if (historicos && historicos.length > 0) {
    console.log(`   Total históricos agregados: ${historicos.length}`);
    console.log("   Primeiro histórico retornado:", historicos[0]);
  }
}

testarConsultasVivas().catch(console.error);
