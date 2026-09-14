from abc import ABC, abstractmethod
from typing import Dict, Any, Tuple
import pandas as pd

class ExtratorDadosBase(ABC):
    """
    Interface base para qualquer conector de dados de clientes (Fabric, SQL, ERP, Arquivo).
    Garante que todos os extratores retornem exatamente o mesmo contrato de DataFrames normalizados:
    
    1. df_vendas:
       - 'loja': identificador da filial/loja (str ou int)
       - 'sku': código do produto (str)
       - 'data': data da venda (datetime64)
       - 'qtd_venda': quantidade vendida no dia (float)
       
    2. df_produtos:
       - 'sku': código do produto (str)
       - 'descricao': descrição do item (str)
       - 'estoque_qtd': saldo físico atual (float, opcional)
       - 'preco_compra': custo unitário (float, opcional)
    """
    def __init__(self, nome_fonte: str):
        self.nome_fonte = nome_fonte

    @abstractmethod
    def extrair(self, config: Dict[str, Any]) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Executa a extração da fonte configurada e retorna a tupla padronizada (df_vendas, df_produtos).
        """
        pass
