import { describe, expect, it } from "vitest";

import { closeDatabase, DB_NAME, DB_VERSION, MOCK_STORES, readAll, readAllByIndex } from "./indexedDb";

const PERSONAL_STORES = ["personalExpenses", "personalBudgets", "personalDocuments"];

function request<T>(open: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

/**
 * Creates the database as a browser on version 19 would hold it: every store
 * except the personal ones, with records in the old policy shape.
 */
async function givenVersion19Database(records: { policies: object[]; users: object[] }): Promise<void> {
  const open = indexedDB.open(DB_NAME, 19);
  open.onupgradeneeded = () => {
    for (const storeName of MOCK_STORES.filter((name) => !PERSONAL_STORES.includes(name))) {
      open.result.createObjectStore(storeName, { keyPath: storeName === "credentials" ? "userId" : "id" });
    }
  };
  const database = await request(open);
  const transaction = database.transaction(["policies", "users"], "readwrite");
  for (const policy of records.policies) transaction.objectStore("policies").put(policy);
  for (const user of records.users) transaction.objectStore("users").put(user);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function openWithoutUpgrade(): Promise<IDBDatabase> {
  await closeDatabase();
  return request(indexedDB.open(DB_NAME));
}

describe("IndexedDB migrations", () => {
  it("creates every store at the current version for a new browser", async () => {
    await readAll("users");

    const database = await openWithoutUpgrade();
    expect(database.version).toBe(DB_VERSION);
    expect([...database.objectStoreNames].sort()).toEqual([...MOCK_STORES].sort());
    database.close();
  });

  it("upgrades a version 19 database without losing existing data", async () => {
    const user = { id: "user-legacy", organizationId: "org-1", name: "Legacy User", email: "legacy@example.com" };
    const migratedPolicy = {
      id: "policy-v2",
      organizationId: "org-1",
      name: "Already migrated",
      departmentIds: [],
      rules: { noFutureDates: { enforcement: "WARN" } },
      status: "active",
    };
    await givenVersion19Database({
      users: [user],
      policies: [
        {
          id: "policy-legacy",
          organizationId: "org-1",
          name: "Travel",
          status: "active",
          approvalLimit: 2_000,
          rule: { maximumAmount: 5_000, allowedDepartments: ["dept-engineering"], requiresReceipt: true },
        },
        {
          id: "policy-threshold",
          organizationId: "org-1",
          name: "Meals",
          status: "active",
          approvalLimit: 2_000,
          rule: { approvalThreshold: 1_500 },
        },
        migratedPolicy,
      ],
    });

    const policies = await readAll<Record<string, unknown>>("policies");

    // §21.4 policy model v2: the old maximum blocks, departments become the scope.
    const legacy = policies.find((policy) => policy.id === "policy-legacy");
    expect(legacy).toMatchObject({
      name: "Travel",
      status: "active",
      departmentIds: ["dept-engineering"],
      rules: { approvalThreshold: 2_000, maximumAmount: { amount: 5_000, enforcement: "BLOCK" } },
    });
    expect(legacy).not.toHaveProperty("rule");
    expect(legacy).not.toHaveProperty("approvalLimit");
    expect(policies.find((policy) => policy.id === "policy-threshold")).toMatchObject({
      departmentIds: [],
      rules: { approvalThreshold: 1_500 },
    });
    expect(policies.find((policy) => policy.id === "policy-v2")).toEqual(migratedPolicy);

    expect(await readAll("users")).toEqual([user]);
    // Version 21 adds the personal stores, read by owner.
    expect(await readAllByIndex("personalExpenses", "ownerId", "user-personal-1")).toEqual([]);

    const database = await openWithoutUpgrade();
    expect(database.version).toBe(DB_VERSION);
    expect([...database.objectStoreNames]).toEqual(expect.arrayContaining(PERSONAL_STORES));
    database.close();
  });
});

describe("IndexedDB connections across tabs", () => {
  it("releases its connection when a newer version opens in another tab", async () => {
    await readAll("users");

    const newer = indexedDB.open(DB_NAME, DB_VERSION + 1);
    const opened = new Promise<IDBDatabase>((resolve, reject) => {
      newer.onsuccess = () => resolve(newer.result);
      newer.onerror = () => reject(newer.error);
      newer.onblocked = () => reject(new Error("The upgrade was blocked."));
    });

    const database = await opened;
    expect(database.version).toBe(DB_VERSION + 1);
    database.close();
  });

  it("fails instead of waiting when an older tab keeps the database open", async () => {
    const olderTab = await request(indexedDB.open(DB_NAME, 1));

    await expect(readAll("users")).rejects.toThrow("The database is in use by another Ledgerly tab.");

    // Once the other tab lets go, the next request opens the upgraded database.
    olderTab.close();
    expect(await readAll("users")).toEqual([]);
  });
});
