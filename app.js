// App State
let currentTab = 'repostajes';
let editingId = null;
let activeVehicle = null; // Currently selected vehicle
let statsView = 'anual'; // 'mensual' or 'anual'
let lastSyncTime = null; // Track last sync time
let selectedYear = new Date().getFullYear();

// Filter years for each tab (2024-2050)
let filterYearRepostajes = 'all';
let filterYearAlmacen = 'all';
let filterYearTaller = 'all';
let filterYearOtros = 'all';

// Chart instances (to destroy before re-creating)
let pieChartInstance = null;
let barChartInstance = null;

// Helper function to format date as DD/MM/AAAA
function formatDate(dateStr) {
    if (!dateStr) return 'Sin fecha';
    try {
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return dateStr;
    }
}

// Migration function: Normalize discount fields in old records
async function migrarDescuentosAntiguos() {
    try {
        const repostajes = await getAllRecords('repostajes');
        let migratedCount = 0;
        
        for (const record of repostajes) {
            let needsUpdate = false;
            
            // Normalize descuento_valor (was descuento_porcentaje or descuento_euros)
            if (record.descuento_valor === undefined || record.descuento_valor === null) {
                record.descuento_valor = 0;
                needsUpdate = true;
            }
            
            // Normalize descuento_tipo
            if (record.descuento_tipo === undefined || record.descuento_tipo === null) {
                record.descuento_tipo = 'euros';
                needsUpdate = true;
            }
            
            // Normalize importe_bruto (calculate if missing)
            if (record.importe_bruto === undefined || record.importe_bruto === null) {
                const litros = parseFloat(record.litros) || 0;
                const precioLitro = parseFloat(record.precio_litro) || 0;
                record.importe_bruto = litros * precioLitro;
                needsUpdate = true;
            }
            
            // Update record if needed
            if (needsUpdate) {
                await updateRecord('repostajes', record);
                migratedCount++;
            }
        }
        
        if (migratedCount > 0) {
            console.log(`Migración completada: ${migratedCount} repostajes actualizados`);
        }
    } catch (error) {
        console.error('Error en migración de descuentos:', error);
    }
}

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

// Generate year options HTML (2024-2050)
function getYearFilterOptions(selectedValue = 'all') {
    let options = `<option value="all" ${selectedValue === 'all' ? 'selected' : ''}>Todos</option>`;
    for (let y = 2024; y <= 2050; y++) {
        options += `<option value="${y}" ${selectedValue == y ? 'selected' : ''}>${y}</option>`;
    }
    return options;
}

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        
        // Run migration for old records (normalize discount fields)
        await migrarDescuentosAntiguos();
        
        // Load active vehicle from localStorage
        const savedVehicle = localStorage.getItem('activeVehicle');
        if (savedVehicle) {
            activeVehicle = savedVehicle;
        }
        
        // Load last sync time
        lastSyncTime = localStorage.getItem('lastSyncTime');
        if (lastSyncTime) {
            updateSyncStatusDisplay(new Date(lastSyncTime));
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
                // Force render charts immediately after data load
                await loadEstadisticas();
            } else {
                showNoVehicleMessage();
            }
        }
    } catch (error) {
        console.error('Init error:', error);
    }
});

// ===== SYNC FUNCTIONS (Now in Ajustes tab) =====

