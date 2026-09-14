import torch
import numpy as np
from typing import List
from chronos import ChronosBoltPipeline
from .base import ModeloPrevisaoBase, PrevisaoResultado

class ModeloChronosBolt(ModeloPrevisaoBase):
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

    def prever(self, historico_diario: np.ndarray, horizonte_dias: int) -> PrevisaoResultado:
        self._lazy_load()
        if len(historico_diario) == 0:
            return PrevisaoResultado(0.0, 0.0, 0.0, self.nome)

        # Contexto dos ultimos 365 dias
        ctx = historico_diario[-365:] if len(historico_diario) >= 365 else historico_diario
        context_tensor = torch.tensor([ctx], dtype=torch.float32)

        with torch.no_grad():
            forecast = self.pipeline.predict(context_tensor, prediction_length=horizonte_dias)

        p50 = float(forecast[0, 4, :].sum().item())
        p80 = float(forecast[0, 7, :].sum().item())
        previsao_central = max(0.0, p50)

        return PrevisaoResultado(
            previsao_central=previsao_central,
            p50=previsao_central,
            p80=max(previsao_central, float(p80)),
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

        # forecast shape: (batch_size, 9, horizon)
        # index 4 = 0.5 (median/p50), index 7 = 0.8 (p80)
        p50_vals = forecast[:, 4, :].sum(dim=-1).numpy().reshape(-1)
        p80_vals = forecast[:, 7, :].sum(dim=-1).numpy().reshape(-1)

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
