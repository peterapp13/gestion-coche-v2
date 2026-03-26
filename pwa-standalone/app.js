// App State
let currentTab = 'repostajes';
let editingId = null;
let activeVehicle = null; // Currently selected vehicle
let statsView = 'anual'; // 'mensual' or 'anual'
let lastSyncTime = null; // Track last sync time
let selectedYear = new Date().getFullYear();

// Chart instances (to destroy before re-creating)
let pieChartInstance = null;
let barChartInstance = null;

// Expense Categories for "Otros Gastos"
const EXPENSE_CATEGORIES = [
    { value: 'seguro', label: 'Seguro', icon: '🛡️', type: 'fixed' },
    { value: 'itv', label: 'ITV', icon: '🔍', type: 'fixed' },
    { value: 'impuesto', label: 'Impuesto Circulación', icon: '📋', type: 'fixed' },
    { value: 'parking', label: 'Parking', icon: '🅿️', type: 'variable' },
    { value: 'peajes', label: 'Peajes', icon: '🛣️', type: 'variable' },
    { value: 'aditivos', label: 'Aditivos', icon: '🧪', type: 'variable' },
    { value: 'otros', label: 'Otros', icon: '📝', type: 'variable' }
];

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    
    // Load active vehicle from localStorage
    const savedVehicle = localStorage.getItem('activeVehicle');
    if (savedVehicle) {
        activeVehicle = savedVehicle;
    }
    
    // Load last sync time
    lastSyncTime = localStorage.getItem('lastSyncTime');
    if (lastSyncTime) {
        updateSyncStatus(new Date(lastSyncTime));
    }
    
    // Check if this is a new device/first launch (no vehicles)
    const hasData = await hasAnyData();
    
    if (!hasData) {
        // Show welcome screen for new devices
        showWelcomeScreen();
    } else {
        await loadVehicles();
        setupNavigation();
        populateYearSelector();
        
        // Only load data if we have an active vehicle
        if (activeVehicle) {
            await loadAllData();
            updateStats();
            loadEstadisticas();
        } else {
            // Show welcome message for other tabs
            showNoVehicleMessage();
        }
    }
});

// ===== SYNC MENU FUNCTIONS =====
function openSyncMenu() {
    const menu = document.getElementById('sync-menu');
    menu.classList.add('show');
}

function closeSyncMenu() {
    const menu = document.getElementById('sync-menu');
    menu.classList.remove('show');
}

// Export database to iCloud
async function exportDatabase() {
    closeSyncMenu();
    
    try {
        // Show loading indicator
        const syncBtn = document.getElementById('sync-btn');
        syncBtn.innerHTML = '⏳';
        
        const result = await exportMasterDatabase();
        
        if (result.success) {
            // Update sync time
            lastSyncTime = new Date().toISOString();
            localStorage.setItem('lastSyncTime', lastSyncTime);
            updateSyncStatus(new Date(lastSyncTime));
            
            alert('✅ Base de datos exportada correctamente.\n\nGuarda el archivo "gestion_coche_db.json" en tu iCloud Drive para sincronizar entre dispositivos.');
        } else if (!result.cancelled) {
            alert('❌ Error al exportar: ' + (result.error || 'Error desconocido'));
        }
        
        syncBtn.innerHTML = '☁️';
    } catch (error) {
        console.error('Export error:', error);
        alert('❌ Error al exportar: ' + error.message);
        document.getElementById('sync-btn').innerHTML = '☁️';
    }
}

// Import database from iCloud
async function importDatabase() {
    closeSyncMenu();
    hideWelcomeScreen();
    
    try {
        // Show merge options modal
        showMergeOptionsModal();
    } catch (error) {
        console.error('Import error:', error);
        alert('❌ Error al importar: ' + error.message);
    }
}

