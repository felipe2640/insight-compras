"""
Normalização do contrato de dados de vendas e produtos.
-------------------------------------------------------
Os extratores devolvem os nomes canônicos em minúsculo ('loja', 'sku', 'data',
'qtd_venda'), mas o cache legado gerado por `extrator_dados.py` usa os nomes crus
do DAX ('ANOMEFANTASIA', 'ACODPRODUTO', 'Data', 'QtdVenda'). Tudo que lê parquet
passa por aqui para aceitar os dois formatos e falhar de forma explícita quando
faltar uma coluna obrigatória — em vez de estourar um KeyError opaco mais adiante.
"""

import os
import zlib
import unicodedata
import pandas as pd

# Aliases aceitos para cada coluna canônica de vendas.
ALIASES_VENDAS = {
    'loja': ('loja', 'ANOMEFANTASIA', 'Loja', 'filial', 'empresa'),
    'sku': ('sku', 'ACODPRODUTO', 'SKU', 'produto', 'codigo'),
    'data': ('data', 'Data', 'DATA', 'data_venda'),
    'qtd_venda': ('qtd_venda', 'QtdVenda', 'QTDMOVIMENTADA', 'qtd', 'quantidade'),
}

# Aliases aceitos para cada coluna canônica de produtos.
ALIASES_PRODUTOS = {
    'sku': ('sku', 'ACODPRODUTO', 'SKU', 'Produto', 'produto', 'codigo'),
    'descricao': ('descricao', 'Descricao', 'ADESCRICAO', 'nome'),
}


def normalizar_texto_loja(valor) -> str:
    """Chave canônica de loja: sem acento, sem espaço duplicado, em maiúsculas."""
    texto = str(valor or '').strip()
    sem_acento = ''.join(
        c for c in unicodedata.normalize('NFKD', texto) if not unicodedata.combining(c)
    )
    return ' '.join(sem_acento.upper().split())


def normalizar_colunas(df: pd.DataFrame, aliases: dict, rotulo: str) -> pd.DataFrame:
    """
    Renomeia as colunas conhecidas para os nomes canônicos e exige as obrigatórias.
    """
    renomear = {}
    for canonico, candidatos in aliases.items():
        if canonico in df.columns:
            continue
        for candidato in candidatos:
            if candidato in df.columns:
                renomear[candidato] = canonico
                break
    if renomear:
        df = df.rename(columns=renomear)

    faltando = [c for c in aliases if c not in df.columns]
    if faltando:
        raise KeyError(
            f'[{rotulo}] Colunas obrigatórias ausentes: {faltando}. '
            f'Colunas recebidas: {list(df.columns)}'
        )
    return df


def identificador_produto(codigo_sku) -> int:
    """
    Id numérico estável para SKU não numérico.
    `hash()` de string é randomizado por processo (PYTHONHASHSEED), o que gerava
    um id diferente a cada execução — furando o upsert e o lookup do cockpit.
    CRC32 é determinístico entre processos e versões.
    """
    try:
        return int(codigo_sku)
    except (TypeError, ValueError):
        return zlib.crc32(str(codigo_sku).encode('utf-8')) % 2147483647


def inteiro_do_ambiente(nome: str, padrao: int, minimo: int = 1) -> int:
    """
    Lê um inteiro de variável de ambiente tolerando ausência e valor vazio.
    O GitHub Actions injeta string vazia quando a `vars.X` não está definida, e
    `int('')` levantaria ValueError no meio do pipeline.
    """
    bruto = (os.getenv(nome) or '').strip()
    if not bruto:
        return padrao
    try:
        valor = int(bruto)
    except ValueError:
        print(f'[Config] AVISO: {nome}="{bruto}" não é inteiro; usando {padrao}.')
        return padrao
    if valor < minimo:
        print(f'[Config] AVISO: {nome}={valor} abaixo do mínimo {minimo}; usando {padrao}.')
        return padrao
    return valor
