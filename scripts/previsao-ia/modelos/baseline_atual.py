import math
import numpy as np
from .base import ModeloPrevisaoBase, PrevisaoResultado

class ModeloBaselineAtual(ModeloPrevisaoBase):
    def __init__(self, fator_calibracao: float = 0.90):
        super().__init__('Baseline Heuristico (Atual)')
        self.fator_calibracao = fator_calibracao

    def prever(self, historico_diario: np.ndarray, horizonte_dias: int) -> PrevisaoResultado:
        if len(historico_diario) == 0:
            return PrevisaoResultado(0.0, 0.0, 0.0, self.nome)

        # Janela padrao de 180 dias do motor oficial
        janela_180d = historico_diario[-180:] if len(historico_diario) >= 180 else historico_diario
        total_vendas_180 = float(np.sum(janela_180d))
        dias_denominador = 180.0

        daily_rate = total_vendas_180 / dias_denominador if dias_denominador > 0 else 0.0
        monthly_rate = daily_rate * 30.0

        if monthly_rate >= 6.0:
            margem = 0.25
        elif monthly_rate >= 2.5:
            margem = 0.45
        else:
            margem = 0.80

        # Previsao central = taxa diaria * horizonte
        previsao_central = daily_rate * horizonte_dias
        # Previsao com margem e fator de calibracao (equivalente ao p80/p90 do motor de estoque)
        demanda_horizonte = daily_rate * horizonte_dias * (1.0 + margem)
        p80 = math.ceil(demanda_horizonte * self.fator_calibracao) if demanda_horizonte > 0 else 0.0

        return PrevisaoResultado(
            previsao_central=previsao_central,
            p50=previsao_central,
            p80=float(p80),
            modelo_nome=self.nome
        )
