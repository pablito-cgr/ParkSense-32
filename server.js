/**
 * Smart Parking - Servidor Web & API Central
 * Caso de Estudio: La Piazza, Machala, Ecuador
 * Integra:
 *  - Modo Público (Página Publicitaria y Comercial)
 *  - Modo Estacionamiento (Kiosco de Autoservicio con 8 Opciones)
 *  - Consola Administrativa Protegida
 *  - Preparado para integración física con microcontrolador ESP32
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const DATA_DIR = path.join(__dirname, 'data');

// Crea la carpeta 'data' si no existe y copia los archivos iniciales si están en la raíz
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
['datos.json', 'config.json'].forEach((archivo) => {
  const origen = path.join(__dirname, archivo);
  const destino = path.join(DATA_DIR, archivo);
  if (fs.existsSync(origen) && !fs.existsSync(destino)) {
    fs.copyFileSync(origen, destino);
  }
});

const DATA_FILE = path.join(DATA_DIR, 'datos.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const ADMIN_TOKEN = 'smart-parking-admin-token-piazza-machala';

// ======================================================
// GESTIÓN DE CREDENCIALES (config.json)
// ======================================================
function obtenerCredencialesAdmin() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const contenido = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const cfg = JSON.parse(contenido);
      if (cfg && cfg.usuario && cfg.password) {
        return {
          usuario: String(cfg.usuario).trim(),
          password: String(cfg.password).trim(),
          pinKiosco: String(cfg.pinKiosco || '1234').trim()
        };
      }
    }
  } catch (error) {
    console.error('Error al leer config.json:', error.message);
  }
  return { usuario: 'cristhian', password: 'admin123', pinKiosco: '1234' };
}

function guardarCredencialesAdmin(nuevoUsuario, nuevaPassword, nuevoPin = null) {
  const credsActuales = obtenerCredencialesAdmin();
  const nuevaConfig = {
    usuario: String(nuevoUsuario || credsActuales.usuario).trim(),
    password: String(nuevaPassword || credsActuales.password).trim(),
    pinKiosco: String(nuevoPin !== null ? nuevoPin : credsActuales.pinKiosco).trim()
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(nuevaConfig, null, 2), 'utf-8');
  console.log(`[Admin] Credenciales guardadas: Usuario "${nuevaConfig.usuario}" | PIN Kiosco actualizado`);
  return nuevaConfig;
}

// ======================================================
// GESTIÓN DE BASE DE DATOS OPERATIVA (datos.json)
// ======================================================
function obtenerFechaHoraEcuador() {
  return new Date().toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil',
    hour12: false
  });
}

function inicializarEspaciosPorDefecto() {
  return [
    { id: 1, codigo: 'A1', ocupada: false, estado: 'disponible', vehiculo: null, distanciaHardware: -1 },
    { id: 2, codigo: 'A2', ocupada: false, estado: 'disponible', vehiculo: null, distanciaHardware: -1 },
    { id: 3, codigo: 'B1', ocupada: false, estado: 'disponible', vehiculo: null, distanciaHardware: -1 },
    { id: 4, codigo: 'B2', ocupada: false, estado: 'disponible', vehiculo: null, distanciaHardware: -1 }
  ];
}

const CODIGOS_POR_ID = { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2' };

function cargarDatos() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const contenido = fs.readFileSync(DATA_FILE, 'utf-8');
      const raw = JSON.parse(contenido);

      // Migración o carga de los 4 espacios A1, A2, B1, B2
      let espacios = inicializarEspaciosPorDefecto();
      if (Array.isArray(raw.espacios) && raw.espacios.length === 4) {
        espacios = raw.espacios.map(e => ({
          ...e,
          codigo: CODIGOS_POR_ID[e.id] || e.codigo
        }));
      } else if (Array.isArray(raw.ultimoEstado) && raw.ultimoEstado.length === 4) {
        espacios = raw.ultimoEstado.map(p => ({
          id: Number(p.id),
          codigo: CODIGOS_POR_ID[Number(p.id)] || `A${p.id}`,
          ocupada: Boolean(p.ocupada),
          estado: Boolean(p.ocupada) ? 'ocupado' : 'disponible',
          vehiculo: p.vehiculo || (p.ocupada ? { placa: `DEF-000${p.id}`, horaIngreso: obtenerFechaHoraEcuador(), movimientoId: `MOV-INIT-${p.id}` } : null),
          distanciaHardware: typeof p.distancia === 'number' ? p.distancia : -1
        }));
      }

      return {
        espacios,
        movimientos: Array.isArray(raw.movimientos) ? raw.movimientos : (Array.isArray(raw.historial) ? raw.historial.map(h => ({
          id: String(h.id || Date.now()),
          tipo: h.mensaje && h.mensaje.includes('libre a ocupada') ? 'ENTRADA' : 'SALIDA',
          placa: h.placa || 'DESC-000',
          espacio: CODIGOS_POR_ID[h.plazaId || 1] || 'A1',
          espacioId: h.plazaId || 1,
          fechaHora: h.fechaHora || obtenerFechaHoraEcuador(),
          timestamp: h.timestamp || Date.now(),
          estado: 'HISTÓRICO'
        })) : []),
        contadorMovimientos: Number(raw.contadorMovimientos || 100),
        barreras: raw.barreras || { entrada: 'cerrada', salida: 'cerrada' },
        estadisticas: raw.estadisticas || { totalIngresos: 0, totalSalidas: 0, picoOcupacion: 0 },
        incidencias: Array.isArray(raw.incidencias) ? raw.incidencias : [],
        ultimaActualizacion: raw.ultimaActualizacion || new Date().toISOString()
      };
    }
  } catch (error) {
    console.error('Error al leer datos.json, inicializando nuevo estado:', error.message);
  }

  return {
    espacios: inicializarEspaciosPorDefecto(),
    movimientos: [],
    contadorMovimientos: 100,
    barreras: { entrada: 'cerrada', salida: 'cerrada' },
    estadisticas: { totalIngresos: 0, totalSalidas: 0, picoOcupacion: 0 },
    incidencias: [],
    ultimaActualizacion: new Date().toISOString()
  };
}

let db = cargarDatos();

// Cola de comandos pendientes hacia el ESP32 (se entregan en el siguiente POST /api/estado)
let comandosPendientes = {
  entrada: null, // 'abrir_auto' | 'abrir' | 'cerrar' | null
  salida: null   // 'abrir_auto' | 'abrir' | 'cerrar' | null
};

function guardarDatos() {
  try {
    db.ultimaActualizacion = new Date().toISOString();
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error al guardar datos.json:', error.message);
  }
}

function generarSiguienteMovimientoId() {
  db.contadorMovimientos++;
  const pad = String(db.contadorMovimientos).padStart(4, '0');
  return `MOV-${pad}`;
}

function normalizarPlaca(placa) {
  if (!placa) return '';
  return String(placa).toUpperCase().replace(/[^A-Z0-9-]/g, '').trim();
}

function esTokenAdminValido(req) {
  const authHeader = req.headers['authorization'] || req.headers['x-admin-token'] || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim() === ADMIN_TOKEN;
  }
  return authHeader.trim() === ADMIN_TOKEN;
}

// ======================================================
// RESUMEN Y REGLAS DE NEGOCIO DEL ESTACIONAMIENTO
// ======================================================
function obtenerResumenKiosco() {
  let ocupados = 0;
  let disponibles = 0;
  let reservados = 0;

  const listaEspacios = db.espacios.map(e => {
    if (e.estado === 'reservado' || e.estado === 'mantenimiento') {
      reservados++;
    } else if (e.ocupada || e.estado === 'ocupado') {
      ocupados++;
    } else {
      disponibles++;
    }
    return {
      id: e.id,
      codigo: e.codigo,
      ocupada: e.ocupada,
      estado: e.estado,
      vehiculo: e.vehiculo ? { placa: e.vehiculo.placa, horaIngreso: e.vehiculo.horaIngreso, movimientoId: e.vehiculo.movimientoId } : null,
      distanciaHardware: e.distanciaHardware
    };
  });

  const total = listaEspacios.length; // 4
  db.estadisticas.picoOcupacion = Math.max(db.estadisticas.picoOcupacion, ocupados + reservados);

  // Reglas de alerta
  let alerta = {
    tipo: 'NORMAL',
    mensaje: 'Espacios disponibles para estacionar.',
    soloUnoDisponible: false,
    espacioUnico: null
  };

  if (disponibles === 0) {
    alerta = {
      tipo: 'LLENO',
      mensaje: 'Lo sentimos, actualmente no hay espacios disponibles.',
      soloUnoDisponible: false,
      espacioUnico: null
    };
  } else if (disponibles === 1) {
    const unico = listaEspacios.find(e => !e.ocupada && e.estado === 'disponible');
    alerta = {
      tipo: 'ULTIMO_ESPACIO',
      mensaje: `¡Atención! Solamente queda un espacio disponible. El espacio ${unico ? unico.codigo : ''} es la única opción disponible para estacionar.`,
      soloUnoDisponible: true,
      espacioUnico: unico ? unico.codigo : null,
      espacioUnicoId: unico ? unico.id : null
    };
  }

  return {
    espacios: listaEspacios,
    totales: {
      total,
      ocupados,
      disponibles,
      reservados,
      porcentajeOcupacion: Math.round(((ocupados + reservados) / total) * 100)
    },
    alerta,
    barreras: db.barreras,
    estadisticas: db.estadisticas,
    ultimaActualizacion: db.ultimaActualizacion
  };
}

// Generador de reporte CSV
function generarCSVHistorialMovimientos() {
  let csv = '\uFEFF'; // BOM para compatibilidad con Excel
  csv += 'Nro Movimiento,Tipo,Placa,Espacio,Fecha y Hora,Estado,Estancia (Minutos),Detalle\r\n';

  (db.movimientos || []).forEach(m => {
    const estancia = m.tiempoEstanciaMinutos !== undefined ? m.tiempoEstanciaMinutos : '-';
    const detalle = m.notas ? m.notas.replace(/"/g, '""') : '';
    csv += `"${m.id}","${m.tipo}","${m.placa}","${m.espacio}","${m.fechaHora}","${m.estado || ''}","${estancia}","${detalle}"\r\n`;
  });

  return csv;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

// ======================================================
// CONFIGURACIÓN DEL SERVIDOR HTTP (EXPRESS / NATIVO)
// ======================================================
function iniciarServidor() {
  try {
    const express = require('express');
    const cors = require('cors');

    const app = express();
    app.disable('x-powered-by');
    app.use(cors());

    // Cabeceras de seguridad HTTP
    app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      next();
    });

    // Bloqueo explícito de archivos sensibles de la raíz
    app.use((req, res, next) => {
      const p = req.path.toLowerCase();
      if (
        p.includes('..') ||
        p.endsWith('server.js') ||
        p.endsWith('config.json') ||
        p.endsWith('datos.json') ||
        p.endsWith('package.json') ||
        p.endsWith('package-lock.json') ||
        p.includes('.env')
      ) {
        return res.status(403).json({ error: 'Acceso denegado.' });
      }
      next();
    });

    // Rate limiting ligero por IP (permite hasta 180 req/min al ESP32 y 100 req/min a otras APIs)
    const rateLimitMap = new Map();
    app.use('/api/', (req, res, next) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const esHardware = req.path === '/estado' || req.path === '/hardware/telemetria';
      const limite = esHardware ? 180 : 100;
      const ahora = Date.now();

      let registro = rateLimitMap.get(ip);
      if (!registro || ahora - registro.inicio > 60000) {
        registro = { inicio: ahora, conteo: 1 };
      } else {
        registro.conteo++;
      }
      rateLimitMap.set(ip, registro);

      if (registro.conteo > limite) {
        return res.status(429).json({ error: 'Demasiadas peticiones. Intenta nuevamente en un minuto.' });
      }
      next();
    });

    app.use(express.json({ limit: '10kb' }));
    app.use(express.static(PUBLIC_DIR, { dotfiles: 'deny' }));

    // Rutas directas para modos
    app.get(['/publicidad', '/landing'], (req, res) => {
      res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
    });
    app.get(['/kiosco', '/estacionamiento'], (req, res) => {
      res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
    });

    // ----------------------------------------------------
    // ENDPOINTS DEL MODO ESTACIONAMIENTO (KIOSCO AUTOSERVICIO)
    // ----------------------------------------------------

    // 1. GET /api/kiosco/resumen (Opción 1 y actualización general)
    app.get('/api/kiosco/resumen', (req, res) => {
      res.json(obtenerResumenKiosco());
    });

    // 2. POST /api/kiosco/verificar-disponibilidad (Paso previo Opción 2)
    app.post('/api/kiosco/verificar-disponibilidad', (req, res) => {
      const placa = normalizarPlaca(req.body.placa);

      if (!placa || placa.length < 3) {
        return res.status(400).json({
          valido: false,
          error: 'Por favor, ingresa una placa de vehículo válida (mínimo 3 caracteres).'
        });
      }

      // Validar si el vehículo ya se encuentra dentro del estacionamiento
      const espacioOcupadoPorVehiculo = db.espacios.find(e => e.ocupada && e.vehiculo && normalizarPlaca(e.vehiculo.placa) === placa);
      if (espacioOcupadoPorVehiculo) {
        return res.status(400).json({
          valido: false,
          error: `Vehículo ya registrado: la placa ${placa} ya se encuentra en el espacio ${espacioOcupadoPorVehiculo.codigo}.`
        });
      }

      const resumen = obtenerResumenKiosco();
      if (resumen.totales.disponibles === 0) {
        return res.status(400).json({
          valido: false,
          error: 'Lo sentimos, actualmente no hay espacios disponibles.'
        });
      }

      // Recomendación automática: primer espacio disponible ordenado (E1, E2, E3, E4)
      const espaciosLibres = db.espacios.filter(e => !e.ocupada && e.estado === 'disponible');
      const recomendado = espaciosLibres[0];

      res.json({
        valido: true,
        placa,
        espaciosLibres: espaciosLibres.map(e => ({ id: e.id, codigo: e.codigo })),
        recomendado: { id: recomendado.id, codigo: recomendado.codigo },
        soloUnoDisponible: resumen.alerta.soloUnoDisponible,
        espacioUnico: resumen.alerta.espacioUnico
      });
    });

    // 3. POST /api/kiosco/entrada (Opción 2: Registrar Entrada)
    app.post('/api/kiosco/entrada', (req, res) => {
      const placa = normalizarPlaca(req.body.placa);
      const espacioId = Number(req.body.espacioId);

      if (!placa || placa.length < 3) {
        return res.status(400).json({ success: false, error: 'Placa inválida.' });
      }

      // Revalidación: vehículo ya dentro
      const existe = db.espacios.find(e => e.ocupada && e.vehiculo && normalizarPlaca(e.vehiculo.placa) === placa);
      if (existe) {
        return res.status(400).json({
          success: false,
          error: `El vehículo con placa ${placa} ya se encuentra registrado en el espacio ${existe.codigo}.`
        });
      }

      // Revalidación del espacio
      const espacio = db.espacios.find(e => e.id === espacioId);
      if (!espacio) {
        return res.status(400).json({ success: false, error: 'Espacio de estacionamiento no encontrado.' });
      }

      if (espacio.ocupada || espacio.estado !== 'disponible') {
        return res.status(400).json({
          success: false,
          error: `El espacio ${espacio.codigo} ya no está disponible. Por favor, selecciona otro lugar.`
        });
      }

      const movId = generarSiguienteMovimientoId();
      const fechaHoraActual = obtenerFechaHoraEcuador();
      const timestampActual = Date.now();

      // Asignar el espacio
      espacio.ocupada = true;
      espacio.estado = 'ocupado';
      espacio.vehiculo = {
        placa,
        horaIngreso: fechaHoraActual,
        timestamp: timestampActual,
        movimientoId: movId
      };

      // Registrar movimiento de entrada en historial
      const movimientoEntrada = {
        id: movId,
        tipo: 'ENTRADA',
        placa,
        espacio: espacio.codigo,
        espacioId: espacio.id,
        fechaHora: fechaHoraActual,
        timestamp: timestampActual,
        estado: 'ACTIVO',
        notas: 'Entrada registrada mediante autoservicio de estacionamiento'
      };

      db.movimientos.unshift(movimientoEntrada);
      db.estadisticas.totalIngresos++;

      // Ordenar al ESP32 abrir la barrera de entrada hasta que pase el vehículo
      db.barreras.entrada = 'abierta';
      comandosPendientes.entrada = 'abrir_auto';

      guardarDatos();

      console.log(`[Entrada] Vehículo ${placa} asignado a ${espacio.codigo} con ${movId}`);

      res.json({
        success: true,
        mensaje: `Entrada registrada con éxito. Espacio asignado: ${espacio.codigo}`,
        movimiento: movimientoEntrada,
        resumen: obtenerResumenKiosco()
      });
    });

    // 4. POST /api/kiosco/buscar-salida (Opción 3 - Paso 1: Buscar Vehículo para Salir)
    app.post('/api/kiosco/buscar-salida', (req, res) => {
      const placa = normalizarPlaca(req.body.placa);

      if (!placa) {
        return res.status(400).json({ encontrado: false, error: 'Por favor, ingresa una placa de vehículo.' });
      }

      const espacioConVehiculo = db.espacios.find(e => e.ocupada && e.vehiculo && normalizarPlaca(e.vehiculo.placa) === placa);

      if (!espacioConVehiculo || !espacioConVehiculo.vehiculo) {
        return res.status(404).json({
          encontrado: false,
          error: `No se encontró ningún vehículo activo con la placa "${placa}" en el estacionamiento.`
        });
      }

      const vehiculo = espacioConVehiculo.vehiculo;
      const minutosTranscurridos = Math.max(1, Math.round((Date.now() - (vehiculo.timestamp || Date.now())) / 60000));

      res.json({
        encontrado: true,
        datos: {
          placa: vehiculo.placa,
          espacio: espacioConVehiculo.codigo,
          espacioId: espacioConVehiculo.id,
          horaIngreso: vehiculo.horaIngreso,
          movimientoId: vehiculo.movimientoId,
          minutosTranscurridos
        }
      });
    });

    // 5. POST /api/kiosco/salida (Opción 3 - Paso 2: Confirmar Salida de Vehículo)
    app.post('/api/kiosco/salida', (req, res) => {
      const placa = normalizarPlaca(req.body.placa);

      if (!placa) {
        return res.status(400).json({ success: false, error: 'Placa inválida.' });
      }

      const espacio = db.espacios.find(e => e.ocupada && e.vehiculo && normalizarPlaca(e.vehiculo.placa) === placa);

      if (!espacio || !espacio.vehiculo) {
        return res.status(404).json({
          success: false,
          error: `El vehículo con placa ${placa} no tiene un registro de entrada activo en el estacionamiento.`
        });
      }

      const vehiculo = espacio.vehiculo;
      const fechaHoraSalida = obtenerFechaHoraEcuador();
      const timestampSalida = Date.now();
      const movIdSalida = generarSiguienteMovimientoId();
      const minutosEstancia = Math.max(1, Math.round((timestampSalida - (vehiculo.timestamp || timestampSalida)) / 60000));

      // Liberar espacio
      const codigoEspacio = espacio.codigo;
      espacio.ocupada = false;
      espacio.estado = 'disponible';
      espacio.vehiculo = null;

      // Actualizar estado del movimiento de entrada original si existe
      const movEntrada = db.movimientos.find(m => m.id === vehiculo.movimientoId && m.tipo === 'ENTRADA');
      if (movEntrada) {
        movEntrada.estado = 'SALIDA_REGISTRADA';
      }

      // Registrar movimiento de salida en historial permanente
      const movimientoSalida = {
        id: movIdSalida,
        movimientoEntradaId: vehiculo.movimientoId,
        tipo: 'SALIDA',
        placa,
        espacio: codigoEspacio,
        espacioId: espacio.id,
        horaIngreso: vehiculo.horaIngreso,
        fechaHora: fechaHoraSalida,
        timestamp: timestampSalida,
        tiempoEstanciaMinutos: minutosEstancia,
        estado: 'SALIDA_REGISTRADA',
        notas: `Salida confirmada por autoservicio. Tiempo de estancia: ${minutosEstancia} min.`
      };

      db.movimientos.unshift(movimientoSalida);
      db.estadisticas.totalSalidas++;

      // Ordenar al ESP32 abrir la barrera de salida hasta que pase el vehículo
      db.barreras.salida = 'abierta';
      comandosPendientes.salida = 'abrir_auto';

      guardarDatos();

      console.log(`[Salida] Vehículo ${placa} liberó ${codigoEspacio} con ${movIdSalida}`);

      res.json({
        success: true,
        mensaje: `Salida registrada exitosamente para el vehículo ${placa}. Espacio ${codigoEspacio} liberado.`,
        movimiento: movimientoSalida,
        resumen: obtenerResumenKiosco()
      });
    });

    // 6. GET /api/kiosco/espacio/:id (Opción 4: Consultar Estado Individual de un Espacio)
    app.get('/api/kiosco/espacio/:id', (req, res) => {
      const id = Number(req.params.id);
      const espacio = db.espacios.find(e => e.id === id);

      if (!espacio) {
        return res.status(404).json({ error: 'Espacio no encontrado.' });
      }

      res.json({
        id: espacio.id,
        codigo: espacio.codigo,
        ocupada: espacio.ocupada,
        estado: espacio.estado,
        vehiculo: espacio.vehiculo ? {
          placa: espacio.vehiculo.placa,
          horaIngreso: espacio.vehiculo.horaIngreso,
          movimientoId: espacio.vehiculo.movimientoId
        } : null,
        distanciaHardware: espacio.distanciaHardware
      });
    });

    // 7. POST /api/kiosco/buscar-vehiculo (Opción 5: Localizador "¿Dónde estacioné?")
    app.post('/api/kiosco/buscar-vehiculo', (req, res) => {
      const placa = normalizarPlaca(req.body.placa);

      if (!placa) {
        return res.status(400).json({ error: 'Por favor, ingresa la placa de tu vehículo.' });
      }

      const espacio = db.espacios.find(e => e.ocupada && e.vehiculo && normalizarPlaca(e.vehiculo.placa) === placa);

      if (!espacio || !espacio.vehiculo) {
        return res.status(404).json({
          encontrado: false,
          error: `No encontramos ningún vehículo con la placa "${placa}" estacionado actualmente.`
        });
      }

      const mins = Math.max(1, Math.round((Date.now() - (espacio.vehiculo.timestamp || Date.now())) / 60000));

      res.json({
        encontrado: true,
        placa: espacio.vehiculo.placa,
        espacio: espacio.codigo,
        espacioId: espacio.id,
        horaIngreso: espacio.vehiculo.horaIngreso,
        tiempoMinutos: mins,
        indicaciones: `Tu vehículo se encuentra en el espacio ${espacio.codigo}. Al ingresar, sigue por el carril central.`
      });
    });

    // 8. POST /api/kiosco/asistencia (Opción 8: Reporte de Incidencias / Llamada a Cabina)
    app.post('/api/kiosco/asistencia', (req, res) => {
      const { tipo, mensaje, placa } = req.body || {};
      const incidencia = {
        id: Date.now(),
        fechaHora: obtenerFechaHoraEcuador(),
        tipo: tipo || 'SOLICITUD_ASISTENCIA',
        mensaje: mensaje || 'Conductor solicita asistencia en pantalla de autoservicio',
        placa: normalizarPlaca(placa) || 'N/A',
        estado: 'PENDIENTE'
      };

      db.incidencias.unshift(incidencia);
      guardarDatos();

      console.log(`[Asistencia] Nueva incidencia registrada: ${incidencia.mensaje}`);

      res.json({
        success: true,
        mensaje: 'Tu solicitud de asistencia ha sido enviada al operador en cabina. Un asistente se acercará en breve.',
        incidencia
      });
    });

    // ----------------------------------------------------
    // ENDPOINTS DE SEGURIDAD Y ADMINISTRACIÓN
    // ----------------------------------------------------

    // 9. POST /api/admin/verificar-pin (Para salir del Kiosco o acceder a Admin)
    app.post('/api/admin/verificar-pin', (req, res) => {
      const { pin, password } = req.body || {};
      const creds = obtenerCredencialesAdmin();

      const esPinValido = pin && String(pin).trim() === creds.pinKiosco;
      const esClaveValida = password && String(password).trim() === creds.password;

      if (esPinValido || esClaveValida) {
        return res.json({
          valido: true,
          token: ADMIN_TOKEN,
          usuario: creds.usuario,
          mensaje: 'PIN / Credencial verificada correctamente'
        });
      }

      return res.status(401).json({
        valido: false,
        error: 'PIN o contraseña de administrador incorrecta.'
      });
    });

    // 10. POST /api/admin/login (Login Tradicional con Usuario y Contraseña)
    app.post('/api/admin/login', (req, res) => {
      const { usuario, password } = req.body || {};
      const creds = obtenerCredencialesAdmin();

      if (usuario === creds.usuario && password === creds.password) {
        return res.json({
          success: true,
          mensaje: 'Autenticación exitosa',
          token: ADMIN_TOKEN,
          usuario: creds.usuario
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Usuario o contraseña de administrador incorrectos'
      });
    });

    // 11. GET /api/admin/verificar (Verifica si la sesión sigue activa)
    app.get('/api/admin/verificar', (req, res) => {
      if (esTokenAdminValido(req)) {
        return res.json({ autenticado: true, usuario: obtenerCredencialesAdmin().usuario });
      }
      return res.status(401).json({ autenticado: false });
    });

    // 12. GET /api/admin/movimientos (Historial de Auditoría con Filtros)
    app.get('/api/admin/movimientos', (req, res) => {
      if (!esTokenAdminValido(req)) {
        return res.status(401).json({ error: 'Acceso exclusivo para el administrador.' });
      }

      const filtroPlaca = normalizarPlaca(req.query.placa);
      const filtroEspacio = req.query.espacio ? String(req.query.espacio).trim().toUpperCase() : '';

      let lista = db.movimientos || [];
      if (filtroPlaca) {
        lista = lista.filter(m => m.placa.includes(filtroPlaca));
      }
      if (filtroEspacio) {
        lista = lista.filter(m => m.espacio === filtroEspacio);
      }

      res.json({
        movimientos: lista,
        incidencias: db.incidencias || [],
        resumen: obtenerResumenKiosco()
      });
    });

    // 13. POST /api/admin/liberar-espacio (Corrección/Desocupación forzada por el admin)
    app.post('/api/admin/liberar-espacio', (req, res) => {
      if (!esTokenAdminValido(req)) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const espacioId = Number(req.body.espacioId);
      const motivo = req.body.motivo || 'Liberación manual por el administrador';
      const espacio = db.espacios.find(e => e.id === espacioId);

      if (!espacio) {
        return res.status(404).json({ error: 'Espacio no encontrado.' });
      }

      const vehiculoAnterior = espacio.vehiculo ? espacio.vehiculo.placa : 'SIN-PLACA';

      espacio.ocupada = false;
      espacio.estado = 'disponible';
      espacio.vehiculo = null;

      const movId = generarSiguienteMovimientoId();
      db.movimientos.unshift({
        id: movId,
        tipo: 'ADMIN_LIBERAR',
        placa: vehiculoAnterior,
        espacio: espacio.codigo,
        espacioId: espacio.id,
        fechaHora: obtenerFechaHoraEcuador(),
        timestamp: Date.now(),
        estado: 'CORREGIDO',
        notas: `Liberación administrativa forzada: ${motivo}`
      });

      guardarDatos();

      res.json({
        success: true,
        mensaje: `Espacio ${espacio.codigo} liberado correctamente.`,
        resumen: obtenerResumenKiosco()
      });
    });

    // 14. POST /api/admin/cambiar-estado-espacio (Reservada / Mantenimiento / Normal)
    app.post('/api/admin/cambiar-estado-espacio', (req, res) => {
      if (!esTokenAdminValido(req)) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const { espacioId, estado } = req.body || {};
      const espacio = db.espacios.find(e => e.id === Number(espacioId));

      if (!espacio || !['disponible', 'reservado', 'mantenimiento'].includes(estado)) {
        return res.status(400).json({ error: 'Parámetros inválidos' });
      }

      espacio.estado = estado;
      if (estado !== 'disponible') {
        espacio.ocupada = true;
      } else {
        if (!espacio.vehiculo) espacio.ocupada = false;
      }

      guardarDatos();
      res.json({ success: true, mensaje: `Espacio ${espacio.codigo} marcado como ${estado}`, resumen: obtenerResumenKiosco() });
    });

    // 15. POST /api/admin/barrera (Control Remoto de Servomotores)
    app.post('/api/admin/barrera', (req, res) => {
      if (!esTokenAdminValido(req)) {
        return res.status(401).json({ error: 'No autorizado' });
      }
      const { barrera, accion } = req.body || {};
      if (!['entrada', 'salida'].includes(barrera) || !['abrir', 'cerrar'].includes(accion)) {
        return res.status(400).json({ error: 'Parámetros de barrera inválidos' });
      }

      db.barreras[barrera] = accion === 'abrir' ? 'abierta' : 'cerrada';
      comandosPendientes[barrera] = accion;
      guardarDatos();
      console.log(`[Admin] Comando de barrera enviado al ESP32: ${barrera} -> ${accion}`);
      res.json({ success: true, mensaje: `Barrera de ${barrera} ${db.barreras[barrera]}`, barreras: db.barreras });
    });

    // 16. GET /api/admin/reporte-csv (Descarga del Reporte de Auditoría)
    app.get('/api/admin/reporte-csv', (req, res) => {
      if (!esTokenAdminValido(req)) {
        return res.status(401).send('No autorizado');
      }
      const csv = generarCSVHistorialMovimientos();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="auditoria_movimientos_smart_parking.csv"');
      res.status(200).send(csv);
    });

    // 17. POST /api/admin/cambiar-clave
    app.post('/api/admin/cambiar-clave', (req, res) => {
      if (!esTokenAdminValido(req)) {
        return res.status(401).json({ error: 'No autorizado.' });
      }
      const { nuevoUsuario, nuevaPassword, nuevoPin } = req.body || {};
      if (!nuevoUsuario || !nuevaPassword || !nuevoUsuario.trim() || !nuevaPassword.trim()) {
        return res.status(400).json({ error: 'Usuario y contraseña no pueden estar vacíos.' });
      }
      const creds = guardarCredencialesAdmin(nuevoUsuario, nuevaPassword, nuevoPin);
      res.json({ success: true, mensaje: 'Credenciales actualizadas correctamente.', usuario: creds.usuario });
    });

    // 18. POST /api/hardware/telemetria (ESP32 - Telemetría Ultrasónica / Servomotores)
    app.post(['/api/hardware/telemetria', '/api/estado'], (req, res) => {
      try {
        const { plazas, sensores, barreras } = req.body || {};
        const listaLecturas = plazas || sensores;
        const ahora = Date.now();

        if (Array.isArray(listaLecturas)) {
          listaLecturas.slice(0, 4).forEach(lec => {
            if (!lec || typeof lec !== 'object') return;
            const idNum = Number(lec.id);
            if (!Number.isInteger(idNum) || idNum < 1 || idNum > 4) return;

            const esp = db.espacios.find(e => e.id === idNum);
            if (!esp) return;

            if (typeof lec.distancia === 'number' && Number.isFinite(lec.distancia) && lec.distancia >= -1 && lec.distancia <= 500) {
              esp.distanciaHardware = Number(lec.distancia.toFixed(1));
            }

            // Sincronizar ocupación física del sensor ultrasónico con la web
            if (typeof lec.ocupada === 'boolean' && esp.estado !== 'reservado' && esp.estado !== 'mantenimiento') {
              if (lec.ocupada === true) {
                if (!esp.ocupada) {
                  esp.ocupada = true;
                  esp.estado = 'ocupado';
                  if (!esp.vehiculo) {
                    esp.vehiculo = {
                      placa: 'SENSOR-HW',
                      horaIngreso: obtenerFechaHoraEcuador(),
                      timestamp: ahora,
                      movimientoId: 'HW-AUTO'
                    };
                  }
                }
              } else {
                // Si el sensor ya no detecta vehículo:
                // Damos 15 segundos de gracia si fue asignado desde el Kiosco para que el conductor llegue al cajón
                const esRecienAsignadoKiosco = esp.vehiculo && esp.vehiculo.movimientoId !== 'HW-AUTO' && (ahora - (esp.vehiculo.timestamp || 0) < 15000);
                if (esp.ocupada && !esRecienAsignadoKiosco) {
                  esp.ocupada = false;
                  esp.estado = 'disponible';
                  esp.vehiculo = null;
                }
              }
            }
          });
        }

        if (barreras && typeof barreras === 'object') {
          if ((barreras.entrada === 'abierta' || barreras.entrada === 'cerrada') && !comandosPendientes.entrada) {
            db.barreras.entrada = barreras.entrada;
          }
          if ((barreras.salida === 'abierta' || barreras.salida === 'cerrada') && !comandosPendientes.salida) {
            db.barreras.salida = barreras.salida;
          }
        }

        // Entregar comandos pendientes al ESP32 y limpiar la cola
        const comandosAEnviar = {
          entrada: comandosPendientes.entrada || 'ninguno',
          salida: comandosPendientes.salida || 'ninguno'
        };
        comandosPendientes.entrada = null;
        comandosPendientes.salida = null;

        guardarDatos();
        res.json({
          success: true,
          mensaje: 'Telemetría de hardware registrada correctamente.',
          comandos: comandosAEnviar
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Compatibilidad para frontend público
    app.get('/api/estado', (req, res) => {
      res.json(obtenerResumenKiosco());
    });

    app.listen(PORT, HOST, () => {
      const creds = obtenerCredencialesAdmin();
      console.log(`=======================================================`);
      console.log(` PARKSENSE 32 - LA PIAZZA (MACHALA)`);
      console.log(` Servidor activo en http://${HOST}:${PORT}`);
      console.log(` Modo Público y Modo Kiosco unificados.`);
      console.log(` Usuario Admin: "${creds.usuario}" | PIN Kiosco: "${creds.pinKiosco}"`);
      console.log(`=======================================================`);
    });

  } catch (err) {
    console.log(`Error al iniciar Express, utilizando motor HTTP nativo de Node.js:`, err.message);

    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true);
      const pathname = parsedUrl.pathname;
      const method = req.method.toUpperCase();

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');

      if (method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }

      if (pathname === '/api/kiosco/resumen' || pathname === '/api/estado') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(obtenerResumenKiosco()));
      }

      // Servir index.html para modos SPA
      if (pathname === '/' || pathname === '/kiosco' || pathname === '/publicidad' || pathname === '/landing') {
        const filePath = path.join(PUBLIC_DIR, 'index.html');
        fs.readFile(filePath, (err, content) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            return res.end('Error al cargar página');
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content, 'utf-8');
        });
        return;
      }

      let filePath = path.join(PUBLIC_DIR, pathname);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (error, content) => {
        if (error) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Recurso no encontrado');
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content, 'utf-8');
        }
      });
    });

    server.listen(PORT, HOST, () => {
      console.log(`Servidor HTTP nativo activo en http://${HOST}:${PORT}`);
    });
  }
}

iniciarServidor();
