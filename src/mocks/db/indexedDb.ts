const DB_NAME = "ledgerly";
export const DB_VERSION = 20;

export const MOCK_STORES = [
  "users",
  "roles",
  "organizations",
  "departments",
  "teams",
  "expenses",
  "policies",
  "policyEvaluations",
  "budgets",
  "departmentBudgetAllocations",
  "expenseTypeBudgets",
  "teamBudgetAllocations",
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

  5: (database, transaction) => {
    createStoreIfMissing(database, "policyEvaluations");

    const evaluations = transaction.objectStore("policyEvaluations");

    if (!evaluations.indexNames.contains("expenseId")) {
      evaluations.createIndex("expenseId", "expenseId", { unique: false });
    }
    if (!evaluations.indexNames.contains("organizationId")) {
      evaluations.createIndex("organizationId", "organizationId", { unique: false });
    }
    if (!evaluations.indexNames.contains("policyId")) {
      evaluations.createIndex("policyId", "policyId", { unique: false });
    }
  },

  7: (_database, transaction) => {
    const auditEvents = transaction.objectStore("auditEvents");

    if (!auditEvents.indexNames.contains("organizationId")) {
      auditEvents.createIndex("organizationId", "organizationId", { unique: false });
    }
    if (!auditEvents.indexNames.contains("actorId")) {
      auditEvents.createIndex("actorId", "actorId", { unique: false });
    }
    if (!auditEvents.indexNames.contains("action")) {
      auditEvents.createIndex("action", "action", { unique: false });
    }
    if (!auditEvents.indexNames.contains("entityType")) {
      auditEvents.createIndex("entityType", "entityType", { unique: false });
    }
    if (!auditEvents.indexNames.contains("entityId")) {
      auditEvents.createIndex("entityId", "entityId", { unique: false });
    }
    if (!auditEvents.indexNames.contains("timestamp")) {
      auditEvents.createIndex("timestamp", "timestamp", { unique: false });
    }
  },

  6: (_database, transaction) => {
    const roles = transaction.objectStore("roles");
    const roleUpdates: Record<string, string[]> = {
      manager: [
        "expenses.read",
        "expenses.create",
        "expenses.update",
        "expenses.submit",
        "expenses.approve",
        "expenses.reject",
      ],
      finance: [
        "expenses.read",
        "reimbursements.manage",
        "budgets.read",
        "budgets.create",
        "budgets.update",
        "analytics.read",
      ],
      admin: [
        "expenses.read",
        "expenses.create",
        "expenses.update",
        "expenses.submit",
        "users.read",
        "users.create",
        "users.update",
        "users.delete",
        "roles.read",
        "roles.create",
        "roles.update",
        "roles.delete",
        "policies.read",
        "policies.create",
        "policies.update",
        "policies.delete",
        "budgets.read",
        "budgets.create",
        "budgets.update",
        "analytics.read",
        "audit.read",
      ],
    };

    const request = roles.getAll();
    request.onsuccess = () => {
      for (const role of request.result as Array<{
        id: string;
        name: string;
        permissions: string[];
      }>) {
        const permissions = roleUpdates[role.name];

        if (!permissions) {
          continue;
        }

        roles.put({
          ...role,
          permissions,
          updatedAt: new Date().toISOString(),
        });
      }
    };
  },



  8: (_database, transaction) => {
    const roles = transaction.objectStore("roles");
    const request = roles.getAll();
    const adminPermissions = [
      "expenses.read", "expenses.create", "expenses.update", "expenses.submit", "expenses.approve", "expenses.reject", "expenses.delete",
      "users.read", "users.create", "users.update", "users.delete",
      "roles.read", "roles.create", "roles.update", "roles.delete",
      "policies.read", "policies.create", "policies.update", "policies.delete",
      "budgets.read", "budgets.create", "budgets.update", "budgets.delete",
      "analytics.read", "audit.read", "reimbursements.manage",
      "departments.read", "departments.manage", "teams.read", "teams.manage",
      "documents.read", "documents.create", "documents.update", "documents.delete",
      "organization.read", "organization.manage",
    ];

    request.onsuccess = () => {
      for (const role of request.result as Array<{ id: string; name: string }>) {
        if (role.name !== "admin") continue;
        roles.put({ ...role, permissions: adminPermissions, updatedAt: new Date().toISOString() });
      }
    };
  },

  9: (database, transaction) => {
    createStoreIfMissing(database, "departmentBudgetAllocations");
    createStoreIfMissing(database, "expenseTypeBudgets");

    const budgets = transaction.objectStore("budgets");
    if (!budgets.indexNames.contains("organizationId")) {
      budgets.createIndex("organizationId", "organizationId", { unique: false });
    }
    if (!budgets.indexNames.contains("status")) {
      budgets.createIndex("status", "status", { unique: false });
    }

    const departmentAllocations = transaction.objectStore("departmentBudgetAllocations");
    if (!departmentAllocations.indexNames.contains("organizationBudgetId")) {
      departmentAllocations.createIndex("organizationBudgetId", "organizationBudgetId", { unique: false });
    }
    if (!departmentAllocations.indexNames.contains("organizationId")) {
      departmentAllocations.createIndex("organizationId", "organizationId", { unique: false });
    }
    if (!departmentAllocations.indexNames.contains("departmentId")) {
      departmentAllocations.createIndex("departmentId", "departmentId", { unique: false });
    }

    const expenseTypeBudgets = transaction.objectStore("expenseTypeBudgets");
    if (!expenseTypeBudgets.indexNames.contains("organizationBudgetId")) {
      expenseTypeBudgets.createIndex("organizationBudgetId", "organizationBudgetId", { unique: false });
    }
    if (!expenseTypeBudgets.indexNames.contains("departmentAllocationId")) {
      expenseTypeBudgets.createIndex("departmentAllocationId", "departmentAllocationId", { unique: false });
    }
    if (!expenseTypeBudgets.indexNames.contains("departmentId")) {
      expenseTypeBudgets.createIndex("departmentId", "departmentId", { unique: false });
    }
    if (!expenseTypeBudgets.indexNames.contains("expenseType")) {
      expenseTypeBudgets.createIndex("expenseType", "expenseType", { unique: false });
    }
  },

  4: (_database, transaction) => {
    const expenses = transaction.objectStore("expenses");

    if (!expenses.indexNames.contains("organizationId")) {
      expenses.createIndex("organizationId", "organizationId", { unique: false });
    }
    if (!expenses.indexNames.contains("employeeId")) {
      expenses.createIndex("employeeId", "employeeId", { unique: false });
    }
    if (!expenses.indexNames.contains("teamId")) {
      expenses.createIndex("teamId", "teamId", { unique: false });
    }
    if (!expenses.indexNames.contains("departmentId")) {
      expenses.createIndex("departmentId", "departmentId", { unique: false });
    }
  },
  11: (_database, transaction) => {
    const roles = transaction.objectStore("roles");
    const request = roles.getAll();
    request.onsuccess = () => {
      for (const role of request.result as Array<{ id: string; name: string; permissions: string[] }>) {
        if (role.name !== "manager" || role.permissions.includes("analytics.read")) continue;
        roles.put({ ...role, permissions: [...role.permissions, "analytics.read"], updatedAt: new Date().toISOString() });
      }
    };
  },

  10: (_database, transaction) => {
    grantDocumentPermissions(transaction);

    const documents = transaction.objectStore("documents");
    if (!documents.indexNames.contains("organizationId")) {
      documents.createIndex("organizationId", "organizationId", { unique: false });
    }
    if (!documents.indexNames.contains("expenseId")) {
      documents.createIndex("expenseId", "expenseId", { unique: false });
    }
    if (!documents.indexNames.contains("uploadedBy")) {
      documents.createIndex("uploadedBy", "uploadedBy", { unique: false });
    }
    if (!documents.indexNames.contains("status")) {
      documents.createIndex("status", "status", { unique: false });
    }
  },

  12: (_database, transaction) => {
    // Databases first created at v10/v11 were seeded after migration 10 ran,
    // so their system roles never received the document permissions.
    grantDocumentPermissions(transaction);
  },

  13: (_database, transaction) => {
    // The seeded Finance user is the only finance user and is authorized for
    // every seeded department; other users keep their own department.
    const users = transaction.objectStore("users");
    const request = users.get("user-3");
    request.onsuccess = () => {
      const user = request.result as { role?: string; financeDepartmentIds?: string[] } | undefined;
      if (!user || user.role !== "finance" || user.financeDepartmentIds?.length) return;
      users.put({
        ...user,
        financeDepartmentIds: ["dept-engineering", "dept-finance", "dept-operations"],
        updatedAt: new Date().toISOString(),
      });
    };
  },

  14: (_database, transaction) => {
    grantWorkflowPermissions(transaction);
  },

  15: (_database, transaction) => {
    // Finance reviews managers' expenses.
    grantWorkflowPermissions(transaction);
  },

  16: (_database, transaction) => {
    // Finance users create and submit their own expenses.
    grantWorkflowPermissions(transaction);
  },

  17: (_database, transaction) => {
    // Admin administers organization structure, users and roles.
    grantWorkflowPermissions(transaction);
  },

  18: (database, transaction) => {
    // Team-level budget allocations; expense-type budgets now sit under teams.
    createStoreIfMissing(database, "teamBudgetAllocations");
    const teamAllocations = transaction.objectStore("teamBudgetAllocations");
    for (const index of ["organizationBudgetId", "departmentAllocationId", "teamId"]) {
      if (!teamAllocations.indexNames.contains(index)) {
        teamAllocations.createIndex(index, index, { unique: false });
      }
    }
    const expenseTypeBudgets = transaction.objectStore("expenseTypeBudgets");
    if (!expenseTypeBudgets.indexNames.contains("teamAllocationId")) {
      expenseTypeBudgets.createIndex("teamAllocationId", "teamAllocationId", { unique: false });
    }
    // Managers see their team's budget.
    grantWorkflowPermissions(transaction);
  },

  19: () => {
    // Intentionally empty. This version once carried a one-time reset of
    // expense data; it has been removed so no data is ever reset again. The
    // version is kept because databases already at 19 cannot downgrade.
  },

  20: (_database, transaction) => {
    // Policy model v2 (§21.4): one approval threshold, rules with Block/Warn
    // enforcement, and department scope. The old maximum amount becomes a
    // blocking rule; allowed departments become the policy's scope; the
    // receipt flag (always enforced), roles, projects and cost centers are
    // dropped.
    const policies = transaction.objectStore("policies");
    const request = policies.getAll();
    request.onsuccess = () => {
      for (const policy of request.result as Array<Record<string, unknown>>) {
        if (policy.rules) continue;
        const rule = (policy.rule ?? {}) as Record<string, unknown>;
        const threshold = typeof rule.approvalThreshold === "number" ? rule.approvalThreshold : policy.approvalLimit;
        const rules: Record<string, unknown> = {};
        if (typeof threshold === "number" && threshold > 0) rules.approvalThreshold = threshold;
        if (typeof rule.maximumAmount === "number" && rule.maximumAmount > 0) {
          rules.maximumAmount = { amount: rule.maximumAmount, enforcement: "BLOCK" };
        }
        const { rule: _rule, approvalLimit: _approvalLimit, ...rest } = policy;
        policies.put({
          ...rest,
          departmentIds: Array.isArray(rule.allowedDepartments) ? rule.allowedDepartments : [],
          rules,
        });
      }
    };
  },
};

