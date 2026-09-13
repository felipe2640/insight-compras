from .base import ExtratorDadosBase
from .fabric import ExtratorFabric
from .sql import ExtratorBancoSql
from .arquivo import ExtratorArquivo

def obter_extrator(tipo_fonte: str) -> ExtratorDadosBase:
    """
    Fábrica de extratores: instancia o conector adequado para a fonte de dados do cliente.
    Suporta:
    - 'fabric' ou 'powerbi': Microsoft Fabric REST API ou SSAS
    - 'sql', 'postgres', 'sqlserver', 'mysql': Bancos relacionais diretos
    - 'arquivo', 'csv', 'excel', 'parquet': Arquivos tabulares
    """
    tipo = (tipo_fonte or 'fabric').lower().strip()
    if tipo in ('fabric', 'powerbi', 'pbi'):
        return ExtratorFabric()
    elif tipo in ('sql', 'postgres', 'postgresql', 'sqlserver', 'mysql', 'oracle', 'sqlite'):
        return ExtratorBancoSql()
    elif tipo in ('arquivo', 'csv', 'excel', 'parquet', 'planilha'):
        return ExtratorArquivo()
    else:
        raise ValueError(f"Tipo de fonte de dados desconhecido: '{tipo_fonte}'. Opções válidas: 'fabric', 'sql', 'arquivo'.")
