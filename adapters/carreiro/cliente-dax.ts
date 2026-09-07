/**
 * Cliente HTTP para Power BI Fabric REST API (executeQueries)
 * Camada: Adapters / Carreiro
 * 100% em Português do Brasil (pt-BR).
 *
 * Autenticação OAuth2 via Service Principal (Client Credentials) com cache de token
 * e fallback gracioso caso as credenciais não estejam configuradas no ambiente.
 */

export interface ConfiguracaoClienteDax {
  readonly workspaceId?: string;
  readonly datasetId?: string;
  readonly tenantId?: string;
  readonly clientId?: string;
  readonly clientSecret?: string;
  readonly accessTokenFixo?: string;
  readonly fetchCustomizado?: typeof fetch;
}

export interface RespostaLinhaDax {
  readonly [coluna: string]: unknown;
}

export interface RespostaExecuteQueriesPowerBI {
  readonly results?: readonly {
    readonly tables?: readonly {
      readonly rows?: readonly Record<string, unknown>[];
    }[];
  }[];
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}

/**
 * Utilitário para limpar prefixos de tabela do DAX.
 * Exemplos:
 * "PRODUTOS[ACODPRODUTO]" -> "ACODPRODUTO"
 * "[Receita Liquida]"     -> "Receita Liquida"
 * "CADEMP[ANOMEFANTASIA]" -> "ANOMEFANTASIA"
 */
export function limparNomeColunaDax(coluna: string): string {
  const match = /\[(.*?)\]$/.exec(coluna);
  if (match && match[1]) {
    return match[1];
  }
  return coluna;
}

/**
 * Normaliza todas as chaves de uma linha retornada pelo Power BI,
 * removendo prefixos de tabela e brackets.
 */
export function normalizarLinhaDax(linha: Record<string, unknown>): Record<string, unknown> {
  const resultado: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(linha)) {
    const chaveLimpa = limparNomeColunaDax(chave);
    resultado[chaveLimpa] = valor;
  }
  return resultado;
}

export class ClienteDaxPowerBI {
  private readonly workspaceId: string;
  private readonly datasetId: string;
  private readonly tenantId?: string;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly accessTokenFixo?: string;
  private readonly fetcher: typeof fetch;

  private tokenEmCache: string | null = null;
  private expiraEmEpochMs: number = 0;

  constructor(configuracao: ConfiguracaoClienteDax = {}) {
    this.workspaceId =
      configuracao.workspaceId ||
      process.env.POWERBI_WORKSPACE_ID ||
      "6bf4ec9d-2d71-48cf-b742-3460847d8036";
    this.datasetId =
      configuracao.datasetId ||
      process.env.POWERBI_DATASET_ID ||
      "a1ac5650-ca05-4a08-9593-5550ab67e14b";
    this.tenantId = configuracao.tenantId || process.env.POWERBI_TENANT_ID;
    this.clientId = configuracao.clientId || process.env.POWERBI_CLIENT_ID;
    this.clientSecret = configuracao.clientSecret || process.env.POWERBI_CLIENT_SECRET;
    this.accessTokenFixo = configuracao.accessTokenFixo || process.env.POWERBI_ACCESS_TOKEN;
    this.fetcher = configuracao.fetchCustomizado || globalThis.fetch;
  }

  /**
   * Verifica se as credenciais necessárias para conectar ao Fabric estão presentes.
   */
  public possuiConfiguracaoAtiva(): boolean {
    if (this.accessTokenFixo && this.accessTokenFixo.trim().length > 0) {
      return true;
    }
    return Boolean(
      this.tenantId &&
        this.clientId &&
        this.clientSecret &&
        this.tenantId.trim().length > 0 &&
        this.clientId.trim().length > 0 &&
        this.clientSecret.trim().length > 0
    );
  }

  /**
   * Obtém token de acesso OAuth2 válido (reutiliza cache se não estiver expirado).
   */
  public async obterTokenAcesso(): Promise<string> {
    if (this.accessTokenFixo) {
      return this.accessTokenFixo;
    }

    const agora = Date.now();
    // Margem de segurança de 60 segundos
    if (this.tokenEmCache && this.expiraEmEpochMs - agora > 60_000) {
      return this.tokenEmCache;
    }

    if (!this.tenantId || !this.clientId || !this.clientSecret) {
      throw new Error(
        "[Cliente DAX] Credenciais ausentes. Defina POWERBI_TENANT_ID, POWERBI_CLIENT_ID e POWERBI_CLIENT_SECRET no ambiente ou forneça token de acesso."
      );
    }

    const urlToken = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    const corpoRequisicao = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "https://analysis.windows.net/powerbi/api/.default",
    });

    const resposta = await this.fetcher(urlToken, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: corpoRequisicao.toString(),
    });

    if (!resposta.ok) {
      const textoErro = await resposta.text();
      throw new Error(
        `[Cliente DAX] Falha na autenticação OAuth2 com Azure Entra ID (HTTP ${resposta.status}): ${textoErro}`
      );
    }

    const dadosToken = (await resposta.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.tokenEmCache = dadosToken.access_token;
    this.expiraEmEpochMs = Date.now() + (dadosToken.expires_in || 3600) * 1000;

    return this.tokenEmCache;
  }

  /**
   * Executa uma consulta DAX no endpoint oficial do Fabric e retorna as linhas limpas.
   */
  public async executarConsultaDax(queryDax: string): Promise<readonly Record<string, unknown>[]> {
    if (!this.possuiConfiguracaoAtiva()) {
      throw new Error(
        "[Cliente DAX] Impossível executar DAX: variáveis de ambiente do Power BI Fabric não configuradas."
      );
    }

    const token = await this.obterTokenAcesso();
    const url = `https://api.powerbi.com/v1.0/myorg/groups/${this.workspaceId}/datasets/${this.datasetId}/executeQueries`;

    const payload = {
      queries: [{ query: queryDax }],
      serializerSettings: { includeNulls: true },
    };

    const resposta = await this.fetcher(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resposta.ok) {
      const textoErro = await resposta.text();
      throw new Error(
        `[Cliente DAX] Erro na API REST do Power BI Fabric (HTTP ${resposta.status}): ${textoErro}`
      );
    }

    const dados = (await resposta.json()) as RespostaExecuteQueriesPowerBI;

    if (dados.error) {
      throw new Error(
        `[Cliente DAX] Erro de execução DAX retornado pelo Fabric: ${dados.error.code} - ${dados.error.message}`
      );
    }

    const linhasBrutas = dados.results?.[0]?.tables?.[0]?.rows ?? [];
    return linhasBrutas.map((linha) => normalizarLinhaDax(linha));
  }
}
