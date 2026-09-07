import fs from "fs";
import { AdaptadorInventarioCarreiro } from "../adapters/carreiro/adaptador-carreiro.ts";
import { converterParaLinhasCockpit } from "../src/lib/cockpit/gerador-linhas-matriz.ts";

// Carrega .env.local
const envContent = fs.readFileSync(".env.local", "utf8").replace(/^\uFEFF/, "");
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
}

async function testarAdaptadorCompletoAoVivo() {
  console.log("=== INICIANDO TESTE COMPLETO DO ADAPTADOR VIVO DA CARREIRO ===");
  const t0 = Date.now();

  const adaptador = new AdaptadorInventarioCarreiro();
  const saude = await adaptador.verificarSaudeConexao();
  console.log("Status de Saúde da Conexão:", saude ? "🟢 CONECTADO" : "🔴 DESCONECTADO");

  console.log("Carregando inventário completo via Fabric REST API...");
  const resposta = await adaptador.carregarInventarioCompleto({
    fornecedoresPermitidos: null,
  });

  console.log(`\n✅ Carga Completa Concluída em ${Date.now() - t0} ms!`);
  console.log(`   Provedor: ${resposta.metadados.provedor}`);
  console.log(`   Total Produtos Únicos: ${resposta.produtos.length}`);
  console.log(`   Total Posições Estoque: ${resposta.estoques.size}`);
  console.log(`   Total Históricos Vendas: ${resposta.historicos.size}`);

  // Teste de Geração da Matriz de Decisão do Cockpit (Loja Matriz Pedro II = Filial 1)
  console.log("\nGerando Matriz de Decisão do Cockpit para Filial 1 (Pedro II)...");
  const tMatriz = Date.now();
  const linhasCockpit = converterParaLinhasCockpit(resposta, { filialFocoId: 1 });
  console.log(`✅ Matriz gerada em ${Date.now() - tMatriz} ms! Total de linhas para o comprador: ${linhasCockpit.length}`);

  console.log("\n--- AMOSTRA DO COCKPIT AO VIVO (3 PRIMEIROS SKUs) ---");
  for (const linha of linhasCockpit.slice(0, 3)) {
    console.log({
      codigoSku: linha.codigoSku,
      descricao: linha.descricao,
      marca: linha.marca,
      estoqueLojaFoco: linha.estoqueLojaFoco,
      estoqueOutrasLojasRede: linha.estoqueOutrasLojasRede,
      vendas30d: linha.vendasLiquidas30d,
      vendas90d: linha.vendasLiquidas90d,
      vendas180d: linha.vendasLiquidas180d,
      sugestaoFinalCompra: linha.sugestaoFinalCompra,
      statusSugestao: linha.statusSugestao,
      motivoDecisao: linha.motivoDecisao,
      isMarcaZumbi: linha.isMarcaZumbi,
    });
  }
}

testarAdaptadorCompletoAoVivo().catch(console.error);
