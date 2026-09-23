#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const TENANT_ID = /^[a-z0-9][a-z0-9_-]{1,62}$/;

export function validarManifesto(manifesto, tenantEsperado = null) {
  if (!manifesto || manifesto.schemaVersion !== 1 || !TENANT_ID.test(manifesto.tenantId ?? "")) {
    throw new Error("Manifesto incompatível ou sem tenant válido.");
  }
  if (tenantEsperado && manifesto.tenantId !== tenantEsperado) {
    throw new Error("Manifesto destinado a outro tenant.");
  }
  if (manifesto.somenteConfiguracoes !== true || !manifesto.dados) {
    throw new Error("Manifesto não está marcado como somente configurações.");
  }
  const { integridade, ...conteudo } = manifesto;
  const checksum = createHash("sha256").update(JSON.stringify(conteudo)).digest("hex");
  if (integridade?.algoritmo !== "sha256" || integridade.checksum !== checksum) {
    throw new Error("Checksum do manifesto inválido.");
  }
  for (const tabela of ["fornecedor_grupo", "usuario_grupo", "secao_multiplo_compra", "margem_alvo"]) {
    if (!Array.isArray(manifesto.dados[tabela])) throw new Error(`Dados ausentes: ${tabela}.`);
  }
  return manifesto;
}

async function chamarRpc(nome, corpo) {
  const url = process.env.INSIGHT_SUPABASE_URL?.replace(/\/+$/, "");
  const chave = process.env.INSIGHT_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error("Credenciais do Supabase de destino ausentes.");
  const resposta = await fetch(`${url}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: {
      apikey: chave,
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corpo),
  });
  if (!resposta.ok) throw new Error(`RPC ${nome} falhou: ${resposta.status} ${await resposta.text()}`);
  return resposta.json();
}

function valorArgumento(nome) {
  const indice = process.argv.indexOf(nome);
  return indice === -1 ? null : process.argv[indice + 1] ?? null;
}

async function principal() {
  const arquivo = valorArgumento("--manifest");
  if (!arquivo) throw new Error("Informe --manifest <arquivo.json>.");
  const tenant = process.env.MIGRACAO_TENANT_ID;
  if (!tenant || !TENANT_ID.test(tenant)) {
    throw new Error("Configure MIGRACAO_TENANT_ID com o tenant de destino.");
  }
  const manifesto = validarManifesto(
    JSON.parse(await readFile(resolve(arquivo), "utf8")),
    tenant
  );

  const resumo = {
    tenantId: manifesto.tenantId,
    fornecedorGrupo: manifesto.dados.fornecedor_grupo.length,
    usuarioGrupo: manifesto.dados.usuario_grupo.length,
    secaoMultiploCompra: manifesto.dados.secao_multiplo_compra.length,
    margemAlvo: manifesto.dados.margem_alvo.length,
  };

  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify({ modo: "dry-run", ...resumo }, null, 2));
    return;
  }

  const resultado = await chamarRpc("importar_configuracoes_diario", {
    p_tenant_id: tenant,
    p_manifesto: manifesto,
  });
  console.log(JSON.stringify({ modo: "aplicado", resultado }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  });
}