// Show merge options modal
function showMergeOptionsModal() {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
        <h2 class="form-title">📥 Importar Base de Datos</h2>
        <p style="color: #9CA3AF; margin-bottom: 20px;">Selecciona cómo quieres importar los datos:</p>
        
        <div class="merge-options">
            <div class="merge-option selected" data-mode="merge" onclick="selectMergeOption('merge')">
                <div class="merge-option-radio"></div>
                <div class="merge-option-text">
                    <strong>🔄 Fusionar datos</strong>
                    <span>Añade registros nuevos sin duplicar los existentes</span>
                </div>
            </div>
            
            <div class="merge-option" data-mode="overwrite" onclick="selectMergeOption('overwrite')">
                <div class="merge-option-radio"></div>
                <div class="merge-option-text">
                    <strong>🔄 Sobrescribir todo</strong>
                    <span>Reemplaza TODOS los datos locales con el archivo</span>
                </div>
            </div>
        </div>
        
        <div class="form-actions">
            <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
            <button type="button" class="btn-primary" onclick="confirmImport()">Seleccionar archivo</button>
        </div>
    `;
    
    modal.classList.add('show');
}

let selectedMergeMode = 'merge';

function selectMergeOption(mode) {
    selectedMergeMode = mode;
    document.querySelectorAll('.merge-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.mode === mode);
    });
}

async function confirmImport() {
    closeModal();
    
    const syncBtn = document.getElementById('sync-btn');
    syncBtn.innerHTML = '⏳';
    
    try {
        const result = await importMasterDatabase(selectedMergeMode);
        
        if (result.success) {
            // Update sync time
            lastSyncTime = new Date().toISOString();
            localStorage.setItem('lastSyncTime', lastSyncTime);
            updateSyncStatus(new Date(lastSyncTime));
            
            // Reload all data
            await loadVehicles();
            populateYearSelector();
            
            if (activeVehicle) {
                await loadAllData();
                updateStats();
                loadEstadisticas();
            }
            
            let message = '✅ Importación completada.\n\n';
            message += `📊 Registros añadidos: ${result.stats.added}\n`;
            if (selectedMergeMode === 'merge') {
                message += `⏭️ Duplicados omitidos: ${result.stats.skipped}`;
            }
            
            alert(message);
        } else if (!result.cancelled) {
            alert('❌ Error al importar');
        }
        
        syncBtn.innerHTML = '☁️';
    } catch (error) {
        console.error('Import error:', error);
        alert('❌ Error al importar: ' + error.message);
        syncBtn.innerHTML = '☁️';
    }
}

// Update sync status display
function updateSyncStatus(date) {
    const statusEl = document.getElementById('sync-status');
    if (statusEl && date) {
        const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        statusEl.textContent = `Sincronizado: ${time}`;
        statusEl.classList.add('show');
    }
}

// ===== WELCOME SCREEN =====
function showWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.classList.add('show');
    }
}

function hideWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.classList.remove('show');
    }
}

async function startFresh() {
    hideWelcomeScreen();
    
    // Initialize app normally
    await loadVehicles();
    setupNavigation();
    populateYearSelector();
    
    // Switch to Vehículos tab to add first vehicle
    switchTab('vehiculos');
    showNoVehicleMessage();
}

// Navigation
function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
}

function switchTab(tab) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tab);
    });
    
    currentTab = tab;
    
    // Load estadisticas when switching to that tab
    if (tab === 'estadisticas') {
        loadEstadisticas();
    }
}

// Load All Data
async function loadAllData() {
    await loadRepostajes();
    await loadAlmacen();
    await loadTaller();
    await loadOtrosGastos();
}

// ===== REPOSTAJES =====
async function loadRepostajes() {
    // Don't try to load if no active vehicle
    if (!activeVehicle) {
        const container = document.getElementById('repostajes-list');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🚗</div>
                <div class="empty-state-text">No hay vehículo seleccionado</div>
                <div class="empty-state-subtext">Selecciona un vehículo en el menú superior</div>
            </div>
        `;
        return;
    }
    
    const records = await getAllRecords('repostajes');
    // Filter by active vehicle - but allow records without matricula for backward compatibility
    const vehicleRecords = records.filter(r => !r.matricula || r.matricula === activeVehicle);
    vehicleRecords.sort((a, b) => b.km_actuales - a.km_actuales);
    
    // Calculate KM gastados and consumo for each record
    for (let i = 0; i < vehicleRecords.length; i++) {
        if (i < vehicleRecords.length - 1) {
            const current = vehicleRecords[i];
            const previous = vehicleRecords[i + 1];
            const kmGastados = current.km_actuales - previous.km_actuales;
            vehicleRecords[i].km_gastados = kmGastados;
            if (kmGastados > 0) {
                vehicleRecords[i].consumo = ((current.litros / kmGastados) * 100).toFixed(2);
            }
        }
    }
    
    const container = document.getElementById('repostajes-list');
    
    if (vehicleRecords.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⛽</div>
                <div class="empty-state-text">No hay repostajes registrados</div>
                <div class="empty-state-subtext">Toca el botón + para añadir uno</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = vehicleRecords.map(r => `
        <div class="record-card">
            <div class="record-header">
                <div>
                    <div class="record-title">${r.gasolinera}</div>
                    <div class="record-subtitle">Factura: ${r.numero_factura}</div>
                </div>
                <div class="record-actions">
                    <button class="btn-edit" onclick="editRepostaje(${r.id})">✏️</button>
                    <button class="btn-delete" onclick="deleteRepostaje(${r.id})">🗑️</button>
                </div>
            </div>
            <div class="record-body">
                <div class="record-row">
                    <span class="record-label">Fecha:</span>
                    <span class="record-value">${r.fecha}</span>
                </div>
                <div class="record-row">
                    <span class="record-label">KM Actuales:</span>
                    <span class="record-value">${r.km_actuales.toLocaleString()} km</span>
                </div>
                ${r.km_gastados ? `
                <div class="record-row">
                    <span class="record-label">KM Gastados:</span>
                    <span class="record-value highlight">${r.km_gastados} km</span>
                </div>
                ` : ''}
                <div class="record-row">
                    <span class="record-label">Litros:</span>
                    <span class="record-value">${r.litros} L</span>
                </div>
                ${r.consumo ? `
                <div class="record-row">
                    <span class="record-label">Consumo:</span>
                    <span class="record-value highlight">${r.consumo} L/100km</span>
                </div>
                ` : ''}
                <div class="record-row">
                    <span class="record-label">Precio/L:</span>
                    <span class="record-value">${r.precio_litro.toFixed(2)} €</span>
                </div>
                <div class="record-row">
                    <span class="record-label">Total:</span>
                    <span class="record-value" style="color: #4285F4; font-weight: bold;">${r.total_euros.toFixed(2)} €</span>
                </div>
            </div>
        </div>
    `).join('');
}

function showRepostajeForm(id = null) {
    editingId = id;
    const title = id ? 'Editar Repostaje' : 'Nuevo Repostaje';
    
    if (id) {
        getRecord('repostajes', id).then(record => {
            openRepostajeModal(title, record);
        });
    } else {
        openRepostajeModal(title);
    }
}

