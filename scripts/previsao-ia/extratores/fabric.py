import os
import time
import json
import urllib.error
import urllib.request
import urllib.parse
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, Any, List, Tuple
import pandas as pd
from .base import ExtratorDadosBase

# Limite de linhas por chamada do endpoint executeQueries do Power BI/Fabric.
# A API TRUNCA o resultado em silêncio (HTTP 200) ao ultrapassar o limite, por isso
# a extração é paginada por janelas de data e cada janela é conferida.
LIMITE_LINHAS_EXECUTEQUERIES = 100000

# Tamanho inicial da janela de extração, em dias.
JANELA_DIAS_PADRAO = 30

# Janela mínima: se um único dia ainda estourar o limite, não há como paginar por data.
JANELA_DIAS_MINIMA = 1


def _inteiro_env(nome: str, padrao: int) -> int:
    """
    Inteiro de variável de ambiente tolerando ausência e string vazia — o GitHub
    Actions injeta '' quando a `vars.X` não existe, e int('') levantaria ValueError.
    """
    bruto = (os.getenv(nome) or '').strip()
    if not bruto:
        return padrao
    try:
        valor = int(bruto)
    except ValueError:
        print(f'[Fabric] AVISO: {nome}="{bruto}" não é inteiro; usando {padrao}.')
        return padrao
    return valor if valor >= 1 else padrao


