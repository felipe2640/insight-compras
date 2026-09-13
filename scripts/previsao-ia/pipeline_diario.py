"""
Pipeline Diário de Inferência de Previsão de Demanda com IA
-----------------------------------------------------------
Executa localmente na máquina do cliente (24/7):
1. Extrai ou carrega dados de demanda diária e cadastro de produtos.
2. Executa inferência em lote com o modelo campeão de IA (ou especificado via flag).
3. Publica previsões probabilísticas (p50, p80) na tabela `demanda_ia_previsao` do Supabase.
"""

import os
import sys
import json
import time
import argparse
from datetime import datetime, date
from pathlib import Path
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

# Carrega variáveis de ambiente (.env.local do projeto raiz ou local)
raiz_projeto = Path(__file__).resolve().parent.parent.parent
load_dotenv(raiz_projeto / '.env.local')
load_dotenv(Path(__file__).resolve().parent / '.env')

from modelos.baseline_atual import ModeloBaselineAtual
from modelos.chronos_bolt import ModeloChronosBolt
from modelos.croston_sba import ModeloCrostonSBA
from modelos.dlinear import ModeloDLinear
from extratores import obter_extrator

# Mapeamento oficial de Lojas para filial_id (compatível com config/tenants/carreiro.ts)
MAPA_LOJA_FILIAL = {
    'CARREIRO PEDRO II': 1,
    'MELO DISTRIBUIDORA': 2,
    'CARREIRO PORANGA': 3,
    'CEARA AUTO PECAS CAMPO MAIOR': 4,
    'CARREIRO JOSE DE FREITAS': 5
}

def obter_modelo(nome_modelo: str):
    nome_low = (nome_modelo or '').lower()
    if 'small' in nome_low:
        return ModeloChronosBolt(model_id='amazon/chronos-bolt-small', nome='Chronos-Bolt (Small)')
    elif 'tiny' in nome_low or 'chronos' in nome_low:
        return ModeloChronosBolt(model_id='amazon/chronos-bolt-tiny', nome='Chronos-Bolt (Tiny)')
    elif 'croston' in nome_low:
        return ModeloCrostonSBA()
    elif 'dlinear' in nome_low:
        return ModeloDLinear()
    elif 'baseline' in nome_low:
        return ModeloBaselineAtual()
    else:
        return ModeloChronosBolt(model_id='amazon/chronos-bolt-tiny', nome='Chronos-Bolt (Tiny)')