function grantWorkflowPermissions(transaction: IDBTransaction): void {
  // Databases seeded by earlier builds (or edited through the Roles page) may
  // lack the permissions the approval and reimbursement workflow requires.
  // Additive only: existing permissions are never removed.
  const roles = transaction.objectStore("roles");
  const required: Record<string, string[]> = {
    finance: [
      "reimbursements.manage",
      "documents.read",
      "documents.create",
      "documents.update",
      "documents.delete",
      "expenses.approve",
      "expenses.reject",
      "expenses.create",
      "expenses.update",
      "expenses.submit",
    ],
    manager: ["expenses.approve", "expenses.reject", "budgets.read"],
    admin: [
      "expenses.approve",
      "expenses.reject",
      "reimbursements.manage",
      "organization.read",
      "organization.manage",
      "departments.read",
      "departments.manage",
      "teams.read",
      "teams.manage",
      "users.read",
      "users.create",
      "users.update",
      "users.delete",
      "roles.read",
      "roles.create",
      "roles.update",
      "roles.delete",
      "audit.read",
    ],
  };
  const request = roles.getAll();
  request.onsuccess = () => {
    for (const role of request.result as Array<{ id: string; name: string; permissions?: string[] }>) {
      const permissions = required[String(role.name).toLowerCase()];
      const current = role.permissions ?? [];
      if (!permissions || permissions.every((permission) => current.includes(permission))) continue;
      roles.put({
        ...role,
        permissions: Array.from(new Set([...current, ...permissions])),
        updatedAt: new Date().toISOString(),
      });
    }
  };
}

