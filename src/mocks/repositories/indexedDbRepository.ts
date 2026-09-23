import {
  readAll,
  readByKey,
  remove,
  write,
  type MockStoreName,
} from "../db/indexedDb";

export const indexedDbRepository = {
  getAll<T>(storeName: MockStoreName) {
    return readAll<T>(storeName);
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
};
