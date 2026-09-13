import math
import numpy as np
from .base import ModeloPrevisaoBase, PrevisaoResultado

class ModeloCrostonSBA(ModeloPrevisaoBase):
    def __init__(self, alpha: float = 0.1):
        super().__init__('Croston-SBA (Intermitente)')
        self.alpha = alpha

    def prever(self, historico_diario: np.ndarray, horizonte_dias: int) -> PrevisaoResultado:
        if len(historico_diario) == 0:
            return PrevisaoResultado(0.0, 0.0, 0.0, self.nome)

        series = [max(0.0, float(v)) for v in historico_diario]
        nonzero = [(i, v) for i, v in enumerate(series) if v > 0]
        if not nonzero:
            return PrevisaoResultado(0.0, 0.0, 0.0, self.nome)

        z = nonzero[0][1]
        interval = max(1.0, float(nonzero[0][0] + 1))
        last_index = nonzero[0][0]

        demand_sizes = [nonzero[0][1]]
        for index, value in nonzero[1:]:
            gap = max(1.0, float(index - last_index))
            z = self.alpha * value + (1.0 - self.alpha) * z
            interval = self.alpha * gap + (1.0 - self.alpha) * interval
            last_index = index
            demand_sizes.append(value)

        # Fator corretivo de Syntetos-Boylan: (1 - alpha/2)
        daily_rate = (1.0 - self.alpha / 2.0) * z / max(interval, 1e-6)
        previsao_central = daily_rate * horizonte_dias

        # Estimativa de variancia do desvio intermitente para calcular quantil 80
        sigma = np.std(demand_sizes) if len(demand_sizes) > 1 else (z * 0.5)
        p80 = previsao_central + 0.84 * math.sqrt(max(1.0, horizonte_dias / max(interval, 1.0))) * sigma

        return PrevisaoResultado(
            previsao_central=previsao_central,
            p50=previsao_central,
            p80=max(previsao_central, p80),
            modelo_nome=self.nome
        )