// Export database to iCloud
async function exportDatabase() {
    try {
        const result = await exportMasterDatabase();
        
        if (result.success) {
            // Update sync time
            lastSyncTime = new Date().toISOString();
            localStorage.setItem('lastSyncTime', lastSyncTime);
            updateSyncStatusDisplay(new Date(lastSyncTime));
            
            alert('✅ Base de datos exportada correctamente.\n\nGuarda el archivo "gestion_coche_db.json" en tu iCloud Drive para sincronizar entre dispositivos.');
        } else if (!result.cancelled) {
            alert('❌ Error al exportar: ' + (result.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Export error:', error);
        alert('❌ Error al exportar: ' + error.message);
    }
}

// Import database from iCloud
async function importDatabase() {
    hideWelcomeScreen();
    
    try {
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
                    <strong>🗑️ Reemplazar todo</strong>
                    <span>Borra TODO y carga solo el archivo importado</span>
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
    
    try {
        const result = await importMasterDatabase(selectedMergeMode);
        
        if (result.success) {
            // Update sync time
            lastSyncTime = new Date().toISOString();
            localStorage.setItem('lastSyncTime', lastSyncTime);
            updateSyncStatusDisplay(new Date(lastSyncTime));
            
            // Reload all data
            await loadVehicles();
            populateYearSelector();
            
            if (activeVehicle) {
                await loadAllData();
                // Force render charts immediately after import
                await loadEstadisticas();
            }
            
            // Update app stats
            loadAppStats();
            
            let message = '✅ Importación completada.\n\n';
            message += `📊 Registros añadidos: ${result.stats.added}\n`;
            if (selectedMergeMode === 'merge') {
                message += `⏭️ Duplicados omitidos: ${result.stats.skipped}`;
            }
            
            alert(message);
        } else if (!result.cancelled) {
            alert('❌ Error al importar');
        }
    } catch (error) {
        console.error('Import error:', error);
        alert('❌ Error al importar: ' + error.message);
    }
}

// Update sync status display in Ajustes tab
function updateSyncStatusDisplay(date) {
    const statusCard = document.getElementById('sync-status-card');
    const statusText = document.getElementById('sync-status-text');
    
    if (statusCard && statusText && date) {
        const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        statusText.textContent = `✅ Sincronizado: ${dateStr} ${time}`;
        statusCard.classList.add('synced');
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
    
    // Switch to Vehículos tab to add first vehicle (now in Ajustes area, but we go to vehiculos)
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
    
    // Load app stats when switching to Ajustes
    if (tab === 'ajustes') {
        loadAppStats();
        updateSyncStatusDisplay(lastSyncTime ? new Date(lastSyncTime) : null);
    }
}

// Load All Data
async function loadAllData() {
    await loadRepostajes();
    await loadAlmacen();
    await loadTaller();
    await loadOtrosGastos();
}

// ===== APP STATS FOR AJUSTES =====
async function loadAppStats() {
    const container = document.getElementById('app-stats-info');
    if (!container) return;
    
    const vehiculos = await getAllRecords('vehiculos');
    const repostajes = await getAllRecords('repostajes');
    const almacen = await getAllRecords('almacen');
    const taller = await getAllRecords('taller');
    const otros = await getAllRecords('otros_gastos');
    
    container.innerHTML = `
        <div class="stat-info-item">
            <div class="stat-info-value">${vehiculos.length}</div>
            <div class="stat-info-label">Vehículos</div>
        </div>
        <div class="stat-info-item">
            <div class="stat-info-value">${repostajes.length}</div>
            <div class="stat-info-label">Repostajes</div>
        </div>
        <div class="stat-info-item">
            <div class="stat-info-value">${almacen.length}</div>
            <div class="stat-info-label">Recambios</div>
        </div>
        <div class="stat-info-item">
            <div class="stat-info-value">${taller.length + otros.length}</div>
            <div class="stat-info-label">Trabajos/Gastos</div>
        </div>
    `;
}

// ===== REPOSTAJES =====
async function loadRepostajes() {
    const container = document.getElementById('repostajes-list');
    if (!container) return;
    
    // Don't try to load if no active vehicle
    if (!activeVehicle) {
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
    
    // PASO 1: Filtrar por vehículo activo (sin filtrar por año todavía)
    let allVehicleRecords = records.filter(r => !r.matricula || r.matricula === activeVehicle);
    
    // PASO 2: Ordenar cronológicamente por km (de menor a mayor para calcular consumo)
    allVehicleRecords.sort((a, b) => (a.km_actuales || 0) - (b.km_actuales || 0));
    
    // PASO 3: Calcular consumo FULL-TO-FULL (acumulando litros entre tanques llenos)
    let litrosAcumulados = 0;
    let ultimoKmTanqueLleno = null;
    
    for (let i = 0; i < allVehicleRecords.length; i++) {
        const registro = allVehicleRecords[i];
        const kmActual = parseFloat(registro.km_actuales) || 0;
        const litros = parseFloat(registro.litros) || 0;
        
        // Acumular litros
        litrosAcumulados += litros;
        
        // Determinar si es tanque lleno (nuevo campo o inferir de autonomía para datos antiguos)
        let esTanqueLleno = false;
        if (registro.tanque_lleno !== undefined) {
            // Nuevo campo existe
            esTanqueLleno = registro.tanque_lleno === true || registro.tanque_lleno === 'true';
        } else {
            // Datos antiguos: inferir de autonomía después (>634 km = tanque lleno)
            const autonomiaDespues = parseFloat(registro.autonomia_despues) || 0;
            esTanqueLleno = autonomiaDespues > 634;
        }
        
        // Guardar si es tanque lleno para mostrar en UI
        allVehicleRecords[i].esTanqueLleno = esTanqueLleno;
        
        if (esTanqueLleno) {
            // TANQUE LLENO: Calcular consumo desde el último tanque lleno
            if (ultimoKmTanqueLleno !== null) {
                const distancia = kmActual - ultimoKmTanqueLleno;
                allVehicleRecords[i].km_gastados = distancia;
                
                if (distancia > 0 && litrosAcumulados > 0) {
                    const consumoCalculado = (litrosAcumulados / distancia) * 100;
                    allVehicleRecords[i].consumo = consumoCalculado.toFixed(2);
                    // Marcar si es irreal
                    allVehicleRecords[i].consumoIrreal = consumoCalculado < 2 || consumoCalculado > 25;
                } else {
                    allVehicleRecords[i].consumo = '--';
                }
            } else {
                // Primer tanque lleno: no hay referencia anterior
                allVehicleRecords[i].km_gastados = 0;
                allVehicleRecords[i].consumo = '--';
            }
            
            // Resetear acumuladores
            litrosAcumulados = 0;
            ultimoKmTanqueLleno = kmActual;
        } else {
            // REPOSTAJE PARCIAL: No calcular consumo, seguir acumulando
            if (i > 0) {
                const previous = allVehicleRecords[i - 1];
                const distancia = kmActual - (parseFloat(previous.km_actuales) || 0);
                allVehicleRecords[i].km_gastados = distancia;
            } else {
                allVehicleRecords[i].km_gastados = 0;
            }
            allVehicleRecords[i].consumo = 'Parcial';
        }
    }
    
    // PASO 4: AHORA filtrar por año (después de calcular consumo)
    let filteredRecords = allVehicleRecords;
    if (filterYearRepostajes !== 'all') {
        filteredRecords = allVehicleRecords.filter(r => {
            if (!r.fecha) return false;
            const year = new Date(r.fecha).getFullYear();
            return year == filterYearRepostajes;
        });
    }
    
    // Ordenar para mostrar (de mayor a menor km - los más recientes arriba)
    filteredRecords.sort((a, b) => (b.km_actuales || 0) - (a.km_actuales || 0));
    
    // Year filter HTML
    const filterHtml = `
        <div class="list-filter">
            <label>Año:</label>
            <select onchange="filterYearRepostajes = this.value; loadRepostajes();">
                ${getYearFilterOptions(filterYearRepostajes)}
            </select>
            <span class="filter-count">${filteredRecords.length} registros</span>
        </div>
    `;
    
    if (filteredRecords.length === 0 && filterYearRepostajes === 'all') {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⛽</div>
                <div class="empty-state-text">No hay repostajes registrados</div>
                <div class="empty-state-subtext">Toca el botón + para añadir uno</div>
            </div>
        `;
        return;
    }
    
    const listHtml = filteredRecords.length === 0 
        ? `<div class="empty-state small"><div class="empty-state-text">No hay datos en ${filterYearRepostajes}</div></div>`
        : filteredRecords.map(r => {
            // Calculate price per liter for display
            const precioLitro = (r.litros && r.litros > 0) ? (r.total_euros / r.litros).toFixed(3) : (r.precio_litro || 0).toFixed(3);
            
            // Format consumption display
            let consumoDisplay = '--';
            let consumoClass = 'list-item-consumo';
            
            if (r.consumo === 'Parcial') {
                consumoDisplay = 'Parcial';
                consumoClass += ' consumo-parcial';
            } else if (r.consumo !== '--') {
                consumoDisplay = `${r.consumo} L/100km`;
                // Mark unrealistic values with different color
                if (r.consumoIrreal) {
                    consumoClass += ' consumo-irreal';
                }
            }
            
            // Show km traveled since last fill-up
            const kmRecorridos = r.km_gastados > 0 ? `+${r.km_gastados} km` : '';
            
            // Indicator for full tank or partial
            const tanqueIcon = r.esTanqueLleno ? '⛽' : '🔸';
            
            return `
        <div class="list-item repostaje-item" onclick="editRepostaje(${r.id})">
            <div class="list-item-main">
                <div class="list-item-title"><span class="tanque-icon">${tanqueIcon}</span> ${r.gasolinera || 'Sin nombre'}</div>
                <div class="list-item-subtitle">${formatDate(r.fecha)} · <span class="km-total">${(r.km_actuales || 0).toLocaleString()} km</span> ${kmRecorridos ? `<span class="km-recorridos">(${kmRecorridos})</span>` : ''}</div>
            </div>
            <div class="list-item-data">
                <div class="list-item-amount">${(r.total_euros || 0).toFixed(2)} €</div>
                <div class="list-item-detail">${(r.litros || 0).toFixed(2)} L · ${precioLitro} €/L</div>
                <div class="${consumoClass}">${consumoDisplay}</div>
            </div>
            <button class="list-item-delete" onclick="event.stopPropagation(); deleteRepostaje(${r.id})">🗑️</button>
        </div>
    `}).join('');
    
    container.innerHTML = filterHtml + `<div class="list-container">${listHtml}</div>`;
}

function showRepostajeForm(id = null) {
    if (!activeVehicle) {
        alert('Por favor, selecciona un vehículo primero');
        return;
    }
    
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
            
            <div class="form-group checkbox-group">
                <label class="checkbox-label">
                    <input type="checkbox" name="tanque_lleno" id="tanque_lleno" ${data.tanque_lleno !== false ? 'checked' : ''}>
                    <span class="checkbox-custom"></span>
                    <span class="checkbox-text">¿Tanque Lleno?</span>
                </label>
                <span class="checkbox-hint">Marca si llenaste el depósito completo</span>
            </div>
            
            <div class="form-group">
                <label class="form-label">Litros</label>
                <input type="number" step="0.01" class="form-input" name="litros" id="litros" value="${data.litros || ''}" oninput="calcularTotalRepostaje()" required>
            </div>
            <div class="form-group">
                <label class="form-label">Precio por Litro (€)</label>
                <input type="number" step="0.001" class="form-input" name="precio_litro" id="precio_litro" value="${data.precio_litro || ''}" oninput="calcularTotalRepostaje()" required>
            </div>
            
            <div class="form-section discount-section">
                <label class="form-label">Descuento (opcional)</label>
                <div class="discount-row">
                    <select class="form-select discount-type" id="descuento_tipo" onchange="calcularTotalRepostaje()">
                        <option value="euros" ${(data.descuento_tipo === 'euros' || !data.descuento_tipo) ? 'selected' : ''}>€</option>
                        <option value="porcentaje" ${data.descuento_tipo === 'porcentaje' ? 'selected' : ''}>%</option>
                    </select>
                    <input type="number" step="0.01" class="form-input discount-value" id="descuento_valor" name="descuento_valor" value="${data.descuento_valor || ''}" placeholder="0.00" oninput="calcularTotalRepostaje()">
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Importe Bruto (€)</label>
                <input type="number" step="0.01" class="form-input" id="importe_bruto" name="importe_bruto" value="${data.importe_bruto || ''}" readonly style="background: #2A2A2A; opacity: 0.7;">
            </div>
            
            <div class="form-group">
                <label class="form-label">Total Pagado (€)</label>
                <input type="number" step="0.01" class="form-input total-pagado" name="total_euros" id="total_euros" value="${data.total_euros || ''}" required>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
                <button type="submit" class="btn-primary">Guardar</button>
            </div>
        </form>
    `;
    
    modal.classList.add('show');
    
    // Calculate initial total if editing
    if (data.litros && data.precio_litro) {
        calcularTotalRepostaje();
    }
}

// Calculate fuel total with discount
function calcularTotalRepostaje() {
    const litros = parseFloat(document.getElementById('litros')?.value) || 0;
    const precioLitro = parseFloat(document.getElementById('precio_litro')?.value) || 0;
    const descuentoTipo = document.getElementById('descuento_tipo')?.value || 'euros';
    const descuentoValor = parseFloat(document.getElementById('descuento_valor')?.value) || 0;
    
    const importeBruto = litros * precioLitro;
    let descuentoEuros = 0;
    
    if (descuentoTipo === 'porcentaje') {
        descuentoEuros = importeBruto * (descuentoValor / 100);
    } else {
        descuentoEuros = descuentoValor;
    }
    
    const totalPagado = importeBruto - descuentoEuros;
    
    // Update fields
    const importeBrutoInput = document.getElementById('importe_bruto');
    const totalEurosInput = document.getElementById('total_euros');
    
    if (importeBrutoInput) {
        importeBrutoInput.value = importeBruto.toFixed(2);
    }
    if (totalEurosInput) {
        totalEurosInput.value = totalPagado.toFixed(2);
    }
}

async function saveRepostaje(event) {
    event.preventDefault();
    
    if (!activeVehicle) {
        alert('Por favor, selecciona un vehículo primero');
        return;
    }
    
    const form = event.target;
    const formData = new FormData(form);
    
    const descuentoTipo = document.getElementById('descuento_tipo')?.value || 'euros';
    const descuentoValor = parseFloat(document.getElementById('descuento_valor')?.value) || 0;
    const tanqueLleno = document.getElementById('tanque_lleno')?.checked ?? true;
    
    const data = {
        matricula: activeVehicle, // BIND TO ACTIVE VEHICLE
        numero_factura: formData.get('numero_factura'),
        gasolinera: formData.get('gasolinera'),
        fecha: formData.get('fecha'),
        km_actuales: parseFloat(formData.get('km_actuales')),
        autonomia_antes: parseFloat(formData.get('autonomia_antes')),
        autonomia_despues: parseFloat(formData.get('autonomia_despues')),
        tanque_lleno: tanqueLleno,
        litros: parseFloat(formData.get('litros')),
        precio_litro: parseFloat(formData.get('precio_litro')),
        importe_bruto: parseFloat(formData.get('importe_bruto')) || 0,
        descuento_tipo: descuentoTipo,
        descuento_valor: descuentoValor,
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
    loadEstadisticas();
}

async function editRepostaje(id) {
    showRepostajeForm(id);
}

async function deleteRepostaje(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este repostaje?')) {
        await deleteRecord('repostajes', id);
        await loadRepostajes();
        loadEstadisticas();
    }
}

// ===== ALMACÉN =====
async function loadAlmacen() {
    const container = document.getElementById('almacen-list');
    if (!container) return;
    
    if (!activeVehicle) {
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
    let vehicleRecords = records.filter(r => r.matricula === activeVehicle);
    
    // Apply year filter
    if (filterYearAlmacen !== 'all') {
        vehicleRecords = vehicleRecords.filter(r => {
            if (!r.fecha_compra) return false;
            const year = new Date(r.fecha_compra).getFullYear();
            return year == filterYearAlmacen;
        });
    }
    
    vehicleRecords.sort((a, b) => new Date(b.fecha_compra || 0) - new Date(a.fecha_compra || 0));
    
    // Year filter HTML
    const filterHtml = `
        <div class="list-filter">
            <label>Año:</label>
            <select onchange="filterYearAlmacen = this.value; loadAlmacen();">
                ${getYearFilterOptions(filterYearAlmacen)}
            </select>
            <span class="filter-count">${vehicleRecords.length} registros</span>
        </div>
    `;
    
    if (vehicleRecords.length === 0 && filterYearAlmacen === 'all') {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <div class="empty-state-text">No hay recambios en almacén</div>
                <div class="empty-state-subtext">Toca el botón + para añadir uno</div>
            </div>
        `;
        return;
    }
    
    const getStatusClass = (estado) => {
        if (!estado) return '';
        return estado.toLowerCase().replace(' ', '-').replace('/', '-');
    };
    
    const listHtml = vehicleRecords.length === 0
        ? `<div class="empty-state small"><div class="empty-state-text">No hay datos en ${filterYearAlmacen}</div></div>`
        : vehicleRecords.map(r => `
        <div class="list-item" onclick="editAlmacen(${r.id})">
            <div class="list-item-main">
                <div class="list-item-title">${r.recambio || 'Sin nombre'}</div>
                <div class="list-item-subtitle">${r.marca || ''} · ${formatDate(r.fecha_compra)}</div>
            </div>
            <div class="list-item-data">
                <div class="list-item-amount">${(r.coste_euros || 0).toFixed(2)} €</div>
                <div class="list-item-detail status-${getStatusClass(r.estado)}">${r.cantidad_comprada || 0} uds · ${r.estado || 'N/A'}</div>
            </div>
            <button class="list-item-delete" onclick="event.stopPropagation(); deleteAlmacen(${r.id})">🗑️</button>
        </div>
    `).join('');
    
    container.innerHTML = filterHtml + `<div class="list-container">${listHtml}</div>`;
}

function showAlmacenForm(id = null) {
    if (!activeVehicle) {
        alert('Por favor, selecciona un vehículo primero');
        return;
    }
    
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
    loadEstadisticas();
}

async function editAlmacen(id) {
    showAlmacenForm(id);
}

async function deleteAlmacen(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este recambio?')) {
        await deleteRecord('almacen', id);
        await loadAlmacen();
        loadEstadisticas();
    }
}

// ===== TALLER (MULTIPLE PARTS SUPPORT) =====
async function loadTaller() {
    const container = document.getElementById('taller-list');
    if (!container) return;
    
    if (!activeVehicle) {
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
    let vehicleRecords = records.filter(r => r.matricula === activeVehicle);
    
    // Apply year filter
    if (filterYearTaller !== 'all') {
        vehicleRecords = vehicleRecords.filter(r => {
            if (!r.fecha_montaje) return false;
            const year = new Date(r.fecha_montaje).getFullYear();
            return year == filterYearTaller;
        });
    }
    
    vehicleRecords.sort((a, b) => (b.km_montaje || 0) - (a.km_montaje || 0));
    
    // Year filter HTML
    const filterHtml = `
        <div class="list-filter">
            <label>Año:</label>
            <select onchange="filterYearTaller = this.value; loadTaller();">
                ${getYearFilterOptions(filterYearTaller)}
            </select>
            <span class="filter-count">${vehicleRecords.length} registros</span>
        </div>
    `;
    
    if (vehicleRecords.length === 0 && filterYearTaller === 'all') {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔧</div>
                <div class="empty-state-text">No hay trabajos registrados</div>
                <div class="empty-state-subtext">Toca el botón + para añadir uno</div>
            </div>
        `;
        return;
    }
    
    const listHtml = vehicleRecords.length === 0
        ? `<div class="empty-state small"><div class="empty-state-text">No hay datos en ${filterYearTaller}</div></div>`
        : vehicleRecords.map(r => {
            // Handle both old format (single recambio_instalado) and new format (recambios array)
            let displayTitle = '';
            let partsCount = 1;
            
            if (r.recambios && Array.isArray(r.recambios) && r.recambios.length > 0) {
                // New format: multiple parts
                partsCount = r.recambios.length;
                if (partsCount > 1) {
                    displayTitle = 'Varios recambios';
                } else {
                    displayTitle = r.recambios[0].nombre || 'Sin nombre';
                }
            } else {
                // Old format: single part
                displayTitle = r.recambio_instalado || 'Sin nombre';
            }
            
            // Escape notes for HTML attribute
            const escapedNotes = r.notas ? r.notas.replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
            
            return `
        <div class="list-item" onclick="editTaller(${r.id})">
            <div class="list-item-main">
                <div class="list-item-title">${displayTitle}</div>
                <div class="list-item-subtitle">${formatDate(r.fecha_montaje)} · <span class="km-total">${(r.km_montaje || 0).toLocaleString()} km</span></div>
                ${partsCount > 1 ? `<div class="list-item-parts">${partsCount} recambios</div>` : ''}
            </div>
            <div class="list-item-data">
                <div class="list-item-amount">${r.cantidad_usada || (r.recambios ? r.recambios.reduce((sum, p) => sum + (p.cantidad || 1), 0) : 1)} uds</div>
                ${r.notas ? `<button class="btn-show-note" onclick="event.stopPropagation(); showTallerNote('${escapedNotes}')" title="Ver nota">📝</button>` : ''}
            </div>
            <button class="list-item-delete" onclick="event.stopPropagation(); deleteTaller(${r.id})">🗑️</button>
        </div>
    `}).join('');
    
    container.innerHTML = filterHtml + `<div class="list-container">${listHtml}</div>`;
}

async function showTallerForm(id = null) {
    if (!activeVehicle) {
        alert('Por favor, selecciona un vehículo primero');
        return;
    }
    
    editingId = id;
    const title = id ? 'Editar Trabajo' : 'Nuevo Trabajo';
    
    // Get ALL parts from Almacén FILTERED BY ACTIVE VEHICLE
    const almacenItems = await getAllRecords('almacen');
    const allVehicleParts = almacenItems.filter(item => item.matricula === activeVehicle);
    
    // Parts with stock available (for new selections)
    const availableParts = allVehicleParts.filter(item => 
        item.cantidad_comprada > 0 && 
        item.estado === 'En Stock'
    );
    
    // Store for adding new rows
    window.tallerAvailableParts = availableParts;
    window.tallerAllParts = allVehicleParts; // All parts for showing existing selections
    
    if (id) {
        const record = await getRecord('taller', id);
        // Store original recambios for comparison when saving (to detect deletions)
        window.tallerOriginalRecambios = record.recambios ? [...record.recambios] : 
            (record.almacen_id ? [{ almacen_id: record.almacen_id, cantidad: record.cantidad_usada || 1 }] : []);
        openTallerModal(title, record, availableParts, allVehicleParts);
    } else {
        window.tallerOriginalRecambios = [];
        openTallerModal(title, {}, availableParts, allVehicleParts);
    }
}

function openTallerModal(title, data = {}, availableParts = [], allParts = []) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    
    // Check if we're editing (has existing recambios)
    const isEditing = data.id && (data.recambios || data.almacen_id);
    
    // Prepare initial parts data for editing
    let initialParts = [];
    if (data.recambios && Array.isArray(data.recambios) && data.recambios.length > 0) {
        // New format: multiple parts
        initialParts = data.recambios;
    } else if (data.almacen_id) {
        // Old format: single part - convert to array format for editing
        initialParts = [{ almacen_id: data.almacen_id, cantidad: data.cantidad_usada || 1, nombre: data.recambio_instalado }];
    }
    
    // Generate initial parts rows HTML
    // For editing: use allParts to show existing selections even without stock
    // For new: use availableParts
    const partsForDropdown = isEditing ? allParts : availableParts;
    
    const partsRowsHtml = initialParts.length > 0 
        ? initialParts.map((part, index) => createPartRowHtml(index, partsForDropdown, part, index === 0, isEditing)).join('')
        : createPartRowHtml(0, availableParts, {}, true, false);
    
    // Show add button if there are available parts with stock
    const showAddButton = availableParts.length > 0;
    
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
            
            <div class="form-section">
                <label class="form-label">Recambios Instalados</label>
                ${isEditing ? '<p style="color: #9CA3AF; font-size: 12px; margin-bottom: 12px;">💡 Modifica cantidades o elimina recambios. El stock se ajusta automáticamente.</p>' : ''}
                <div id="lista-recambios">
                    ${partsRowsHtml}
                </div>
                ${showAddButton ? `
                <button type="button" class="btn-add-part" onclick="addTallerPartRow()">
                    + Añadir otro recambio
                </button>
                ` : (!isEditing ? '<p style="color: #F59E0B; font-size: 14px; margin-top: 8px;">No hay piezas disponibles en stock</p>' : '')}
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

function createPartRowHtml(index, availableParts, partData = {}, isFirst = false, isEditing = false) {
    // For editing: show the selected part even if it has no stock
    let partsOptions = '';
    
    if (isEditing && partData.almacen_id) {
        // Check if the part is already in availableParts
        const partExists = availableParts.some(p => p.id == partData.almacen_id);
        
        if (!partExists && partData.nombre) {
            // Part not in stock, show it as a special option
            partsOptions = `<option value="${partData.almacen_id}" selected data-original-qty="${partData.cantidad || 1}">${partData.nombre} (instalado)</option>`;
        }
    }
    
    // Add available parts
    partsOptions += availableParts.map(part => 
        `<option value="${part.id}" data-max="${part.cantidad_comprada}" ${partData.almacen_id == part.id ? 'selected' : ''}>${part.recambio} (${part.marca}) - Stock: ${part.cantidad_comprada}</option>`
    ).join('');
    
    // For editing existing parts, store original quantity for diff calculation
    const isExistingPart = isEditing && partData.almacen_id;
    const originalQty = partData.cantidad || 1;
    
    return `
        <div class="part-row" data-index="${index}" ${isExistingPart ? `data-existing="true" data-original-qty="${originalQty}" data-almacen-id="${partData.almacen_id}"` : ''}>
            <select class="form-select part-select ${isExistingPart ? 'existing-part' : ''}" onchange="updatePartQuantityMax(this)" ${isExistingPart ? 'disabled' : ''}>
                <option value="">-- Selecciona --</option>
                ${partsOptions}
            </select>
            <input type="number" min="1" step="1" class="form-input part-quantity" value="${partData.cantidad || 1}" placeholder="Cant.">
            ${!isFirst ? `<button type="button" class="btn-remove-part" onclick="removeTallerPartRow(this)">✕</button>` : '<div class="part-spacer"></div>'}
        </div>
    `;
}

function addTallerPartRow() {
    const container = document.getElementById('lista-recambios');
    const availableParts = window.tallerAvailableParts || [];
    const newIndex = container.querySelectorAll('.part-row').length;
    const newRowHtml = createPartRowHtml(newIndex, availableParts, {}, false);
    container.insertAdjacentHTML('beforeend', newRowHtml);
}

function removeTallerPartRow(button) {
    const row = button.closest('.part-row');
    const wasExisting = row.dataset.existing === 'true';
    const almacenId = row.dataset.almacenId;
    const originalQty = parseInt(row.dataset.originalQty) || 0;
    
    row.remove();
    
    // If removing an existing part, update dropdowns to show the returned stock
    if (wasExisting && almacenId && originalQty > 0) {
        updateTallerDropdownsStock(parseInt(almacenId), originalQty);
    }
}

// Update all dropdowns to reflect stock that will be returned
function updateTallerDropdownsStock(returnedAlmacenId, returnedQty) {
    const allSelects = document.querySelectorAll('#lista-recambios .part-select:not(:disabled)');
    
    allSelects.forEach(select => {
        let optionFound = false;
        
        // Find the option for this almacen_id and update its stock display
        for (let i = 0; i < select.options.length; i++) {
            const option = select.options[i];
            if (option.value == returnedAlmacenId) {
                optionFound = true;
                const currentMax = parseInt(option.getAttribute('data-max')) || 0;
                const newMax = currentMax + returnedQty;
                option.setAttribute('data-max', newMax);
                
                // Update the text to show new stock
                const text = option.textContent;
                const newText = text.replace(/Stock: \d+/, `Stock: ${newMax}`);
                option.textContent = newText;
                break;
            }
        }
        
        // If option not found (part was out of stock), add it
        if (!optionFound && window.tallerAllParts) {
            const fullPart = window.tallerAllParts.find(p => p.id == returnedAlmacenId);
            if (fullPart) {
                const newOption = document.createElement('option');
                newOption.value = fullPart.id;
                newOption.setAttribute('data-max', returnedQty);
                newOption.textContent = `${fullPart.recambio} (${fullPart.marca}) - Stock: ${returnedQty}`;
                select.appendChild(newOption);
            }
        }
    });
    
    // Also update the global available parts for new rows (avoid duplicates)
    if (window.tallerAvailableParts) {
        const existingPart = window.tallerAvailableParts.find(p => p.id == returnedAlmacenId);
        if (existingPart) {
            existingPart.cantidad_comprada += returnedQty;
        } else {
            // Part was out of stock, need to add it back (create a copy to avoid reference issues)
            const allParts = window.tallerAllParts || [];
            const fullPart = allParts.find(p => p.id == returnedAlmacenId);
            if (fullPart) {
                // Create a copy with updated stock
                const newPart = { ...fullPart, cantidad_comprada: returnedQty, estado: 'En Stock' };
                window.tallerAvailableParts.push(newPart);
            }
        }
    }
}

function updatePartQuantityMax(selectElement) {
    const row = selectElement.closest('.part-row');
    const quantityInput = row.querySelector('.part-quantity');
    
    if (selectElement.value) {
        const selectedOption = selectElement.options[selectElement.selectedIndex];
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
    const isEditing = !!editingId;
    
    // Collect all parts from dynamic rows
    const partRows = document.querySelectorAll('#lista-recambios .part-row');
    const recambios = [];
    const stockChanges = []; // Track what needs to be deducted from stock
    let totalCantidad = 0;
    let recambioNames = [];
    
    for (const row of partRows) {
        const selectEl = row.querySelector('.part-select');
        const quantityEl = row.querySelector('.part-quantity');
        const isExistingPart = row.dataset.existing === 'true';
        const originalQty = parseInt(row.dataset.originalQty) || 0;
        const storedAlmacenId = row.dataset.almacenId;
        
        // For existing parts (when editing), get the value from the disabled select
        let almacenId = selectEl.value;
        if (isExistingPart && selectEl.disabled) {
            almacenId = storedAlmacenId || selectEl.options[selectEl.selectedIndex]?.value;
        }
        
        const newCantidad = parseInt(quantityEl.value) || 1;
        
        if (almacenId) {
            const almacenItem = await getRecord('almacen', parseInt(almacenId));
            
            // Get nombre
            let nombre = '';
            if (almacenItem) {
                nombre = `${almacenItem.recambio} (${almacenItem.marca})`;
            } else if (isExistingPart) {
                const selectedOption = selectEl.options[selectEl.selectedIndex];
                nombre = selectedOption ? selectedOption.textContent.replace(' (instalado)', '').replace(' (ya instalado)', '') : 'Recambio';
            }
            
            // Calculate stock change needed
            if (isExistingPart) {
                // For existing parts: only deduct the DIFFERENCE (newQty - originalQty)
                const diff = newCantidad - originalQty;
                if (diff > 0) {
                    // Need to deduct more from stock
                    if (almacenItem && almacenItem.cantidad_comprada < diff) {
                        alert(`Error: No hay suficiente stock de "${nombre}". Disponible: ${almacenItem.cantidad_comprada}, Necesitas añadir: ${diff}`);
                        return;
                    }
                    stockChanges.push({
                        almacen_id: parseInt(almacenId),
                        cantidad: diff // Only deduct the difference
                    });
                }
                // If diff <= 0, no need to deduct (user reduced quantity or kept same)
            } else {
                // For NEW parts: deduct full quantity
                if (almacenItem) {
                    if (almacenItem.cantidad_comprada < newCantidad) {
                        alert(`Error: No hay suficiente stock de "${almacenItem.recambio}". Disponible: ${almacenItem.cantidad_comprada}, Solicitado: ${newCantidad}`);
                        return;
                    }
                    stockChanges.push({
                        almacen_id: parseInt(almacenId),
                        cantidad: newCantidad
                    });
                }
            }
            
            recambios.push({
                almacen_id: parseInt(almacenId),
                nombre: nombre,
                cantidad: newCantidad
            });
            
            recambioNames.push(nombre);
            totalCantidad += newCantidad;
        }
    }
    
    if (recambios.length === 0) {
        alert('Debes seleccionar al menos un recambio del almacén');
        return;
    }
    
    // Check for DELETED parts (were in original but not in current) - return their stock
    const originalRecambios = window.tallerOriginalRecambios || [];
    const currentAlmacenIds = recambios.map(r => r.almacen_id);
    
    for (const original of originalRecambios) {
        if (!currentAlmacenIds.includes(original.almacen_id)) {
            // This part was deleted - return stock to almacén
            const almacenItem = await getRecord('almacen', original.almacen_id);
            if (almacenItem) {
                almacenItem.cantidad_comprada += original.cantidad;
                almacenItem.estado = 'En Stock';
                await updateRecord('almacen', almacenItem);
            }
        }
    }
    
    // Apply stock changes (deductions for new parts or increased quantities)
    for (const change of stockChanges) {
        const almacenItem = await getRecord('almacen', change.almacen_id);
        
        if (almacenItem) {
            almacenItem.cantidad_comprada -= change.cantidad;
            
            if (almacenItem.cantidad_comprada <= 0) {
                almacenItem.cantidad_comprada = 0;
                almacenItem.estado = 'Agotado/Instalado';
            }
            
            await updateRecord('almacen', almacenItem);
        }
    }
    
    const data = {
        matricula: activeVehicle,
        fecha_montaje: formData.get('fecha_montaje'),
        km_montaje: parseFloat(formData.get('km_montaje')),
        recambios: recambios,
        // Keep backward compatibility fields
        recambio_instalado: recambioNames.join(', '),
        cantidad_usada: totalCantidad,
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
    await loadAlmacen();
    loadEstadisticas();
}

async function editTaller(id) {
    await showTallerForm(id);
}

async function deleteTaller(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este trabajo?')) {
        await deleteRecord('taller', id);
        await loadTaller();
        loadEstadisticas();
    }
}

// Show note in a modal popup
function showTallerNote(note) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
        <h2 class="form-title">📝 Nota del Trabajo</h2>
        <div class="note-display">
            <p>${note.replace(/\n/g, '<br>')}</p>
        </div>
        <div class="form-actions">
            <button type="button" class="btn-primary" onclick="closeModal()">Cerrar</button>
        </div>
    `;
    
    modal.classList.add('show');
}

// ===== OTROS GASTOS =====
async function loadOtrosGastos() {
    const container = document.getElementById('otros-list');
    if (!container) return;
    
    if (!activeVehicle) {
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
    let vehicleRecords = records.filter(r => r.matricula === activeVehicle);
    
    // Apply year filter
    if (filterYearOtros !== 'all') {
        vehicleRecords = vehicleRecords.filter(r => {
            if (!r.fecha) return false;
            const year = new Date(r.fecha).getFullYear();
            return year == filterYearOtros;
        });
    }
    
    vehicleRecords.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
    
    // Year filter HTML
    const filterHtml = `
        <div class="list-filter">
            <label>Año:</label>
            <select onchange="filterYearOtros = this.value; loadOtrosGastos();">
                ${getYearFilterOptions(filterYearOtros)}
            </select>
            <span class="filter-count">${vehicleRecords.length} registros</span>
        </div>
    `;
    
    if (vehicleRecords.length === 0 && filterYearOtros === 'all') {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💰</div>
                <div class="empty-state-text">No hay otros gastos registrados</div>
                <div class="empty-state-subtext">Registra seguros, ITV, impuestos, parking...</div>
            </div>
        `;
        return;
    }
    
    const listHtml = vehicleRecords.length === 0
        ? `<div class="empty-state small"><div class="empty-state-text">No hay datos en ${filterYearOtros}</div></div>`
        : vehicleRecords.map(r => {
        const category = EXPENSE_CATEGORIES.find(c => c.value === r.categoria) || { icon: '📝', label: r.categoria || 'Otro' };
        return `
        <div class="list-item" onclick="editOtrosGastos(${r.id})">
            <div class="list-item-main">
                <div class="list-item-title">${category.icon} ${r.descripcion || 'Sin descripción'}</div>
                <div class="list-item-subtitle">${formatDate(r.fecha)} · ${category.label}</div>
            </div>
            <div class="list-item-data">
                <div class="list-item-amount expense">${(r.importe || 0).toFixed(2)} €</div>
            </div>
            <button class="list-item-delete" onclick="event.stopPropagation(); deleteOtrosGastos(${r.id})">🗑️</button>
        </div>
    `;
    }).join('');
    
    container.innerHTML = filterHtml + `<div class="list-container">${listHtml}</div>`;
}

// FIX: Ensure this function works with click events
function showOtrosGastosForm(id = null) {
    console.log('showOtrosGastosForm called', { id, activeVehicle }); // Debug
    
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
        openOtrosGastosModal(title, {});
    }
}

function openOtrosGastosModal(title, data = {}) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    
    if (!modal || !modalBody) {
        console.error('Modal elements not found');
        return;
    }
    
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
    
    try {
        if (editingId) {
            data.id = editingId;
            await updateRecord('otros_gastos', data);
        } else {
            await addRecord('otros_gastos', data);
        }
        
        closeModal();
        await loadOtrosGastos();
        loadEstadisticas();
    } catch (error) {
        console.error('Error saving otros gastos:', error);
        alert('Error al guardar: ' + error.message);
    }
}

async function editOtrosGastos(id) {
    showOtrosGastosForm(id);
}

async function deleteOtrosGastos(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este gasto?')) {
        await deleteRecord('otros_gastos', id);
        await loadOtrosGastos();
        loadEstadisticas();
    }
}

// ===== ESTADÍSTICAS WITH CHARTS (FIX) =====
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
        clearCharts();
        return;
    }
    
    // Get selected year
    const yearSelector = document.getElementById('stats-year-selector');
    if (yearSelector) {
        selectedYear = parseInt(yearSelector.value);
    }
    
    try {
        // Fetch all data
        const allRepostajes = await getAllRecords('repostajes');
        const allAlmacen = await getAllRecords('almacen');
        const allOtrosGastos = await getAllRecords('otros_gastos');
        
        // Filter by active vehicle
        const repostajes = allRepostajes.filter(r => r.matricula === activeVehicle);
        const almacen = allAlmacen.filter(a => a.matricula === activeVehicle);
        const otrosGastos = allOtrosGastos.filter(o => o.matricula === activeVehicle);
        
        // Filter by year
        const yearRepostajes = repostajes.filter(r => new Date(r.fecha).getFullYear() === selectedYear);
        const yearAlmacen = almacen.filter(a => new Date(a.fecha_compra).getFullYear() === selectedYear);
        const yearOtros = otrosGastos.filter(o => new Date(o.fecha).getFullYear() === selectedYear);
        
        // Calculate totals
        const totalFuel = yearRepostajes.reduce((sum, r) => sum + (r.total_euros || 0), 0);
        const totalParts = yearAlmacen.reduce((sum, a) => sum + (a.coste_euros || 0), 0);
        
        // Calculate total liters and average price per liter
        const totalLitros = yearRepostajes.reduce((sum, r) => sum + (r.litros || 0), 0);
        const avgPrecioLitro = totalLitros > 0 ? totalFuel / totalLitros : 0;
        
        // Fixed costs (Seguro, ITV, Impuesto)
        const fixedCosts = yearOtros
            .filter(o => ['seguro', 'itv', 'impuesto'].includes(o.categoria))
            .reduce((sum, o) => sum + (o.importe || 0), 0);
        
        // Variable costs (Parking, Peajes, Aditivos, Otros)
        const variableCosts = yearOtros
            .filter(o => ['parking', 'peajes', 'aditivos', 'otros'].includes(o.categoria))
            .reduce((sum, o) => sum + (o.importe || 0), 0);
        
        const grandTotal = totalFuel + totalParts + fixedCosts + variableCosts;
        
        // Render Charts
        renderPieChart(totalFuel, totalParts, fixedCosts, variableCosts);
        renderBarChart(yearRepostajes, yearAlmacen, yearOtros);
        
        // Render Financial Table with fuel stats
        renderFinancialTable(totalFuel, totalParts, fixedCosts, variableCosts, grandTotal, yearOtros, totalLitros, avgPrecioLitro);
    } catch (error) {
        console.error('Error loading estadisticas:', error);
    }
}

function clearCharts() {
    if (pieChartInstance) {
        pieChartInstance.destroy();
        pieChartInstance = null;
    }
    if (barChartInstance) {
        barChartInstance.destroy();
        barChartInstance = null;
    }
}

function renderPieChart(fuel, parts, fixed, variable) {
    const container = document.getElementById('pie-chart-container');
    if (!container) return;
    
    // Destroy existing chart first
    if (pieChartInstance) {
        pieChartInstance.destroy();
        pieChartInstance = null;
    }
    
    // Restore canvas element
    container.innerHTML = '<canvas id="pieChart"></canvas>';
    const canvas = document.getElementById('pieChart');
    
    if (!canvas) return;
    
    const total = fuel + parts + fixed + variable;
    
    // Show chart even with zero values - just shows empty
    const data = [fuel, parts, fixed, variable];
    const hasData = data.some(v => v > 0);
    
    if (!hasData) {
        container.innerHTML = `
            <div class="chart-no-data">
                <div class="chart-no-data-icon">📊</div>
                <div class="chart-no-data-text">No hay datos para ${selectedYear}</div>
            </div>
        `;
        return;
    }
    
    try {
        pieChartInstance = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['Combustible', 'Recambios', 'Costes Fijos', 'Costes Variables'],
                datasets: [{
                    data: data,
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
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${context.label}: ${value.toFixed(2)} € (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error creating pie chart:', error);
    }
}

function renderBarChart(repostajes, almacen, otros) {
    const container = document.getElementById('bar-chart-container');
    if (!container) return;
    
    // Destroy existing chart first
    if (barChartInstance) {
        barChartInstance.destroy();
        barChartInstance = null;
    }
    
    // Restore canvas element
    container.innerHTML = '<canvas id="barChart"></canvas>';
    const canvas = document.getElementById('barChart');
    
    if (!canvas) return;
    
    // Prepare monthly data
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const fuelByMonth = new Array(12).fill(0);
    const othersByMonth = new Array(12).fill(0);
    
    repostajes.forEach(r => {
        const month = new Date(r.fecha).getMonth();
        fuelByMonth[month] += r.total_euros || 0;
    });
    
    almacen.forEach(a => {
        const month = new Date(a.fecha_compra).getMonth();
        othersByMonth[month] += a.coste_euros || 0;
    });
    
    otros.forEach(o => {
        const month = new Date(o.fecha).getMonth();
        othersByMonth[month] += o.importe || 0;
    });
    
    const hasData = fuelByMonth.some(v => v > 0) || othersByMonth.some(v => v > 0);
    
    if (!hasData) {
        container.innerHTML = `
            <div class="chart-no-data">
                <div class="chart-no-data-icon">📈</div>
                <div class="chart-no-data-text">No hay datos mensuales</div>
            </div>
        `;
        return;
    }
    
    try {
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
    } catch (error) {
        console.error('Error creating bar chart:', error);
    }
}

function renderFinancialTable(fuel, parts, fixed, variable, total, otrosGastos, totalLitros = 0, avgPrecioLitro = 0) {
    const container = document.getElementById('financial-table-container');
    if (!container) return;
    
    // Break down fixed and variable costs
    const seguro = otrosGastos.filter(o => o.categoria === 'seguro').reduce((s, o) => s + (o.importe || 0), 0);
    const itv = otrosGastos.filter(o => o.categoria === 'itv').reduce((s, o) => s + (o.importe || 0), 0);
    const impuesto = otrosGastos.filter(o => o.categoria === 'impuesto').reduce((s, o) => s + (o.importe || 0), 0);
    const parking = otrosGastos.filter(o => o.categoria === 'parking').reduce((s, o) => s + (o.importe || 0), 0);
    const peajes = otrosGastos.filter(o => o.categoria === 'peajes').reduce((s, o) => s + (o.importe || 0), 0);
    const aditivos = otrosGastos.filter(o => o.categoria === 'aditivos').reduce((s, o) => s + (o.importe || 0), 0);
    const otros = otrosGastos.filter(o => o.categoria === 'otros').reduce((s, o) => s + (o.importe || 0), 0);
    
    container.innerHTML = `
        <table class="financial-table">
            <tr>
                <td><span class="category-icon">⛽</span> Combustible</td>
                <td>${fuel.toFixed(2)} €</td>
            </tr>
            <tr>
                <td><span class="category-icon">💧</span> Litros Totales</td>
                <td>${totalLitros.toFixed(1)} L</td>
            </tr>
            <tr>
                <td><span class="category-icon">📊</span> Precio Medio/Litro</td>
                <td>${avgPrecioLitro.toFixed(3)} €/L</td>
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

function changeStatsView(view) {
    statsView = view;
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    loadEstadisticas();
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

// Modal
function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('show');
    editingId = null;
}

// ===== NO VEHICLE STATE =====
function showNoVehicleMessage() {
    const tabs = ['repostajes', 'almacen', 'taller', 'otros'];
    tabs.forEach(tab => {
        const container = document.getElementById(`${tab}-list`);
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🚗</div>
                    <div class="empty-state-text">No hay vehículo seleccionado</div>
                    <div class="empty-state-subtext">Ve a ⚙️ Ajustes > Mis Vehículos para añadir tu primer vehículo</div>
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
            <div class="record-card ${v.matricula === activeVehicle ? 'active-vehicle' : ''}">
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
        
        loadEstadisticas();
    } catch (error) {
        alert('Error al eliminar vehículo: ' + error.message);
    }
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
