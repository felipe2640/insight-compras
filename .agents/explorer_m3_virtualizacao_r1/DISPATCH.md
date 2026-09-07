## 2026-09-06T16:26:42Z

### Missão:
Investigar e arquitetar a solução completa de virtualização do Cockpit do Comprador com @tanstack/react-table v8 e @tanstack/react-virtual para suportar 25.000+ SKUs sem engasgos (60fps constantes na rolagem) e busca/filtro instantâneo em memória (< 250ms).

### Escopo:
1. Grid Virtualizado (@tanstack/react-virtual + @tanstack/react-table v8):
   - useVirtualizer (getScrollElement, estimateSize: 48, overscan: 10, measureElement)
   - TableBody com paddingTop/paddingBottom calculados
   - VirtualRow com React.memo e comparador customizado
   - Fixação de colunas (sticky z-10 bg-white) para Código e Descrição
2. Motor de Busca e Filtros em Memória (< 250ms para 25k SKUs):
   - Pré-computação de _searchIndex normalizado (NFD)
   - Tokenização multi-palavra
   - useDeferredValue e useTransition (60fps)
   - Filtros categóricos O(1) via Set<string>
3. Dependências e Configuração (package.json, src/components/cockpit/)
4. Estratégia de Testes (Vitest em tests/cockpit/)
