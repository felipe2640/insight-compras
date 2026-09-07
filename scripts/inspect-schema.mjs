import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf8").replace(/^\uFEFF/, "");
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
}

async function inspectSchema() {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.POWERBI_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.POWERBI_CLIENT_ID,
    client_secret: process.env.POWERBI_CLIENT_SECRET,
    scope: "https://analysis.windows.net/powerbi/api/.default",
  });

  const resToken = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const token = (await resToken.json()).access_token;
  const daxUrl = `https://api.powerbi.com/v1.0/myorg/groups/${process.env.POWERBI_WORKSPACE_ID}/datasets/${process.env.POWERBI_DATASET_ID}/executeQueries`;

  async function queryDax(query) {
    const res = await fetch(daxUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ queries: [{ query }], serializerSettings: { includeNulls: true } }),
    });
    return res.json();
  }

  console.log("\n--- COLUNAS DA TABELA NOTAS NO FABRIC ---");
  const dataNotas = await queryDax("EVALUATE TOPN(1, NOTAS)");
  if (dataNotas.error) {
    console.error("Erro em NOTAS:", dataNotas.error);
  } else {
    const row = dataNotas.results?.[0]?.tables?.[0]?.rows?.[0];
    console.log(Object.keys(row || {}));
    console.log("Exemplo de linha NOTAS:", row);
  }

  console.log("\n--- TABELAS DO MODELO SEMÂNTICO (INFO.TABLES) ---");
  const dataTables = await queryDax("EVALUATE SELECTCOLUMNS(INFO.TABLES(), \"Name\", [Name])");
  if (dataTables.error) {
    console.log("INFO.TABLES não disponível ou restrito.");
  } else {
    console.log(dataTables.results?.[0]?.tables?.[0]?.rows?.map((r) => r["[Name]"]));
  }
}

inspectSchema().catch(console.error);
