"""
Pipeline Diário de Inferência de Previsão de Demanda com IA
-----------------------------------------------------------
Executa localmente na máquina do cliente (ou no GitHub Actions):
1. Extrai ou carrega dados de demanda diária e cadastro de produtos.
2. Executa inferência em lote com o modelo campeão de IA (ou especificado via flag).
3. Publica previsões probabilísticas (p50, p80) na tabela `demanda_ia_previsao` do Supabase.

Contrato de colunas: os extratores devolvem SEMPRE os nomes canônicos em minúsculo
('loja', 'sku', 'data', 'qtd_venda'). O cache legado gerado por `extrator_dados.py`
usa os nomes crus do DAX ('ANOMEFANTASIA', 'ACODPRODUTO', 'Data', 'QtdVenda'), por
isso a normalização abaixo aceita os dois e falha explicitamente se faltar coluna.
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
from modelos.quantil_empirico import ModeloQuantilEmpirico
from extratores import obter_extrator
from normalizacao import (
    ALIASES_PRODUTOS,
    ALIASES_VENDAS,
    identificador_produto,
    inteiro_do_ambiente,
    normalizar_colunas,
    normalizar_texto_loja,
)

# Horizonte de previsão em dias. O cockpit reescala para o horizonte do perfil de
# giro, mas o valor é publicado junto da previsão para que a conta seja auditável.
HORIZONTE_DIAS_PADRAO = 30

# Mapeamento padrão de Lojas (ANOMEFANTASIA do ERP) para filial_id do tenant.
# Pode ser sobrescrito por completo via env `MAPA_LOJA_FILIAL_JSON`
# (ex.: '{"CARREIRO PEDRO II": 1, "MELO DISTRIBUIDORA": 2}'), porque o nome
# fantasia é editável no ERP e não deve exigir alteração de código.
MAPA_LOJA_FILIAL_PADRAO = {
    'CARREIRO PEDRO II': 1,
    'MELO DISTRIBUIDORA': 2,
    'CARREIRO PORANGA': 3,
    'CEARA AUTO PECAS CAMPO MAIOR': 4,
    'CARREIRO JOSE DE FREITAS': 5
}

def carregar_mapa_loja_filial() -> dict:
    """Mapa loja -> filial_id, com override por env e chaves normalizadas."""
    bruto = os.getenv('MAPA_LOJA_FILIAL_JSON')
    origem = MAPA_LOJA_FILIAL_PADRAO
    if bruto:
        try:
            carregado = json.loads(bruto)
            if not isinstance(carregado, dict) or not carregado:
                raise ValueError('MAPA_LOJA_FILIAL_JSON deve ser um objeto não vazio.')
            origem = carregado
            print(f'[Pipeline] Mapa de lojas carregado de MAPA_LOJA_FILIAL_JSON ({len(origem)} lojas).')
        except (json.JSONDecodeError, ValueError) as e:
            print(f'[Pipeline] ERRO: MAPA_LOJA_FILIAL_JSON inválido: {e}')
            sys.exit(1)
    return {normalizar_texto_loja(k): int(v) for k, v in origem.items()}


def montar_config_extrator(fonte_tipo: str) -> dict:
    """
    Monta a configuração do extrator a partir do ambiente.
    Sem isto as fontes 'sql' e 'arquivo' são inutilizáveis: elas exigem
    connection_url / caminho_vendas e recebiam um dicionário vazio.
    """
    tipo = (fonte_tipo or '').lower().strip()

    if tipo in ('sql', 'postgres', 'postgresql', 'sqlserver', 'mysql', 'oracle', 'sqlite'):
        config = {
            'connection_url': os.getenv('FONTE_SQL_CONNECTION_URL'),
            'query_vendas': os.getenv('FONTE_SQL_QUERY_VENDAS'),
            'query_produtos': os.getenv('FONTE_SQL_QUERY_PRODUTOS'),
        }
        if not config['connection_url']:
            print('[Pipeline] ERRO: FONTE_SQL_CONNECTION_URL é obrigatório para --fonte sql.')
            sys.exit(1)
        # Queries vazias caem no default do extrator.
        return {k: v for k, v in config.items() if v}

    if tipo in ('arquivo', 'csv', 'excel', 'parquet', 'planilha'):
        config = {
            'caminho_vendas': os.getenv('FONTE_ARQUIVO_VENDAS'),
            'caminho_produtos': os.getenv('FONTE_ARQUIVO_PRODUTOS'),
        }
        if not config['caminho_vendas']:
            print('[Pipeline] ERRO: FONTE_ARQUIVO_VENDAS é obrigatório para --fonte arquivo.')
            sys.exit(1)
        return {k: v for k, v in config.items() if v}

    # Fabric/Power BI lê as credenciais do próprio ambiente; nada obrigatório aqui.
    return {}


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
    elif 'quantil' in nome_low or 'empirico' in nome_low:
        return ModeloQuantilEmpirico()
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

def executar_pipeline(
    modelo_nome: str = None,
    fonte_tipo: str = 'fabric',
    extrair: bool = False,
    dry_run: bool = False,
    permitir_lojas_nao_mapeadas: bool = False,
):
    t_inicio = time.time()
    base_dir = Path(__file__).parent
    dados_dir = base_dir / 'dados'
    dados_dir.mkdir(exist_ok=True)

    caminho_vendas = dados_dir / 'daily_demand.parquet'
    caminho_produtos = dados_dir / 'current_product.parquet'

    if extrair or not caminho_vendas.exists():
        print(f'[Pipeline] Executando extração de dados da fonte: {fonte_tipo.upper()}...')
        extrator = obter_extrator(fonte_tipo)
        df_vendas_ext, df_produtos_ext = extrator.extrair(montar_config_extrator(fonte_tipo))

        # Salva em parquet padronizado para cache
        df_vendas_ext.to_parquet(caminho_vendas, index=False)
        if not df_produtos_ext.empty:
            df_produtos_ext.to_parquet(caminho_produtos, index=False)
        print(f'[Pipeline] Extração concluída: {len(df_vendas_ext):,} vendas salvas em cache.')

    print(f'[Pipeline] Carregando dados históricos...')
    df_vendas = pd.read_parquet(caminho_vendas)

    # Normalização de nomes de colunas (aceita cache novo em minúsculo e cache legado do DAX)
    df_vendas = normalizar_colunas(df_vendas, ALIASES_VENDAS, 'Vendas')

    # `normalize()` zera a hora: o índice de datas é diário e um timestamp com
    # hora não casaria com nenhuma chave, zerando a série em silêncio.
    df_vendas['data'] = pd.to_datetime(df_vendas['data'], errors='coerce').dt.normalize()
    df_vendas['qtd_venda'] = pd.to_numeric(df_vendas['qtd_venda'], errors='coerce').fillna(0.0)
    linhas_sem_data = int(df_vendas['data'].isna().sum())
    if linhas_sem_data:
        print(f'[Pipeline] AVISO: {linhas_sem_data:,} linhas descartadas por data inválida.')
        df_vendas = df_vendas[df_vendas['data'].notna()]

    if df_vendas.empty:
        print('[Pipeline] ERRO: nenhuma venda válida após a normalização. Abortando.')
        sys.exit(1)

    mapa_descricoes = {}
    if caminho_produtos.exists():
        df_produtos = pd.read_parquet(caminho_produtos)
        try:
            df_produtos = normalizar_colunas(df_produtos, ALIASES_PRODUTOS, 'Produtos')
            mapa_descricoes = dict(
                zip(df_produtos['sku'].astype(str), df_produtos['descricao'].fillna(''))
            )
        except KeyError as e:
            print(f'[Pipeline] AVISO: cadastro de produtos ignorado ({e}).')

    data_max = df_vendas['data'].max()
    data_min = max(df_vendas['data'].min(), data_max - pd.Timedelta(days=365))
    datas = pd.date_range(data_min, data_max, freq='D')
    mapa_datas = {d: i for i, d in enumerate(datas)}
    n_dias = len(datas)

    print(f'[Pipeline] Filtrando janela de contexto dos últimos 365 dias ({data_min.date()} até {data_max.date()})...')
    df_recente = df_vendas[df_vendas['data'] >= data_min]

    mapa_loja_filial = carregar_mapa_loja_filial()
    series_ativas = []
    chaves_series = []
    lojas_nao_mapeadas = {}

    grupos = df_recente.groupby(['loja', 'sku'])
    for (loja, sku), group in grupos:
        filial_id = mapa_loja_filial.get(normalizar_texto_loja(loja))
        if filial_id is None:
            # Loja fora do mapa: registra para reportar em vez de sumir em silêncio.
            lojas_nao_mapeadas[str(loja)] = lojas_nao_mapeadas.get(str(loja), 0) + 1
            continue
        vetor = np.zeros(n_dias, dtype=np.float32)
        for _, row in group.iterrows():
            d = row['data']
            if d in mapa_datas:
                vetor[mapa_datas[d]] += float(row['qtd_venda'])

        if np.sum(vetor) > 0:
            series_ativas.append(vetor)
            chaves_series.append((loja, filial_id, str(sku)))

    if lojas_nao_mapeadas:
        print('[Pipeline] ATENÇÃO: lojas sem filial_id correspondente (nenhuma previsão gerada para elas):')
        for nome_loja, qtd in sorted(lojas_nao_mapeadas.items(), key=lambda x: -x[1]):
            print(f'    - "{nome_loja}" ({qtd:,} séries descartadas)')
        print('    Ajuste MAPA_LOJA_FILIAL_JSON para incluí-las.')
        if not permitir_lojas_nao_mapeadas:
            print('[Pipeline] ERRO: abortando para não publicar previsão parcial da rede.')
            print('           Use --permitir-lojas-nao-mapeadas se a exclusão for intencional.')
            sys.exit(1)

    total_series = len(series_ativas)
    print(f'[Pipeline] {total_series:,} séries ativas identificadas para previsão.')

    if total_series == 0:
        print('[Pipeline] ERRO: nenhuma série ativa para prever. Abortando.')
        sys.exit(1)

    if not modelo_nome:
        modelo_nome = obter_modelo_padrao()

    modelo = obter_modelo(modelo_nome)
    print(f'[Pipeline] Modelo selecionado: {modelo.nome}')

    horizonte_dias = inteiro_do_ambiente('HORIZONTE_DIAS_PREVISAO', HORIZONTE_DIAS_PADRAO)
    print(f'[Pipeline] Gerando previsões para horizonte de {horizonte_dias} dias em lotes de 512...')
    batch_size = 512
    resultados_previsao = []

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
    #
    # TENANT_ATIVO é OBRIGATÓRIO. O padrão 'carreiro' publicava a previsão de
    # qualquer execução mal configurada dentro do cliente Carreiro — inclusive
    # a de outro cliente, já que o workflow roda o mesmo pipeline em laço.
    tenant_id = (os.getenv('TENANT_ATIVO') or '').strip()
    if not tenant_id:
        raise SystemExit(
            '[Pipeline] TENANT_ATIVO é obrigatório: sem ele a previsão seria '
            'publicada no cliente errado.'
        )
    data_hoje = date.today().isoformat()
    now_iso = datetime.now().isoformat()

    registros = []
    for (loja, filial_id, sku_raw), res in zip(chaves_series, resultados_previsao):
        s_raw = str(sku_raw or '').strip()
        codigo_sku = s_raw.split('|')[0].strip() if '|' in s_raw else s_raw
        prod_id = identificador_produto(codigo_sku)

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
    # Service role apenas: a tabela `demanda_ia_previsao` não tem grant para anon
    # (ver docs/supabase/schema-ia.sql), então a chave pública só daria 401.
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

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
    lotes_falhos = []

    for i in range(0, len(registros), tamanho_lote_upsert):
        lote = registros[i:i+tamanho_lote_upsert]
        enviado = False
        ultimo_erro = None
        # Uma falha de rede não deve condenar o dia inteiro: tenta 3 vezes.
        for tentativa in range(1, 4):
            try:
                supabase.table('demanda_ia_previsao').upsert(
                    lote,
                    on_conflict='tenant_id,filial_id,produto_id'
                ).execute()
                total_enviados += len(lote)
                enviado = True
                break
            except Exception as e:
                ultimo_erro = e
                print(f'[Pipeline] Falha no lote {i}-{i+len(lote)} (tentativa {tentativa}/3): {e}')
                if tentativa < 3:
                    time.sleep(2 * tentativa)
        if not enviado:
            # Segue com os demais lotes em vez de abortar: o relatório final
            # informa o que faltou e o processo termina com status de erro.
            lotes_falhos.append((i, len(lote), str(ultimo_erro)))

    print(f'[Pipeline] Upsert concluído: {total_enviados:,}/{len(registros):,} registros salvos no Supabase em {time.time()-t_upsert:.1f}s.')
    print(f'[Pipeline] Tempo total de execução: {time.time()-t_inicio:.1f}s.')

    if lotes_falhos:
        caminho_backup = base_dir / 'dados/previsoes_demanda_ia.parquet'
        pd.DataFrame(registros).to_parquet(caminho_backup, index=False)
        print(f'[Pipeline] Backup completo salvo em {caminho_backup}.')
        print(f'[Pipeline] ERRO: {len(lotes_falhos)} lote(s) não publicado(s):')
        for inicio, tamanho, erro in lotes_falhos:
            print(f'    - lote {inicio}-{inicio+tamanho}: {erro}')
        # Sai com erro para o GitHub Actions marcar a execução como falha.
        sys.exit(1)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Pipeline Diário de Previsão de Demanda com IA')
    parser.add_argument('--modelo', type=str, default=None, help='Nome do modelo (chronos-tiny, chronos-small, croston, dlinear, baseline)')
    parser.add_argument('--fonte', type=str, default='fabric', help='Tipo de fonte de dados (fabric, sql, arquivo)')
    parser.add_argument('--extrair', action='store_true', help='Extrai dados novos da fonte configurada antes da inferência')
    parser.add_argument('--dry-run', action='store_true', help='Executa inferência sem enviar ao Supabase')
    parser.add_argument(
        '--permitir-lojas-nao-mapeadas',
        action='store_true',
        help='Prossegue mesmo com lojas sem filial_id (por padrão aborta para não publicar rede parcial)'
    )
    args = parser.parse_args()

    executar_pipeline(
        modelo_nome=args.modelo,
        fonte_tipo=args.fonte,
        extrair=args.extrair,
        dry_run=args.dry_run,
        permitir_lojas_nao_mapeadas=args.permitir_lojas_nao_mapeadas,
    )
