/**
 * Cria um usuário no provedor de autenticação configurado (server-side, chave privilegiada).
 *
 *   npx tsx scripts/criar-usuario.mts --usuario gestor --nome "Nome" --papel GESTOR [--tenant carreiro] [--fornecedores 12,34]
 *
 * A senha vem de SENHA_NOVO_USUARIO no ambiente (nunca em argumento: fica no histórico do shell).
 * Se ausente, uma senha aleatória é gerada e impressa UMA vez.
 */
import fs from "node:fs";
import crypto from "node:crypto";

const env = fs.readFileSync(".env.local", "utf8").replace(/^﻿/, "");
for (const linha of env.split(/\r?\n/)) {
  const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const { obterAdministradorUsuarios, normalizarPapel, normalizarFornecedores } = await import("../src/lib/autenticacao/index.ts");

const usuario = arg("usuario") ?? arg("email");
const nome = arg("nome");
const papel = normalizarPapel(arg("papel"));
// Sem padrão de cliente: criar usuário no cliente errado é dar acesso ao
// estoque de outra rede. Ou vem no argumento, ou vem do ambiente da instalação.
const tenantId = arg("tenant") ?? process.env.TENANT_ATIVO?.trim();
if (!tenantId) {
  console.error("informe --tenant <cliente> ou defina TENANT_ATIVO");
  process.exit(1);
}
const fornecedores = normalizarFornecedores(arg("fornecedores"));
if (!usuario || !nome || !papel) {
  console.error("uso: --usuario <usuario> --nome <nome> --papel COMPRADOR|GESTOR|ADMIN [--tenant id] [--fornecedores 1,2]");
  process.exit(2);
}

let senha = process.env.SENHA_NOVO_USUARIO;
let senhaGerada = false;
if (!senha) {
  senha = crypto.randomBytes(9).toString("base64url");
  senhaGerada = true;
}

const admin = obterAdministradorUsuarios();
const criado = await admin.criarUsuario({ usuario, senha, nome, papel, tenantId, fornecedores });
console.log(`usuário criado: ${criado.usuario} (${criado.papel}, tenant ${criado.tenantId}, id ${criado.id})`);
if (senhaGerada) console.log(`senha inicial (mostrada uma única vez): ${senha}`);
