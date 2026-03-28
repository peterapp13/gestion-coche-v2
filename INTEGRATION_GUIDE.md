# Multi-Vehicle Update - Implementation Notes

## Files Modified:
1. `index.html` - Added header with vehicle selector, new Vehículos tab, stats toggle, reset button
2. `styles.css` - Added header styles, vehicle selector, toggle buttons, danger zone
3. `db.js` - Updated to v2 with vehiculos collection, added clearAllData()
4. `app.js` - Needs manual integration of vehicle functions (see below)

## Required app.js Functions to Add:

```javascript
// Add these functions to app.js after the existing code:

// ===== VEHÍCULOS =====
async function loadVehicles() {
    const vehicles = await getAllRecords('vehiculos');
    const selector = document.getElementById('vehicle-selector');
    
    selector.innerHTML = '<option value="">Selecciona vehículo...</option>';
    vehicles.forEach(v => {
        const option = document.createElement('option');
        option.value = v.matricula;
        option.textContent = `${v.matricula} - ${v.marca} ${v.modelo}`;
        if (v.matricula === activeVehicle) {
            option.selected = true;
        }
        selector.appendChild(option);
    });
    
    // Show vehicle list
    const container = document.getElementById('vehiculos-list');
    if (vehicles.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🚙</div>
                <div class="empty-state-text">No hay vehículos registrados</div>
                <div class="empty-state-subtext">Añade tu primer vehículo</div>
            </div>
        `;
    } else {
        container.innerHTML = vehicles.map(v => `
            <div class="record-card">
                <div class="record-header">
                    <div>
                        <div class="record-title">${v.marca} ${v.modelo}</div>
                        <div class="record-subtitle">Mat: ${v.matricula}</div>
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
    localStorage.setItem('activeVehicle', activeVehicle);
    loadAllData();
    loadEstadisticas();
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
                <input type="text" class="form-input" name="matricula" value="${data.matricula || ''}" required ${data.matricula ? 'readonly' : ''}>
            </div>
            <div class="form-group">
                <label class="form-label">Marca</label>
                <input type="text" class="form-input" name="marca" value="${data.marca || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Modelo</label>
                <input type="text" class="form-input" name="modelo" value="${data.modelo || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Motor</label>
                <input type="text" class="form-input" name="motor" value="${data.motor || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">CV (Potencia)</label>
                <input type="number" class="form-input" name="cv" value="${data.cv || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Año</label>
                <input type="number" class="form-input" name="year" value="${data.year || new Date().getFullYear()}" required>
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
        matricula: formData.get('matricula').toUpperCase(),
        marca: formData.get('marca'),
        modelo: formData.get('modelo'),
        motor: formData.get('motor'),
        cv: parseInt(formData.get('cv')),
        year: parseInt(formData.get('year'))
    };
    
    if (editingId) {
        data.id = editingId;
        await updateRecord('vehiculos', data);
    } else {
        await addRecord('vehiculos', data);
        // Auto-select first vehicle
        if (!activeVehicle) {
            activeVehicle = data.matricula;
            localStorage.setItem('activeVehicle', activeVehicle);
        }
    }
    
    closeModal();
    await loadVehicles();
}

async function editVehiculo(id) {
    showVehiculoForm(id);
}

async function deleteVehiculo(id) {
    if (confirm('¿Eliminar este vehículo y TODOS sus registros?')) {
        const vehicle = await getRecord('vehiculos', id);
        await deleteRecord('vehiculos', id);
        
        // Delete all related records
        const repostajes = await getAllRecords('repostajes');
        const almacen = await getAllRecords('almacen');
        const taller = await getAllRecords('taller');
        
        for (const r of repostajes.filter(x => x.matricula === vehicle.matricula)) {
            await deleteRecord('repostajes', r.id);
        }
        for (const a of almacen.filter(x => x.matricula === vehicle.matricula)) {
            await deleteRecord('almacen', a.id);
        }
        for (const t of taller.filter(x => x.matricula === vehicle.matricula)) {
            await deleteRecord('taller', t.id);
        }
        
        await loadVehicles();
        await loadAllData();
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
    if (confirm('⚠️ ADVERTENCIA: Esto eliminará TODOS los datos de forma permanente.\n\n¿Estás seguro de continuar?')) {
        if (confirm('Última confirmación: ¿Realmente quieres borrar todo?')) {
            try {
                await clearAllData();
                localStorage.clear();
                activeVehicle = null;
                alert('✅ Todos los datos han sido eliminados');
                location.reload();
            } catch (error) {
                alert('Error al borrar datos: ' + error.message);
            }
        }
    }
}

// MODIFY EXISTING FUNCTIONS TO FILTER BY VEHICLE:
// In loadRepostajes(), loadAlmacen(), loadTaller():
// Add filter: records.filter(r => r.matricula === activeVehicle)

// In save functions (saveRepostaje, saveAlmacen, saveTaller):
// Add matricula to data object: matricula: activeVehicle

// In loadEstadisticas():
// Filter data by activeVehicle before processing
// Use statsView to determine mensual vs anual display

// In exportToCSV():
// Add Matrícula column to each section
```

## Manual Integration Steps:
1. Copy vehicle functions to end of app.js
2. Modify existing load functions to filter by activeVehicle
3. Modify existing save functions to add matricula field
4. Update loadEstadisticas() to respect statsView toggle
5. Update exportToCSV() to include Matrícula column

## Testing:
1. Add first vehicle
2. Add fuel/parts/workshop records
3. Switch vehicle in header selector
4. Verify filtering works
5. Test mensual/anual toggle
6. Export CSV and verify Matrícula column
7. Test reset button (after export!)
