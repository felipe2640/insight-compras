from pathlib import Path
from typing import Dict, Any, Tuple
import pandas as pd
from .base import ExtratorDadosBase

class ExtratorArquivo(ExtratorDadosBase):
    """
    Extrator para clientes que exportam relatórios periódicos em arquivos
    (CSV, Excel ou Parquet) depositados em pastas locais, SFTP ou buckets na nuvem.
    """
    def __init__(self):
        super().__init__('Arquivo Tabular (CSV/Excel/Parquet)')

    def _ler_arquivo(self, caminho_str: str) -> pd.DataFrame:
        caminho = Path(caminho_str)
        if not caminho.exists():
            raise FileNotFoundError(f'Arquivo não encontrado: {caminho}')

        sufixo = caminho.suffix.lower()
        if sufixo == '.parquet':
            return pd.read_parquet(caminho)
        elif sufixo in ('.xlsx', '.xls'):
            return pd.read_excel(caminho)
        elif sufixo in ('.csv', '.txt'):
            # Detecta separador comum (vírgula ou ponto-e-vírgula)
            try:
                return pd.read_csv(caminho, sep=';', encoding='utf-8')
            except Exception:
                return pd.read_csv(caminho, sep=',', encoding='utf-8')
        else:
            raise ValueError(f'Formato de arquivo não suportado: {sufixo}')

    def extrair(self, config: Dict[str, Any]) -> Tuple[pd.DataFrame, pd.DataFrame]:
        caminho_vendas = config.get('caminho_vendas')
        caminho_produtos = config.get('caminho_produtos')

        if not caminho_vendas:
            raise ValueError(f'[{self.nome_fonte}] caminho_vendas é obrigatório na configuração.')

        print(f'[{self.nome_fonte}] Lendo arquivo de vendas: {caminho_vendas}')
        df_vendas = self._ler_arquivo(caminho_vendas)

        df_produtos = pd.DataFrame()
        if caminho_produtos:
            print(f'[{self.nome_fonte}] Lendo arquivo de produtos: {caminho_produtos}')
            df_produtos = self._ler_arquivo(caminho_produtos)

        # Mapeamento flexível de nomes de colunas
        mapa_vendas = {
            'loja': 'loja', 'filial': 'loja', 'empresa': 'loja', 'ANOMEFANTASIA': 'loja',
            'sku': 'sku', 'produto': 'sku', 'codigo': 'sku', 'ACODPRODUTO': 'sku',
            'data': 'data', 'data_venda': 'data', 'Data': 'data',
            'qtd': 'qtd_venda', 'quantidade': 'qtd_venda', 'qtd_venda': 'qtd_venda', 'QtdVenda': 'qtd_venda'
        }
        renomear_vendas = {col: mapa_vendas[col] for col in df_vendas.columns if col in mapa_vendas}
        df_vendas = df_vendas.rename(columns=renomear_vendas)

        df_vendas['data'] = pd.to_datetime(df_vendas['data'], errors='coerce')
        df_vendas['qtd_venda'] = pd.to_numeric(df_vendas['qtd_venda'], errors='coerce').fillna(0.0)
        df_vendas['sku'] = df_vendas['sku'].astype(str)

        if not df_produtos.empty:
            mapa_prod = {
                'sku': 'sku', 'produto': 'sku', 'codigo': 'sku', 'ACODPRODUTO': 'sku',
                'descricao': 'descricao', 'nome': 'descricao', 'ADESCRICAO': 'descricao'
            }
            renomear_prod = {col: mapa_prod[col] for col in df_produtos.columns if col in mapa_prod}
            df_produtos = df_produtos.rename(columns=renomear_prod)
            df_produtos['sku'] = df_produtos['sku'].astype(str)

        return df_vendas, df_produtos
