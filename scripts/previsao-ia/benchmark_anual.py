import json
import time
from datetime import datetime
from pathlib import Path
import numpy as np
import pandas as pd
from tabulate import tabulate

from modelos.baseline_atual import ModeloBaselineAtual
from modelos.croston_sba import ModeloCrostonSBA
from modelos.dlinear import ModeloDLinear
from modelos.chronos_bolt import ModeloChronosBolt
from normalizacao import ALIASES_VENDAS, normalizar_colunas

def carregar_dados():
    base_dir = Path(__file__).parent
    df_vendas = pd.read_parquet(base_dir / 'dados/daily_demand.parquet')
    df_produtos = pd.read_parquet(base_dir / 'dados/current_product.parquet')
    # Aceita o cache novo (colunas canônicas) e o legado (nomes crus do DAX).
    df_vendas = normalizar_colunas(df_vendas, ALIASES_VENDAS, 'Vendas')
    df_vendas['data'] = pd.to_datetime(df_vendas['data'], errors='coerce').dt.normalize()
    df_vendas = df_vendas[df_vendas['data'].notna()]
    df_vendas['qtd_venda'] = pd.to_numeric(df_vendas['qtd_venda'], errors='coerce').fillna(0.0)
    return df_vendas, df_produtos

def construir_matriz_temporal(df_vendas, data_min, data_max):
    print(f'Construindo matriz temporal de {data_min.date()} a {data_max.date()}...')
    datas = pd.date_range(data_min, data_max, freq='D')
    mapa_datas = {d: i for i, d in enumerate(datas)}
    n_dias = len(datas)

    series_dict = {}
    grupos = df_vendas.groupby(['loja', 'sku'])
    for (loja, sku), group in grupos:
        vetor = np.zeros(n_dias, dtype=np.float32)
        for _, row in group.iterrows():
            d = row['data']
            if d in mapa_datas:
                vetor[mapa_datas[d]] += float(row['qtd_venda'])
        series_dict[(loja, sku)] = vetor

    print(f'-> {len(series_dict):,} series temporais construidas com {n_dias} dias cada.')
    return series_dict, datas

