import {
  readAll,
  type MockStoreName,
} from "../db/indexedDb";
import { indexedDbRepository } from "../repositories/indexedDbRepository";
import {
  bootstrapCredentials,
  bootstrapDepartments,
  bootstrapOrganizations,
  bootstrapRoles,
  bootstrapTeams,
  bootstrapUsers,
} from "../data/bootstrap";
import { hashPassword } from "./passwordService";

let initializationPromise: Promise<void> | null = null;

async function seedIfEmpty<T extends object>(
  storeName: MockStoreName,
  records: T[],
): Promise<void> {
  const existing = await readAll<T>(storeName);

  if (existing.length > 0) {
    return;
  }

  for (const record of records) {
    await indexedDbRepository.save(storeName, record);
  }
}

async function migrateUserOrganizationContext(): Promise<void> {
  const users = await indexedDbRepository.getAll<Record<string, unknown>>("users");
  const roleByName = new Map<string, string>(
    bootstrapRoles.map((role) => [String(role.name), role.id]),
  );
  const defaultsByUserId: Record<
    string,
    { departmentId: string; teamId: string }
  > = {
    "user-1": {
      departmentId: "dept-engineering",
      teamId: "team-engineering",
    },
    "user-2": {
      departmentId: "dept-engineering",
      teamId: "team-engineering",
    },
    "user-3": {
      departmentId: "dept-finance",
      teamId: "team-finance",
    },
    "user-4": {
      departmentId: "dept-operations",
      teamId: "team-operations",
    },
  };

  for (const user of users) {
    const defaults = defaultsByUserId[String(user.id)];
    const roleId =
      typeof user.roleId === "string"
        ? user.roleId
        : roleByName.get(String(user.role));

    if (!defaults && typeof user.departmentId === "string" && typeof user.teamId === "string" && typeof roleId === "string") {
      continue;
    }

    if (typeof user.organizationId !== "string") {
      user.organizationId = "org-1";
    }

    if (typeof user.departmentId !== "string") {
      user.departmentId = defaults?.departmentId ?? "dept-operations";
    }

    if (typeof user.teamId !== "string") {
      user.teamId = defaults?.teamId ?? "team-operations";
    }

    if (typeof roleId === "string") {
      user.roleId = roleId;
    }

    await indexedDbRepository.save("users", user);
  }
}


async function seedCredentials(): Promise<void> {
  const existing = await readAll<{ userId: string }>("credentials");
  if (existing.length > 0) {
    return;
  }

  for (const credential of bootstrapCredentials) {
    await indexedDbRepository.save("credentials", {
      ...credential,
      password: await hashPassword(credential.password),
    });
  }
}

export function initializeMockDatabase(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = Promise.all([
      seedIfEmpty("organizations", [...bootstrapOrganizations]),
      seedIfEmpty("departments", [...bootstrapDepartments]),
      seedIfEmpty("teams", [...bootstrapTeams]),
      seedIfEmpty("users", [...bootstrapUsers]),
      seedIfEmpty("roles", [...bootstrapRoles]),
      seedCredentials(),
    ])
      .then(() => migrateUserOrganizationContext())
      .then(() => undefined);
  }

  return initializationPromise;
}

export async function listRecords<T>(
  storeName: MockStoreName,
): Promise<T[]> {
  await initializeMockDatabase();
  return indexedDbRepository.getAll<T>(storeName);
}

export async function listRecordsByIndex<T>(
  storeName: MockStoreName,
  indexName: string,
  value: IDBValidKey,
): Promise<T[]> {
  await initializeMockDatabase();
  return indexedDbRepository.getAllByIndex<T>(storeName, indexName, value);
}

export async function getRecord<T>(
  storeName: MockStoreName,
  id: string,
): Promise<T | undefined> {
  await initializeMockDatabase();
  return indexedDbRepository.getById<T>(storeName, id);
}

export async function saveRecord<T extends object>(
  storeName: MockStoreName,
  record: T,
): Promise<T> {
  await initializeMockDatabase();
  return indexedDbRepository.save(storeName, record);
}

