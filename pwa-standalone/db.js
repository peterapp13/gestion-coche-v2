// IndexedDB Setup
const DB_NAME = 'VehiculoDB';
const DB_VERSION = 3; // Incremented for otros_gastos collection
let db;

// Master Database File Name
const MASTER_DB_FILENAME = 'gestion_coche_db.json';

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
            // NEW: Otros Gastos collection
            if (!db.objectStoreNames.contains('otros_gastos')) {
                db.createObjectStore('otros_gastos', { keyPath: 'id', autoIncrement: true });
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
        // Check if store exists
        if (!db.objectStoreNames.contains(storeName)) {
            resolve([]);
            return;
        }
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
            const stores = ['vehiculos', 'repostajes', 'almacen', 'taller', 'otros_gastos'];
            for (const storeName of stores) {
                if (db.objectStoreNames.contains(storeName)) {
                    const transaction = db.transaction([storeName], 'readwrite');
                    const store = transaction.objectStore(storeName);
                    await new Promise((res, rej) => {
                        const request = store.clear();
                        request.onsuccess = () => res();
                        request.onerror = () => rej(request.error);
                    });
                }
            }
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

// ===== MASTER DATABASE EXPORT/IMPORT =====

// Get all data as a unified JSON structure
async function getMasterDatabaseJSON() {
    const vehiculos = await getAllRecords('vehiculos');
    const repostajes = await getAllRecords('repostajes');
    const almacen = await getAllRecords('almacen');
    const taller = await getAllRecords('taller');
    const otros_gastos = await getAllRecords('otros_gastos');
    
    return {
        version: '3.0',
        exportDate: new Date().toISOString(),
        appName: 'Mi Garaje - Gestión de Vehículos',
        data: {
            vehiculos,
            repostajes,
            almacen,
            taller,
            otros_gastos
        },
        metadata: {
            vehiculosCount: vehiculos.length,
            repostajesCount: repostajes.length,
            almacenCount: almacen.length,
            tallerCount: taller.length,
            otrosGastosCount: otros_gastos.length,
            totalRecords: vehiculos.length + repostajes.length + almacen.length + taller.length + otros_gastos.length
        }
    };
}

// Export database to JSON file (for iCloud save)
async function exportMasterDatabase() {
    try {
        const masterDB = await getMasterDatabaseJSON();
        const jsonString = JSON.stringify(masterDB, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        // Try File System Access API first (better for iOS Files app)
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: MASTER_DB_FILENAME,
                    types: [{
                        description: 'JSON Database',
                        accept: { 'application/json': ['.json'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                return { success: true, method: 'FilePicker' };
            } catch (err) {
                if (err.name === 'AbortError') {
                    return { success: false, cancelled: true };
                }
                // Fall through to download method
            }
        }
        
        // Fallback: Standard download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = MASTER_DB_FILENAME;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return { success: true, method: 'Download' };
    } catch (error) {
        console.error('Export error:', error);
        return { success: false, error: error.message };
    }
}

// Import database from JSON file
async function importMasterDatabase(mergeMode = 'merge') {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        
        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) {
                resolve({ success: false, cancelled: true });
                return;
            }
            
            try {
                const text = await file.text();
                const importedDB = JSON.parse(text);
                
                // Validate structure
                if (!importedDB.data || !importedDB.version) {
                    throw new Error('Archivo JSON no válido. Asegúrate de usar un archivo exportado por Mi Garaje.');
                }
                
                const result = await processDatabaseImport(importedDB, mergeMode);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        };
        
        input.oncancel = () => {
            resolve({ success: false, cancelled: true });
        };
        
        input.click();
    });
}

// Process the imported database
async function processDatabaseImport(importedDB, mergeMode) {
    const stores = ['vehiculos', 'repostajes', 'almacen', 'taller', 'otros_gastos'];
    const stats = { added: 0, updated: 0, skipped: 0 };
    
    if (mergeMode === 'overwrite') {
        // Clear all existing data
        await clearAllData();
        
        // Insert all imported data
        for (const storeName of stores) {
            const records = importedDB.data[storeName] || [];
            for (const record of records) {
                // Remove ID to let IndexedDB auto-generate
                const { id, ...recordWithoutId } = record;
                await addRecord(storeName, recordWithoutId);
                stats.added++;
            }
        }
    } else {
        // Merge mode - avoid duplicates
        for (const storeName of stores) {
            const existingRecords = await getAllRecords(storeName);
            const importedRecords = importedDB.data[storeName] || [];
            
            for (const importedRecord of importedRecords) {
                const isDuplicate = checkForDuplicate(storeName, importedRecord, existingRecords);
                
                if (!isDuplicate) {
                    const { id, ...recordWithoutId } = importedRecord;
                    await addRecord(storeName, recordWithoutId);
                    stats.added++;
                } else {
                    stats.skipped++;
                }
            }
        }
    }
    
    return {
        success: true,
        stats,
        importedFrom: importedDB.exportDate,
        totalRecords: importedDB.metadata?.totalRecords || 0
    };
}

// Check if a record already exists (to avoid duplicates during merge)
function checkForDuplicate(storeName, importedRecord, existingRecords) {
    switch (storeName) {
        case 'vehiculos':
            // Check by matricula (unique identifier)
            return existingRecords.some(r => r.matricula === importedRecord.matricula);
        
        case 'repostajes':
            // Check by matricula + fecha + km_actuales
            return existingRecords.some(r => 
                r.matricula === importedRecord.matricula &&
                r.fecha === importedRecord.fecha &&
                r.km_actuales === importedRecord.km_actuales
            );
        
        case 'almacen':
            // Check by matricula + fecha_compra + recambio + marca
            return existingRecords.some(r => 
                r.matricula === importedRecord.matricula &&
                r.fecha_compra === importedRecord.fecha_compra &&
                r.recambio === importedRecord.recambio &&
                r.marca === importedRecord.marca
            );
        
        case 'taller':
            // Check by matricula + fecha_montaje + km_montaje
            return existingRecords.some(r => 
                r.matricula === importedRecord.matricula &&
                r.fecha_montaje === importedRecord.fecha_montaje &&
                r.km_montaje === importedRecord.km_montaje
            );
        
        case 'otros_gastos':
            // Check by matricula + fecha + categoria + importe
            return existingRecords.some(r => 
                r.matricula === importedRecord.matricula &&
                r.fecha === importedRecord.fecha &&
                r.categoria === importedRecord.categoria &&
                r.importe === importedRecord.importe
            );
        
        default:
            return false;
    }
}

// Check if database has any data
async function hasAnyData() {
    const vehiculos = await getAllRecords('vehiculos');
    return vehiculos.length > 0;
}
