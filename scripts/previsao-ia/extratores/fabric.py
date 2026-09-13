import os
import time
import json
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Dict, Any, Tuple
import pandas as pd
from .base import ExtratorDadosBase

class ExtratorFabric(ExtratorDadosBase):
    """
    Extrator para Microsoft Fabric / Power BI Service (nuvem) e Power BI Desktop (local).
    Se credenciais do Azure/Fabric forem fornecidas, consulta a API REST do Fabric (api.powerbi.com).
    Caso contrário, faz fallback para a instância local do Power BI Desktop via pbi-cli.
    """
    def __init__(self):
        super().__init__('Microsoft Fabric / Power BI')

    def _obter_token_azure(self, tenant_id: str, client_id: str, client_secret: str) -> str:
        token_url = f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token'
        payload = urllib.parse.urlencode({
            'grant_type': 'client_credentials',
            'client_id': client_id,
            'client_secret': client_secret,
            'scope': 'https://analysis.windows.net/powerbi/api/.default'
        }).encode('utf-8')

        req = urllib.request.Request(token_url, data=payload, headers={'Content-Type': 'application/x-www-form-urlencoded'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data['access_token']

    def _executar_dax_fabric(self, token: str, workspace_id: str, dataset_id: str, dax_query: str) -> list[dict]:
        url = f'https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/datasets/{dataset_id}/executeQueries'
        payload = json.dumps({'queries': [{'query': dax_query}]}).encode('utf-8')

        req = urllib.request.Request(url, data=payload, headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        })
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            results = data.get('results', [])
            if not results:
                return []
            tables = results[0].get('tables', [])
            if not tables:
                return []
            raw_rows = tables[0].get('rows', [])
            
            # Limpar nomes de colunas com colchetes
            rows_limpas = []
            for r in raw_rows:
                limpa = {}
                for k, v in r.items():
                    nome = k.rsplit('[', 1)[1][:-1] if ('[' in k and k.endswith(']')) else k.strip('[]')
                    limpa[nome] = v
                rows_limpas.append(limpa)
            return rows_limpas

    def extrair(self, config: Dict[str, Any]) -> Tuple[pd.DataFrame, pd.DataFrame]:
        tenant_id = config.get('azure_tenant_id') or os.getenv('AZURE_TENANT_ID') or os.getenv('POWERBI_TENANT_ID')
        client_id = config.get('azure_client_id') or os.getenv('AZURE_CLIENT_ID') or os.getenv('POWERBI_CLIENT_ID')
        client_secret = config.get('azure_client_secret') or os.getenv('AZURE_CLIENT_SECRET') or os.getenv('POWERBI_CLIENT_SECRET')
        workspace_id = config.get('workspace_id') or os.getenv('POWERBI_WORKSPACE_ID')
        dataset_id = config.get('dataset_id') or os.getenv('POWERBI_DATASET_ID')

        base_dir = Path(__file__).resolve().parent.parent
        caminho_vendas_local = base_dir / 'dados/daily_demand.parquet'
        caminho_produtos_local = base_dir / 'dados/current_product.parquet'

        # Se houver credenciais completas da nuvem, consulta Fabric REST API
        if tenant_id and client_id and client_secret and workspace_id and dataset_id:
            print(f'[{self.nome_fonte}] Autenticando no Azure Fabric via Service Principal...')
            token = self._obter_token_azure(tenant_id, client_id, client_secret)
            print(f'[{self.nome_fonte}] Conexão autenticada. Consultando vendas e produtos...')

            dax_vendas = """
            EVALUATE
            SELECTCOLUMNS(
                FILTER(
                    MOVIMENTOS,
                    MOVIMENTOS[TIPOMOVIMENTO] = "S" &&
                    MOVIMENTOS[DATA] >= TODAY() - 365
                ),
                "Loja", RELATED(CADEMP[ANOMEFANTASIA]),
                "SKU", MOVIMENTOS[ACODPRODUTO],
                "Data", MOVIMENTOS[DATA],
                "QtdVenda", MOVIMENTOS[QTDMOVIMENTADA]
            )
            """
            rows_vendas = self._executar_dax_fabric(token, workspace_id, dataset_id, dax_vendas)
            df_vendas = pd.DataFrame(rows_vendas)

            dax_produtos = """
            EVALUATE
            SELECTCOLUMNS(
                PRODUTOS,
                "SKU", PRODUTOS[ACODPRODUTO],
                "Descricao", PRODUTOS[ADESCRICAO]
            )
            """
            rows_produtos = self._executar_dax_fabric(token, workspace_id, dataset_id, dax_produtos)
            df_produtos = pd.DataFrame(rows_produtos)
        else:
            # Fallback local para os dados já extraídos em parquet
            print(f'[{self.nome_fonte}] Carregando cache parquet local...')
            df_vendas = pd.read_parquet(caminho_vendas_local)
            df_produtos = pd.read_parquet(caminho_produtos_local)

        # Padronização de colunas
        mapa_colunas_vendas = {
            'ANOMEFANTASIA': 'loja',
            'Loja': 'loja',
            'ACODPRODUTO': 'sku',
            'SKU': 'sku',
            'Data': 'data',
            'DATA': 'data',
            'QtdVenda': 'qtd_venda',
            'QTDMOVIMENTADA': 'qtd_venda'
        }
        df_vendas = df_vendas.rename(columns={k: v for k, v in mapa_colunas_vendas.items() if k in df_vendas.columns})
        df_vendas['data'] = pd.to_datetime(df_vendas['data'], errors='coerce')
        df_vendas['qtd_venda'] = pd.to_numeric(df_vendas['qtd_venda'], errors='coerce').fillna(0.0)

        mapa_colunas_prod = {
            'ACODPRODUTO': 'sku',
            'SKU': 'sku',
            'Produto': 'sku',
            'ADESCRICAO': 'descricao',
            'Descricao': 'descricao'
        }
        df_produtos = df_produtos.rename(columns={k: v for k, v in mapa_colunas_prod.items() if k in df_produtos.columns})

        return df_vendas, df_produtos
