from typing import Dict, Any, Tuple
import pandas as pd
from .base import ExtratorDadosBase

class ExtratorBancoSql(ExtratorDadosBase):
    """
    Extrator para clientes que utilizam bancos de dados relacionais diretos
    (PostgreSQL, SQL Server, MySQL, Oracle, etc.).
    Recebe uma connection string (ou parâmetros de conexão) e as queries SQL de vendas e produtos.
    """
    def __init__(self):
        super().__init__('Banco de Dados SQL Relacional')

    def extrair(self, config: Dict[str, Any]) -> Tuple[pd.DataFrame, pd.DataFrame]:
        connection_url = config.get('connection_url') or config.get('connection_string')
        if not connection_url:
            raise ValueError(f'[{self.nome_fonte}] connection_url é obrigatório na configuração.')

        # Query de vendas (padrão ou customizada do cliente)
        query_vendas = config.get('query_vendas', """
            SELECT
                filial AS loja,
                codigo_produto AS sku,
                data_venda AS data,
                quantidade AS qtd_venda
            FROM vendas
            WHERE data_venda >= CURRENT_DATE - INTERVAL '365 days'
        """)

        # Query de produtos (padrão ou customizada)
        query_produtos = config.get('query_produtos', """
            SELECT
                codigo_produto AS sku,
                descricao,
                estoque_atual AS estoque_qtd,
                preco_custo AS preco_compra
            FROM produtos
        """)

        print(f'[{self.nome_fonte}] Conectando ao banco SQL via URL...')
        # Utiliza pandas.read_sql
        try:
            from sqlalchemy import create_engine
            engine = create_engine(connection_url)
            with engine.connect() as conn:
                print(f'[{self.nome_fonte}] Executando query de vendas...')
                df_vendas = pd.read_sql(query_vendas, conn)
                print(f'[{self.nome_fonte}] Executando query de produtos...')
                df_produtos = pd.read_sql(query_produtos, conn)
        except ImportError:
            # Fallback para sqlite ou drivers diretos se sqlalchemy não estiver instalado
            import sqlite3
            conn = sqlite3.connect(connection_url)
            df_vendas = pd.read_sql(query_vendas, conn)
            df_produtos = pd.read_sql(query_produtos, conn)
            conn.close()

        # Normalização de tipos
        df_vendas['data'] = pd.to_datetime(df_vendas['data'], errors='coerce')
        df_vendas['qtd_venda'] = pd.to_numeric(df_vendas['qtd_venda'], errors='coerce').fillna(0.0)
        df_vendas['sku'] = df_vendas['sku'].astype(str)
        df_produtos['sku'] = df_produtos['sku'].astype(str)

        return df_vendas, df_produtos
