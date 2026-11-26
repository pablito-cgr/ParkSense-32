# 🚗 Smart Parking — La Piazza (Machala, Ecuador)

Sistema inteligente de gestión de estacionamientos con arquitectura **SPA Full Stack** (Node.js + Express + HTML5/CSS3/JS vanilla) preparado para integración con microcontrolador **ESP32**, sensores ultrasónicos **HC-SR04** y control automatizado de barreras mediante servomotores.

---

## 🏗️ Arquitectura General

Aplicación web de **página única (SPA)** con tres modos de funcionamiento:

| Modo | Ruta | Acceso |
|------|------|--------|
| Público / Comercial | `/` o `/landing` | Cualquier visitante |
| Autoservicio (Kiosco) | `/kiosco` | Conductores (pantalla táctil) |
| Administración | Panel dentro de la SPA | PIN `1234` o contraseña `admin123` |

Todos los modos comparten el **mismo estado** de los 4 espacios de estacionamiento. No hay datos independientes ni decorativos.

---

## 📂 Estructura de Archivos

```
smart-parking/
├── public/
│   ├── index.html          # SPA principal (3 modos: público, kiosco, admin)
│   ├── styles.css          # Diseño dark glassmorphism completo
│   ├── app.js              # Lógica frontend: 8 opciones kiosco, ROI, admin
│   └── logo.svg            # Logotipo Smart Parking
├── esp32_smart_parking/    # Código fuente Arduino/ESP32
├── server.js               # Servidor Express con todas las APIs REST
├── config.json             # Credenciales, PIN y configuración
├── datos.json              # Persistencia de estado (espacios + movimientos)
├── package.json
└── README.md
```

---

## 🚀 Iniciar el Sistema

```bash
npm install
npm start
```

Luego abre: **http://localhost:3000**

---

## 🌐 Modo 1: Página Comercial / Publicitaria

Página principal accesible para cualquier visitante. Contiene:

- **Hero:** Nombre, eslogan, estado en tiempo real de los 4 espacios, métricas clave.
- **Estado en Vivo:** 4 tarjetas con estado real (libre/ocupado/reservado), actualización automática cada 3 s.
- **Nuestra Solución:** Descripción del problema que resuelve Smart Parking.
- **Tecnologías:** Tarjetas de los 5 componentes del sistema:
  - ESP32 (control central)
  - Sensores ultrasónicos HC-SR04 (detección)
  - Servomotor SG90 (barrera)
  - Sensor infrarrojo (detección complementaria)
  - Buzzer (señalización sonora — integración futura)
- **Comparativa:** Tabla estacionamiento tradicional vs Smart Parking.
- **Calculadora ROI:** Deslizador de afluencia vehicular → tiempo ahorrado, combustible y CO₂.
- **Cómo Funciona:** Proceso paso a paso.
- **Contacto / Footer.**

---

## 🖥️ Modo 2: Kiosco de Autoservicio

Interfaz táctil diseñada para conductores en la entrada del estacionamiento. **8 opciones reales:**

| # | Opción | Descripción |
|---|--------|-------------|
| 1 | Consultar Disponibilidad | Vista general de los 4 espacios con colores (verde/rojo/amarillo) |
| 2 | Registrar Entrada | Flujo de 5 pasos: placa → verificación → recomendación → confirmación → ticket |
| 3 | Registrar Salida | Busca vehículo por placa → confirma → libera espacio |
| 4 | Estado de un Espacio | Selecciona un espacio y ve detalle completo |
| 5 | ¿Dónde Dejé Mi Auto? | Localizador por placa para conductores que olvidaron el espacio |
| 6 | Instrucciones de Uso | Guía rápida del sistema |
| 7 | Información del Sistema | Datos técnicos del proyecto |
| 8 | Asistencia / Incidencias | Reporte de problemas al operador |

### Reglas especiales del flujo de entrada:
- **Último espacio:** Si solo queda 1 espacio disponible, el sistema lo asigna automáticamente sin opción de elegir.
- **Estacionamiento lleno:** Muestra aviso y bloquea el registro de entrada.
- **Duplicado de placa:** Rechaza el intento si el vehículo ya tiene una entrada activa.
- **Espacio ocupado:** No puede asignarse a un segundo vehículo.