function openRepostajeModal(title, data = {}) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
        <h2 class="form-title">${title}</h2>
        <form id="repostaje-form" onsubmit="saveRepostaje(event)">
            <div class="form-group">
                <label class="form-label">Nº Factura</label>
                <input type="text" class="form-input" name="numero_factura" value="${data.numero_factura || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Gasolinera</label>
                <input type="text" class="form-input" name="gasolinera" value="${data.gasolinera || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Fecha</label>
                <input type="date" class="form-input" name="fecha" value="${data.fecha || new Date().toISOString().split('T')[0]}" required>
            </div>
            <div class="form-group">
                <label class="form-label">KM Actuales</label>
                <input type="number" class="form-input" name="km_actuales" value="${data.km_actuales || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Autonomía Antes (km)</label>
                <input type="number" class="form-input" name="autonomia_antes" value="${data.autonomia_antes || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Autonomía Después (km)</label>
                <input type="number" class="form-input" name="autonomia_despues" value="${data.autonomia_despues || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Litros</label>
                <input type="number" step="0.01" class="form-input" name="litros" value="${data.litros || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Precio por Litro (€)</label>
                <input type="number" step="0.001" class="form-input" name="precio_litro" value="${data.precio_litro || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Total (€)</label>
                <input type="number" step="0.01" class="form-input" name="total_euros" value="${data.total_euros || ''}" required>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
                <button type="submit" class="btn-primary">Guardar</button>
            </div>
        </form>
    `;
    
    modal.classList.add('show');
}

async function saveRepostaje(event) {
    event.preventDefault();
    
    if (!activeVehicle) {
        alert('Por favor, selecciona un vehículo primero');
        return;
    }
    
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
        matricula: activeVehicle, // BIND TO ACTIVE VEHICLE
        numero_factura: formData.get('numero_factura'),
        gasolinera: formData.get('gasolinera'),
        fecha: formData.get('fecha'),
        km_actuales: parseFloat(formData.get('km_actuales')),
        autonomia_antes: parseFloat(formData.get('autonomia_antes')),
        autonomia_despues: parseFloat(formData.get('autonomia_despues')),
        litros: parseFloat(formData.get('litros')),
        precio_litro: parseFloat(formData.get('precio_litro')),
        total_euros: parseFloat(formData.get('total_euros'))
    };
    
    if (editingId) {
        data.id = editingId;
        await updateRecord('repostajes', data);
    } else {
        await addRecord('repostajes', data);
    }
    
    closeModal();
    await loadRepostajes();
    updateStats();
    loadEstadisticas();
}

async function editRepostaje(id) {
    showRepostajeForm(id);
}

async function deleteRepostaje(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este repostaje?')) {
        await deleteRecord('repostajes', id);
        await loadRepostajes();
        updateStats();
        loadEstadisticas();
    }
}

// ===== ALMACÉN =====
async function loadAlmacen() {
    if (!activeVehicle) {
        const container = document.getElementById('almacen-list');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🚗</div>
                <div class="empty-state-text">No hay vehículo seleccionado</div>
                <div class="empty-state-subtext">Selecciona un vehículo en el menú superior</div>
            </div>
        `;
        return;
    }
    
    const records = await getAllRecords('almacen');
    const vehicleRecords = records.filter(r => r.matricula === activeVehicle);
    vehicleRecords.sort((a, b) => new Date(b.fecha_compra) - new Date(a.fecha_compra));
    
    const container = document.getElementById('almacen-list');
    
    if (vehicleRecords.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <div class="empty-state-text">No hay recambios en almacén</div>
                <div class="empty-state-subtext">Toca el botón + para añadir uno</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = vehicleRecords.map(r => `
        <div class="record-card">
            <div class="record-header">
                <div>
                    <div class="record-title">${r.recambio}</div>
                    <div class="record-subtitle">${r.marca}</div>
                </div>
                <div class="record-actions">
                    <span class="status-badge">
                        <span class="status-dot ${r.estado.toLowerCase().replace(' ', '-').replace('/', '-')}"></span>
                        ${r.estado}
                    </span>
                    <button class="btn-edit" onclick="editAlmacen(${r.id})">✏️</button>
                    <button class="btn-delete" onclick="deleteAlmacen(${r.id})">🗑️</button>
                </div>
            </div>
            <div class="record-body">
                <div class="record-row">
                    <span class="record-label">Fecha de Compra:</span>
                    <span class="record-value">${r.fecha_compra}</span>
                </div>
                <div class="record-row">
                    <span class="record-label">Cantidad:</span>
                    <span class="record-value">${r.cantidad_comprada || 0} unidades</span>
                </div>
                <div class="record-row">
                    <span class="record-label">Coste:</span>
                    <span class="record-value" style="color: #4285F4; font-weight: bold;">${r.coste_euros.toFixed(2)} €</span>
                </div>
            </div>
        </div>
    `).join('');
}

function showAlmacenForm(id = null) {
    editingId = id;
    const title = id ? 'Editar Recambio' : 'Nuevo Recambio';
    
    if (id) {
        getRecord('almacen', id).then(record => {
            openAlmacenModal(title, record);
        });
    } else {
        openAlmacenModal(title);
    }
}

