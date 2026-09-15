import torch
import numpy as np
from typing import List, Tuple
from chronos import ChronosBoltPipeline
from .base import ModeloPrevisaoBase, PrevisaoResultado

# Quantil alvo do nível de serviço (80%) na distribuição normal padrão.
Z_NIVEL_SERVICO_80 = 0.8416212335729143
# Distância entre p10 e p90 em desvios-padrão (2 * 1.2816).
AMPLITUDE_P10_P90_EM_SIGMAS = 2.5631031310892007


class ModeloChronosBolt(ModeloPrevisaoBase):
    """
    Chronos-Bolt (Amazon) — modelo campeão do benchmark anual.

    O modelo devolve quantis POR DIA. A demanda que interessa ao motor de compra é
    o TOTAL do horizonte, e o quantil 80 de uma soma NÃO é a soma dos quantis 80:
    somar p80 diário embute 0,84·sigma em cada um dos H dias (H·0,84·sigma), quando
    o correto é 0,84·sigma sobre o desvio do total (~0,84·sqrt(H)·sigma). Em 30 dias
    a diferença é da ordem de 5x de estoque de segurança a mais.

    Aqui o total é agregado somando a mediana diária e combinando o desvio diário
    em quadratura (independência entre dias), o que devolve um p80 do TOTAL.
    """

    def __init__(self, model_id: str = 'amazon/chronos-bolt-small', nome: str = 'Chronos-Bolt (Small)'):
        super().__init__(nome)
        self.model_id = model_id
        self.pipeline = None

    def _lazy_load(self):
        if self.pipeline is None:
            self.pipeline = ChronosBoltPipeline.from_pretrained(
                self.model_id,
                device_map='cpu',
                dtype=torch.float32,
            )

    @staticmethod
    def _indices_quantis(n_quantis: int) -> Tuple[int, int, int]:
        """
        Índices de p10, p50 e p90 na saída do modelo.
        O Chronos-Bolt publica 9 níveis (0.1 ... 0.9), mas derivamos os índices em
        vez de fixar 4 e 7 para não silenciar uma mudança de contrato do modelo.
        """
        niveis = np.linspace(0.1, 0.9, n_quantis)
        return (
            int(np.argmin(np.abs(niveis - 0.1))),
            int(np.argmin(np.abs(niveis - 0.5))),
            int(np.argmin(np.abs(niveis - 0.9))),
        )

    def _agregar_horizonte(self, forecast: torch.Tensor) -> Tuple[np.ndarray, np.ndarray]:
        """
        Converte quantis diários (lote, quantis, horizonte) no total do horizonte.
        Devolve (p50_total, p80_total) por série.
        """
        i10, i50, i90 = self._indices_quantis(forecast.shape[1])

        p50_diario = forecast[:, i50, :]
        sigma_diario = torch.clamp(
            (forecast[:, i90, :] - forecast[:, i10, :]) / AMPLITUDE_P10_P90_EM_SIGMAS,
            min=0.0,
        )

        p50_total = torch.clamp(p50_diario.sum(dim=-1), min=0.0)
        # Desvio do total: raiz da soma dos quadrados dos desvios diários.
        sigma_total = torch.sqrt(torch.clamp((sigma_diario ** 2).sum(dim=-1), min=0.0))
        p80_total = p50_total + Z_NIVEL_SERVICO_80 * sigma_total

        return (
            p50_total.numpy().reshape(-1),
            p80_total.numpy().reshape(-1),
        )

    def prever(self, historico_diario: np.ndarray, horizonte_dias: int) -> PrevisaoResultado:
        self._lazy_load()
        if len(historico_diario) == 0:
            return PrevisaoResultado(0.0, 0.0, 0.0, self.nome)

        # Contexto dos ultimos 365 dias
        ctx = historico_diario[-365:] if len(historico_diario) >= 365 else historico_diario
        context_tensor = torch.tensor([ctx], dtype=torch.float32)

        with torch.no_grad():
            forecast = self.pipeline.predict(context_tensor, prediction_length=horizonte_dias)

        p50_vals, p80_vals = self._agregar_horizonte(forecast)
        central = max(0.0, float(p50_vals[0]))

        return PrevisaoResultado(
            previsao_central=central,
            p50=central,
            p80=max(central, float(p80_vals[0])),
            modelo_nome=self.nome
        )

    def prever_lote(self, lista_series: List[np.ndarray], horizonte_dias: int) -> List[PrevisaoResultado]:
        self._lazy_load()
        if not lista_series:
            return []

        # Preparar batch de tensores com padding a esquerda
        max_len = min(365, max(len(s) for s in lista_series))
        batch_list = []
        for s in lista_series:
            sub = s[-max_len:]
            if len(sub) < max_len:
                pad = np.pad(sub, (max_len - len(sub), 0), mode='constant')
                batch_list.append(pad)
            else:
                batch_list.append(sub)

        context_tensor = torch.tensor(np.array(batch_list), dtype=torch.float32)
        with torch.no_grad():
            forecast = self.pipeline.predict(context_tensor, prediction_length=horizonte_dias)

        # forecast shape: (batch_size, n_quantis, horizonte)
        p50_vals, p80_vals = self._agregar_horizonte(forecast)

        resultados = []
        for p50, p80 in zip(p50_vals, p80_vals):
            central = max(0.0, float(p50))
            resultados.append(PrevisaoResultado(
                previsao_central=central,
                p50=central,
                p80=max(central, float(p80)),
                modelo_nome=self.nome
            ))
        return resultados
