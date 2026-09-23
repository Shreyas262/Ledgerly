import { closeDatabase, DB_NAME } from "./indexedDb";

export async function resetMockDatabase(): Promise<void> {
  if (!import.meta.env.DEV) {
    throw new Error(
      "Mock database reset is available only in development mode.",
    );
  }

  await closeDatabase();

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      reject(
        new Error(
          "IndexedDB reset is blocked because another database connection is open.",
        ),
      );
    };
  });
}