function openAlmacenModal(title, data = {}) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
        <h2 class="form-title">${title}</h2>
        <form id="almacen-form" onsubmit="saveAlmacen(event)">
            <div class="form-group">
                <label class="form-label">Fecha de Compra</label>
                <input type="date" class="form-input" name="fecha_compra" value="${data.fecha_compra || new Date().toISOString().split('T')[0]}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Recambio</label>
                <input type="text" class="form-input" name="recambio" value="${data.recambio || ''}" placeholder="Filtro de aceite, pastillas..." required>
            </div>
            <div class="form-group">
                <label class="form-label">Marca</label>
                <input type="text" class="form-input" name="marca" value="${data.marca || ''}" placeholder="Bosch, Mann, etc." required>
            </div>
            <div class="form-group">
                <label class="form-label">Cantidad Comprada</label>
                <input type="number" min="0" step="1" class="form-input" name="cantidad_comprada" value="${data.cantidad_comprada || 1}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Coste (€)</label>
                <input type="number" step="0.01" class="form-input" name="coste_euros" value="${data.coste_euros || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Estado</label>
                <select class="form-select" name="estado" required>
                    <option value="En Stock" ${!data.estado || data.estado === 'En Stock' ? 'selected' : ''}>En Stock</option>
                    <option value="Agotado/Instalado" ${data.estado === 'Agotado/Instalado' ? 'selected' : ''}>Agotado/Instalado</option>
                    <option value="Servicio" ${data.estado === 'Servicio' ? 'selected' : ''}>Servicio</option>
                </select>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
                <button type="submit" class="btn-primary">Guardar</button>
            </div>
        </form>
    `;
    
    modal.classList.add('show');
}

async function saveAlmacen(event) {
    event.preventDefault();
    
    if (!activeVehicle) {
        alert('Por favor, selecciona un vehículo primero');
        return;
    }
    
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
        matricula: activeVehicle, // BIND TO ACTIVE VEHICLE
        fecha_compra: formData.get('fecha_compra'),
        recambio: formData.get('recambio'),
        marca: formData.get('marca'),
        cantidad_comprada: parseFloat(formData.get('cantidad_comprada')),
        coste_euros: parseFloat(formData.get('coste_euros')),
        estado: formData.get('estado')
    };
    
    if (editingId) {
        data.id = editingId;
        await updateRecord('almacen', data);
    } else {
        await addRecord('almacen', data);
    }
    
    closeModal();
    await loadAlmacen();
    updateStats();
    loadEstadisticas();
}

async function editAlmacen(id) {
    showAlmacenForm(id);
}

async function deleteAlmacen(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este recambio?')) {
        await deleteRecord('almacen', id);
        await loadAlmacen();
        updateStats();
        loadEstadisticas();
    }
}

// ===== TALLER =====
async function loadTaller() {
    if (!activeVehicle) {
        const container = document.getElementById('taller-list');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🚗</div>
                <div class="empty-state-text">No hay vehículo seleccionado</div>
                <div class="empty-state-subtext">Selecciona un vehículo en el menú superior</div>
            </div>
        `;
        return;
    }
    
    const records = await getAllRecords('taller');
    const vehicleRecords = records.filter(r => r.matricula === activeVehicle);
    vehicleRecords.sort((a, b) => b.km_montaje - a.km_montaje);
    
    const container = document.getElementById('taller-list');
    
    if (vehicleRecords.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔧</div>
                <div class="empty-state-text">No hay trabajos registrados</div>
                <div class="empty-state-subtext">Toca el botón + para añadir uno</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = vehicleRecords.map(r => `
        <div class="record-card">
            <div class="record-header">
                <div>
                    <div class="record-title">${r.recambio_instalado}</div>
                    <div class="record-subtitle">Fecha: ${r.fecha_montaje}</div>
                </div>
                <div class="record-actions">
                    <button class="btn-edit" onclick="editTaller(${r.id})">✏️</button>
                    <button class="btn-delete" onclick="deleteTaller(${r.id})">🗑️</button>
                </div>
            </div>
            <div class="record-body">
                <div class="record-row">
                    <span class="record-label">KM de Montaje:</span>
                    <span class="record-value">${r.km_montaje.toLocaleString()} km</span>
                </div>
                ${r.cantidad_usada ? `
                <div class="record-row">
                    <span class="record-label">Cantidad Usada:</span>
                    <span class="record-value">${r.cantidad_usada} unidades</span>
                </div>
                ` : ''}
                ${r.notas ? `
                <div style="margin-top: 12px; padding: 12px; background: #0A0A0A; border-radius: 8px;">
                    <div class="record-label" style="margin-bottom: 4px;">Notas:</div>
                    <div class="record-value">${r.notas}</div>
                </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

async function showTallerForm(id = null) {
    if (!activeVehicle) {
        alert('Por favor, selecciona un vehículo primero');
        return;
    }
    
    editingId = id;
    const title = id ? 'Editar Trabajo' : 'Nuevo Trabajo';
    
    // Get available parts from Almacén FILTERED BY ACTIVE VEHICLE with stock > 0
    const almacenItems = await getAllRecords('almacen');
    const availableParts = almacenItems.filter(item => 
        item.matricula === activeVehicle && 
        item.cantidad_comprada > 0 && 
        item.estado === 'En Stock'
    );
    
    if (id) {
        getRecord('taller', id).then(record => {
            openTallerModal(title, record, availableParts);
        });
    } else {
        openTallerModal(title, {}, availableParts);
    }
}

function openTallerModal(title, data = {}, availableParts = []) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    
    const partsOptions = availableParts.map(part => 
        `<option value="${part.id}" data-max="${part.cantidad_comprada}">${part.recambio} (${part.marca}) - Stock: ${part.cantidad_comprada}</option>`
    ).join('');
    
    modalBody.innerHTML = `
        <h2 class="form-title">${title}</h2>
        <form id="taller-form" onsubmit="saveTaller(event)">
            <div class="form-group">
                <label class="form-label">Fecha de Montaje</label>
                <input type="date" class="form-input" name="fecha_montaje" value="${data.fecha_montaje || new Date().toISOString().split('T')[0]}" required>
            </div>
            <div class="form-group">
                <label class="form-label">KM del Vehículo</label>
                <input type="number" class="form-input" name="km_montaje" value="${data.km_montaje || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Recambio Instalado</label>
                <select class="form-select" name="almacen_id" id="almacen_select" onchange="updateQuantityMax()" ${availableParts.length === 0 ? 'disabled' : ''}>
                    <option value="">-- Selecciona del almacén --</option>
                    ${partsOptions}
                </select>
                ${availableParts.length === 0 ? '<p style="color: #F59E0B; font-size: 14px; margin-top: 8px;">No hay piezas disponibles en stock</p>' : ''}
            </div>
            <div class="form-group">
                <label class="form-label">Cantidad Usada</label>
                <input type="number" min="1" step="1" class="form-input" name="cantidad_usada" id="cantidad_usada" value="${data.cantidad_usada || 1}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Notas Técnicas (Opcional)</label>
                <textarea class="form-textarea" name="notas" placeholder="Detalles del trabajo realizado...">${data.notas || ''}</textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
                <button type="submit" class="btn-primary">Guardar</button>
            </div>
        </form>
    `;
    
    modal.classList.add('show');
}

function updateQuantityMax() {
    const select = document.getElementById('almacen_select');
    const quantityInput = document.getElementById('cantidad_usada');
    
    if (select.value) {
        const selectedOption = select.options[select.selectedIndex];
        const maxQuantity = selectedOption.getAttribute('data-max');
        quantityInput.max = maxQuantity;
    } else {
        quantityInput.removeAttribute('max');
    }
}

async function saveTaller(event) {
    event.preventDefault();
    
    if (!activeVehicle) {
        alert('Por favor, selecciona un vehículo primero');
        return;
    }
    
    const form = event.target;
    const formData = new FormData(form);
    
    const almacenId = formData.get('almacen_id');
    const cantidadUsada = parseFloat(formData.get('cantidad_usada'));
    
    let recambioNombre = '';
    
    if (almacenId) {
        const almacenItem = await getRecord('almacen', parseInt(almacenId));
        
        if (!almacenItem) {
            alert('Error: No se encontró el recambio seleccionado');
            return;
        }
        
        if (almacenItem.cantidad_comprada < cantidadUsada) {
            alert(`Error: No hay suficiente stock. Disponible: ${almacenItem.cantidad_comprada}, Solicitado: ${cantidadUsada}`);
            return;
        }
        
        recambioNombre = `${almacenItem.recambio} (${almacenItem.marca})`;
        
        // Subtract quantity from almacén
        almacenItem.cantidad_comprada -= cantidadUsada;
        
        // Update status if quantity reaches zero
        if (almacenItem.cantidad_comprada <= 0) {
            almacenItem.cantidad_comprada = 0;
            almacenItem.estado = 'Agotado/Instalado';
        }
        
        await updateRecord('almacen', almacenItem);
    } else {
        alert('Debes seleccionar un recambio del almacén');
        return;
    }
    
    const data = {
        matricula: activeVehicle, // BIND TO ACTIVE VEHICLE
        fecha_montaje: formData.get('fecha_montaje'),
        km_montaje: parseFloat(formData.get('km_montaje')),
        recambio_instalado: recambioNombre,
        almacen_id: almacenId ? parseInt(almacenId) : null,
        cantidad_usada: cantidadUsada,
        notas: formData.get('notas') || ''
    };
    
    if (editingId) {
        data.id = editingId;
        await updateRecord('taller', data);
    } else {
        await addRecord('taller', data);
    }
    
    closeModal();
    await loadTaller();
    await loadAlmacen(); // Reload almacén to show updated quantities
    updateStats();
    loadEstadisticas();
}

async function editTaller(id) {
    await showTallerForm(id);
}

async function deleteTaller(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este trabajo?')) {
        await deleteRecord('taller', id);
        await loadTaller();
        updateStats();
        loadEstadisticas();
    }
}

