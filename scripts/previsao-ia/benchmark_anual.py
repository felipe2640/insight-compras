import argparse
import json
import time
from datetime import datetime
from pathlib import Path
import numpy as np
import pandas as pd
from tabulate import tabulate

from modelos.baseline_atual import ModeloBaselineAtual
from modelos.quantil_empirico import ModeloQuantilEmpirico
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

def construir_vetor_financeiro(series_chaves, df_produtos, margem_percentual=0.40, taxa_posse_mensal=0.02):
    """
    Mapeia custo unitário, margem bruta em R$ e custo de posse mensal para cada SKU da rede.
    """
    mapa_custo = {}
    for _, row in df_produtos.iterrows():
        sku_raw = str(row.get('Produto', row.get('sku', ''))).strip()
        sku_code = sku_raw.split('|')[0].strip() if '|' in sku_raw else sku_raw
        try:
            c = float(row.get('PrecoCompraERP', 0.0))
            if c > 0:
                mapa_custo[sku_raw] = c
                mapa_custo[sku_code] = c
        except (ValueError, TypeError):
            pass

    custos_validos = [c for c in mapa_custo.values() if c > 0]
    custo_mediano = float(np.median(custos_validos)) if custos_validos else 33.14

    n = len(series_chaves)
    custos_np = np.zeros(n, dtype=np.float32)
    for i, (_, sku) in enumerate(series_chaves):
        s_raw = str(sku).strip()
        s_code = s_raw.split('|')[0].strip() if '|' in s_raw else s_raw
        custos_np[i] = mapa_custo.get(s_raw, mapa_custo.get(s_code, custo_mediano))

    # Margem bruta unitária (R$) perdida na ruptura: custo * (margem / (1 - margem))
    fator_margem = margem_percentual / max(0.01, 1.0 - margem_percentual)
    margens_np = custos_np * fator_margem

    # Custo de posse de estoque mensal (R$): custo * taxa_posse_mensal
    taxa_posse_np = custos_np * taxa_posse_mensal

    print(f'-> Perfil Financeiro: Custo médio R$ {np.mean(custos_np):.2f} | Margem média R$ {np.mean(margens_np):.2f} | Posse média R$ {np.mean(taxa_posse_np):.2f}/mês')
    return custos_np, margens_np, taxa_posse_np