class ExtratorFabric(ExtratorDadosBase):
    """
    Extrator para Microsoft Fabric / Power BI Service (nuvem) e cache local.
    Se credenciais do Azure/Fabric forem fornecidas, consulta a API REST do Fabric
    (api.powerbi.com) paginando por janelas de data. Sem credenciais, usa o cache
    parquet já extraído.
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

    def _executar_dax_fabric(self, token: str, workspace_id: str, dataset_id: str, dax_query: str) -> List[dict]:
        url = f'https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/datasets/{dataset_id}/executeQueries'
        payload = json.dumps({'queries': [{'query': dax_query}]}).encode('utf-8')

        req = urllib.request.Request(url, data=payload, headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        })
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            corpo_erro = e.read().decode('utf-8', errors='replace')
            raise RuntimeError(f"[{self.nome_fonte}] Erro na API REST do Fabric (HTTP {e.code}): {corpo_erro}")

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

    @staticmethod
    def _dax_vendas_periodo(inicio: date, fim: date) -> str:
        """
        DAX de vendas restrito a uma janela de datas (bordas inclusivas).

        Mesma consulta homologada em queries/daily_demand.dax — medida
        [Quantidade Vendida Produto] filtrada por Venda Direta sobre 'dCalendario' —
        só que com a janela parametrizada, para permitir a paginação por data.
        """
        return f"""
        EVALUATE
        SUMMARIZECOLUMNS(
            'CADEMP'[ANOMEFANTASIA],
            'PRODUTOS'[ACODPRODUTO],
            'dCalendario'[Data],
            FILTER(
                ALL('dCalendario'[Data]),
                'dCalendario'[Data] >= DATE({inicio.year}, {inicio.month}, {inicio.day})
                    && 'dCalendario'[Data] <= DATE({fim.year}, {fim.month}, {fim.day})
            ),
            "QtdVenda", CALCULATE([Quantidade Vendida Produto], KEEPFILTERS('NOTAS'[Tipo Movimentação] = "Venda Direta"))
        )
        """

    def _extrair_janela(
        self,
        token: str,
        workspace_id: str,
        dataset_id: str,
        inicio: date,
        fim: date,
    ) -> List[dict]:
        """
        Extrai uma janela de datas, subdividindo-a quando o resultado bate no limite
        da API (sinal de truncamento silencioso).
        """
        rows = self._executar_dax_fabric(
            token, workspace_id, dataset_id, self._dax_vendas_periodo(inicio, fim)
        )
        dias = (fim - inicio).days + 1

        if len(rows) < LIMITE_LINHAS_EXECUTEQUERIES:
            print(f'[{self.nome_fonte}]   {inicio} a {fim}: {len(rows):,} linhas.')
            return rows

        if dias <= JANELA_DIAS_MINIMA:
            raise RuntimeError(
                f'[{self.nome_fonte}] A janela mínima ({inicio}) retornou {len(rows):,} linhas, '
                f'no limite de {LIMITE_LINHAS_EXECUTEQUERIES:,} do executeQueries. '
                f'O resultado está truncado e não há como paginar mais por data — '
                f'particione a consulta por loja ou use um endpoint de exportação.'
            )

        meio = inicio + timedelta(days=dias // 2 - 1)
        print(
            f'[{self.nome_fonte}]   {inicio} a {fim} retornou {len(rows):,} linhas '
            f'(limite da API): subdividindo a janela.'
        )
        return (
            self._extrair_janela(token, workspace_id, dataset_id, inicio, meio)
            + self._extrair_janela(token, workspace_id, dataset_id, meio + timedelta(days=1), fim)
        )

    def _ler_cache_local(self, caminho_vendas: Path, caminho_produtos: Path) -> Tuple[pd.DataFrame, pd.DataFrame]:
        if not caminho_vendas.exists():
            raise FileNotFoundError(
                f'[{self.nome_fonte}] Sem credenciais do Fabric e sem cache local em '
                f'{caminho_vendas}. Cadastre AZURE_TENANT_ID / AZURE_CLIENT_ID / '
                f'AZURE_CLIENT_SECRET / POWERBI_WORKSPACE_ID / POWERBI_DATASET_ID em '
                f'Settings > Secrets and variables > Actions no GitHub, '
                f'ou gere o cache localmente com extrator_dados.py.'
            )
        df_vendas = pd.read_parquet(caminho_vendas)
        # O cadastro de produtos é opcional: só alimenta a descrição do item.
        df_produtos = pd.read_parquet(caminho_produtos) if caminho_produtos.exists() else pd.DataFrame()
        if df_produtos.empty:
            print(f'[{self.nome_fonte}] AVISO: cache de produtos ausente; itens ficarão sem descrição.')
        return df_vendas, df_produtos

    def extrair(self, config: Dict[str, Any]) -> Tuple[pd.DataFrame, pd.DataFrame]:
        credenciais = {
            'AZURE_TENANT_ID': config.get('azure_tenant_id') or os.getenv('AZURE_TENANT_ID') or os.getenv('POWERBI_TENANT_ID'),
            'AZURE_CLIENT_ID': config.get('azure_client_id') or os.getenv('AZURE_CLIENT_ID') or os.getenv('POWERBI_CLIENT_ID'),
            'AZURE_CLIENT_SECRET': config.get('azure_client_secret') or os.getenv('AZURE_CLIENT_SECRET') or os.getenv('POWERBI_CLIENT_SECRET'),
            'POWERBI_WORKSPACE_ID': config.get('workspace_id') or os.getenv('POWERBI_WORKSPACE_ID'),
            'POWERBI_DATASET_ID': config.get('dataset_id') or os.getenv('POWERBI_DATASET_ID'),
        }
        preenchidas = [k for k, v in credenciais.items() if v]
        faltando = [k for k, v in credenciais.items() if not v]

        base_dir = Path(__file__).resolve().parent.parent
        caminho_vendas_local = base_dir / 'dados/daily_demand.parquet'
        caminho_produtos_local = base_dir / 'dados/current_product.parquet'

        # Credenciais pela metade são erro de configuração, não motivo para cair
        # silenciosamente num cache velho (o agendamento diário nunca reclamaria).
        if preenchidas and faltando:
            raise ValueError(
                f'[{self.nome_fonte}] Configuração incompleta do Fabric. '
                f'Faltando: {faltando}. Preencha todas as variáveis ou nenhuma '
                f'(para usar explicitamente o cache local).'
            )

        if not preenchidas:
            print(f'[{self.nome_fonte}] Sem credenciais: carregando cache parquet local...')
            df_vendas, df_produtos = self._ler_cache_local(caminho_vendas_local, caminho_produtos_local)
        else:
            print(f'[{self.nome_fonte}] Autenticando no Azure Fabric via Service Principal...')
            token = self._obter_token_azure(
                credenciais['AZURE_TENANT_ID'],
                credenciais['AZURE_CLIENT_ID'],
                credenciais['AZURE_CLIENT_SECRET'],
            )
            workspace_id = credenciais['POWERBI_WORKSPACE_ID']
            dataset_id = credenciais['POWERBI_DATASET_ID']
            print(f'[{self.nome_fonte}] Conexão autenticada. Consultando vendas e produtos...')

            dias_historico = int(config.get('dias_historico') or _inteiro_env('DIAS_HISTORICO_VENDAS', 365))
            janela_dias = int(config.get('janela_dias') or _inteiro_env('JANELA_EXTRACAO_DIAS', JANELA_DIAS_PADRAO))
            fim_total = date.today()
            inicio_total = fim_total - timedelta(days=dias_historico)

            print(
                f'[{self.nome_fonte}] Extraindo {dias_historico} dias '
                f'({inicio_total} a {fim_total}) em janelas de {janela_dias} dias...'
            )

            t0 = time.time()
            rows_vendas: List[dict] = []
            inicio_janela = inicio_total
            while inicio_janela <= fim_total:
                fim_janela = min(inicio_janela + timedelta(days=janela_dias - 1), fim_total)
                rows_vendas.extend(
                    self._extrair_janela(token, workspace_id, dataset_id, inicio_janela, fim_janela)
                )
                inicio_janela = fim_janela + timedelta(days=1)

            print(
                f'[{self.nome_fonte}] Vendas extraídas: {len(rows_vendas):,} linhas '
                f'em {time.time() - t0:.1f}s.'
            )
            df_vendas = pd.DataFrame(rows_vendas)

            # O cadastro de produtos NÃO é mais extraído.
            #
            # Ele servia só para preencher `descricao` em demanda_ia_previsao — e
            # nenhuma parte do app lê essa coluna (o repositório do cockpit não a
            # seleciona; a descrição exibida vem da carga do Power BI). Enquanto
            # isso, a consulta puxava 100 mil linhas por dia, batia no teto da API
            # mesmo agrupada por código, e foi ela que derrubou a execução de
            # 16/09. Custo diário e risco de queda por uma coluna que ninguém lê.
            df_produtos = pd.DataFrame()

        if df_vendas.empty:
            raise RuntimeError(f'[{self.nome_fonte}] Nenhuma linha de venda extraída.')

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
        df_vendas['sku'] = df_vendas['sku'].astype(str)

        mapa_colunas_prod = {
            'ACODPRODUTO': 'sku',
            'SKU': 'sku',
            'Produto': 'sku',
            'ADESCRICAO': 'descricao',
            'Descricao': 'descricao'
        }
        if not df_produtos.empty:
            df_produtos = df_produtos.rename(columns={k: v for k, v in mapa_colunas_prod.items() if k in df_produtos.columns})
            if 'sku' in df_produtos.columns:
                df_produtos['sku'] = df_produtos['sku'].astype(str)

        return df_vendas, df_produtos