// ===== OTROS GASTOS (NEW MODULE) =====
async function loadOtrosGastos() {
    if (!activeVehicle) {
        const container = document.getElementById('otros-list');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🚗</div>
                <div class="empty-state-text">No hay vehículo seleccionado</div>
                <div class="empty-state-subtext">Selecciona un vehículo en el menú superior</div>
            </div>
        `;
        return;
    }
    
    const records = await getAllRecords('otros_gastos');
    const vehicleRecords = records.filter(r => r.matricula === activeVehicle);
    vehicleRecords.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    const container = document.getElementById('otros-list');
    
    if (vehicleRecords.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💰</div>
                <div class="empty-state-text">No hay otros gastos registrados</div>
                <div class="empty-state-subtext">Registra seguros, ITV, impuestos, parking...</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = vehicleRecords.map(r => {
        const category = EXPENSE_CATEGORIES.find(c => c.value === r.categoria) || { icon: '📝', label: r.categoria };
        return `
            <div class="record-card">
                <div class="record-header">
                    <div>
                        <div class="record-title">${category.icon} ${r.descripcion}</div>
                        <span class="category-badge ${r.categoria}">${category.label}</span>
                    </div>
                    <div class="record-actions">
                        <button class="btn-edit" onclick="editOtrosGastos(${r.id})">✏️</button>
                        <button class="btn-delete" onclick="deleteOtrosGastos(${r.id})">🗑️</button>
                    </div>
                </div>
                <div class="record-body">
                    <div class="record-row">
                        <span class="record-label">Fecha:</span>
                        <span class="record-value">${r.fecha}</span>
                    </div>
                    <div class="record-row">
                        <span class="record-label">Importe:</span>
                        <span class="record-value" style="color: #EF4444; font-weight: bold;">${r.importe.toFixed(2)} €</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function showOtrosGastosForm(id = null) {
    if (!activeVehicle) {
        alert('Por favor, selecciona un vehículo primero');
        return;
    }
    
    editingId = id;
    const title = id ? 'Editar Gasto' : 'Nuevo Gasto';
    
    if (id) {
        getRecord('otros_gastos', id).then(record => {
            openOtrosGastosModal(title, record);
        });
    } else {
        openOtrosGastosModal(title);
    }
}

function openOtrosGastosModal(title, data = {}) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    
    const categoryOptions = EXPENSE_CATEGORIES.map(cat => 
        `<option value="${cat.value}" ${data.categoria === cat.value ? 'selected' : ''}>${cat.icon} ${cat.label}</option>`
    ).join('');
    
    modalBody.innerHTML = `
        <h2 class="form-title">${title}</h2>
        <form id="otros-gastos-form" onsubmit="saveOtrosGastos(event)">
            <div class="form-group">
                <label class="form-label">Fecha</label>
                <input type="date" class="form-input" name="fecha" value="${data.fecha || new Date().toISOString().split('T')[0]}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Categoría</label>
                <select class="form-select" name="categoria" required>
                    ${categoryOptions}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Descripción</label>
                <input type="text" class="form-input" name="descripcion" value="${data.descripcion || ''}" placeholder="Ej: Seguro a terceros 2024" required>
            </div>
            <div class="form-group">
                <label class="form-label">Importe (€)</label>
                <input type="number" step="0.01" class="form-input" name="importe" value="${data.importe || ''}" placeholder="0.00" required>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
                <button type="submit" class="btn-primary">Guardar</button>
            </div>
        </form>
    `;
    
    modal.classList.add('show');
}

async function saveOtrosGastos(event) {
    event.preventDefault();
    
    if (!activeVehicle) {
        alert('Por favor, selecciona un vehículo primero');
        return;
    }
    
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
        matricula: activeVehicle,
        fecha: formData.get('fecha'),
        categoria: formData.get('categoria'),
        descripcion: formData.get('descripcion'),
        importe: parseFloat(formData.get('importe'))
    };
    
    if (editingId) {
        data.id = editingId;
        await updateRecord('otros_gastos', data);
    } else {
        await addRecord('otros_gastos', data);
    }
    
    closeModal();
    await loadOtrosGastos();
    updateStats();
    loadEstadisticas();
}

async function editOtrosGastos(id) {
    showOtrosGastosForm(id);
}

async function deleteOtrosGastos(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este gasto?')) {
        await deleteRecord('otros_gastos', id);
        await loadOtrosGastos();
        updateStats();
        loadEstadisticas();
    }
}

// ===== ESTADÍSTICAS WITH CHARTS =====
function populateYearSelector() {
    const selector = document.getElementById('stats-year-selector');
    if (!selector) return;
    
    const currentYear = new Date().getFullYear();
    const years = [];
    
    // Add years from current to 5 years ago
    for (let y = currentYear; y >= currentYear - 5; y--) {
        years.push(y);
    }
    
    selector.innerHTML = years.map(y => 
        `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`
    ).join('');
}

