import numpy as np
from typing import List
from .base import ModeloPrevisaoBase, PrevisaoResultado

class ModeloQuantilEmpirico(ModeloPrevisaoBase):
    """
    Modelo de Quantil Empírico Móvel de 30 dias.
    -------------------------------------------
    Para cada SKU x Loja:
    1. Extrai as somas móveis de 30 dias do histórico recente (últimos 180 a 365 dias).
    2. Calcula diretamente a distribuição empírica da soma de 30 dias.
    3. Extrai p50 (mediana da demanda mensal) e p80 (percentil 80 para reposição com segurança).
    
    Vantagens:
    - Não-paramétrico: sem suposições gaussianas ou de Poisson distorcidas.
    - Resolve a falácia da soma de quantis diários: calcula o quantil DA SOMA de 30 dias.
    - Extremamente rápido: roda em milissegundos em CPU.
    """
    def __init__(self, percentil_cobertura: float = 80.0, dias_janela_max: int = 365):
        super().__init__('Quantil Empirico Movel 30d')
        self.percentil_cobertura = percentil_cobertura
        self.dias_janela_max = dias_janela_max

    def prever(self, historico_diario: np.ndarray, horizonte_dias: int) -> PrevisaoResultado:
        if len(historico_diario) == 0 or np.sum(historico_diario) == 0:
            return PrevisaoResultado(0.0, 0.0, 0.0, self.nome)

        H = max(1, int(horizonte_dias))
        ctx = historico_diario[-self.dias_janela_max:] if len(historico_diario) >= self.dias_janela_max else historico_diario
        
        if len(ctx) < H:
            soma = float(np.sum(ctx))
            taxa_diaria = soma / max(1, len(ctx))
            prev = taxa_diaria * H
            return PrevisaoResultado(prev, prev, prev, self.nome)

        # Convolução 1D rápida para gerar a série de somas móveis de H dias
        somas_moveis = np.convolve(ctx, np.ones(H, dtype=np.float32), mode='valid')

        if len(somas_moveis) == 0 or np.max(somas_moveis) == 0:
            return PrevisaoResultado(0.0, 0.0, 0.0, self.nome)

        p50 = float(np.percentile(somas_moveis, 50))
        p80 = float(np.percentile(somas_moveis, self.percentil_cobertura))
        media = float(np.mean(somas_moveis))

        previsao_central = max(0.0, p50 if p50 > 0 else media)
        p80_val = max(previsao_central, p80)

        return PrevisaoResultado(
            previsao_central=previsao_central,
            p50=previsao_central,
            p80=p80_val,
            modelo_nome=self.nome
        )

    def prever_lote(self, lista_series: List[np.ndarray], horizonte_dias: int) -> List[PrevisaoResultado]:
        return [self.prever(s, horizonte_dias) for s in lista_series]