def executar_benchmark_anual():
    df_vendas, df_produtos = carregar_dados()
    data_min = df_vendas['data'].min()
    data_max = df_vendas['data'].max()
    series_dict, datas = construir_matriz_temporal(df_vendas, data_min, data_max)

    cortes = [
        datetime(2025, 10, 1),
        datetime(2025, 11, 1),
        datetime(2025, 12, 1),
        datetime(2026, 1, 1),
        datetime(2026, 2, 1),
        datetime(2026, 3, 1),
        datetime(2026, 4, 1),
        datetime(2026, 5, 1),
        datetime(2026, 6, 1),
        datetime(2026, 7, 1),
        datetime(2026, 8, 1),
        datetime(2026, 8, 13),
    ]
    horizonte_dias = 30

    modelos = [
        ModeloBaselineAtual(),
        ModeloChronosBolt(model_id='amazon/chronos-bolt-tiny', nome='Chronos-Bolt (Tiny)'),
        ModeloChronosBolt(model_id='amazon/chronos-bolt-small', nome='Chronos-Bolt (Small)'),
        ModeloCrostonSBA(),
        ModeloDLinear(),
    ]

    print('\n' + '='*80)
    print('INICIANDO ROLLING BACKTEST ANUAL (12 MESES) EM 100% DOS SKUs')
    print(f'Total de SKUs na rede: {len(series_dict):,}')
    print(f'Total de avaliacoes (SKU x Cortes): {len(series_dict) * len(cortes):,}')
    print('='*80 + '\n')

    totais_sku = {k: np.sum(v) for k, v in series_dict.items()}
    skus_curva_a = {k for k, tot in totais_sku.items() if tot >= 30}
    print(f'SKUs Curva A/Alto Volume: {len(skus_curva_a):,} | Intermitentes/Outros: {len(series_dict)-len(skus_curva_a):,}')

    resultados_modelo = {m.nome: {
        'tempo_total_s': 0.0,
        'soma_real': 0.0,
        'soma_erro_abs': 0.0,
        'soma_erro_bias': 0.0,
        'soma_real_curva_a': 0.0,
        'soma_erro_curva_a': 0.0,
        'pecas_ruptura': 0.0,
        'pecas_encalhe': 0.0,
        'total_avaliacoes': 0,
        'casos_ruptura': 0
    } for m in modelos}

    for corte_idx, corte in enumerate(cortes, 1):
        idx_corte = int(np.argmin(np.abs([(d.to_pydatetime() - corte).total_seconds() for d in datas])))
        idx_fim = min(len(datas), idx_corte + horizonte_dias)
        dias_reais = idx_fim - idx_corte

        print(f'\n>>> Rodada {corte_idx}/12: Corte em {corte.date()} (Horizonte: {dias_reais} dias)...')

        total_skus_rede = len(series_dict)
        skus_ativos = []
        contextos_ativos = []
        indices_ativos = []

        reais_todos = np.zeros(total_skus_rede, dtype=np.float32)
        is_curva_a_np = np.zeros(total_skus_rede, dtype=bool)

        for i, (k, v) in enumerate(series_dict.items()):
            hist = v[:idx_corte]
            real_val = float(np.sum(v[idx_corte:idx_fim]))
            reais_todos[i] = real_val
            is_curva_a_np[i] = (k in skus_curva_a)

            if np.sum(hist) > 0:
                skus_ativos.append(k)
                contextos_ativos.append(hist)
                indices_ativos.append(i)

        soma_real_rodada = float(np.sum(reais_todos))
        print(f'    Total SKUs avaliados na rodada: {total_skus_rede:,} (100% da rede)')
        print(f'    SKUs com historico de venda ativo: {len(skus_ativos):,} | Demanda real ocorrida: {soma_real_rodada:,.0f} pecas.')

        for modelo in modelos:
            t0 = time.time()
            batch_size = 512
            previsoes_central_ativos = []
            previsoes_p80_ativos = []

            for b in range(0, len(skus_ativos), batch_size):
                b_ctx = contextos_ativos[b:b+batch_size]
                res_batch = modelo.prever_lote(b_ctx, dias_reais)
                for r in res_batch:
                    previsoes_central_ativos.append(r.previsao_central)
                    previsoes_p80_ativos.append(r.p80)
                if b > 0 and (b // batch_size) % 15 == 0:
                    print(f'      ... progresso {modelo.nome}: {min(b + batch_size, len(skus_ativos)):,}/{len(skus_ativos):,} SKUs')

            # Vetores completos para 100% dos SKUs da rede
            p_central_np = np.zeros(total_skus_rede, dtype=np.float32)
            p80_np = np.zeros(total_skus_rede, dtype=np.float32)

            if len(indices_ativos) > 0:
                p_central_np[indices_ativos] = np.array(previsoes_central_ativos, dtype=np.float32)
                p80_np[indices_ativos] = np.array(previsoes_p80_ativos, dtype=np.float32)

            dt = time.time() - t0
            erros_abs = np.abs(reais_todos - p_central_np)
            erros_bias = p_central_np - reais_todos
            rupturas = np.maximum(0.0, reais_todos - p80_np)
            encalhes = np.maximum(0.0, p80_np - reais_todos)

            m_stats = resultados_modelo[modelo.nome]
            m_stats['tempo_total_s'] += dt
            m_stats['soma_real'] += soma_real_rodada
            m_stats['soma_erro_abs'] += float(np.sum(erros_abs))
            m_stats['soma_erro_bias'] += float(np.sum(erros_bias))
            m_stats['pecas_ruptura'] += float(np.sum(rupturas))
            m_stats['pecas_encalhe'] += float(np.sum(encalhes))
            m_stats['total_avaliacoes'] += total_skus_rede
            m_stats['casos_ruptura'] += int(np.sum(rupturas > 0))

            if np.any(is_curva_a_np):
                m_stats['soma_real_curva_a'] += float(np.sum(reais_todos[is_curva_a_np]))
                m_stats['soma_erro_curva_a'] += float(np.sum(erros_abs[is_curva_a_np]))

            wape_rodada = (np.sum(erros_abs) / soma_real_rodada * 100.0) if soma_real_rodada > 0 else 0.0
            print(f'    [{modelo.nome}]: WAPE = {wape_rodada:.1f}% | Rupturas = {np.sum(rupturas):,.0f} un | Tempo: {dt:.1f}s')

    print('\n' + '='*95)
    print('RELATORIO FINAL CONSOLIDADO DO BENCHMARK ANUAL (12 MESES - 100% DOS SKUs)')
    print('='*95)

    tabela_resumo = []
    ranking_wape = []

    for nome, s in resultados_modelo.items():
        wape_global = (s['soma_erro_abs'] / s['soma_real'] * 100.0) if s['soma_real'] > 0 else 0.0
        wape_curva_a = (s['soma_erro_curva_a'] / s['soma_real_curva_a'] * 100.0) if s['soma_real_curva_a'] > 0 else 0.0
        bias_global = (s['soma_erro_bias'] / s['soma_real'] * 100.0) if s['soma_real'] > 0 else 0.0
        taxa_ruptura = (s['casos_ruptura'] / s['total_avaliacoes'] * 100.0) if s['total_avaliacoes'] > 0 else 0.0

        ranking_wape.append((wape_global, nome))

        tabela_resumo.append([
            nome,
            f'{wape_global:.2f}%',
            f'{wape_curva_a:.2f}%',
            f'{bias_global:+.1f}%',
            f'{s["pecas_ruptura"]:,.0f}',
            f'{s["pecas_encalhe"]:,.0f}',
            f'{taxa_ruptura:.1f}%',
            f'{s["tempo_total_s"]:.1f}s'
        ])

    headers = [
        'Modelo',
        'WAPE Global (Erro Total)',
        'WAPE Curva A (Alto Volume)',
        'Bias (Tendencia)',
        'Pecas em Ruptura',
        'Pecas em Encalhe',
        'Taxa de Ruptura',
        'Tempo Total CPU'
    ]

    print(tabulate(tabela_resumo, headers=headers, tablefmt='grid'))

    ranking_wape.sort(key=lambda x: x[0])
    campeao = ranking_wape[0][1]

    print(f'\n*** MODELO CAMPEAO ELEITO POR ACURACIA REAL: {campeao} ***')
    print('='*95 + '\n')

    relatorio_path = Path(__file__).parent / 'resultados_benchmark_anual.json'
    with open(relatorio_path, 'w', encoding='utf-8') as f:
        json.dump({
            'data_execucao': datetime.now().isoformat(),
            'campeao': campeao,
            'metricas': resultados_modelo,
            'tabela': tabela_resumo
        }, f, ensure_ascii=False, indent=2)
    print(f'Relatorio salvo em: {relatorio_path}')

if __name__ == '__main__':
    executar_benchmark_anual()