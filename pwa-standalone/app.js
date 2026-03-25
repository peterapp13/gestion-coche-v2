// App State
let currentTab = 'repostajes';
let editingId = null;

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    setupNavigation();
    await loadAllData();
    updateStats();
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
}

// Load All Data
async function loadAllData() {
    await loadRepostajes();
    await loadAlmacen();
    await loadTaller();
}

// ===== REPOSTAJES =====
async function loadRepostajes() {
    const records = await getAllRecords('repostajes');
    records.sort((a, b) => b.km_actuales - a.km_actuales);
    
    // Calculate KM gastados and consumo for each record
    for (let i = 0; i < records.length; i++) {
        if (i < records.length - 1) {
            const current = records[i];
            const previous = records[i + 1];
            const kmGastados = current.km_actuales - previous.km_actuales;
            records[i].km_gastados = kmGastados;
            if (kmGastados > 0) {
                records[i].consumo = ((current.litros / kmGastados) * 100).toFixed(2);
            }
        }
    }
    
    const container = document.getElementById('repostajes-list');
    
    if (records.length === 0) {
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
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
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
}

async function editRepostaje(id) {
    showRepostajeForm(id);
}

async function deleteRepostaje(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este repostaje?')) {
        await deleteRecord('repostajes', id);
        await loadRepostajes();
        updateStats();
    }
}

// ===== ALMACÉN =====
async function loadAlmacen() {
    const records = await getAllRecords('almacen');
    records.sort((a, b) => new Date(b.fecha_compra) - new Date(a.fecha_compra));
    
    const container = document.getElementById('almacen-list');
    
    if (records.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <div class="empty-state-text">No hay recambios en almacén</div>
                <div class="empty-state-subtext">Toca el botón + para añadir uno</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = records.map(r => `
        <div class="record-card">
            <div class="record-header">
                <div>
                    <div class="record-title">${r.recambio}</div>
                    <div class="record-subtitle">${r.marca}</div>
                </div>
                <div class="record-actions">
                    <span class="status-badge">
                        <span class="status-dot ${r.estado.toLowerCase()}"></span>
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
                <label class="form-label">Coste (€)</label>
                <input type="number" step="0.01" class="form-input" name="coste_euros" value="${data.coste_euros || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Estado</label>
                <select class="form-select" name="estado" required>
                    <option value="Pendiente" ${data.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="Instalado" ${data.estado === 'Instalado' ? 'selected' : ''}>Instalado</option>
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
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
        fecha_compra: formData.get('fecha_compra'),
        recambio: formData.get('recambio'),
        marca: formData.get('marca'),
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
}

async function editAlmacen(id) {
    showAlmacenForm(id);
}

async function deleteAlmacen(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este recambio?')) {
        await deleteRecord('almacen', id);
        await loadAlmacen();
        updateStats();
    }
}

// ===== TALLER =====
async function loadTaller() {
    const records = await getAllRecords('taller');
    records.sort((a, b) => b.km_montaje - a.km_montaje);
    
    const container = document.getElementById('taller-list');
    
    if (records.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔧</div>
                <div class="empty-state-text">No hay trabajos registrados</div>
                <div class="empty-state-subtext">Toca el botón + para añadir uno</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = records.map(r => `
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

function showTallerForm(id = null) {
    editingId = id;
    const title = id ? 'Editar Trabajo' : 'Nuevo Trabajo';
    
    if (id) {
        getRecord('taller', id).then(record => {
            openTallerModal(title, record);
        });
    } else {
        openTallerModal(title);
    }
}

function openTallerModal(title, data = {}) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    
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
                <input type="text" class="form-input" name="recambio_instalado" value="${data.recambio_instalado || ''}" placeholder="Filtro de aceite Bosch..." required>
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

async function saveTaller(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
        fecha_montaje: formData.get('fecha_montaje'),
        km_montaje: parseFloat(formData.get('km_montaje')),
        recambio_instalado: formData.get('recambio_instalado'),
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
    updateStats();
}

async function editTaller(id) {
    showTallerForm(id);
}

async function deleteTaller(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este trabajo?')) {
        await deleteRecord('taller', id);
        await loadTaller();
        updateStats();
    }
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
    csv += 'Fecha Compra,Recambio,Marca,Coste €,Estado\n';
    almacen.forEach(a => {
        csv += `${a.fecha_compra},${a.recambio},${a.marca},${a.coste_euros},${a.estado}\n`;
    });
    
    csv += '\n\n';
    
    // Taller
    csv += 'TALLER\n';
    csv += 'Fecha Montaje,KM Montaje,Recambio Instalado,Notas\n';
    taller.forEach(t => {
        const notas = (t.notas || '').replace(/,/g, ';');
        csv += `${t.fecha_montaje},${t.km_montaje},${t.recambio_instalado},${notas}\n`;
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
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
                <div class="stat-value">${almacen.filter(a => a.estado === 'Pendiente').length}</div>
                <div class="stat-label">Pendientes</div>
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