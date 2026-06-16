const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
const DB = '(default)';
const DOC_PATH = `projects/${PROJECT_ID}/databases/${DB}/documents`;
const API_BASE = `https://firestore.googleapis.com/v1/${DOC_PATH}`;
const COMMIT_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DB}/documents:commit`;
const BEGIN_TX_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DB}/documents:beginTransaction`;
const QUERY_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DB}/documents:runQuery`;

// ── Value serialization ──────────────────────────────────────────────────────

type FV = Record<string, unknown>;

function toValue(v: unknown): FV {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v as Record<string, unknown>) } };
  return { nullValue: null };
}

function toFields(obj: Record<string, unknown>): Record<string, FV> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toValue(v)]));
}

function fromValue(v: FV): unknown {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return { seconds: Math.floor(new Date(v.timestampValue as string).getTime() / 1000) };
  if ('arrayValue' in v) return ((v.arrayValue as { values?: FV[] }).values ?? []).map(fromValue);
  if ('mapValue' in v) return fromFields((v.mapValue as { fields?: Record<string, FV> }).fields ?? {});
  return null;
}

function fromFields(fields: Record<string, FV>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromValue(v)]));
}

function parseDoc(raw: { name: string; fields?: Record<string, FV> }): FsDoc {
  const id = raw.name.split('/').pop()!;
  return { _id: id, ...fromFields(raw.fields ?? {}) };
}

// ── HTTP helper ──────────────────────────────────────────────────────────────

async function call<T>(method: string, url: string, token: string | null, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Firestore ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json() as T;
}

// ── Public types ─────────────────────────────────────────────────────────────

export type FsDoc = Record<string, unknown> & { _id: string };

export type WriteOp =
  | { type: 'set'; path: string; data: Record<string, unknown> }
  | { type: 'update'; path: string; data: Record<string, unknown> }
  | { type: 'increment'; path: string; field: string; delta: number }
  | { type: 'add'; collection: string; id: string; data: Record<string, unknown> };

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function fsGet(path: string, token: string | null): Promise<FsDoc | null> {
  try {
    const doc = await call<{ name: string; fields?: Record<string, FV> }>('GET', `${API_BASE}/${path}`, token);
    return parseDoc(doc);
  } catch {
    return null;
  }
}

export async function fsSet(path: string, data: Record<string, unknown>, token: string): Promise<void> {
  await call('PATCH', `${API_BASE}/${path}`, token, { fields: toFields(data) });
}

export async function fsUpdate(path: string, data: Record<string, unknown>, token: string): Promise<void> {
  const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  await call('PATCH', `${API_BASE}/${path}?${mask}`, token, { fields: toFields(data) });
}

export async function fsQuery(
  collection: string,
  filters: Array<{ field: string; op: string; value: unknown }>,
  token: string | null,
  limitN?: number,
  orderBy?: { field: string; dir?: 'ASCENDING' | 'DESCENDING' }
): Promise<FsDoc[]> {
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: collection }],
  };
  if (filters.length > 0) {
    structuredQuery.where = {
      compositeFilter: {
        op: 'AND',
        filters: filters.map(f => ({
          fieldFilter: {
            field: { fieldPath: f.field },
            op: f.op,
            value: toValue(f.value),
          },
        })),
      },
    };
  }
  if (limitN) structuredQuery.limit = limitN;
  if (orderBy) structuredQuery.orderBy = [{ field: { fieldPath: orderBy.field }, direction: orderBy.dir ?? 'ASCENDING' }];

  const results = await call<Array<{ document?: { name: string; fields?: Record<string, FV> } }>>(
    'POST', QUERY_URL, token, { structuredQuery }
  );
  return results.filter(r => r.document).map(r => parseDoc(r.document!));
}

// ── Batch write ───────────────────────────────────────────────────────────────

function opToWrite(op: WriteOp): unknown {
  if (op.type === 'set') {
    return { update: { name: `${DOC_PATH}/${op.path}`, fields: toFields(op.data) } };
  }
  if (op.type === 'update') {
    return {
      update: { name: `${DOC_PATH}/${op.path}`, fields: toFields(op.data) },
      updateMask: { fieldPaths: Object.keys(op.data) },
    };
  }
  if (op.type === 'increment') {
    return {
      transform: {
        document: `${DOC_PATH}/${op.path}`,
        fieldTransforms: [{ fieldPath: op.field, increment: toValue(op.delta) }],
      },
    };
  }
  if (op.type === 'add') {
    return { update: { name: `${DOC_PATH}/${op.collection}/${op.id}`, fields: toFields(op.data) } };
  }
}

export async function fsBatch(ops: WriteOp[], token: string): Promise<void> {
  await call('POST', COMMIT_URL, token, { writes: ops.map(opToWrite) });
}

// ── Transaction ───────────────────────────────────────────────────────────────

export async function fsBeginTransaction(token: string): Promise<string> {
  const res = await call<{ transaction: string }>('POST', BEGIN_TX_URL, token, { options: { readWrite: {} } });
  return res.transaction;
}

export async function fsGetInTx(path: string, txId: string, token: string): Promise<FsDoc | null> {
  try {
    const doc = await call<{ name: string; fields?: Record<string, FV> }>(
      'GET', `${API_BASE}/${path}?transaction=${encodeURIComponent(txId)}`, token
    );
    return parseDoc(doc);
  } catch {
    return null;
  }
}

export async function fsQueryInTx(
  collection: string,
  filters: Array<{ field: string; op: string; value: unknown }>,
  txId: string,
  token: string,
  limitN?: number
): Promise<FsDoc[]> {
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: collection }],
    where: {
      compositeFilter: {
        op: 'AND',
        filters: filters.map(f => ({
          fieldFilter: {
            field: { fieldPath: f.field },
            op: f.op,
            value: toValue(f.value),
          },
        })),
      },
    },
  };
  if (limitN) structuredQuery.limit = limitN;

  const results = await call<Array<{ document?: { name: string; fields?: Record<string, FV> } }>>(
    'POST', QUERY_URL, token, { structuredQuery, transaction: txId }
  );
  return results.filter(r => r.document).map(r => parseDoc(r.document!));
}

export async function fsCommit(ops: WriteOp[], txId: string, token: string): Promise<void> {
  await call('POST', COMMIT_URL, token, { transaction: txId, writes: ops.map(opToWrite) });
}
