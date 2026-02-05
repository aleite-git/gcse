export type FirestoreSeed = Record<string, Record<string, unknown>>;

type IncrementOp = { __op: 'inc'; value: number };

type StoredDoc = Record<string, unknown>;

type Filter = {
  field: string;
  op: '==' | '>=' | '<=' | 'in';
  value: unknown;
};

type OrderBy = { field: string; direction: 'asc' | 'desc' };

export const COLLECTIONS = {
  ACCESS_CODES: 'accessCodes',
  QUESTIONS: 'questions',
  DAILY_ASSIGNMENTS: 'dailyAssignments',
  ATTEMPTS: 'attempts',
  QUESTION_STATS: 'questionStats',
  USER_STREAKS: 'userStreaks',
  STREAK_ACTIVITIES: 'streakActivities',
  MOBILE_USERS: 'mobileUsers',
  USER_PROFILES: 'userProfiles',
  ACCOUNT_DELETION_REQUESTS: 'accountDeletionRequests',
} as const;

function isIncrement(value: unknown): value is IncrementOp {
  return Boolean(value && typeof value === 'object' && (value as IncrementOp).__op === 'inc');
}

function applyUpdate(target: StoredDoc, update: StoredDoc) {
  for (const [key, value] of Object.entries(update)) {
    if (isIncrement(value)) {
      const current = typeof target[key] === 'number' ? (target[key] as number) : 0;
      target[key] = current + value.value;
    } else {
      target[key] = value;
    }
  }
}

function clone<T>(value: T): T {
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  if (value && typeof value === 'object') {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === 'function') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => clone(item)) as T;
    }

    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = clone(item);
    }
    return out as T;
  }

  return value;
}

class DocumentSnapshot {
  constructor(public id: string, private value: StoredDoc | undefined) {}

  get exists() {
    return this.value !== undefined;
  }

  data() {
    return this.value ? clone(this.value) : undefined;
  }
}

class DocumentRef {
  constructor(
    private store: Map<string, Map<string, StoredDoc>>,
    private collectionName: string,
    public id: string
  ) {}

  get ref() {
    return this;
  }

  async get() {
    const collection = this.store.get(this.collectionName);
    const value = collection?.get(this.id);
    return new DocumentSnapshot(this.id, value);
  }

  async set(data: StoredDoc, options?: { merge?: boolean }) {
    const collection = ensureCollection(this.store, this.collectionName);
    if (options?.merge) {
      const existing = collection.get(this.id) ?? {};
      const merged = { ...existing };
      applyUpdate(merged, data);
      collection.set(this.id, merged);
      return;
    }
    collection.set(this.id, { ...data });
  }

  async update(data: StoredDoc) {
    const collection = ensureCollection(this.store, this.collectionName);
    const existing = collection.get(this.id) ?? {};
    const merged = { ...existing };
    applyUpdate(merged, data);
    collection.set(this.id, merged);
  }

  async delete() {
    const collection = ensureCollection(this.store, this.collectionName);
    collection.delete(this.id);
  }
}

class QuerySnapshot {
  constructor(public docs: Array<{ id: string; data: () => StoredDoc; ref: DocumentRef }>) {}

  get empty() {
    return this.docs.length === 0;
  }

  get size() {
    return this.docs.length;
  }

  forEach(cb: (doc: { id: string; data: () => StoredDoc; ref: DocumentRef }) => void) {
    this.docs.forEach(cb);
  }
}

class Query {
  private filters: Filter[] = [];
  private orderBys: OrderBy[] = [];
  private limitCount: number | null = null;

  constructor(
    private store: Map<string, Map<string, StoredDoc>>,
    private collectionName: string
  ) {}

  where(field: string, op: Filter['op'], value: unknown) {
    const next = new Query(this.store, this.collectionName);
    next.filters = [...this.filters, { field, op, value }];
    next.orderBys = [...this.orderBys];
    next.limitCount = this.limitCount;
    return next;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    const next = new Query(this.store, this.collectionName);
    next.filters = [...this.filters];
    next.orderBys = [...this.orderBys, { field, direction }];
    next.limitCount = this.limitCount;
    return next;
  }

