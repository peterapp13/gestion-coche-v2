// IndexedDB Setup
const DB_NAME = 'VehiculoDB';
const DB_VERSION = 2; // Incremented version for new collection
let db;

// Initialize Database
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            
            // Create object stores
            if (!db.objectStoreNames.contains('vehiculos')) {
                db.createObjectStore('vehiculos', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('repostajes')) {
                db.createObjectStore('repostajes', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('almacen')) {
                db.createObjectStore('almacen', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('taller')) {
                db.createObjectStore('taller', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// Generic CRUD Operations
function addRecord(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(data);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getAllRecords(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function updateRecord(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function deleteRecord(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function getRecord(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Clear all data
function clearAllData() {
    return new Promise(async (resolve, reject) => {
        try {
            const stores = ['vehiculos', 'repostajes', 'almacen', 'taller'];
            for (const storeName of stores) {
                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                await new Promise((res, rej) => {
                    const request = store.clear();
                    request.onsuccess = () => res();
                    request.onerror = () => rej(request.error);
                });
            }
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}