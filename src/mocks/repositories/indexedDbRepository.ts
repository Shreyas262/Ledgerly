import {
  readAll,
  readAllByIndex,
  readByKey,
  remove,
  runTransaction,
  write,
  type MockStoreName,
} from "../db/indexedDb";

export const indexedDbRepository = {
  getAll<T>(storeName: MockStoreName) {
    return readAll<T>(storeName);
  },

  getAllByIndex<T>(storeName: MockStoreName, indexName: string, value: IDBValidKey) {
    return readAllByIndex<T>(storeName, indexName, value);
  },

  getById<T>(storeName: MockStoreName, id: string) {
    return readByKey<T>(storeName, id);
  },

  save<T extends object>(storeName: MockStoreName, value: T) {
    return write(storeName, value);
  },

  delete(storeName: MockStoreName, id: string) {
    return remove(storeName, id);
  },

  transaction<T>(
    storeNames: MockStoreName[],
    callback: (transaction: IDBTransaction) => Promise<T> | T,
  ) {
    return runTransaction(storeNames, callback);
  },
};