async function loadEstadisticas() {
    if (!activeVehicle) {
        const container = document.getElementById('financial-table-container');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🚗</div>
                    <div class="empty-state-text">No hay vehículo seleccionado</div>
                </div>
            `;
        }
        // Clear charts
        if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }
        if (barChartInstance) { barChartInstance.destroy(); barChartInstance = null; }
        return;
    }
    
    // Get selected year
    const yearSelector = document.getElementById('stats-year-selector');
    if (yearSelector) {
        selectedYear = parseInt(yearSelector.value);
    }
    
    // Fetch all data
    const allRepostajes = await getAllRecords('repostajes');
    const allAlmacen = await getAllRecords('almacen');
    const allTaller = await getAllRecords('taller');
    const allOtrosGastos = await getAllRecords('otros_gastos');
    
    // Filter by active vehicle
    const repostajes = allRepostajes.filter(r => r.matricula === activeVehicle);
    const almacen = allAlmacen.filter(a => a.matricula === activeVehicle);
    const taller = allTaller.filter(t => t.matricula === activeVehicle);
    const otrosGastos = allOtrosGastos.filter(o => o.matricula === activeVehicle);
    
    // Filter by year
    const yearRepostajes = repostajes.filter(r => new Date(r.fecha).getFullYear() === selectedYear);
    const yearAlmacen = almacen.filter(a => new Date(a.fecha_compra).getFullYear() === selectedYear);
    const yearOtros = otrosGastos.filter(o => new Date(o.fecha).getFullYear() === selectedYear);
    
    // Calculate totals
    const totalFuel = yearRepostajes.reduce((sum, r) => sum + r.total_euros, 0);
    const totalParts = yearAlmacen.reduce((sum, a) => sum + a.coste_euros, 0);
    
    // Fixed costs (Seguro, ITV, Impuesto)
    const fixedCosts = yearOtros
        .filter(o => ['seguro', 'itv', 'impuesto'].includes(o.categoria))
        .reduce((sum, o) => sum + o.importe, 0);
    
    // Variable costs (Parking, Peajes, Aditivos, Otros)
    const variableCosts = yearOtros
        .filter(o => ['parking', 'peajes', 'aditivos', 'otros'].includes(o.categoria))
        .reduce((sum, o) => sum + o.importe, 0);
    
    const grandTotal = totalFuel + totalParts + fixedCosts + variableCosts;
    
    // Render Pie Chart
    renderPieChart(totalFuel, totalParts, fixedCosts, variableCosts);
    
    // Render Bar Chart
    renderBarChart(yearRepostajes, yearAlmacen, yearOtros);
    
    // Render Financial Table
    renderFinancialTable(totalFuel, totalParts, fixedCosts, variableCosts, grandTotal, yearOtros);
}

function renderPieChart(fuel, parts, fixed, variable) {
    const ctx = document.getElementById('pieChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (pieChartInstance) {
        pieChartInstance.destroy();
    }
    
    const total = fuel + parts + fixed + variable;
    
    if (total === 0) {
        ctx.parentElement.innerHTML = `
            <div class="chart-no-data">
                <div class="chart-no-data-icon">📊</div>
                <div class="chart-no-data-text">No hay datos para ${selectedYear}</div>
            </div>
        `;
        return;
    }
    
    // Restore canvas if it was replaced
    if (!ctx.getContext) {
        ctx.parentElement.innerHTML = '<canvas id="pieChart"></canvas>';
    }
    
    const canvas = document.getElementById('pieChart');
    
    pieChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Combustible', 'Recambios', 'Costes Fijos', 'Costes Variables'],
            datasets: [{
                data: [fuel, parts, fixed, variable],
                backgroundColor: [
                    '#F59E0B', // Fuel - Orange
                    '#4285F4', // Parts - Blue
                    '#EF4444', // Fixed - Red
                    '#10B981'  // Variable - Green
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#9CA3AF',
                        padding: 15,
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${value.toFixed(2)} € (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderBarChart(repostajes, almacen, otros) {
    const ctx = document.getElementById('barChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (barChartInstance) {
        barChartInstance.destroy();
    }
    
    // Prepare monthly data
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const fuelByMonth = new Array(12).fill(0);
    const othersByMonth = new Array(12).fill(0);
    
    repostajes.forEach(r => {
        const month = new Date(r.fecha).getMonth();
        fuelByMonth[month] += r.total_euros;
    });
    
    almacen.forEach(a => {
        const month = new Date(a.fecha_compra).getMonth();
        othersByMonth[month] += a.coste_euros;
    });
    
    otros.forEach(o => {
        const month = new Date(o.fecha).getMonth();
        othersByMonth[month] += o.importe;
    });
    
    const hasData = fuelByMonth.some(v => v > 0) || othersByMonth.some(v => v > 0);
    
    if (!hasData) {
        ctx.parentElement.innerHTML = `
            <div class="chart-no-data">
                <div class="chart-no-data-icon">📈</div>
                <div class="chart-no-data-text">No hay datos mensuales</div>
            </div>
        `;
        return;
    }
    
    // Restore canvas if needed
    if (!ctx.getContext) {
        ctx.parentElement.innerHTML = '<canvas id="barChart"></canvas>';
    }
    
    const canvas = document.getElementById('barChart');
    
    barChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Combustible',
                    data: fuelByMonth,
                    backgroundColor: '#F59E0B',
                    borderRadius: 4
                },
                {
                    label: 'Otros Gastos',
                    data: othersByMonth,
                    backgroundColor: '#4285F4',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#9CA3AF', font: { size: 10 } }
                },
                y: {
                    grid: { color: '#2A2A2A' },
                    ticks: { 
                        color: '#9CA3AF',
                        callback: value => value + '€'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#9CA3AF', font: { size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.raw.toFixed(2)} €`
                    }
                }
            }
        }
    });
}

function renderFinancialTable(fuel, parts, fixed, variable, total, otrosGastos) {
    const container = document.getElementById('financial-table-container');
    if (!container) return;
    
    // Break down fixed and variable costs
    const seguro = otrosGastos.filter(o => o.categoria === 'seguro').reduce((s, o) => s + o.importe, 0);
    const itv = otrosGastos.filter(o => o.categoria === 'itv').reduce((s, o) => s + o.importe, 0);
    const impuesto = otrosGastos.filter(o => o.categoria === 'impuesto').reduce((s, o) => s + o.importe, 0);
    const parking = otrosGastos.filter(o => o.categoria === 'parking').reduce((s, o) => s + o.importe, 0);
    const peajes = otrosGastos.filter(o => o.categoria === 'peajes').reduce((s, o) => s + o.importe, 0);
    const aditivos = otrosGastos.filter(o => o.categoria === 'aditivos').reduce((s, o) => s + o.importe, 0);
    const otros = otrosGastos.filter(o => o.categoria === 'otros').reduce((s, o) => s + o.importe, 0);
    
    container.innerHTML = `
        <table class="financial-table">
            <tr>
                <td><span class="category-icon">⛽</span> Combustible</td>
                <td>${fuel.toFixed(2)} €</td>
            </tr>
            <tr>
                <td><span class="category-icon">📦</span> Recambios (Almacén)</td>
                <td>${parts.toFixed(2)} €</td>
            </tr>
            <tr class="subtotal">
                <td><strong>Mantenimiento Total</strong></td>
                <td><strong>${(fuel + parts).toFixed(2)} €</strong></td>
            </tr>
            
            <tr><td colspan="2" style="padding: 8px 0; border: none;"></td></tr>
            
            <tr>
                <td><span class="category-icon">🛡️</span> Seguro</td>
                <td>${seguro.toFixed(2)} €</td>
            </tr>
            <tr>
                <td><span class="category-icon">🔍</span> ITV</td>
                <td>${itv.toFixed(2)} €</td>
            </tr>
            <tr>
                <td><span class="category-icon">📋</span> Impuesto Circulación</td>
                <td>${impuesto.toFixed(2)} €</td>
            </tr>
            <tr class="subtotal">
                <td><strong>Costes Fijos</strong></td>
                <td><strong>${fixed.toFixed(2)} €</strong></td>
            </tr>
            
            <tr><td colspan="2" style="padding: 8px 0; border: none;"></td></tr>
            
            <tr>
                <td><span class="category-icon">🅿️</span> Parking</td>
                <td>${parking.toFixed(2)} €</td>
            </tr>
            <tr>
                <td><span class="category-icon">🛣️</span> Peajes</td>
                <td>${peajes.toFixed(2)} €</td>
            </tr>
            <tr>
                <td><span class="category-icon">🧪</span> Aditivos</td>
                <td>${aditivos.toFixed(2)} €</td>
            </tr>
            <tr>
                <td><span class="category-icon">📝</span> Otros</td>
                <td>${otros.toFixed(2)} €</td>
            </tr>
            <tr class="subtotal">
                <td><strong>Costes Variables</strong></td>
                <td><strong>${variable.toFixed(2)} €</strong></td>
            </tr>
            
            <tr><td colspan="2" style="padding: 12px 0; border: none;"></td></tr>
            
            <tr class="grand-total">
                <td>💶 GASTO TOTAL ${selectedYear}</td>
                <td>${total.toFixed(2)} €</td>
            </tr>
        </table>
    `;
}

