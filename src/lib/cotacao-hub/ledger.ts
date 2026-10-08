import { open, mkdir, readFile, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { ConnectorConfig, Ledger } from "./types";

export class FileLedger {
  constructor(private readonly config: ConnectorConfig) {}
  async withLock<T>(fn: (ledger: Ledger, save: () => Promise<void>) => Promise<T>): Promise<T> {
    const file = this.config.storageFile, directory = dirname(file), lock = `${file}.lock`;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    let handle;
    for (let i = 0; i < 100; i++) {
      try { handle = await open(lock, "wx", 0o600); break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    if (!handle) throw new Error("Há outra operação no ledger; tente novamente. Não remova locks de processos ativos.");
    try {
      await handle.writeFile(String(process.pid));
      let data: Ledger;
      try { data = JSON.parse(await readFile(file, "utf8")); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        data = { tenantId: this.config.tenantId, hubTenantId: this.config.hubTenantId,
          sourceSystem: this.config.sourceSystem, applicationId: this.config.applicationId,
          submissions: {}, inbox: {}, drafts: [] };
      }
      for (const key of ["tenantId", "hubTenantId", "sourceSystem", "applicationId"] as const) {
        if (data[key] !== this.config[key]) throw new Error("Ledger pertence a outra conexão.");
      }
      const save = async () => {
        const temporary = `${file}.${randomUUID()}.part`;
        const output = await open(temporary, "wx", 0o600);
        try { await output.writeFile(JSON.stringify(data)); await output.sync(); }
        finally { await output.close(); }
        await rename(temporary, file);
        const dir = await open(directory, "r");
        try { await dir.sync(); } finally { await dir.close(); }
      };
      return await fn(data, save);
    } finally { await handle.close(); await unlink(lock); }
  }
}