function grantDocumentPermissions(transaction: IDBTransaction): void {
  const roles = transaction.objectStore("roles");
  const rolePermissions: Record<string, string[]> = {
    employee: ["documents.read", "documents.create", "documents.update", "documents.delete"],
    manager: ["documents.read", "documents.create", "documents.update", "documents.delete"],
    finance: ["documents.read"],
    admin: ["documents.read", "documents.create", "documents.update", "documents.delete"],
  };
  const roleRequest = roles.getAll();
  roleRequest.onsuccess = () => {
    for (const role of roleRequest.result as Array<{ id: string; name: string; permissions: string[] }>) {
      const documentPermissions = rolePermissions[role.name];
      if (!documentPermissions || documentPermissions.every((permission) => role.permissions.includes(permission))) continue;
      roles.put({
        ...role,
        permissions: Array.from(new Set([...role.permissions, ...documentPermissions])),
        updatedAt: new Date().toISOString(),
      });
    }
  };
}

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

export async function readAllByIndex<T>(
  storeName: MockStoreName,
  indexName: string,
  value: IDBValidKey,
): Promise<T[]> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    if (!store.indexNames.contains(indexName)) {
      reject(new Error(`IndexedDB index ${indexName} is not defined on ${storeName}.`));
      return;
    }

    const request = store.index(indexName).getAll(IDBKeyRange.only(value));
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


export async function runTransaction<T>(
  storeNames: MockStoreName[],
  callback: (transaction: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeNames, "readwrite");
    let callbackResult: T;

    transaction.oncomplete = () => resolve(callbackResult);
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));

    const abort = (error: unknown) => {
      try {
        transaction.abort();
      } catch {
        // The transaction already finished; nothing further to roll back.
      }
      reject(error);
    };

    let callbackPromise: Promise<T>;
    try {
      callbackPromise = Promise.resolve(callback(transaction));
    } catch (error) {
      // A synchronous failure must roll back any writes already queued so the
      // entity change and its audit event are never persisted partially.
      abort(error);
      return;
    }

    callbackPromise.then(
      (result) => {
        callbackResult = result;
      },
      abort,
    );
  });
}
