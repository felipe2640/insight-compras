import math
import numpy as np
from .base import ModeloPrevisaoBase, PrevisaoResultado

class ModeloDLinear(ModeloPrevisaoBase):
    def __init__(self, kernel_size: int = 25):
        super().__init__('DLinear (Decomposicao Linear)')
        self.kernel_size = kernel_size

    def prever(self, historico_diario: np.ndarray, horizonte_dias: int) -> PrevisaoResultado:
        if len(historico_diario) < self.kernel_size:
            # Fallback para media simples se a serie for menor que o kernel
            media = float(np.mean(historico_diario)) if len(historico_diario) > 0 else 0.0
            central = media * horizonte_dias
            return PrevisaoResultado(central, central, central * 1.3, self.nome)

        # 1. Decomposicao em Tendencia (Moving Average) e Sazonalidade (Residuo)
        pad_size = (self.kernel_size - 1) // 2
        padded = np.pad(historico_diario, (pad_size, pad_size), mode='edge')
        weights = np.ones(self.kernel_size) / self.kernel_size
        trend = np.convolve(padded, weights, mode='valid')
        if len(trend) != len(historico_diario):
            trend = trend[:len(historico_diario)]
        seasonal = historico_diario - trend

        # 2. Projecao Linear Simples de Tendencia
        # Regressao linear nos ultimos 60 dias de tendencia
        t_window = trend[-60:] if len(trend) >= 60 else trend
        x = np.arange(len(t_window))
        if len(x) > 1:
            slope, intercept = np.polyfit(x, t_window, 1)
            # Evita inclinações negativas absurdas ou explosões
            slope = np.clip(slope, -0.05, 0.05)
            future_x = len(x) + np.arange(horizonte_dias)
            future_trend = np.maximum(0.0, intercept + slope * future_x)
        else:
            future_trend = np.full(horizonte_dias, max(0.0, trend[-1]))

        # 3. Projecao da Sazonalidade (Ciclo semanal / mensal)
        ciclo = 7  # ciclo semanal comum no varejo de autopecas
        ultimos_ciclos = seasonal[-ciclo:] if len(seasonal) >= ciclo else np.zeros(horizonte_dias)
        future_seasonal = np.tile(ultimos_ciclos, int(np.ceil(horizonte_dias / len(ultimos_ciclos))))[:horizonte_dias]

        # 4. Recombinacao
        future_daily = np.maximum(0.0, future_trend + future_seasonal)
        previsao_central = float(np.sum(future_daily))

        # Quantil 80 com base no desvio dos residuos
        resid_std = float(np.std(seasonal)) if len(seasonal) > 0 else (previsao_central * 0.2)
        p80 = previsao_central + 0.84 * math.sqrt(horizonte_dias) * resid_std

        return PrevisaoResultado(
            previsao_central=previsao_central,
            p50=previsao_central,
            p80=max(previsao_central, p80),
            modelo_nome=self.nome
        )
