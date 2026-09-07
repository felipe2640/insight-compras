import fs from "fs";

// Carrega .env.local
const envContent = fs.readFileSync(".env.local", "utf8").replace(/^\uFEFF/, "");
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
}

async function testarConexaoVivaPowerBI() {
  const tenantId = process.env.POWERBI_TENANT_ID;
  const clientId = process.env.POWERBI_CLIENT_ID;
  const clientSecret = process.env.POWERBI_CLIENT_SECRET;
  const workspaceId = process.env.POWERBI_WORKSPACE_ID;
  const datasetId = process.env.POWERBI_DATASET_ID;

  console.log("--------------------------------------------------");
  console.log("1. Autenticação OAuth2 no Azure Entra ID...");
  console.log("   Tenant ID:", tenantId);
  console.log("   Client ID:", clientId);
  console.log("   Workspace ID:", workspaceId);
  console.log("   Dataset ID:", datasetId);

  const t0 = Date.now();
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

  if (!resToken.ok) {
    const erroTexto = await resToken.text();
    console.error("❌ Falha na autenticação OAuth2:", resToken.status, erroTexto);
    return;
  }

  const tokenData = await resToken.json();
  console.log("✅ Token OAuth2 obtido com sucesso em", Date.now() - t0, "ms!");
  console.log("   Validade do token:", tokenData.expires_in, "segundos");

  console.log("\n2. Executando consulta DAX viva no Power BI Fabric REST API...");
  const t1 = Date.now();
  const daxUrl = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/executeQueries`;
  
  // Consulta de teste de conectividade e frescor
  const daxQuery = `
EVALUATE
ROW(
    "Status", "CONECTADO_AO_VIVO",
    "TimestampUTC", NOW(),
    "TotalEmpresas", COUNTROWS(CADEMP),
    "TotalProdutos", COUNTROWS(PRODUTOS)
)
  `.trim();

  const resDax = await fetch(daxUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      queries: [{ query: daxQuery }],
      serializerSettings: { includeNulls: true },
    }),
  });

  if (!resDax.ok) {
    const erroDax = await resDax.text();
    console.error("❌ Falha na API do Power BI Fabric:", resDax.status, erroDax);
    return;
  }

  const daxData = await resDax.json();
  console.log("✅ Consulta DAX executada com sucesso no Fabric em", Date.now() - t1, "ms!");
  console.log("\n3. Dados retornados do modelo semântico vivo:");
  console.dir(daxData.results?.[0]?.tables?.[0]?.rows, { depth: null });
}

testarConexaoVivaPowerBI().catch((err) => console.error("Erro inesperado:", err));
