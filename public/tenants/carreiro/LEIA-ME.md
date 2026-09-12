# Arquivos de marca da Rede Carreiro

Solte os arquivos aqui com EXATAMENTE estes nomes — são os que
`config/tenants/carreiro.ts` aponta em `identidadeVisual`:

| arquivo | onde aparece | observação |
|---|---|---|
| `logo-carreiro-claro.svg` | menu lateral e cabeçalhos, sobre o azul | versão com a marca em BRANCO |
| `logo-carreiro-escuro.svg` | telas de fundo claro | versão com a marca em AZUL |
| `favicon.ico` | aba do navegador | 32×32 |

SVG é o formato preferido: escala sem borrar e pesa menos. Se só houver PNG,
troque a extensão nos três campos de `identidadeVisual` — o código não assume
formato nenhum.

A logo de uma LOJA (por exemplo a Ceará Auto Peças, de Campo Maior) não é a
logo da rede e não entra aqui. O cadastro de filiais ainda não tem campo de
logotipo por loja; se for preciso, é uma mudança em `FilialCadastradaTenant`.
