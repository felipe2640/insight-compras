import json
import subprocess
import time
from pathlib import Path
import pandas as pd

def _clean_key(k: str) -> str:
    if '[' in k and k.endswith(']'):
        return k.rsplit('[', 1)[1][:-1]
    return k.strip('[]')

def parse_pbi_json(payload: dict) -> list[dict]:
    rows = payload.get('rows')
    if rows is None:
        rows = payload.get('data', {}).get('rows', [])
    return [{_clean_key(str(k)): v for k, v in row.items()} for row in rows]

def run_dax_query(query_path: Path, max_rows: int = 500000) -> list[dict]:
    print(f'Executando DAX: {query_path.name} (limite {max_rows:,} linhas)...')
    t0 = time.time()
    result = subprocess.run(
        [
            'pbi', '--json', 'dax', 'execute',
            '--file', str(query_path),
            '--max-rows', str(max_rows),
            '--timeout', '300',
        ],
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
        check=True
    )
    payload = json.loads(result.stdout)
    rows = parse_pbi_json(payload)
    dt = time.time() - t0
    print(f'-> {len(rows):,} linhas extraídas em {dt:.1f}s.')
    return rows

def extrair_tudo():
    base_dir = Path(__file__).parent
    queries_dir = base_dir / 'queries'
    dados_dir = base_dir / 'dados'
    dados_dir.mkdir(exist_ok=True)

    # 1. Store Map
    lojas = run_dax_query(queries_dir / 'store_map.dax', max_rows=100)
    df_lojas = pd.DataFrame(lojas)
    df_lojas.to_parquet(dados_dir / 'store_map.parquet', index=False)
    print('Store Map salvo.')

    # 2. Current Product (Cadastro + Estoques atuais)
    produtos = run_dax_query(queries_dir / 'current_product.dax', max_rows=250000)
    df_produtos = pd.DataFrame(produtos)
    df_produtos.to_parquet(dados_dir / 'current_product.parquet', index=False)
    print(f'Produtos salvos: {len(df_produtos):,} itens.')

    # 3. Daily Demand (Vendas diárias reais dos últimos 2 anos até hoje)
    vendas = run_dax_query(queries_dir / 'daily_demand.dax', max_rows=500000)
    df_vendas = pd.DataFrame(vendas)
    df_vendas['QtdVenda'] = pd.to_numeric(df_vendas['QtdVenda'], errors='coerce').fillna(0)
    df_vendas['Data'] = pd.to_datetime(df_vendas['Data'], format='%d/%m/%Y %H:%M:%S', errors='coerce')
    df_vendas.to_parquet(dados_dir / 'daily_demand.parquet', index=False)
    print(f'Vendas diárias salvas: {len(df_vendas):,} registros.')
    print('--- EXTRAÇÃO COMPLETA COM SUCESSO! ---')

if __name__ == '__main__':
    extrair_tudo()