def executar_benchmark_anual(incluir_small: bool = False):
    df_vendas, df_produtos = carregar_dados()
    data_min = df_vendas['data'].min()
    data_max = df_vendas['data'].max()
    series_dict, datas = construir_matriz_temporal(df_vendas, data_min, data_max)

    series_chaves = list(series_dict.keys())
    total_skus_rede = len(series_chaves)

    custos_np, margens_np, taxa_posse_np = construir_vetor_financeiro(
        series_chaves,
        df_produtos,
        margem_percentual=0.40,
        taxa_posse_mensal=0.02
    )

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
        ModeloQuantilEmpirico(percentil_cobertura=80.0),
        ModeloCrostonSBA(),
        ModeloDLinear(),
        ModeloChronosBolt(model_id='amazon/chronos-bolt-tiny', nome='Chronos-Bolt (Tiny)'),
    ]

    if incluir_small:
        modelos.append(ModeloChronosBolt(model_id='amazon/chronos-bolt-small', nome='Chronos-Bolt (Small)'))

    print('\n' + '='*95)
    print('INICIANDO ROLLING BACKTEST ANUAL COM SIMULAÇÃO DE ESTOQUE E CRITÉRIO FINANCEIRO (R$)')
    print(f'Total de SKUs na rede: {total_skus_rede:,}')
    print(f'Total de cortes mensais: {len(cortes)}')
    print(f'Critério de Eleição: MENOR CUSTO TOTAL EM R$ (Perda de Margem por Ruptura + Custo de Posse de Estoque)')
    print('='*95 + '\n')

    totais_sku = {k: np.sum(v) for k, v in series_dict.items()}
    skus_curva_a = {k for k, tot in totais_sku.items() if tot >= 30}
    is_curva_a_np = np.array([(k in skus_curva_a) for k in series_chaves], dtype=bool)
    print(f'SKUs Curva A/Alto Volume: {len(skus_curva_a):,} | Intermitentes/Outros: {total_skus_rede-len(skus_curva_a):,}')

    # Estado dinâmico de estoque remanescente entre cortes por modelo
    estoques_modelo = {m.nome: np.zeros(total_skus_rede, dtype=np.float32) for m in modelos}

    resultados_modelo = {m.nome: {
        'tempo_total_s': 0.0,
        'soma_real': 0.0,
        'soma_erro_abs': 0.0,
        'soma_erro_bias': 0.0,
        'soma_real_curva_a': 0.0,
        'soma_erro_curva_a': 0.0,
        'pecas_ruptura': 0.0,
        'pecas_estoque_final_media': 0.0,
        'casos_ruptura': 0,
        'total_avaliacoes': 0,
        'custo_ruptura_rs': 0.0,
        'custo_posse_rs': 0.0,
        'custo_total_rs': 0.0,
    } for m in modelos}

    for corte_idx, corte in enumerate(cortes, 1):
        idx_corte = int(np.argmin(np.abs([(d.to_pydatetime() - corte).total_seconds() for d in datas])))
        idx_fim = min(len(datas), idx_corte + horizonte_dias)
        dias_reais = idx_fim - idx_corte

        print(f'\n>>> Rodada {corte_idx}/12: Corte em {corte.date()} (Horizonte: {dias_reais} dias)...')

        skus_ativos = []
        contextos_ativos = []
        indices_ativos = []

        reais_todos = np.zeros(total_skus_rede, dtype=np.float32)

        for i, (k, v) in enumerate(series_dict.items()):
            hist = v[:idx_corte]
            real_val = float(np.sum(v[idx_corte:idx_fim]))
            reais_todos[i] = real_val

            if np.sum(hist) > 0:
                skus_ativos.append(k)
                contextos_ativos.append(hist)
                indices_ativos.append(i)

        soma_real_rodada = float(np.sum(reais_todos))
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

            p_central_np = np.zeros(total_skus_rede, dtype=np.float32)
            p80_np = np.zeros(total_skus_rede, dtype=np.float32)

            if len(indices_ativos) > 0:
                p_central_np[indices_ativos] = np.array(previsoes_central_ativos, dtype=np.float32)
                p80_np[indices_ativos] = np.array(previsoes_p80_ativos, dtype=np.float32)

            dt = time.time() - t0

            # --- SIMULAÇÃO DE ESTOQUE COM CARREGAMENTO DE SALDO ---
            estoque_anterior = estoques_modelo[modelo.nome]
            
            # Compra líquida necessária para atingir a meta de cobertura do período
            alvo_cobertura = p80_np
            compra_sugerida = np.maximum(0.0, alvo_cobertura - estoque_anterior)
            disponivel_periodo = estoque_anterior + compra_sugerida

            # Demanda real ocorre
            rupturas = np.maximum(0.0, reais_todos - disponivel_periodo)
            estoque_final = np.maximum(0.0, disponivel_periodo - reais_todos)

            # Saldo é carregado para a próxima rodada
            estoques_modelo[modelo.nome] = estoque_final

            # Custos financeiros em R$
            custo_ruptura_rodada = float(np.sum(rupturas * margens_np))
            custo_posse_rodada = float(np.sum(estoque_final * taxa_posse_np))
            custo_total_rodada = custo_ruptura_rodada + custo_posse_rodada

            # Erros estatísticos
            erros_abs = np.abs(reais_todos - p_central_np)
            erros_bias = p_central_np - reais_todos

            m_stats = resultados_modelo[modelo.nome]
            m_stats['tempo_total_s'] += dt
            m_stats['soma_real'] += soma_real_rodada
            m_stats['soma_erro_abs'] += float(np.sum(erros_abs))
            m_stats['soma_erro_bias'] += float(np.sum(erros_bias))
            m_stats['pecas_ruptura'] += float(np.sum(rupturas))
            m_stats['pecas_estoque_final_media'] += float(np.sum(estoque_final)) / len(cortes)
            m_stats['casos_ruptura'] += int(np.sum(rupturas > 0))
            m_stats['total_avaliacoes'] += total_skus_rede
            m_stats['custo_ruptura_rs'] += custo_ruptura_rodada
            m_stats['custo_posse_rs'] += custo_posse_rodada
            m_stats['custo_total_rs'] += custo_total_rodada

            if np.any(is_curva_a_np):
                m_stats['soma_real_curva_a'] += float(np.sum(reais_todos[is_curva_a_np]))
                m_stats['soma_erro_curva_a'] += float(np.sum(erros_abs[is_curva_a_np]))

            print(f'    [{modelo.nome}]: Ruptura = {np.sum(rupturas):,.0f} un (R$ {custo_ruptura_rodada:,.0f}) | Posse = R$ {custo_posse_rodada:,.0f} | Custo Total = R$ {custo_total_rodada:,.0f} | Tempo: {dt:.1f}s')

    print('\n' + '='*105)
    print('RELATORIO FINAL CONSOLIDADO DO BENCHMARK ANUAL (12 MESES — CRITÉRIO FINANCEIRO EM R$)')
    print('='*105)

    tabela_resumo = []
    ranking_financeiro = []

    for nome, s in resultados_modelo.items():
        wape_global = (s['soma_erro_abs'] / s['soma_real'] * 100.0) if s['soma_real'] > 0 else 0.0
        wape_curva_a = (s['soma_erro_curva_a'] / s['soma_real_curva_a'] * 100.0) if s['soma_real_curva_a'] > 0 else 0.0
        bias_global = (s['soma_erro_bias'] / s['soma_real'] * 100.0) if s['soma_real'] > 0 else 0.0
        taxa_ruptura = (s['casos_ruptura'] / s['total_avaliacoes'] * 100.0) if s['total_avaliacoes'] > 0 else 0.0

        ranking_financeiro.append((s['custo_total_rs'], nome))

        tabela_resumo.append([
            nome,
            f"R$ {s['custo_total_rs']:,.0f}",
            f"R$ {s['custo_ruptura_rs']:,.0f}",
            f"R$ {s['custo_posse_rs']:,.0f}",
            f"{s['pecas_ruptura']:,.0f}",
            f"{taxa_ruptura:.1f}%",
            f"{s['pecas_estoque_final_media']:,.0f}",
            f"{wape_global:.1f}%",
            f"{bias_global:+.1f}%",
            f"{s['tempo_total_s']:.1f}s"
        ])

    headers = [
        'Modelo',
        'Custo Total (R$)',
        'Perda Ruptura (R$)',
        'Custo Posse (R$)',
        'Peças Ruptura',
        'Taxa Ruptura',
        'Estoque Médio',
        'WAPE',
        'Bias',
        'Tempo CPU'
    ]

    print(tabulate(tabela_resumo, headers=headers, tablefmt='grid'))

    ranking_financeiro.sort(key=lambda x: x[0])
    campeao = ranking_financeiro[0][1]
    custo_campeao = ranking_financeiro[0][0]

    print(f'\n*** MODELO CAMPEÃO ELEITO POR EFICIÊNCIA FINANCEIRA: {campeao} (Custo Total: R$ {custo_campeao:,.0f}) ***')
    print('='*105 + '\n')

    relatorio_path = Path(__file__).parent / 'resultados_benchmark_anual.json'
    with open(relatorio_path, 'w', encoding='utf-8') as f:
        json.dump({
            'data_execucao': datetime.now().isoformat(),
            'criterio_eleicao': 'Menor Custo Financeiro Total (R$)',
            'campeao': campeao,
            'custo_campeao_rs': custo_campeao,
            'metricas': resultados_modelo,
            'tabela': tabela_resumo
        }, f, ensure_ascii=False, indent=2)
    print(f'Relatorio salvo em: {relatorio_path}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Benchmark Anual de Previsão de Demanda com Critério Financeiro')
    parser.add_argument('--incluir-small', action='store_true', help='Inclui Chronos-Bolt (Small) além do Tiny')
    args = parser.parse_args()

    executar_benchmark_anual(incluir_small=args.incluir_small)