from typing import List

import numpy as np

from .base import ModeloPrevisaoBase, PrevisaoResultado


class ModeloCombinadoPiso(ModeloPrevisaoBase):
    """
    Combinação `max(régua analítica, modelo)` — o que a PRODUÇÃO executa.

    A trava de piso em core/calculo/necessidade.ts faz a demanda do horizonte ser
    `max(régua analítica, projeção reescalada)`: o modelo só acrescenta cobertura,
    nunca reduz. O benchmark, porém, avaliava cada modelo ISOLADO — nenhuma linha
    da tabela representava o que o cockpit de fato calcula.

    Este wrapper fecha essa lacuna. Com ele o critério financeiro responde a
    pergunta que interessa de verdade: *o modelo se paga como upside?* Ou seja, a
    cobertura extra que ele acrescenta evita mais ruptura (em R$) do que custa de
    posse de estoque.

    Por construção: ruptura nunca é pior que a do piso, e a posse nunca é melhor.
    O que o critério decide é se a troca vale.
    """

    def __init__(self, piso: ModeloPrevisaoBase, upside: ModeloPrevisaoBase):
        super().__init__(f'max({piso.nome}, {upside.nome})')
        self.piso = piso
        self.upside = upside

    @staticmethod
    def _combinar(a: PrevisaoResultado, b: PrevisaoResultado, nome: str) -> PrevisaoResultado:
        return PrevisaoResultado(
            previsao_central=max(a.previsao_central, b.previsao_central),
            p50=max(a.p50, b.p50),
            # O p80 é o que vira meta de cobertura: é aqui que o piso age.
            p80=max(a.p80, b.p80),
            modelo_nome=nome,
        )

    def prever(self, historico_diario: np.ndarray, horizonte_dias: int) -> PrevisaoResultado:
        return self._combinar(
            self.piso.prever(historico_diario, horizonte_dias),
            self.upside.prever(historico_diario, horizonte_dias),
            self.nome,
        )

    def prever_lote(self, lista_series: List[np.ndarray], horizonte_dias: int) -> List[PrevisaoResultado]:
        # Delega em lote para preservar o batching do modelo de fundação, que é
        # ordens de magnitude mais rápido que série a série.
        res_piso = self.piso.prever_lote(lista_series, horizonte_dias)
        res_upside = self.upside.prever_lote(lista_series, horizonte_dias)
        return [
            self._combinar(a, b, self.nome)
            for a, b in zip(res_piso, res_upside)
        ]
