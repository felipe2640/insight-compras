from abc import ABC, abstractmethod
from typing import List
import numpy as np

class PrevisaoResultado:
    def __init__(
        self,
        previsao_central: float,
        p50: float,
        p80: float,
        modelo_nome: str
    ):
        self.previsao_central = max(0.0, float(previsao_central))
        self.p50 = max(0.0, float(p50))
        self.p80 = max(0.0, float(p80))
        self.modelo_nome = modelo_nome

class ModeloPrevisaoBase(ABC):
    def __init__(self, nome: str):
        self.nome = nome

    @abstractmethod
    def prever(self, historico_diario: np.ndarray, horizonte_dias: int) -> PrevisaoResultado:
        pass

    def prever_lote(self, lista_series: List[np.ndarray], horizonte_dias: int) -> List[PrevisaoResultado]:
        return [self.prever(s, horizonte_dias) for s in lista_series]
