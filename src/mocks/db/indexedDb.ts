const DB_NAME = "ledgerly";
export const DB_VERSION = 3;

export const MOCK_STORES = [
  "users",
  "roles",
  "organizations",
  "departments",
  "teams",
  "expenses",
  "policies",
  "budgets",
  "documents",
  "auditEvents",
  "sessions",
  "credentials",
] as const;

export type MockStoreName = (typeof MOCK_STORES)[number];

type Migration = (
  database: IDBDatabase,
  transaction: IDBTransaction,
) => void;

let databasePromise: Promise<IDBDatabase> | null = null;

function createStoreIfMissing(
  database: IDBDatabase,
  storeName: MockStoreName,
): void {
  if (database.objectStoreNames.contains(storeName)) {
    return;
  }

  database.createObjectStore(storeName, {
    keyPath: storeName === "credentials" ? "userId" : "id",
  });
}

const migrations: Record<number, Migration> = {
  1: (database) => {
    for (const storeName of MOCK_STORES) {
      createStoreIfMissing(database, storeName);
    }
  },

  2: (database) => {
    // Preserve the existing schema while establishing the explicit
    // migration boundary for future non-destructive schema changes.
    for (const storeName of MOCK_STORES) {
      createStoreIfMissing(database, storeName);
    }
  },

  3: (database, transaction) => {
    for (const storeName of MOCK_STORES) {
      createStoreIfMissing(database, storeName);
    }

    const users = transaction.objectStore("users");
    const roles = transaction.objectStore("roles");
    const departments = transaction.objectStore("departments");
    const teams = transaction.objectStore("teams");

    if (!users.indexNames.contains("organizationId")) {
      users.createIndex("organizationId", "organizationId", { unique: false });
    }
    if (!users.indexNames.contains("departmentId")) {
      users.createIndex("departmentId", "departmentId", { unique: false });
    }
    if (!users.indexNames.contains("teamId")) {
      users.createIndex("teamId", "teamId", { unique: false });
    }
    if (!users.indexNames.contains("roleId")) {
      users.createIndex("roleId", "roleId", { unique: false });
    }
    if (!roles.indexNames.contains("organizationId")) {
      roles.createIndex("organizationId", "organizationId", { unique: false });
    }
    if (!departments.indexNames.contains("organizationId")) {
      departments.createIndex("organizationId", "organizationId", { unique: false });
    }
    if (!teams.indexNames.contains("organizationId")) {
      teams.createIndex("organizationId", "organizationId", { unique: false });
    }
    if (!teams.indexNames.contains("departmentId")) {
      teams.createIndex("departmentId", "departmentId", { unique: false });
    }
  },
};

function runMigrations(
  database: IDBDatabase,
  transaction: IDBTransaction,
  oldVersion: number,
  newVersion: number,
): void {
  for (let version = oldVersion + 1; version <= newVersion; version += 1) {
    const migration = migrations[version];

    if (!migration) {
      throw new Error(
        `Missing IndexedDB migration for version ${version}.`,
      );
    }

    migration(database, transaction);
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = request.result;
      const transaction = request.transaction;

      if (!transaction) {
        reject(new Error("IndexedDB upgrade transaction is unavailable."));
        return;
      }

      try {
        runMigrations(
          database,
          transaction,
          event.oldVersion,
          event.newVersion ?? DB_VERSION,
        );
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  databasePromise.catch(() => {
    databasePromise = null;
  });

  return databasePromise;
}

export async function closeDatabase(): Promise<void> {
  const currentPromise = databasePromise;
  databasePromise = null;

  if (!currentPromise) {
    return;
  }

  const database = await currentPromise;
  database.close();
}

export async function readAll<T>(
  storeName: MockStoreName,
): Promise<T[]> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function readByKey<T>(
  storeName: MockStoreName,
  key: IDBValidKey,
): Promise<T | undefined> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);

    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function write<T extends object>(
  storeName: MockStoreName,
  value: T,
): Promise<T> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const request = transaction.objectStore(storeName).put(value);

    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

export async function remove(
  storeName: MockStoreName,
  key: IDBValidKey,
): Promise<void> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const request = transaction.objectStore(storeName).delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export { DB_NAME };
