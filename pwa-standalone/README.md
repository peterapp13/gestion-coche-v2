# Gestión de Vehículo - PWA Standalone

## 🚗 Aplicación Web Progresiva para Gestión de Vehículos

### Características:

✅ **Sin dependencias externas** - Funciona 100% offline
✅ **Sin backend** - Todos los datos se guardan localmente (IndexedDB)
✅ **Sin autenticación** - Privacidad total, datos solo en tu dispositivo
✅ **PWA Completa** - Instalable en móvil y desktop
✅ **CRUD Completo** - Crear, Leer, Actualizar y Eliminar en todos los módulos
✅ **Auto-cálculos** - KM Gastados y Consumo (L/100km) automáticos
✅ **Exportar a CSV** - Descarga todos tus datos

### Módulos:

1. **⛽ Repostajes**
   - Registro completo de repostajes
   - Cálculo automático de KM gastados
   - Cálculo automático de consumo (L/100km)
   - Editar y eliminar registros

2. **📦 Almacén**
   - Gestión de recambios
   - Estados: Pendiente / Instalado
   - Editar y eliminar piezas

3. **🔧 Taller**
   - Registro de mantenimiento
   - KM y fecha de instalación
   - Notas técnicas
   - Editar y eliminar trabajos

4. **📊 Exportar**
   - Exportar todos los datos a CSV
   - Compatible con Excel y Google Sheets
   - Estadísticas generales

### Instalación:

**iPhone/iPad:**
1. Abre Safari
2. Navega a la URL
3. Toca el botón Compartir (📤)
4. Selecciona "Añadir a pantalla de inicio"

**Android:**
1. Abre Chrome
2. Navega a la URL
3. Toca el menú (⋮)
4. Selecciona "Instalar app"

**Desktop:**
1. Abre Chrome/Edge
2. Navega a la URL
3. Clic en el icono de instalación (⊕) en la barra de direcciones

### Tecnologías:

- **HTML5** - Estructura semántica
- **CSS3** - Diseño responsive y dark mode
- **JavaScript ES6+** - Lógica de aplicación
- **IndexedDB** - Almacenamiento local de datos
- **Service Worker** - Funcionalidad offline
- **Web App Manifest** - Instalación como PWA

### Uso:

1. **Añadir registros**: Toca el botón "+" en cada sección
2. **Editar**: Toca el botón ✏️ en cualquier registro
3. **Eliminar**: Toca el botón 🗑️ (confirmación requerida)
4. **Exportar**: Ve a la sección Exportar y descarga el CSV

### Privacidad:

🔒 **Todos los datos se almacenan SOLO en tu dispositivo**
- No hay servidor
- No hay base de datos en la nube
- No se envía información a internet
- Privacidad total

### Backup:

💾 **Importante**: Como los datos están solo en tu dispositivo:
- Exporta regularmente a CSV
- Guarda los archivos CSV en la nube (Google Drive, iCloud, etc.)
- Al cambiar de dispositivo, puedes importar los datos manualmente

### Archivos del proyecto:

```
pwa-standalone/
├── index.html        # Página principal
├── styles.css        # Estilos (dark mode, responsive)
├── app.js            # Lógica de la aplicación
├── db.js             # Gestión de IndexedDB
├── sw.js             # Service Worker (offline)
├── manifest.json     # Web App Manifest (PWA)
├── icon-192.png      # Icono 192x192
├── icon-512.png      # Icono 512x512
└── README.md         # Este archivo
```

### Desarrollo:

Para ejecutar localmente:

```bash
# Servidor simple con Python
python -m http.server 8000

# O con Node.js
npx http-server
```

Luego abre: `http://localhost:8000`

### Soporte de navegadores:

✅ Chrome/Edge 90+
✅ Firefox 88+
✅ Safari 14+ (iOS/macOS)
✅ Samsung Internet 14+

---

**Versión**: 1.0.0  
**Licencia**: MIT  
**Autor**: Gestión de Vehículo PWA