// ==========================================
// OFFLINE SYNC SERVICE - IndexedDB Manager
// ==========================================

const DB_NAME = 'BatteryPOS_Offline';
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result;
      
      // Offline sales queue
      if (!database.objectStoreNames.contains('offline_sales')) {
        const store = database.createObjectStore('offline_sales', { keyPath: 'local_id', autoIncrement: true });
        store.createIndex('synced', 'synced', { unique: false });
      }

      // Products cache
      if (!database.objectStoreNames.contains('products_cache')) {
        database.createObjectStore('products_cache', { keyPath: 'id' });
      }

      // Company config cache
      if (!database.objectStoreNames.contains('config_cache')) {
        database.createObjectStore('config_cache', { keyPath: 'key' });
      }
    };

    request.onsuccess = (e) => {
      db = (e.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onerror = () => reject(request.error);
  });
}

// Save a sale offline
export async function saveOfflineSale(saleData: any): Promise<number> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('offline_sales', 'readwrite');
    const store = tx.objectStore('offline_sales');
    const record = {
      ...saleData,
      synced: false,
      offline_timestamp: new Date().toISOString(),
      offline_invoice: `OFF-${Date.now()}`
    };
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

// Get all unsynced sales
export async function getUnsyncedSales(): Promise<any[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('offline_sales', 'readonly');
    const store = tx.objectStore('offline_sales');
    const index = store.index('synced');
    const req = index.getAll(IDBKeyRange.only(false));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Mark sale as synced
export async function markSaleSynced(localId: number): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('offline_sales', 'readwrite');
    const store = tx.objectStore('offline_sales');
    const getReq = store.get(localId);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record.synced = true;
        store.put(record);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// Cache products
export async function cacheProducts(products: any[]): Promise<void> {
  const database = await initDB();
  const tx = database.transaction('products_cache', 'readwrite');
  const store = tx.objectStore('products_cache');
  store.clear();
  products.forEach(p => store.put(p));
}

// Get cached products
export async function getCachedProducts(): Promise<any[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('products_cache', 'readonly');
    const store = tx.objectStore('products_cache');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Cache config
export async function cacheConfig(key: string, value: any): Promise<void> {
  const database = await initDB();
  const tx = database.transaction('config_cache', 'readwrite');
  const store = tx.objectStore('config_cache');
  store.put({ key, value, cached_at: new Date().toISOString() });
}

// Get cached config
export async function getCachedConfig(key: string): Promise<any> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('config_cache', 'readonly');
    const store = tx.objectStore('config_cache');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result?.value);
    req.onerror = () => reject(req.error);
  });
}
