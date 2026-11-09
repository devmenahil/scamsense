/**
 * TEST-ONLY in-memory stand-in for the parts of the Supabase client the Step 8 services use: chained
 * select/eq/order/returns/maybeSingle reads, upsert with ignoreDuplicates, and rpc handlers. Never imported by app code.
 */
type Row = Record<string, unknown>;

export interface FakeDb {
  tables: Record<string, Row[]>;
  rpc: Record<
    string,
    (args: Record<string, unknown>) => { data?: unknown; error?: { code?: string; message: string } }
  >;
  calls: { rpc: string[]; upserts: string[] };
}

export function createFakeDb(): FakeDb {
  return { tables: {}, rpc: {}, calls: { rpc: [], upserts: [] } };
}

class Query implements PromiseLike<{ data: unknown; error: null }> {
  private filters: [string, unknown][] = [];
  constructor(
    private db: FakeDb,
    private table: string,
  ) {}
  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push([col, val]);
    return this;
  }
  order() {
    return this;
  }
  returns() {
    return this;
  }
  private rows() {
    return (this.db.tables[this.table] ?? []).filter((r) => this.filters.every(([c, v]) => r[c] === v));
  }
  async maybeSingle() {
    return { data: this.rows()[0] ?? null, error: null };
  }
  then<T1 = { data: unknown; error: null }, T2 = never>(
    ok?: ((v: { data: unknown; error: null }) => T1 | PromiseLike<T1>) | null,
    fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve({ data: this.rows(), error: null }).then(ok, fail);
  }
}

export function fakeClient(db: FakeDb) {
  return {
    from(table: string) {
      const q = new Query(db, table);
      return Object.assign(q, {
        async upsert(row: Row, opts: { onConflict: string; ignoreDuplicates?: boolean }) {
          db.calls.upserts.push(table);
          const keys = opts.onConflict.split(",");
          const list = (db.tables[table] ??= []);
          const existing = list.find((r) => keys.every((k) => r[k] === row[k]));
          if (!existing) list.push({ ...row });
          return { error: null };
        },
      });
    },
    async rpc(name: string, args: Record<string, unknown>) {
      db.calls.rpc.push(name);
      const h = db.rpc[name];
      if (!h) return { data: null, error: { code: "P0001", message: `no handler ${name}` } };
      const r = h(args);
      return { data: r.data ?? null, error: r.error ?? null };
    },
  };
}
