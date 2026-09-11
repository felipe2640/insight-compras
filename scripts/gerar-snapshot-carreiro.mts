/**
 * Gera o snapshot normalizado da Rede Carreiro a partir da carga ao vivo.
 *
 * Uso:  npx tsx scripts/gerar-snapshot-carreiro.mts
 *
 * Rode antes de uma apresentação. Depois, com CARREIRO_PREFERIR_SNAPSHOT=true,
 * o cockpit carrega instantaneamente e sem depender de rede.
 */
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8").replace(/^﻿/, "");
for (const linha of env.split(/\r?\n/)) {
  const m = linha.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}

const { AdaptadorInventarioCarreiro } = await import("../adapters/carreiro/adaptador-carreiro.ts");
const { gravarSnapshotNormalizado } = await import("../adapters/carreiro/snapshot-normalizado.ts");

const t0 = Date.now();
console.log("Carregando inventário ao vivo do Power BI...");

const adaptador = new AdaptadorInventarioCarreiro();
const carga = await adaptador.carregarInventarioCompleto({
  fornecedoresPermitidos: null,
  filialId: 1,
  apenasComEstoqueOuVenda: true,
});

const est = [...carga.estoques.values()];
console.log(`  carga em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`  produtos ${carga.produtos.length} | posições ${carga.estoques.size} | históricos ${carga.historicos.size}`);
console.log(`  saldo>0 ${est.filter((x) => x.saldoFisico > 0).length} | margem apurada ${est.filter((x) => x.margemRealizada !== null).length}`);

if (carga.produtos.length === 0 || carga.estoques.size === 0) {
  console.error("ABORTADO: carga vazia, snapshot não seria confiável.");
  process.exit(1);
}

const caminho = gravarSnapshotNormalizado(carga);
const tamanhoMb = fs.statSync(caminho).size / 1024 / 1024;
console.log(`\nSnapshot gravado: ${caminho} (${tamanhoMb.toFixed(1)} MB)`);
console.log("Para usar na apresentação: CARREIRO_PREFERIR_SNAPSHOT=true npm run dev");