  limit(count: number) {
    const next = new Query(this.store, this.collectionName);
    next.filters = [...this.filters];
    next.orderBys = [...this.orderBys];
    next.limitCount = count;
    return next;
  }

  async get() {
    const collection = ensureCollection(this.store, this.collectionName);
    let entries = Array.from(collection.entries());

    for (const filter of this.filters) {
      entries = entries.filter(([id, data]) => {
        const fieldValue = filter.field === '__name__' ? id : data[filter.field];
        switch (filter.op) {
          case '==':
            return fieldValue === filter.value;
          case '>=':
            return fieldValue >= filter.value;
          case '<=':
            return fieldValue <= filter.value;
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(fieldValue);
          default:
            return false;
        }
      });
    }

    if (this.orderBys.length > 0) {
      entries.sort((a, b) => {
        for (const order of this.orderBys) {
          const aValue = order.field === '__name__' ? a[0] : a[1][order.field];
          const bValue = order.field === '__name__' ? b[0] : b[1][order.field];
          if (aValue < bValue) return order.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return order.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    if (this.limitCount !== null) {
      entries = entries.slice(0, this.limitCount);
    }

    const docs = entries.map(([id, data]) => ({
      id,
      data: () => clone(data),
      ref: new DocumentRef(this.store, this.collectionName, id),
    }));

    return new QuerySnapshot(docs);
  }
}

class CollectionRef {
  constructor(
    private store: Map<string, Map<string, StoredDoc>>,
    private collectionName: string,
    private idCounter: { value: number }
  ) {}

  doc(id?: string) {
    const nextId = id ?? `${this.collectionName}-${(this.idCounter.value += 1)}`;
    return new DocumentRef(this.store, this.collectionName, nextId);
  }

  async add(data: StoredDoc) {
    const ref = this.doc();
    await ref.set(data);
    return { id: ref.id };
  }

  where(field: string, op: Filter['op'], value: unknown) {
    return new Query(this.store, this.collectionName).where(field, op, value);
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    return new Query(this.store, this.collectionName).orderBy(field, direction);
  }

  limit(count: number) {
    return new Query(this.store, this.collectionName).limit(count);
  }

  async get() {
    return new Query(this.store, this.collectionName).get();
  }
}

class WriteBatch {
  private ops: Array<{ type: 'set' | 'update' | 'delete'; ref: DocumentRef; data?: StoredDoc; options?: { merge?: boolean } }> = [];

  set(ref: DocumentRef, data: StoredDoc, options?: { merge?: boolean }) {
    this.ops.push({ type: 'set', ref, data, options });
  }

  update(ref: DocumentRef, data: StoredDoc) {
    this.ops.push({ type: 'update', ref, data });
  }

  delete(ref: DocumentRef) {
    this.ops.push({ type: 'delete', ref });
  }

  async commit() {
    for (const op of this.ops) {
      if (op.type === 'set' && op.data) {
        await op.ref.set(op.data, op.options);
      } else if (op.type === 'update' && op.data) {
        await op.ref.update(op.data);
      } else if (op.type === 'delete') {
        await op.ref.delete();
      }
    }
    this.ops = [];
  }
}

function ensureCollection(store: Map<string, Map<string, StoredDoc>>, name: string) {
  if (!store.has(name)) {
    store.set(name, new Map());
  }
  return store.get(name)!;
}

export function createFirestoreMock(seed: FirestoreSeed = {}) {
  const store = new Map<string, Map<string, StoredDoc>>();
  const idCounter = { value: 0 };

  for (const [collectionName, docs] of Object.entries(seed)) {
    const collection = ensureCollection(store, collectionName);
    for (const [id, data] of Object.entries(docs)) {
      collection.set(id, { ...(data as StoredDoc) });
    }
  }

  const db = {
    collection: (name: string) => new CollectionRef(store, name, idCounter),
    batch: () => new WriteBatch(),
  };

  return { db, store };
}

export function makeIncrement(value: number): IncrementOp {
  return { __op: 'inc', value };
}