### Seguridad del kiosco:
- La pantalla permanece fija en modo autoservicio.
- El conductor **no puede** escapar al modo público ni al admin.
- El acceso admin requiere PIN mediante **`Ctrl+Shift+A`**.
- Sesión de administrador expira automáticamente en **15 minutos** de inactividad.

---

## 🛡️ Modo 3: Panel de Administración

Acceso: `Ctrl+Shift+A` → PIN `1234` o contraseña `admin123`.

Funcionalidades:
- **Estadísticas:** Total entradas/salidas del día, pico de aforo, incidencias.
- **Tarjetas de espacios:** Estado en tiempo real, forzar liberación, marcar como reservado/mantenimiento.
- **Control de barrera:** Apertura/cierre remoto (cada acción cierra automáticamente en 5 s).
- **Historial de movimientos:** Tabla completa de entradas y salidas con filtros por placa y espacio.
- **Descarga CSV:** Exportación del historial completo.
- **Cambio de credenciales:** Usuario, contraseña y PIN en caliente (guarda en `config.json`).

---

## 🔌 API REST

### Kiosco (público)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/kiosco/resumen` | Estado de los 4 espacios + totales + alerta |
| `POST` | `/api/kiosco/verificar-disponibilidad` | Verificar placa y obtener recomendación |
| `POST` | `/api/kiosco/entrada` | Registrar entrada de vehículo |
| `POST` | `/api/kiosco/buscar-salida` | Buscar vehículo activo por placa |
| `POST` | `/api/kiosco/salida` | Registrar salida de vehículo |
| `GET` | `/api/kiosco/espacio/:id` | Detalle de un espacio específico |
| `POST` | `/api/kiosco/buscar-vehiculo` | Localizador de vehículo por placa |
| `POST` | `/api/kiosco/asistencia` | Registrar solicitud de asistencia |

### Admin (requiere `Authorization: Bearer <token>`)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/admin/verificar-pin` | Verificar PIN o contraseña → devuelve token |
| `POST` | `/api/admin/login` | Login con usuario + contraseña |
| `GET` | `/api/admin/verificar` | Verificar sesión activa |
| `GET` | `/api/admin/movimientos` | Historial con filtros (`?placa=&espacio=`) |
| `POST` | `/api/admin/liberar-espacio` | Forzar liberación de un espacio |
| `POST` | `/api/admin/cambiar-estado-espacio` | Cambiar estado a reservado/mantenimiento/disponible |
| `POST` | `/api/admin/barrera` | Control remoto de barrera |
| `GET` | `/api/admin/reporte-csv` | Descargar historial en CSV |
| `POST` | `/api/admin/cambiar-clave` | Cambiar usuario/contraseña/PIN |

### Hardware (ESP32)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/hardware/telemetria` | Envío de distancias ultrasónicas desde ESP32 |
| `POST` | `/api/estado` | Alias de telemetría (compatibilidad legada) |

---

## ⚙️ Configuración

Archivo `config.json`:
```json
{
  "usuario": "cristhian",
  "password": "admin123",
  "pinKiosco": "1234",
  "jwtSecret": "smart-parking-secret-key-2025"
}
```

---

## 📡 Integración ESP32

La telemetría del hardware actualiza únicamente el campo `distanciaHardware` de cada espacio. **No modifica** el estado de ocupación (`ocupada`), que es gestionado exclusivamente por el software de registro de entradas/salidas.

Formato del payload de telemetría:
```json
{
  "sensores": [
    { "id": 1, "distancia": 15 },
    { "id": 2, "distancia": 98 }
  ]
}
```

---

## 🔐 Credenciales por Defecto

| Concepto | Valor |
|----------|-------|
| Usuario admin | `cristhian` |
| Contraseña admin | `admin123` |
| PIN kiosco | `1234` |
| Token admin | `smart-parking-admin-token-piazza-machala` |

---

## 🛠️ Tecnologías Utilizadas

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js 18+, Express 4 |
| Frontend | HTML5, CSS3, JavaScript ES2022 (vanilla) |
| Diseño | Dark Glassmorphism, variables CSS, gradientes |
| Tipografía | Plus Jakarta Sans (Google Fonts) |
| Persistencia | JSON file (`datos.json`) |
| Hardware | ESP32 DevKit, HC-SR04, SG90, IR sensor, Buzzer |
