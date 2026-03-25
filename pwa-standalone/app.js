// App State
let currentTab = 'repostajes';
let editingId = null;
let activeVehicle = null; // Currently selected vehicle
let statsView = 'mensual'; // 'mensual' or 'anual'

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    
    // Load active vehicle from localStorage
    const savedVehicle = localStorage.getItem('activeVehicle');
    if (savedVehicle) {
        activeVehicle = savedVehicle;
    }
    
    await loadVehicles();
    setupNavigation();
    
    // Only load data if we have an active vehicle
    if (activeVehicle) {
        await loadAllData();
        updateStats();
        loadEstadisticas();
    } else {
        // Show welcome message for other tabs
        showNoVehicleMessage();
    }
});

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
    
    container.innerHTML = records.map(r => `
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
    editingId = id;
    const title = id ? 'Editar Trabajo' : 'Nuevo Trabajo';
    
    // Get available parts from Almacén with stock > 0
    const almacenItems = await getAllRecords('almacen');
    const availableParts = almacenItems.filter(item => 
        item.cantidad_comprada > 0 && item.estado === 'En Stock'
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

// ===== ESTADÍSTICAS =====
async function loadEstadisticas() {
    const repostajes = await getAllRecords('repostajes');
    const almacen = await getAllRecords('almacen');
    
    const container = document.getElementById('estadisticas-content');
    
    // Fuel Statistics by Year/Month
    const fuelStats = {};
    repostajes.forEach(r => {
        const date = new Date(r.fecha);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const key = `${year}-${month.toString().padStart(2, '0')}`;
        
        if (!fuelStats[key]) {
            fuelStats[key] = {
                year,
                month,
                litros: 0,
                coste: 0,
                count: 0
            };
        }
        
        fuelStats[key].litros += r.litros;
        fuelStats[key].coste += r.total_euros;
        fuelStats[key].count += 1;
    });
    
    const fuelStatsArray = Object.values(fuelStats).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
    });
    
    const fuelTableRows = fuelStatsArray.map(stat => `
        <tr>
            <td>${stat.year}</td>
            <td>${getMonthName(stat.month)}</td>
            <td class="highlight-value">${stat.litros.toFixed(2)} L</td>
            <td class="highlight-value">${stat.coste.toFixed(2)} €</td>
            <td>${(stat.coste / stat.litros).toFixed(3)} €/L</td>
        </tr>
    `).join('');
    
    // Annual Spending from Almacén
    const almacenStats = {};
    almacen.forEach(a => {
        const year = new Date(a.fecha_compra).getFullYear();
        
        if (!almacenStats[year]) {
            almacenStats[year] = {
                total: 0,
                partes: 0,
                servicios: 0
            };
        }
        
        almacenStats[year].total += a.coste_euros;
        
        if (a.estado === 'Servicio') {
            almacenStats[year].servicios += a.coste_euros;
        } else {
            almacenStats[year].partes += a.coste_euros;
        }
    });
    
    const almacenStatsArray = Object.entries(almacenStats)
        .sort((a, b) => b[0] - a[0])
        .map(([year, data]) => ({ year: parseInt(year), ...data }));
    
    const almacenTableRows = almacenStatsArray.map(stat => `
        <tr>
            <td>${stat.year}</td>
            <td class="highlight-value">${stat.partes.toFixed(2)} €</td>
            <td class="highlight-value">${stat.servicios.toFixed(2)} €</td>
            <td class="highlight-value">${stat.total.toFixed(2)} €</td>
        </tr>
    `).join('');
    
    container.innerHTML = `
        <div class="stats-section">
            <h2>📊 Resumen de Combustible</h2>
            ${fuelStatsArray.length > 0 ? `
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Año</th>
                            <th>Mes</th>
                            <th>Total Litros</th>
                            <th>Coste Total</th>
                            <th>Precio Medio/L</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${fuelTableRows}
                    </tbody>
                </table>
            ` : '<p style="color: #9CA3AF;">No hay datos de combustible</p>'}
        </div>
        
        <div class="stats-section">
            <h2>💰 Gasto Anual en Almacén</h2>
            ${almacenStatsArray.length > 0 ? `
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Año</th>
                            <th>Recambios</th>
                            <th>Servicios</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${almacenTableRows}
                    </tbody>
                </table>
            ` : '<p style="color: #9CA3AF;">No hay datos de almacén</p>'}
        </div>
    `;
}

function getMonthName(month) {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return months[month - 1];
}

// ===== EXPORT =====
async function exportToCSV() {
    const repostajes = await getAllRecords('repostajes');
    const almacen = await getAllRecords('almacen');
    const taller = await getAllRecords('taller');
    
    let csv = '';
    
    // Repostajes
    csv += 'REPOSTAJES\n';
    csv += 'Nº Factura,Gasolinera,Fecha,KM Actuales,Autonomía Antes,Autonomía Después,Litros,Precio/L,Total €\n';
    repostajes.forEach(r => {
        csv += `${r.numero_factura},${r.gasolinera},${r.fecha},${r.km_actuales},${r.autonomia_antes},${r.autonomia_despues},${r.litros},${r.precio_litro},${r.total_euros}\n`;
    });
    
    csv += '\n\n';
    
    // Almacén
    csv += 'ALMACÉN\n';
    csv += 'Fecha Compra,Recambio,Marca,Cantidad,Coste €,Estado\n';
    almacen.forEach(a => {
        csv += `${a.fecha_compra},${a.recambio},${a.marca},${a.cantidad_comprada},${a.coste_euros},${a.estado}\n`;
    });
    
    csv += '\n\n';
    
    // Taller
    csv += 'TALLER\n';
    csv += 'Fecha Montaje,KM Montaje,Recambio Instalado,Cantidad Usada,Notas\n';
    taller.forEach(t => {
        const notas = (t.notas || '').replace(/,/g, ';');
        csv += `${t.fecha_montaje},${t.km_montaje},${t.recambio_instalado},${t.cantidad_usada || ''},${notas}\n`;
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vehiculo_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Stats
async function updateStats() {
    const repostajes = await getAllRecords('repostajes');
    const almacen = await getAllRecords('almacen');
    const taller = await getAllRecords('taller');
    
    const statsContainer = document.getElementById('stats-content');
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
                <div class="stat-value">${almacen.filter(a => a.estado === 'En Stock' && a.cantidad_comprada > 0).length}</div>
                <div class="stat-label">En Stock</div>
            </div>
        </div>
    `;
}

// Modal
function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('show');
    editingId = null;
}

// ===== NO VEHICLE STATE =====
function showNoVehicleMessage() {
    const tabs = ['repostajes', 'almacen', 'taller', 'estadisticas'];
    tabs.forEach(tab => {
        const container = document.getElementById(`${tab}-list`) || document.getElementById(`${tab}-content`);
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🚗</div>
                    <div class="empty-state-text">No hay vehículo seleccionado</div>
                    <div class="empty-state-subtext">Ve a la pestaña "Vehículos" para añadir tu primer vehículo</div>
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
    
    if (!confirm('Última confirmación: ¿Realmente quieres borrar TODO (vehículos, repostajes, recambios, trabajos)?')) {
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