function getMonthName(month) {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return months[month - 1];
}

// ===== EXPORT CSV =====
async function exportToCSV() {
    const repostajes = await getAllRecords('repostajes');
    const almacen = await getAllRecords('almacen');
    const taller = await getAllRecords('taller');
    const otrosGastos = await getAllRecords('otros_gastos');
    
    let csv = '';
    
    // Repostajes
    csv += 'REPOSTAJES\n';
    csv += 'Matrícula,Nº Factura,Gasolinera,Fecha,KM Actuales,Autonomía Antes,Autonomía Después,Litros,Precio/L,Total €\n';
    repostajes.forEach(r => {
        csv += `${r.matricula || 'N/A'},${r.numero_factura},${r.gasolinera},${r.fecha},${r.km_actuales},${r.autonomia_antes},${r.autonomia_despues},${r.litros},${r.precio_litro},${r.total_euros}\n`;
    });
    
    csv += '\n\n';
    
    // Almacén
    csv += 'ALMACÉN\n';
    csv += 'Matrícula,Fecha Compra,Recambio,Marca,Cantidad,Coste €,Estado\n';
    almacen.forEach(a => {
        csv += `${a.matricula || 'N/A'},${a.fecha_compra},${a.recambio},${a.marca},${a.cantidad_comprada},${a.coste_euros},${a.estado}\n`;
    });
    
    csv += '\n\n';
    
    // Taller
    csv += 'TALLER\n';
    csv += 'Matrícula,Fecha Montaje,KM Montaje,Recambio Instalado,Cantidad Usada,Notas\n';
    taller.forEach(t => {
        const notas = (t.notas || '').replace(/,/g, ';');
        csv += `${t.matricula || 'N/A'},${t.fecha_montaje},${t.km_montaje},${t.recambio_instalado},${t.cantidad_usada || ''},${notas}\n`;
    });
    
    csv += '\n\n';
    
    // Otros Gastos
    csv += 'OTROS GASTOS\n';
    csv += 'Matrícula,Fecha,Categoría,Descripción,Importe €\n';
    otrosGastos.forEach(o => {
        const desc = (o.descripcion || '').replace(/,/g, ';');
        csv += `${o.matricula || 'N/A'},${o.fecha},${o.categoria},${desc},${o.importe}\n`;
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vehiculo_${activeVehicle || 'todos'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Stats
async function updateStats() {
    const allRepostajes = await getAllRecords('repostajes');
    const allAlmacen = await getAllRecords('almacen');
    const allTaller = await getAllRecords('taller');
    const allOtros = await getAllRecords('otros_gastos');
    
    // Filter by active vehicle if one is selected
    const repostajes = activeVehicle ? allRepostajes.filter(r => r.matricula === activeVehicle) : allRepostajes;
    const almacen = activeVehicle ? allAlmacen.filter(a => a.matricula === activeVehicle) : allAlmacen;
    const taller = activeVehicle ? allTaller.filter(t => t.matricula === activeVehicle) : allTaller;
    const otros = activeVehicle ? allOtros.filter(o => o.matricula === activeVehicle) : allOtros;
    
    const statsContainer = document.getElementById('stats-content');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value">${repostajes.length}</div>
                    <div class="stat-label">Repostajes</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${almacen.length}</div>
                    <div class="stat-label">Recambios</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${taller.length}</div>
                    <div class="stat-label">Trabajos</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${otros.length}</div>
                    <div class="stat-label">Otros Gastos</div>
                </div>
            </div>
        `;
    }
}

// Modal
function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('show');
    editingId = null;
}

// ===== NO VEHICLE STATE =====
function showNoVehicleMessage() {
    const tabs = ['repostajes', 'almacen', 'taller', 'otros', 'estadisticas'];
    tabs.forEach(tab => {
        const container = document.getElementById(`${tab}-list`) || document.getElementById(`${tab}-content`) || document.getElementById('financial-table-container');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🚗</div>
                    <div class="empty-state-text">No hay vehículo seleccionado</div>
                    <div class="empty-state-subtext">Ve a la pestaña "Coches" para añadir tu primer vehículo</div>
                </div>
            `;
        }
    });
}

// ===== VEHÍCULOS =====
async function loadVehicles() {
    const vehicles = await getAllRecords('vehiculos');
    const selector = document.getElementById('vehicle-selector');
    
    if (!selector) return; // Guard clause
    
    selector.innerHTML = '<option value="">Selecciona vehículo...</option>';
    
    if (vehicles.length === 0) {
        // No vehicles yet - show helpful message
        selector.innerHTML = '<option value="">Añade un vehículo primero</option>';
        selector.disabled = true;
    } else {
        selector.disabled = false;
        vehicles.forEach(v => {
            const option = document.createElement('option');
            option.value = v.matricula;
            option.textContent = `${v.matricula} - ${v.marca} ${v.modelo}`;
            if (v.matricula === activeVehicle) {
                option.selected = true;
            }
            selector.appendChild(option);
        });
        
        // Auto-select first vehicle if none selected
        if (!activeVehicle && vehicles.length > 0) {
            activeVehicle = vehicles[0].matricula;
            localStorage.setItem('activeVehicle', activeVehicle);
            selector.value = activeVehicle;
            // Reload data with new active vehicle
            await loadAllData();
            updateStats();
            loadEstadisticas();
        }
    }
    
    // Show vehicle list in Vehículos tab
    const container = document.getElementById('vehiculos-list');
    if (!container) return;
    
    if (vehicles.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🚙</div>
                <div class="empty-state-text">No hay vehículos registrados</div>
                <div class="empty-state-subtext">Toca el botón + para añadir tu primer vehículo</div>
            </div>
        `;
    } else {
        container.innerHTML = vehicles.map(v => `
            <div class="record-card">
                <div class="record-header">
                    <div>
                        <div class="record-title">${v.marca} ${v.modelo}</div>
                        <div class="record-subtitle">Matrícula: ${v.matricula}</div>
                    </div>
                    <div class="record-actions">
                        <button class="btn-edit" onclick="editVehiculo(${v.id})">✏️</button>
                        <button class="btn-delete" onclick="deleteVehiculo(${v.id})">🗑️</button>
                    </div>
                </div>
                <div class="record-body">
                    <div class="record-row">
                        <span class="record-label">Motor:</span>
                        <span class="record-value">${v.motor}</span>
                    </div>
                    <div class="record-row">
                        <span class="record-label">CV:</span>
                        <span class="record-value">${v.cv} CV</span>
                    </div>
                    <div class="record-row">
                        <span class="record-label">Año:</span>
                        <span class="record-value">${v.year}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

function changeVehicle() {
    const selector = document.getElementById('vehicle-selector');
    activeVehicle = selector.value;
    
    if (activeVehicle) {
        localStorage.setItem('activeVehicle', activeVehicle);
        loadAllData();
        loadEstadisticas();
        updateStats();
    } else {
        showNoVehicleMessage();
    }
}

function showVehiculoForm(id = null) {
    editingId = id;
    const title = id ? 'Editar Vehículo' : 'Nuevo Vehículo';
    
    if (id) {
        getRecord('vehiculos', id).then(record => {
            openVehiculoModal(title, record);
        });
    } else {
        openVehiculoModal(title);
    }
}

function openVehiculoModal(title, data = {}) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
        <h2 class="form-title">${title}</h2>
        <form id="vehiculo-form" onsubmit="saveVehiculo(event)">
            <div class="form-group">
                <label class="form-label">Matrícula</label>
                <input type="text" class="form-input" name="matricula" value="${data.matricula || ''}" 
                    placeholder="1234ABC" required ${data.matricula ? 'readonly' : ''}>
            </div>
            <div class="form-group">
                <label class="form-label">Marca</label>
                <input type="text" class="form-input" name="marca" value="${data.marca || ''}" 
                    placeholder="Toyota, Ford, etc." required>
            </div>
            <div class="form-group">
                <label class="form-label">Modelo</label>
                <input type="text" class="form-input" name="modelo" value="${data.modelo || ''}" 
                    placeholder="Corolla, Focus, etc." required>
            </div>
            <div class="form-group">
                <label class="form-label">Motor</label>
                <input type="text" class="form-input" name="motor" value="${data.motor || ''}" 
                    placeholder="1.6 TDI, 2.0 VTEC, etc." required>
            </div>
            <div class="form-group">
                <label class="form-label">CV (Potencia)</label>
                <input type="number" class="form-input" name="cv" value="${data.cv || ''}" 
                    placeholder="150" required>
            </div>
            <div class="form-group">
                <label class="form-label">Año</label>
                <input type="number" class="form-input" name="year" value="${data.year || new Date().getFullYear()}" 
                    min="1900" max="${new Date().getFullYear() + 1}" required>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
                <button type="submit" class="btn-primary">Guardar</button>
            </div>
        </form>
    `;
    
    modal.classList.add('show');
}

async function saveVehiculo(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
        matricula: formData.get('matricula').toUpperCase().trim(),
        marca: formData.get('marca'),
        modelo: formData.get('modelo'),
        motor: formData.get('motor'),
        cv: parseInt(formData.get('cv')),
        year: parseInt(formData.get('year'))
    };
    
    try {
        if (editingId) {
            data.id = editingId;
            await updateRecord('vehiculos', data);
        } else {
            await addRecord('vehiculos', data);
            
            // Auto-select this vehicle if it's the first one
            const vehicles = await getAllRecords('vehiculos');
            if (vehicles.length === 1 || !activeVehicle) {
                activeVehicle = data.matricula;
                localStorage.setItem('activeVehicle', activeVehicle);
            }
        }
        
        closeModal();
        await loadVehicles();
        populateYearSelector();
        
        // Reload all data if this is now the active vehicle
        if (activeVehicle === data.matricula) {
            await loadAllData();
            updateStats();
            loadEstadisticas();
        }
    } catch (error) {
        alert('Error al guardar vehículo: ' + error.message);
    }
}

async function editVehiculo(id) {
    showVehiculoForm(id);
}

async function deleteVehiculo(id) {
    if (!confirm('⚠️ ¿Eliminar este vehículo?\n\nEsto NO eliminará los registros asociados, pero quedarán sin vehículo asignado.')) {
        return;
    }
    
    try {
        const vehicle = await getRecord('vehiculos', id);
        await deleteRecord('vehiculos', id);
        
        // If this was the active vehicle, clear it
        if (activeVehicle === vehicle.matricula) {
            activeVehicle = null;
            localStorage.removeItem('activeVehicle');
        }
        
        await loadVehicles();
        
        // Check if we have other vehicles
        const vehicles = await getAllRecords('vehiculos');
        if (vehicles.length > 0) {
            // Auto-select first available vehicle
            activeVehicle = vehicles[0].matricula;
            localStorage.setItem('activeVehicle', activeVehicle);
            await loadAllData();
        } else {
            showNoVehicleMessage();
        }
        
        updateStats();
        loadEstadisticas();
    } catch (error) {
        alert('Error al eliminar vehículo: ' + error.message);
    }
}

// ===== STATS VIEW TOGGLE =====
function changeStatsView(view) {
    statsView = view;
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    loadEstadisticas();
}

// ===== RESET FUNCTION =====
async function confirmReset() {
    if (!confirm('⚠️ ADVERTENCIA: Esto eliminará TODOS los datos de forma permanente.\n\n¿Estás seguro de continuar?')) {
        return;
    }
    
    if (!confirm('Última confirmación: ¿Realmente quieres borrar TODO (vehículos, repostajes, recambios, trabajos, otros gastos)?')) {
        return;
    }
    
    try {
        await clearAllData();
        localStorage.clear();
        activeVehicle = null;
        alert('✅ Todos los datos han sido eliminados');
        location.reload();
    } catch (error) {
        alert('Error al borrar datos: ' + error.message);
        console.error(error);
    }
}