def obter_modelo_padrao() -> str:
    benchmark_file = Path(__file__).parent / 'resultados_benchmark_anual.json'
    if benchmark_file.exists():
        try:
            with open(benchmark_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                campeao = data.get('campeao')
                if campeao:
                    print(f'[Pipeline] Modelo campeão detectado no benchmark: {campeao}')
                    return campeao
        except Exception:
            pass
    return os.getenv('MODELO_IA_DEMANDA', 'Chronos-Bolt (Tiny)')

def executar_pipeline(modelo_nome: str = None, fonte_tipo: str = 'fabric', extrair: bool = False, dry_run: bool = False):
    t_inicio = time.time()
    base_dir = Path(__file__).parent
    dados_dir = base_dir / 'dados'
    dados_dir.mkdir(exist_ok=True)

    caminho_vendas = dados_dir / 'daily_demand.parquet'
    caminho_produtos = dados_dir / 'current_product.parquet'

    if extrair or not caminho_vendas.exists():
        print(f'[Pipeline] Executando extração de dados da fonte: {fonte_tipo.upper()}...')
        extrator = obter_extrator(fonte_tipo)
        df_vendas_ext, df_produtos_ext = extrator.extrair({})
        
        # Salva em parquet padronizado para cache
        df_vendas_ext.to_parquet(caminho_vendas, index=False)
        if not df_produtos_ext.empty:
            df_produtos_ext.to_parquet(caminho_produtos, index=False)
        print(f'[Pipeline] Extração concluída: {len(df_vendas_ext):,} vendas salvas em cache.')

    print(f'[Pipeline] Carregando dados históricos...')
    df_vendas = pd.read_parquet(caminho_vendas)
    
    # Normalização de nomes de colunas caso venha de fontes diferentes
    col_data = 'data' if 'data' in df_vendas.columns else 'Data'
    col_loja = 'loja' if 'loja' in df_vendas.columns else 'ANOMEFANTASIA'
    col_sku = 'sku' if 'sku' in df_vendas.columns else 'ACODPRODUTO'
    col_qtd = 'qtd_venda' if 'qtd_venda' in df_vendas.columns else 'QtdVenda'

    df_vendas[col_data] = pd.to_datetime(df_vendas[col_data])
    
    mapa_descricoes = {}
    if caminho_produtos.exists():
        df_produtos = pd.read_parquet(caminho_produtos)
        p_col_sku = 'sku' if 'sku' in df_produtos.columns else 'Produto'
        p_col_desc = 'descricao' if 'descricao' in df_produtos.columns else 'Descricao'
        if p_col_sku in df_produtos.columns and p_col_desc in df_produtos.columns:
            mapa_descricoes = dict(zip(df_produtos[p_col_sku].astype(str), df_produtos[p_col_desc].fillna('')))

    data_max = df_vendas['Data'].max()
    data_min = max(df_vendas['Data'].min(), data_max - pd.Timedelta(days=365))
    datas = pd.date_range(data_min, data_max, freq='D')
    mapa_datas = {d: i for i, d in enumerate(datas)}
    n_dias = len(datas)

    print(f'[Pipeline] Filtrando janela de contexto dos últimos 365 dias ({data_min.date()} até {data_max.date()})...')
    df_recente = df_vendas[df_vendas['Data'] >= data_min]

    series_ativas = []
    chaves_series = []

    grupos = df_recente.groupby(['ANOMEFANTASIA', 'ACODPRODUTO'])
    for (loja, sku), group in grupos:
        filial_id = MAPA_LOJA_FILIAL.get(loja)
        if filial_id is None:
            continue
        vetor = np.zeros(n_dias, dtype=np.float32)
        for _, row in group.iterrows():
            d = row['Data']
            if d in mapa_datas:
                vetor[mapa_datas[d]] += float(row['QtdVenda'])
        
        if np.sum(vetor) > 0:
            series_ativas.append(vetor)
            chaves_series.append((loja, filial_id, str(sku)))

    total_series = len(series_ativas)
    print(f'[Pipeline] {total_series:,} séries ativas identificadas para previsão.')

    if not modelo_nome:
        modelo_nome = obter_modelo_padrao()

    modelo = obter_modelo(modelo_nome)
    print(f'[Pipeline] Modelo selecionado: {modelo.nome}')

    print(f'[Pipeline] Gerando previsões para horizonte de 30 dias em lotes de 512...')
    batch_size = 512
    resultados_previsao = []
    horizonte_dias = 30

    t_inferencia = time.time()
    for b in range(0, total_series, batch_size):
        b_series = series_ativas[b:b+batch_size]
        res = modelo.prever_lote(b_series, horizonte_dias)
        resultados_previsao.extend(res)
        if b > 0 and (b // batch_size) % 10 == 0:
            print(f'  ... {min(b + batch_size, total_series):,}/{total_series:,} séries processadas')

    dt_inf = time.time() - t_inferencia
    print(f'[Pipeline] Inferência concluída em {dt_inf:.1f}s ({total_series / max(dt_inf, 0.001):.0f} séries/s).')

    # Montar registros para o Supabase
    tenant_id = os.getenv('TENANT_ATIVO', 'carreiro')
    data_hoje = date.today().isoformat()
    now_iso = datetime.now().isoformat()

    registros = []
    for (loja, filial_id, sku_raw), res in zip(chaves_series, resultados_previsao):
        s_raw = str(sku_raw or '').strip()
        codigo_sku = s_raw.split('|')[0].strip() if '|' in s_raw else s_raw
        try:
            prod_id = int(codigo_sku)
        except ValueError:
            prod_id = abs(hash(codigo_sku)) % 2147483647

        desc = mapa_descricoes.get(sku_raw, mapa_descricoes.get(codigo_sku, ''))

        registros.append({
            'tenant_id': tenant_id,
            'filial_id': filial_id,
            'produto_id': prod_id,
            'sku': codigo_sku,
            'descricao': desc,
            'previsao_central': round(float(res.previsao_central), 4),
            'demanda_p50': round(float(res.p50), 4),
            'demanda_p80': round(float(res.p80), 4),
            'horizonte_dias': horizonte_dias,
            'modelo_utilizado': modelo.nome,
            'data_previsao': data_hoje,
            'atualizado_em': now_iso
        })

    print(f'[Pipeline] {len(registros):,} registros formatados para envio ao Supabase.')

    if dry_run:
        print('[Pipeline] Modo DRY-RUN ativado. Nenhum dado foi enviado ao Supabase.')
        print('Amostra dos 3 primeiros registros:')
        for r in registros[:3]:
            print(' ', r)
        return

    # Conexão e Upsert no Supabase
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_ANON_KEY')

    if not supabase_url or not supabase_key:
        print('[Pipeline] AVISO: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.')
        print('[Pipeline] Salvando previsões localmente em dados/previsoes_demanda_ia.parquet...')
        df_out = pd.DataFrame(registros)
        df_out.to_parquet(base_dir / 'dados/previsoes_demanda_ia.parquet', index=False)
        print('[Pipeline] Arquivo salvo com sucesso.')
        return

    supabase: Client = create_client(supabase_url, supabase_key)
    print(f'[Pipeline] Conectado ao Supabase ({supabase_url}). Iniciando upsert em lote...')

    t_upsert = time.time()
    tamanho_lote_upsert = 500
    total_enviados = 0

    for i in range(0, len(registros), tamanho_lote_upsert):
        lote = registros[i:i+tamanho_lote_upsert]
        try:
            supabase.table('demanda_ia_previsao').upsert(
                lote,
                on_conflict='tenant_id, filial_id, produto_id'
            ).execute()
            total_enviados += len(lote)
        except Exception as e:
            print(f'[Pipeline] Erro ao enviar lote {i}-{i+len(lote)}: {e}')
            # Salvar fallback local
            df_out = pd.DataFrame(registros)
            df_out.to_parquet(base_dir / 'dados/previsoes_demanda_ia.parquet', index=False)
            print(f'[Pipeline] Backup salvo em dados/previsoes_demanda_ia.parquet.')
            break

    print(f'[Pipeline] Upsert concluído: {total_enviados:,}/{len(registros):,} registros salvos no Supabase em {time.time()-t_upsert:.1f}s.')
    print(f'[Pipeline] Tempo total de execução: {time.time()-t_inicio:.1f}s.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Pipeline Diário de Previsão de Demanda com IA')
    parser.add_argument('--modelo', type=str, default=None, help='Nome do modelo (chronos-tiny, chronos-small, croston, dlinear, baseline)')
    parser.add_argument('--fonte', type=str, default='fabric', help='Tipo de fonte de dados (fabric, sql, arquivo)')
    parser.add_argument('--extrair', action='store_true', help='Extrai dados novos da fonte configurada antes da inferência')
    parser.add_argument('--dry-run', action='store_true', help='Executa inferência sem enviar ao Supabase')
    args = parser.parse_args()

    executar_pipeline(modelo_nome=args.modelo, fonte_tipo=args.fonte, extrair=args.extrair, dry_run=args.dry_run)
