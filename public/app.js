// ============================================================
// ParkSense 32 — Unified Single-Page Application
// ============================================================
// 1. Registrar ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

// 2. Inicializar Lenis (Smooth Scroll)
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true
});

// 3. Sincronizar Lenis con GSAP
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

// ---- Module-level state ----
let pollingInterval = null;
let clockInterval = null;
let adminTimeoutTimer = null;
const ADMIN_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// Entry flow state (Option 2)
let k2EspaciosLibres = [];
let k2Recomendado = null;
let k2PlacaActual = '';
let k2EspacioSeleccionado = null;

// ============================================================
// 1. MODE SWITCHING
// ============================================================

function cambiarModo(modo) {
  const secciones = document.querySelectorAll('.modo-seccion');
  secciones.forEach(s => s.classList.add('oculto'));

  const target = document.getElementById('modo-' + modo);
  if (target) target.classList.remove('oculto');

  document.body.classList.remove('vista-publica', 'vista-kiosco', 'vista-admin');
  document.body.classList.add('vista-' + modo);

  if (modo === 'kiosco') {
    mostrarMenuKiosco();
  }

  if (modo === 'admin') {
    cargarDatosAdmin();
    resetearTimeoutAdmin();
  }
}

function mostrarMenuKiosco() {
  const subvistas = document.querySelectorAll('.kiosco-subvista');
  subvistas.forEach(sv => sv.classList.add('oculto'));
  const menu = document.getElementById('kiosco-menu-principal');
  if (menu) menu.classList.remove('oculto');
}

// ============================================================
// 2. ADMIN AUTHENTICATION
// ============================================================

function obtenerToken() {
  return sessionStorage.getItem('sp_admin_token');
}

function esAdmin() {
  return !!obtenerToken();
}

function authHeaders() {
  const token = obtenerToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + (token || '')
  };
}

function cerrarSesionAdmin() {
  sessionStorage.removeItem('sp_admin_token');
  sessionStorage.removeItem('sp_admin_user');
  clearTimeout(adminTimeoutTimer);
  cambiarModo('publico');
}

function resetearTimeoutAdmin() {
  clearTimeout(adminTimeoutTimer);
  adminTimeoutTimer = setTimeout(() => {
    if (esAdmin()) {
      alert('Sesión de administrador expirada por inactividad.');
      cerrarSesionAdmin();
    }
  }, ADMIN_TIMEOUT_MS);
}

function abrirModalPin() {
  const modal = document.getElementById('modal-pin-seguridad');
  if (modal) {
    modal.classList.remove('oculto');
    const input = modal.querySelector('input');
    if (input) { input.value = ''; input.focus(); }
    const msgErr = document.getElementById('mensaje-error-pin');
    if (msgErr) msgErr.textContent = '';
  }
}

function cerrarModalPin() {
  const modal = document.getElementById('modal-pin-seguridad');
  if (modal) modal.classList.add('oculto');
}

async function verificarPin(e) {
  e.preventDefault();
  const form = e.target;
  const input = form.querySelector('input');
  const valor = (input ? input.value : '').trim();
  const msgErr = document.getElementById('mensaje-error-pin');

  if (!valor) {
    if (msgErr) msgErr.textContent = 'Ingrese el PIN o contraseña.';
    return;
  }

  const body = valor.length <= 6 ? { pin: valor } : { password: valor };

  try {
    const res = await fetch('/api/admin/verificar-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (data.valido || data.success) {
      sessionStorage.setItem('sp_admin_token', data.token);
      sessionStorage.setItem('sp_admin_user', data.usuario || 'admin');
      cerrarModalPin();
      cambiarModo('admin');
    } else {
      if (msgErr) msgErr.textContent = data.mensaje || data.error || 'PIN o contraseña incorrectos.';
    }
  } catch (err) {
    if (msgErr) msgErr.textContent = 'Error de conexión. Intente nuevamente.';
  }
}

// ============================================================
// 3. PUBLIC MODE — LIVE STATE UPDATES
// ============================================================

async function actualizarEstadoPublico() {
  try {
    const res = await fetch('/api/kiosco/resumen');
    const data = await res.json();

    // Hero mini-slots
    if (data.espacios) {
      data.espacios.forEach(esp => {
        const miniSlot = document.getElementById('hero-mini-e' + esp.id);
        const miniState = document.getElementById('hero-mini-state-e' + esp.id);
        if (miniSlot) {
          miniSlot.classList.remove('slot-libre', 'slot-ocupado', 'slot-reservado');
          if (esp.estado === 'reservado' || esp.estado === 'mantenimiento') {
            miniSlot.classList.add('slot-reservado');
          } else if (esp.ocupada) {
            miniSlot.classList.add('slot-ocupado');
          } else {
            miniSlot.classList.add('slot-libre');
          }
        }
        if (miniState) {
          if (esp.estado === 'reservado') miniState.textContent = 'Reservado';
          else if (esp.estado === 'mantenimiento') miniState.textContent = 'Mant.';
          else miniState.textContent = esp.ocupada ? 'Ocupado' : 'Libre';
        }
      });
    }

    // Hero badge aforo
    const badge = document.getElementById('hero-badge-aforo');
    if (badge && data.totales) {
      badge.textContent = data.totales.disponibles + ' / ' + data.totales.total + ' disponibles';
      badge.classList.remove('badge-verde', 'badge-amarillo', 'badge-rojo');
      if (data.totales.disponibles === 0) badge.classList.add('badge-rojo');
      else if (data.totales.disponibles <= 1) badge.classList.add('badge-amarillo');
      else badge.classList.add('badge-verde');
    }

    // Summary cards
    if (data.totales) {
      setText('pub-total-espacios', data.totales.total);
      setText('pub-libres-espacios', data.totales.disponibles);
      setText('pub-ocupados-espacios', data.totales.ocupados);
      setText('pub-porcentaje-aforo', data.totales.porcentajeOcupacion + '%');
    }

    // 4 space cards in section B
    if (data.espacios) {
      data.espacios.forEach(esp => {
        const card = document.getElementById('card-pub-e' + esp.id);
        const pill = document.getElementById('pill-pub-e' + esp.id);
        const icon = document.getElementById('icon-pub-e' + esp.id);
        const desc = document.getElementById('desc-pub-e' + esp.id);
        const placa = document.getElementById('placa-pub-e' + esp.id);

        if (card) {
          card.classList.remove('card-libre', 'card-ocupado', 'card-reservado');
          if (esp.estado === 'reservado' || esp.estado === 'mantenimiento') {
            card.classList.add('card-reservado');
          } else if (esp.ocupada) {
            card.classList.add('card-ocupado');
          } else {
            card.classList.add('card-libre');
          }
        }

        if (pill) {
          pill.classList.remove('badge-verde', 'badge-rojo', 'badge-amarillo', 'badge-green', 'badge-red', 'badge-yellow');
          if (esp.estado === 'reservado') {
            pill.textContent = 'Reservado';
            pill.classList.add('badge-amarillo');
          } else if (esp.estado === 'mantenimiento') {
            pill.textContent = 'Mantenimiento';
            pill.classList.add('badge-amarillo');
          } else if (esp.ocupada) {
            pill.textContent = 'Ocupado';
            pill.classList.add('badge-rojo');
          } else {
            pill.textContent = 'Disponible';
            pill.classList.add('badge-verde');
          }
        }

        if (icon) {
          if (esp.ocupada) {
            icon.innerHTML = `
              <div class="car-slot-visual parked">
                <svg viewBox="0 0 120 64" width="110" height="58" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <ellipse cx="60" cy="54" rx="46" ry="6" fill="rgba(0,0,0,0.45)"/>
                  <path d="M18 38C18 33 21 29 26 28L38 17C42 13 48 11 56 11H74C82 11 88 14 93 20L103 28C107 29 110 33 110 38V44C110 47 107 49 104 49H22C19 49 18 47 18 44V38Z" fill="url(#carBody${esp.id})"/>
                  <path d="M40 19L49 14H73C79 14 84 17 88 23H36L40 19Z" fill="#0f172a" opacity="0.88"/>
                  <rect x="26" y="42" width="14" height="14" rx="7" fill="#0f172a" stroke="#94a3b8" stroke-width="2.5"/>
                  <rect x="82" y="42" width="14" height="14" rx="7" fill="#0f172a" stroke="#94a3b8" stroke-width="2.5"/>
                  <circle cx="106" cy="35" r="3" fill="#fef08a"/>
                  <circle cx="21" cy="35" r="2.5" fill="#fb7185"/>
                  <defs>
                    <linearGradient id="carBody${esp.id}" x1="18" y1="11" x2="110" y2="49" gradientUnits="userSpaceOnUse">
                      <stop stop-color="#f43f5e"/>
                      <stop offset="1" stop-color="#e11d48"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>`;
          } else {
            icon.innerHTML = `
              <div class="car-slot-visual empty">
                <svg viewBox="0 0 120 64" width="110" height="58" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="14" y="8" width="92" height="48" rx="10" stroke="#10b981" stroke-width="2" stroke-dasharray="6 5" fill="rgba(16,185,129,0.08)"/>
                  <circle cx="60" cy="32" r="15" fill="rgba(16,185,129,0.18)" stroke="#10b981" stroke-width="1.8"/>
                  <text x="60" y="37.5" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-size="16" font-weight="800" fill="#34d399">P</text>
                </svg>
              </div>`;
          }
        }

        if (desc) {
          desc.textContent = esp.ocupada ? 'Vehículo estacionado' : 'Espacio disponible';
        }

        if (placa) {
          if (esp.ocupada && esp.vehiculo && esp.vehiculo.placa) {
            placa.textContent = esp.vehiculo.placa;
            placa.classList.remove('oculto');
          } else {
            placa.textContent = '';
            placa.classList.add('oculto');
          }
        }
      });
    }

    // Alert
    const alertaEl = document.getElementById('alerta-aforo-publico');
    if (alertaEl) {
      if (data.alerta && data.alerta.tipo === 'LLENO') {
        alertaEl.classList.remove('oculto');
        const alertMsg = alertaEl.querySelector('.alerta-mensaje, span, p');
        if (alertMsg) alertMsg.textContent = data.alerta.mensaje || 'Estacionamiento lleno';
      } else {
        alertaEl.classList.add('oculto');
      }
    }

    // Also update kiosk availability pill
    if (data.totales) {
      setText('kiosco-texto-disponibles', data.totales.disponibles + ' disponibles');
    }

    // Actualizar indicadores en vivo de la sección #monitoreo
    const connBadge = document.getElementById('monitoreo-conn-badge');
    const connText = document.getElementById('monitoreo-conn-text');
    if (connBadge && connText) {
      connBadge.classList.remove('offline');
      connBadge.classList.add('online');
      connText.textContent = 'Conectado · Telemetría en vivo';
    }

    const ultimaAct = document.getElementById('monitoreo-ultima-actualizacion');
    if (ultimaAct) {
      ultimaAct.textContent = new Date().toLocaleString('es-EC', { hour12: false });
    }

    if (data.espacios) {
      data.espacios.forEach(esp => {
        const d = typeof esp.distanciaHardware === 'number' && esp.distanciaHardware >= 0
          ? esp.distanciaHardware.toFixed(1) + ' cm'
          : (esp.ocupada ? 'Ocupado' : 'Libre');
        setText('tele-dist-e' + esp.id, d);
      });
    }

    if (data.barreras) {
      setText('tele-barrera-entrada', data.barreras.entrada === 'abierta' ? 'Abierta (90°)' : 'Cerrada (0°)');
      setText('tele-barrera-salida', data.barreras.salida === 'abierta' ? 'Abierta (90°)' : 'Cerrada (0°)');
    }

    const histBox = document.getElementById('monitoreo-historial-mediciones');
    if (histBox && data.totales) {
      histBox.textContent =
        'Resumen en vivo: ' + data.totales.disponibles + ' libres / ' +
        data.totales.ocupados + ' ocupados (' + data.totales.porcentajeOcupacion + '% aforo).';
    }

  } catch (err) {
    const connBadge = document.getElementById('monitoreo-conn-badge');
    const connText = document.getElementById('monitoreo-conn-text');
    if (connBadge && connText) {
      connBadge.classList.remove('online');
      connBadge.classList.add('offline');
      connText.textContent = 'Desconectado · Sin respuesta del servidor';
    }
  }
}

// ============================================================
// 4. ROI CALCULATOR
// ============================================================

function configurarROI() {
  const slider = document.getElementById('input-roi-slider');
  if (!slider) return;

  const actualizar = () => {
    const autos = parseInt(slider.value, 10) || 0;
    setText('display-slider-autos', autos);

    const minutesSavedPerDay = autos * 8.5;
    const hoursSavedMonth = Math.round(minutesSavedPerDay * 30 / 60);
    const gallonsSavedMonth = Math.round(autos * 0.08 * 30);
    const co2TonsMonth = Math.round(gallonsSavedMonth * 8.887 / 1000 * 10) / 10;
    const rotationPct = Math.min(Math.round(20 + autos / 150), 48);

    setText('roi-horas-ahorradas', hoursSavedMonth.toLocaleString());
    setText('roi-combustible-ahorrado', gallonsSavedMonth.toLocaleString());
    setText('roi-co2-reducido', co2TonsMonth);
    setText('roi-rotacion-val', rotationPct + '%');
  };

  slider.addEventListener('input', actualizar);
  actualizar();
}

// ============================================================
// 5. KIOSK MODE — MENU NAVIGATION & CLOCK
// ============================================================

function mostrarVistaKiosco(opcionNum) {
  const subvistas = document.querySelectorAll('.kiosco-subvista');
  subvistas.forEach(sv => sv.classList.add('oculto'));
  const menu = document.getElementById('kiosco-menu-principal');
  if (menu) menu.classList.add('oculto');
  const vista = document.getElementById('kiosco-vista-opcion' + opcionNum);
  if (vista) vista.classList.remove('oculto');
}

function actualizarReloj() {
  const el = document.getElementById('kiosco-reloj-digital');
  if (!el) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  el.textContent = hh + ':' + mm + ':' + ss;
}

// ============================================================
// 6. KIOSK OPTION 1 — AVAILABILITY
// ============================================================

async function cargarDisponibilidad() {
  try {
    const res = await fetch('/api/kiosco/resumen');
    const data = await res.json();

    if (data.totales) {
      setText('k1-total', data.totales.total);
      setText('k1-libres', data.totales.disponibles);
      setText('k1-ocupados', data.totales.ocupados);
    }

    const container = document.getElementById('k1-slots-container');
    if (container && data.espacios) {
      container.innerHTML = '';
      data.espacios.forEach(esp => {
        const card = document.createElement('div');
        card.className = 'k1-slot-card';

        let bgColor = '#22c55e'; // green - libre
        let statusText = 'LIBRE';
        let extraInfo = '';

        if (esp.estado === 'reservado') {
          bgColor = '#eab308';
          statusText = 'RESERVADO';
        } else if (esp.estado === 'mantenimiento') {
          bgColor = '#eab308';
          statusText = 'MANTENIMIENTO';
        } else if (esp.ocupada) {
          bgColor = '#ef4444';
          statusText = 'OCUPADO';
          if (esp.vehiculo && esp.vehiculo.placa) {
            extraInfo = '<p style="margin-top:0.5rem;font-size:0.9rem;opacity:0.9;">🚗 ' + escapeHtml(esp.vehiculo.placa) + '</p>';
          }
        }

        card.innerHTML = '<div style="background:' + bgColor + ';color:#fff;border-radius:12px;padding:1.5rem;text-align:center;min-width:140px;">' +
          '<h3 style="margin:0;font-size:1.3rem;">' + escapeHtml(esp.codigo) + '</h3>' +
          '<span style="display:inline-block;margin-top:0.5rem;padding:0.25rem 0.75rem;background:rgba(255,255,255,0.2);border-radius:999px;font-size:0.85rem;">' + statusText + '</span>' +
          extraInfo +
          '</div>';
        container.appendChild(card);
      });
    }
  } catch (err) {
    // Silently handle
  }
}

// ============================================================
// 7. KIOSK OPTION 2 — REGISTER ENTRY (Multi-step flow)
// ============================================================

function normalizarPlaca(placa) {
  return placa.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

function mostrarPasoK2(pasoNum) {
  for (let i = 1; i <= 5; i++) {
    const paso = document.getElementById('k2-paso' + i + '-' + getNombrePasoK2(i));
    if (paso) paso.classList.add('oculto');
  }
  const target = document.getElementById('k2-paso' + pasoNum + '-' + getNombrePasoK2(pasoNum));
  if (target) target.classList.remove('oculto');
}

function getNombrePasoK2(num) {
  const nombres = { 1: 'identificacion', 2: 'recomendacion', 3: 'seleccion-manual', 4: 'confirmacion', 5: 'exito' };
  return nombres[num] || '';
}

function resetearEntrada() {
  k2EspaciosLibres = [];
  k2Recomendado = null;
  k2PlacaActual = '';
  k2EspacioSeleccionado = null;
  const input = document.getElementById('k2-input-placa');
  if (input) input.value = '';
  const msgErr = document.getElementById('k2-mensaje-error-paso1');
  if (msgErr) {
    msgErr.textContent = '';
    msgErr.classList.add('oculto');
  }
  mostrarPasoK2(1);
}

async function verificarDisponibilidadPlaca() {
  const input = document.getElementById('k2-input-placa');
  const placa = normalizarPlaca(input ? input.value : '');
  const msgErr = document.getElementById('k2-mensaje-error-paso1');

  if (msgErr) {
    msgErr.textContent = '';
    msgErr.classList.add('oculto');
  }

  if (!placa || placa.length < 3) {
    if (msgErr) {
      msgErr.textContent = 'Ingrese una placa válida (mínimo 3 caracteres).';
      msgErr.classList.remove('oculto');
    }
    return;
  }

  try {
    const res = await fetch('/api/kiosco/verificar-disponibilidad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placa })
    });
    const data = await res.json();

    if (!res.ok || data.error || data.valido === false) {
      if (msgErr) {
        msgErr.textContent = data.mensaje || data.error || 'Vehículo ya registrado o sin espacios disponibles.';
        msgErr.classList.remove('oculto');
      }
      return;
    }

    // Store state
    k2PlacaActual = data.placa || placa;
    k2EspaciosLibres = data.espaciosLibres || [];
    k2Recomendado = data.recomendado || null;

    // Handle "solo uno disponible"
    const alertaUltimo = document.getElementById('k2-alerta-ultimo-espacio');
    const cajaNormal = document.getElementById('k2-caja-recomendado-normal');
    const btnElegirOtro = document.getElementById('btn-k2-elegir-otro');

    if (data.soloUnoDisponible) {
      if (alertaUltimo) {
        alertaUltimo.classList.remove('oculto');
        const textoUnico = alertaUltimo.querySelector('span, p, .texto-alerta');
        if (textoUnico) textoUnico.textContent = 'Solo queda 1 espacio: ' + (data.espacioUnico || (k2Recomendado ? k2Recomendado.codigo : ''));
      }
      if (cajaNormal) cajaNormal.classList.add('oculto');
      if (btnElegirOtro) btnElegirOtro.classList.add('oculto');
    } else {
      if (alertaUltimo) alertaUltimo.classList.add('oculto');
      if (cajaNormal) cajaNormal.classList.remove('oculto');
      if (btnElegirOtro) btnElegirOtro.classList.remove('oculto');
    }

    // Set recommendation tag
    if (k2Recomendado) {
      setText('k2-espacio-recomendado-tag', k2Recomendado.codigo);
    }

    mostrarPasoK2(2);
  } catch (err) {
    if (msgErr) msgErr.textContent = 'Error de conexión. Intente nuevamente.';
  }
}

function seleccionarEspacioYConfirmar(espacio) {
  k2EspacioSeleccionado = espacio;
  setText('k2-confirm-placa', k2PlacaActual);
  setText('k2-confirm-espacio', espacio.codigo);
  setText('k2-confirm-fechahora', formatearFechaHora(new Date()));
  mostrarPasoK2(4);
}

function renderizarSeleccionManual() {
  const grid = document.getElementById('k2-manual-slots-grid');
  if (!grid) return;

  // We need all 4 spaces, so fetch resumen first
  fetch('/api/kiosco/resumen')
    .then(r => r.json())
    .then(data => {
      grid.innerHTML = '';
      if (!data.espacios) return;

      const libresIds = new Set(k2EspaciosLibres.map(e => e.id));

      data.espacios.forEach(esp => {
        const esLibre = libresIds.has(esp.id);
        const card = document.createElement('div');
        card.className = 'k2-manual-slot';
        card.style.cssText = 'border-radius:12px;padding:1.5rem;text-align:center;cursor:' + (esLibre ? 'pointer' : 'not-allowed') + ';opacity:' + (esLibre ? '1' : '0.4') + ';background:' + (esLibre ? '#22c55e' : '#6b7280') + ';color:#fff;transition:transform 0.2s;';

        card.innerHTML = '<h3 style="margin:0;font-size:1.3rem;">' + escapeHtml(esp.codigo) + '</h3>' +
          '<span style="display:inline-block;margin-top:0.5rem;padding:0.25rem 0.75rem;background:rgba(255,255,255,0.2);border-radius:999px;font-size:0.85rem;">' +
          (esLibre ? 'DISPONIBLE' : 'OCUPADO') + '</span>';

        if (esLibre) {
          card.addEventListener('click', () => {
            seleccionarEspacioYConfirmar({ id: esp.id, codigo: esp.codigo });
          });
        }
        grid.appendChild(card);
      });
    })
    .catch(() => { grid.innerHTML = '<p>Error al cargar espacios.</p>'; });
}

async function completarIngreso() {
  if (!k2EspacioSeleccionado || !k2PlacaActual) return;

  try {
    const res = await fetch('/api/kiosco/entrada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placa: k2PlacaActual, espacioId: k2EspacioSeleccionado.id })
    });
    const data = await res.json();

    if (data.success) {
      setText('k2-exito-espacio-tag', k2EspacioSeleccionado.codigo);
      mostrarPasoK2(5);
    } else {
      alert(data.mensaje || data.error || 'Error al registrar entrada.');
      mostrarPasoK2(2);
    }
  } catch (err) {
    alert('Error de conexión. Intente nuevamente.');
    mostrarPasoK2(2);
  }
}

// ============================================================
// 8. KIOSK OPTION 3 — REGISTER EXIT (Multi-step flow)
// ============================================================

function mostrarPasoK3(pasoNum) {
  const nombres = { 1: 'busqueda', 2: 'confirmacion', 3: 'exito' };
  for (let i = 1; i <= 3; i++) {
    const paso = document.getElementById('k3-paso' + i + '-' + nombres[i]);
    if (paso) paso.classList.add('oculto');
  }
  const target = document.getElementById('k3-paso' + pasoNum + '-' + nombres[pasoNum]);
  if (target) target.classList.remove('oculto');
}

function resetearSalida() {
  const input = document.getElementById('k3-input-placa');
  if (input) input.value = '';
  const msgErr = document.getElementById('k3-mensaje-error');
  if (msgErr) msgErr.textContent = '';
  mostrarPasoK3(1);
}

let k3PlacaSalida = '';

async function buscarVehiculoSalida() {
  const input = document.getElementById('k3-input-placa');
  const placa = normalizarPlaca(input ? input.value : '');
  const msgErr = document.getElementById('k3-mensaje-error');

  if (!placa) {
    if (msgErr) msgErr.textContent = 'Ingrese la placa del vehículo.';
    return;
  }

  try {
    const res = await fetch('/api/kiosco/buscar-salida', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placa })
    });
    const data = await res.json();

    if (!data.encontrado) {
      if (msgErr) msgErr.textContent = data.mensaje || data.error || 'Vehículo no encontrado en el estacionamiento.';
      return;
    }

    k3PlacaSalida = placa;
    const d = data.datos || data;
    setText('k3-salida-placa', d.placa || placa);
    setText('k3-salida-espacio', d.espacio || '');
    setText('k3-salida-horaingreso', d.horaIngreso || '');
    setText('k3-salida-tiempoestancia', (d.minutosTranscurridos || 0) + ' minutos');
    setText('k3-salida-mov-id', d.movimientoId || '');
    mostrarPasoK3(2);
  } catch (err) {
    if (msgErr) msgErr.textContent = 'Error de conexión. Intente nuevamente.';
  }
}

async function confirmarSalida() {
  if (!k3PlacaSalida) return;

  try {
    const res = await fetch('/api/kiosco/salida', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placa: k3PlacaSalida })
    });
    const data = await res.json();

    if (data.success) {
      setText('k3-exito-espacio-liberado', data.movimiento ? data.movimiento.espacio : '');
      mostrarPasoK3(3);
    } else {
      alert(data.mensaje || data.error || 'Error al registrar salida.');
    }
  } catch (err) {
    alert('Error de conexión. Intente nuevamente.');
  }
}

// ============================================================
// 9. KIOSK OPTION 4 — SPACE DETAIL
// ============================================================

async function cargarDetalleEspacio(id) {
  // Toggle active class on selector buttons
  document.querySelectorAll('.btn-selector-espacio').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.espacioId === String(id));
  });

  try {
    const res = await fetch('/api/kiosco/espacio/' + id);
    const data = await res.json();

    setText('k4-card-codigo', data.codigo || '');

    const pill = document.getElementById('k4-card-estado-pill');
    if (pill) {
      pill.classList.remove('badge-verde', 'badge-rojo', 'badge-amarillo');
      if (data.estado === 'reservado' || data.estado === 'mantenimiento') {
        pill.textContent = data.estado === 'reservado' ? 'Reservado' : 'Mantenimiento';
        pill.classList.add('badge-amarillo');
      } else if (data.ocupada) {
        pill.textContent = 'Ocupado';
        pill.classList.add('badge-rojo');
      } else {
        pill.textContent = 'Disponible';
        pill.classList.add('badge-verde');
      }
    }

    const body = document.getElementById('k4-card-body');
    if (body) {
      if (data.ocupada && data.vehiculo) {
        body.innerHTML =
          '<div style="padding:1rem;">' +
          '<p><strong>🚗 Placa:</strong> ' + escapeHtml(data.vehiculo.placa || '') + '</p>' +
          '<p><strong>🕐 Hora ingreso:</strong> ' + escapeHtml(data.vehiculo.horaIngreso || '') + '</p>' +
          '<p><strong>📋 Movimiento:</strong> ' + escapeHtml(data.vehiculo.movimientoId || '') + '</p>' +
          '</div>';
      } else {
        body.innerHTML = '<div style="padding:1rem;text-align:center;color:#22c55e;"><p style="font-size:1.2rem;">✅ Este espacio está libre</p></div>';
      }
    }

    const footer = document.getElementById('k4-card-footer');
    if (footer) {
      if (!data.ocupada && data.estado !== 'reservado' && data.estado !== 'mantenimiento') {
        footer.innerHTML = '<button id="btn-k4-asignar-este" class="btn-kiosco-accion btn-accion-verde btn-grande" style="width:100%;">Asignar este espacio &rarr;</button>';
        const btnAsignar = document.getElementById('btn-k4-asignar-este');
        if (btnAsignar) {
          btnAsignar.addEventListener('click', () => {
            mostrarVistaKiosco(2);
            resetearEntrada();
          });
        }
      } else {
        footer.innerHTML = '';
      }
    }
  } catch (err) {
    const body = document.getElementById('k4-card-body');
    if (body) body.innerHTML = '<p style="padding:1rem;color:#ef4444;">Error al cargar información del espacio.</p>';
  }
}

// ============================================================
// 10. KIOSK OPTION 5 — VEHICLE LOCATOR
// ============================================================

async function localizarVehiculo() {
  const input = document.getElementById('k5-input-placa');
  const placa = normalizarPlaca(input ? input.value : '');
  const resultBox = document.getElementById('k5-resultado-box');
  const errorBox = document.getElementById('k5-error-box');

  if (resultBox) resultBox.classList.add('oculto');
  if (errorBox) errorBox.classList.add('oculto');

  if (!placa) {
    if (errorBox) {
      errorBox.classList.remove('oculto');
      errorBox.textContent = 'Ingrese la placa del vehículo.';
    }
    return;
  }

  try {
    const res = await fetch('/api/kiosco/buscar-vehiculo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placa })
    });
    const data = await res.json();

    if (data.encontrado) {
      if (resultBox) resultBox.classList.remove('oculto');
      setText('k5-res-espacio', data.espacio || '');
      const detalles = document.getElementById('k5-res-detalles');
      if (detalles) {
        let info = '';
        if (data.horaIngreso) info += '<p><strong>Hora ingreso:</strong> ' + escapeHtml(data.horaIngreso) + '</p>';
        if (data.tiempoMinutos !== undefined) info += '<p><strong>Tiempo:</strong> ' + data.tiempoMinutos + ' minutos</p>';
        if (data.indicaciones) info += '<p><strong>Indicaciones:</strong> ' + escapeHtml(data.indicaciones) + '</p>';
        detalles.innerHTML = info;
      }
    } else {
      if (errorBox) {
        errorBox.classList.remove('oculto');
        errorBox.textContent = data.mensaje || data.error || 'Vehículo no encontrado.';
      }
    }
  } catch (err) {
    if (errorBox) {
      errorBox.classList.remove('oculto');
      errorBox.textContent = 'Error de conexión. Intente nuevamente.';
    }
  }
}

// ============================================================
// 13. KIOSK OPTION 8 — ASSISTANCE
// ============================================================

async function llamarOperador() {
  try {
    const res = await fetch('/api/kiosco/asistencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'LLAMADA_OPERADOR', mensaje: 'Conductor solicita asistencia inmediata' })
    });
    const data = await res.json();
    const msgEl = document.getElementById('k8-mensaje-confirmacion');
    if (msgEl) {
      msgEl.classList.remove('oculto');
      msgEl.textContent = data.mensaje || 'Se ha notificado al operador. Por favor espere asistencia.';
    }
  } catch (err) {
    const msgEl = document.getElementById('k8-mensaje-confirmacion');
    if (msgEl) {
      msgEl.classList.remove('oculto');
      msgEl.textContent = 'Error de conexión. Intente solicitar asistencia nuevamente.';
    }
  }
}

async function enviarReporte() {
  // Gather selected tipo and placa from form elements in option 8
  const tipoSelect = document.querySelector('#kiosco-vista-opcion8 select, #kiosco-vista-opcion8 [name="tipo"]');
  const placaInput = document.querySelector('#kiosco-vista-opcion8 input[type="text"], #k8-input-placa');

  const tipo = tipoSelect ? tipoSelect.value : 'REPORTE_PROBLEMA';
  const placa = placaInput ? normalizarPlaca(placaInput.value) : '';
  const mensaje = 'Reporte enviado desde kiosco - Tipo: ' + tipo + (placa ? ' - Placa: ' + placa : '');

  try {
    const res = await fetch('/api/kiosco/asistencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, mensaje, placa })
    });
    const data = await res.json();
    const msgEl = document.getElementById('k8-mensaje-confirmacion');
    if (msgEl) {
      msgEl.classList.remove('oculto');
      msgEl.textContent = data.mensaje || 'Reporte enviado exitosamente.';
    }
  } catch (err) {
    const msgEl = document.getElementById('k8-mensaje-confirmacion');
    if (msgEl) {
      msgEl.classList.remove('oculto');
      msgEl.textContent = 'Error al enviar el reporte. Intente nuevamente.';
    }
  }
}

// ============================================================
// 14. ADMIN MODE
// ============================================================

async function cargarDatosAdmin() {
  if (!esAdmin()) return;

  try {
    const res = await fetch('/api/admin/movimientos', {
      headers: authHeaders()
    });

    if (res.status === 401 || res.status === 403) {
      cerrarSesionAdmin();
      return;
    }

    const data = await res.json();

    // Stats
    if (data.resumen) {
      setText('stat-total-entradas', data.resumen.entradas || 0);
      setText('stat-total-salidas', data.resumen.salidas || 0);
      setText('stat-pico-aforo', data.resumen.picoAforo || data.resumen.pico || 0);
      setText('stat-incidencias-pendientes', data.resumen.incidenciasPendientes || (data.incidencias ? data.incidencias.length : 0));
    }

    // Fetch current spaces for admin cards
    const resResumen = await fetch('/api/kiosco/resumen');
    const resumenData = await resResumen.json();

    // Actualizar estado visual de barreras en Admin
    if (resumenData.barreras) {
      actualizarEstadoVisualBarreraAdmin('entrada', resumenData.barreras.entrada);
      actualizarEstadoVisualBarreraAdmin('salida', resumenData.barreras.salida);
    }

    // Render space cards
    const container = document.getElementById('admin-espacios-cards');
    if (container && resumenData.espacios) {
      container.innerHTML = '';
      resumenData.espacios.forEach(esp => {
        const card = document.createElement('div');
        card.className = 'admin-espacio-card';
        card.style.cssText = 'border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:1.25rem;background:#111827;color:#f8fafc;';

        let statusColor = '#10b981';
        let statusLabel = 'Disponible';
        if (esp.estado === 'reservado') { statusColor = '#f59e0b'; statusLabel = 'Reservado'; }
        else if (esp.estado === 'mantenimiento') { statusColor = '#f97316'; statusLabel = 'Mantenimiento'; }
        else if (esp.ocupada) { statusColor = '#ef4444'; statusLabel = 'Ocupado'; }

        let vehicleInfo = '';
        if (esp.ocupada && esp.vehiculo) {
          vehicleInfo = '<p style="margin:0.5rem 0;font-size:0.9rem;color:#e2e8f0;">Placa: <strong>' + escapeHtml(esp.vehiculo.placa || '') + '</strong></p>' +
            '<p style="margin:0.25rem 0;font-size:0.82rem;color:#94a3b8;">Ingreso: ' + escapeHtml(esp.vehiculo.horaIngreso || '') + '</p>';
        } else {
          vehicleInfo = '<p style="margin:0.5rem 0;font-size:0.85rem;color:#94a3b8;">Sin vehículo asignado</p>';
        }

        let actions = '<div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;">';

        if (esp.ocupada) {
          actions += '<button class="btn-admin-liberar" data-espacio-id="' + esp.id + '" style="padding:0.45rem 0.85rem;border:none;border-radius:8px;background:#ef4444;color:#fff;cursor:pointer;font-size:0.85rem;font-weight:600;">Liberar</button>';
        }

        actions += '<select class="select-admin-estado" data-espacio-id="' + esp.id + '" style="padding:0.45rem 0.65rem;border:1px solid rgba(255,255,255,0.18);border-radius:8px;font-size:0.85rem;background:#1e293b;color:#f8fafc;">' +
          '<option value="disponible"' + (esp.estado === 'disponible' ? ' selected' : '') + '>Disponible</option>' +
          '<option value="reservado"' + (esp.estado === 'reservado' ? ' selected' : '') + '>Reservado</option>' +
          '<option value="mantenimiento"' + (esp.estado === 'mantenimiento' ? ' selected' : '') + '>Mantenimiento</option>' +
          '</select>';
        actions += '</div>';

        card.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">' +
          '<h3 style="margin:0;font-size:1.15rem;color:#f8fafc;">' + escapeHtml(esp.codigo) + '</h3>' +
          '<span style="padding:0.22rem 0.65rem;border-radius:999px;font-size:0.78rem;font-weight:600;color:#fff;background:' + statusColor + ';">' + statusLabel + '</span>' +
          '</div>' +
          vehicleInfo +
          actions;

        container.appendChild(card);
      });

      // Event delegation for admin space actions
      container.querySelectorAll('.btn-admin-liberar').forEach(btn => {
        btn.addEventListener('click', async () => {
          const espacioId = parseInt(btn.dataset.espacioId, 10);
          const motivo = prompt('Motivo para liberar el espacio:') || 'Liberado por administrador';
          try {
            resetearTimeoutAdmin();
            const r = await fetch('/api/admin/liberar-espacio', {
              method: 'POST',
              headers: authHeaders(),
              body: JSON.stringify({ espacioId, motivo })
            });
            const d = await r.json();
            if (d.success) {
              alert('Espacio liberado correctamente.');
              cargarDatosAdmin();
            } else {
              alert(d.mensaje || d.error || 'Error al liberar espacio.');
            }
          } catch (err) {
            alert('Error de conexión.');
          }
        });
      });

      container.querySelectorAll('.select-admin-estado').forEach(sel => {
        sel.addEventListener('change', async () => {
          const espacioId = parseInt(sel.dataset.espacioId, 10);
          const estado = sel.value;
          try {
            resetearTimeoutAdmin();
            const r = await fetch('/api/admin/cambiar-estado-espacio', {
              method: 'POST',
              headers: authHeaders(),
              body: JSON.stringify({ espacioId, estado })
            });
            const d = await r.json();
            if (d.success) {
              cargarDatosAdmin();
            } else {
              alert(d.mensaje || d.error || 'Error al cambiar estado.');
            }
          } catch (err) {
            alert('Error de conexión.');
          }
        });
      });
    }

    // Render movements table
    const tbody = document.getElementById('cuerpo-tabla-movimientos');
    if (tbody && data.movimientos) {
      tbody.innerHTML = '';
      data.movimientos.forEach(mov => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + escapeHtml(mov.id || '') + '</td>' +
          '<td>' + escapeHtml(mov.tipo || '') + '</td>' +
          '<td>' + escapeHtml(mov.placa || '') + '</td>' +
          '<td>' + escapeHtml(mov.espacio || '') + '</td>' +
          '<td>' + escapeHtml(mov.fechaHora || mov.timestamp || '') + '</td>' +
          '<td>' + escapeHtml(mov.estado || '') + '</td>';
        tbody.appendChild(tr);
      });
    }

  } catch (err) {
    // Handle silently
  }
}

async function aplicarFiltrosAdmin() {
  if (!esAdmin()) return;
  resetearTimeoutAdmin();

  const placa = (document.getElementById('filtro-placa-admin') || {}).value || '';
  const espacio = (document.getElementById('filtro-espacio-admin') || {}).value || '';

  let url = '/api/admin/movimientos?';
  if (placa) url += 'placa=' + encodeURIComponent(placa) + '&';
  if (espacio) url += 'espacio=' + encodeURIComponent(espacio);

  try {
    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();

    const tbody = document.getElementById('cuerpo-tabla-movimientos');
    if (tbody && data.movimientos) {
      tbody.innerHTML = '';
      data.movimientos.forEach(mov => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + escapeHtml(mov.id || '') + '</td>' +
          '<td>' + escapeHtml(mov.tipo || '') + '</td>' +
          '<td>' + escapeHtml(mov.placa || '') + '</td>' +
          '<td>' + escapeHtml(mov.espacio || '') + '</td>' +
          '<td>' + escapeHtml(mov.fechaHora || mov.timestamp || '') + '</td>' +
          '<td>' + escapeHtml(mov.estado || '') + '</td>';
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    alert('Error al filtrar movimientos.');
  }
}

function descargarCSV() {
  if (!esAdmin()) return;
  resetearTimeoutAdmin();
  const token = obtenerToken();
  window.open('/api/admin/reporte-csv?token=' + encodeURIComponent(token), '_blank');
}

// ============================================================
// 15. BARRIER CONTROL (Admin)
// ============================================================

function actualizarEstadoVisualBarreraAdmin(barrera, estado) {
  const badge = document.getElementById('admin-estado-barrera-' + barrera);
  if (!badge) return;
  const abierta = estado === 'abierta';
  badge.textContent = abierta ? 'ABIERTA' : 'CERRADA';
  badge.classList.remove('badge-green', 'badge-verde', 'badge-red', 'badge-rojo');
  badge.classList.add(abierta ? 'badge-green' : 'badge-red');
}

async function controlarBarrera(barrera, accion) {
  if (!esAdmin()) return;
  resetearTimeoutAdmin();

  try {
    const res = await fetch('/api/admin/barrera', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ barrera, accion })
    });
    const data = await res.json();
    if (data.success && data.barreras) {
      actualizarEstadoVisualBarreraAdmin(barrera, data.barreras[barrera]);
      actualizarEstadoPublico();
    } else if (!data.success) {
      alert(data.mensaje || data.error || 'Error al controlar barrera.');
    }
  } catch (err) {
    alert('Error de conexión al controlar barrera.');
  }
}

// Make it globally accessible
window.controlarBarrera = controlarBarrera;

// ============================================================
// CREDENTIAL CHANGE MODAL
// ============================================================

function abrirModalClave() {
  const modal = document.getElementById('modal-cambio-clave');
  if (modal) modal.classList.remove('oculto');
}

function cerrarModalClave() {
  const modal = document.getElementById('modal-cambio-clave');
  if (modal) modal.classList.add('oculto');
}

async function cambiarCredenciales(e) {
  e.preventDefault();
  if (!esAdmin()) return;
  resetearTimeoutAdmin();

  const form = e.target;
  const nuevoUsuario = form.querySelector('[name="nuevoUsuario"], #input-nuevo-usuario');
  const nuevaPassword = form.querySelector('[name="nuevaPassword"], #input-nueva-password');
  const nuevoPin = form.querySelector('[name="nuevoPin"], #input-nuevo-pin');

  const body = {};
  if (nuevoUsuario && nuevoUsuario.value) body.nuevoUsuario = nuevoUsuario.value;
  if (nuevaPassword && nuevaPassword.value) body.nuevaPassword = nuevaPassword.value;
  if (nuevoPin && nuevoPin.value) body.nuevoPin = nuevoPin.value;

  try {
    const res = await fetch('/api/admin/cambiar-clave', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      alert('Credenciales actualizadas correctamente.');
      cerrarModalClave();
    } else {
      alert(data.mensaje || data.error || 'Error al cambiar credenciales.');
    }
  } catch (err) {
    alert('Error de conexión.');
  }
}

// ============================================================
// ON-SCREEN KEYBOARD SETUP
// ============================================================

function aplicarFormatoPlacaConGuion(input, prevLength) {
  let val = (input.value || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const sinGuion = val.replace(/-/g, '');
  const escribiendo = val.length >= prevLength;

  // Auto-insertar '-' después de las primeras 3 letras al ir escribiendo (ej. ABC -> ABC-)
  if (escribiendo && sinGuion.length >= 3 && !val.includes('-')) {
    if (/^[A-Z]{3}/.test(sinGuion)) {
      val = sinGuion.slice(0, 3) + '-' + sinGuion.slice(3, 7);
    }
  }

  if (val.length > 8) val = val.slice(0, 8);
  input.value = val;
}

function configurarTeclado(tecladoId, inputId) {
  const teclado = document.getElementById(tecladoId);
  const input = document.getElementById(inputId);
  if (!teclado || !input) return;

  let ultimaLongitud = input.value.length;

  input.addEventListener('input', () => {
    aplicarFormatoPlacaConGuion(input, ultimaLongitud);
    ultimaLongitud = input.value.length;
  });

  // Excluir botones de acción (.btn-tecla-accion) para que Borrar/Limpiar no escriban texto
  teclado.querySelectorAll('.btn-tecla:not(.btn-tecla-accion)').forEach(btn => {
    btn.addEventListener('click', () => {
      const tecla = (btn.dataset.tecla || btn.textContent || '').trim();
      if (!tecla || input.value.length >= 8) return;
      ultimaLongitud = input.value.length;
      input.value += tecla;
      input.dispatchEvent(new Event('input'));
    });
  });

  const borrar = teclado.querySelector('#btn-tecla-borrar') || teclado.querySelector('[data-accion="borrar"]');
  if (borrar) {
    borrar.addEventListener('click', (e) => {
      e.stopPropagation();
      ultimaLongitud = input.value.length;
      input.value = input.value.slice(0, -1);
      ultimaLongitud = input.value.length;
    });
  }

  const limpiar = teclado.querySelector('#btn-tecla-limpiar') || teclado.querySelector('[data-accion="limpiar"]');
  if (limpiar) {
    limpiar.addEventListener('click', (e) => {
      e.stopPropagation();
      input.value = '';
      ultimaLongitud = 0;
    });
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function formatearFechaHora(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mmm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return dd + '/' + mmm + '/' + yyyy + ' ' + hh + ':' + min + ':' + ss;
}

// ============================================================
// 16. SMOOTH SCROLLING
// ============================================================

function configurarScrollSuave() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href && href.length > 1) {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });
}

// ============================================================
// 17. INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // ---- Mode switching buttons ----
  const btnIniciarKioscoNav = document.getElementById('btn-iniciar-kiosco-nav');
  const btnLanzarKioscoHero = document.getElementById('btn-lanzar-kiosco-hero');
  const btnProbarKioscoContacto = document.getElementById('btn-probar-kiosco-contacto');
  const btnAdminIrPublico = document.getElementById('btn-admin-ir-publico');
  const btnAdminIrKiosco = document.getElementById('btn-admin-ir-kiosco');
  const btnCerrarSesion = document.getElementById('btn-cerrar-sesion-admin');

  if (btnIniciarKioscoNav) btnIniciarKioscoNav.addEventListener('click', () => cambiarModo('kiosco'));
  if (btnLanzarKioscoHero) btnLanzarKioscoHero.addEventListener('click', () => cambiarModo('kiosco'));
  if (btnProbarKioscoContacto) btnProbarKioscoContacto.addEventListener('click', () => cambiarModo('kiosco'));
  if (btnAdminIrPublico) btnAdminIrPublico.addEventListener('click', () => cambiarModo('publico'));
  if (btnAdminIrKiosco) btnAdminIrKiosco.addEventListener('click', () => cambiarModo('kiosco'));
  if (btnCerrarSesion) btnCerrarSesion.addEventListener('click', cerrarSesionAdmin);

  // ---- Admin auth ----
  const btnAbrirModalAdmin = document.getElementById('btn-abrir-modal-admin');
  if (btnAbrirModalAdmin) btnAbrirModalAdmin.addEventListener('click', abrirModalPin);

  const btnDesbloqueoKiosco = document.getElementById('btn-desbloqueo-kiosco');
  if (btnDesbloqueoKiosco) btnDesbloqueoKiosco.addEventListener('click', abrirModalPin);

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      e.preventDefault();
      abrirModalPin();
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
      e.preventDefault();
      const enKiosco = document.body.classList.contains('vista-kiosco');
      cambiarModo(enKiosco ? 'publico' : 'kiosco');
    }
  });

  const formPin = document.getElementById('form-verificar-pin');
  if (formPin) formPin.addEventListener('submit', verificarPin);

  const btnCancelarPin = document.getElementById('btn-cancelar-pin');
  if (btnCancelarPin) btnCancelarPin.addEventListener('click', cerrarModalPin);

  const btnCerrarModalPin = document.getElementById('btn-cerrar-modal-pin');
  if (btnCerrarModalPin) btnCerrarModalPin.addEventListener('click', cerrarModalPin);

  // ---- Kiosk menu navigation ----
  document.querySelectorAll('.kiosco-tile-btn[data-opcion]').forEach(tile => {
    tile.addEventListener('click', () => {
      const opcion = parseInt(tile.dataset.opcion, 10);
      mostrarVistaKiosco(opcion);

      // Load data when entering specific options
      if (opcion === 1) cargarDisponibilidad();
      if (opcion === 2) resetearEntrada();
      if (opcion === 3) resetearSalida();
    });
  });

  document.querySelectorAll('.btn-regresar-menu').forEach(btn => {
    btn.addEventListener('click', mostrarMenuKiosco);
  });

  // ---- On-screen keyboards ----
  configurarTeclado('teclado-tactil-entrada', 'k2-input-placa');
  configurarTeclado('teclado-tactil-salida', 'k3-input-placa');

  // ---- Option 1 — Availability ----
  const btnK1IrEntrada = document.getElementById('btn-k1-ir-entrada');
  if (btnK1IrEntrada) btnK1IrEntrada.addEventListener('click', () => {
    mostrarVistaKiosco(2);
    resetearEntrada();
  });

  // ---- Option 2 — Entry flow ----
  const btnVerificarPlaca = document.getElementById('k2-btn-verificar-placa');
  if (btnVerificarPlaca) btnVerificarPlaca.addEventListener('click', verificarDisponibilidadPlaca);

  const btnAceptarRec = document.getElementById('btn-k2-aceptar-recomendado');
  if (btnAceptarRec) btnAceptarRec.addEventListener('click', () => {
    if (k2Recomendado) seleccionarEspacioYConfirmar(k2Recomendado);
  });

  const btnElegirOtro = document.getElementById('btn-k2-elegir-otro');
  if (btnElegirOtro) btnElegirOtro.addEventListener('click', () => {
    mostrarPasoK2(3);
    renderizarSeleccionManual();
  });

  const btnVolverRecom = document.getElementById('btn-k2-volver-a-recom');
  if (btnVolverRecom) btnVolverRecom.addEventListener('click', () => mostrarPasoK2(2));

  const btnCompletarIngreso = document.getElementById('btn-k2-completar-ingreso');
  if (btnCompletarIngreso) btnCompletarIngreso.addEventListener('click', completarIngreso);

  const btnK2Terminar = document.getElementById('btn-k2-terminar');
  if (btnK2Terminar) btnK2Terminar.addEventListener('click', () => {
    resetearEntrada();
    mostrarMenuKiosco();
  });

  // ---- Option 3 — Exit flow ----
  const btnBuscarSalida = document.getElementById('k3-btn-buscar-vehiculo');
  if (btnBuscarSalida) btnBuscarSalida.addEventListener('click', buscarVehiculoSalida);

  const btnConfirmarSalida = document.getElementById('btn-k3-confirmar-salida');
  if (btnConfirmarSalida) btnConfirmarSalida.addEventListener('click', confirmarSalida);

  const btnCancelarSalida = document.getElementById('btn-k3-cancelar-salida');
  if (btnCancelarSalida) btnCancelarSalida.addEventListener('click', () => {
    resetearSalida();
  });

  const btnK3Terminar = document.getElementById('btn-k3-terminar');
  if (btnK3Terminar) btnK3Terminar.addEventListener('click', () => {
    resetearSalida();
    mostrarMenuKiosco();
  });

  // ---- Option 4 — Space detail ----
  document.querySelectorAll('.btn-selector-espacio[data-espacio-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.espacioId, 10);
      cargarDetalleEspacio(id);
    });
  });

  // ---- Option 5 — Vehicle locator ----
  const btnLocalizar = document.getElementById('btn-k5-localizar');
  if (btnLocalizar) btnLocalizar.addEventListener('click', localizarVehiculo);

  // ---- Option 8 — Assistance ----
  const btnLlamarOp = document.getElementById('btn-k8-llamar-operador');
  if (btnLlamarOp) btnLlamarOp.addEventListener('click', llamarOperador);

  const btnEnviarReporte = document.getElementById('btn-k8-enviar-reporte');
  if (btnEnviarReporte) btnEnviarReporte.addEventListener('click', enviarReporte);

  // ---- Admin panel ----
  const btnAplicarFiltros = document.getElementById('btn-aplicar-filtros');
  if (btnAplicarFiltros) btnAplicarFiltros.addEventListener('click', aplicarFiltrosAdmin);

  const btnDescargarCSV = document.getElementById('btn-descargar-csv');
  if (btnDescargarCSV) btnDescargarCSV.addEventListener('click', descargarCSV);

  const btnCambiarCred = document.getElementById('btn-cambiar-credenciales');
  if (btnCambiarCred) btnCambiarCred.addEventListener('click', abrirModalClave);

  const formCambioClave = document.getElementById('form-cambio-clave');
  if (formCambioClave) formCambioClave.addEventListener('submit', cambiarCredenciales);

  const btnCancelarClave = document.getElementById('btn-cancelar-clave');
  if (btnCancelarClave) btnCancelarClave.addEventListener('click', cerrarModalClave);

  const btnCerrarModalClave = document.getElementById('btn-cerrar-modal-clave');
  if (btnCerrarModalClave) btnCerrarModalClave.addEventListener('click', cerrarModalClave);

  // Admin inactivity listener
  document.addEventListener('click', () => { if (esAdmin()) resetearTimeoutAdmin(); });
  document.addEventListener('keydown', () => { if (esAdmin()) resetearTimeoutAdmin(); });

  // ---- ROI Calculator ----
  configurarROI();

  // ---- Smooth scrolling (Lenis) & GSAP ScrollTrigger Animations ----
  configurarScrollSuave();
  configurarAnimacionesEditorialGSAP();

  // ---- Clock ----
  actualizarReloj();
  clockInterval = setInterval(actualizarReloj, 1000);

  // ---- Polling en tiempo real (cada 2 segundos para todos los modos) ----
  actualizarEstadoPublico();
  pollingInterval = setInterval(() => {
    actualizarEstadoPublico();
    if (modoActual === 'kiosco') {
      actualizarHeaderKiosco();
      const op1 = document.getElementById('kiosco-vista-opcion1');
      if (op1 && !op1.classList.contains('oculto')) {
        cargarKioscoOpcion1();
      }
    } else if (modoActual === 'admin' && esAdmin()) {
      const activo = document.activeElement;
      const editando = activo && (activo.tagName === 'INPUT' || activo.tagName === 'SELECT');
      if (!editando) {
        cargarDashboardAdmin();
      }
    }
  }, 2000);

  // ---- Check URL hash ----
  if (window.location.hash === '#kiosco') {
    cambiarModo('kiosco');
  } else {
    cambiarModo('publico');
  }
});


// ============================================================
// 18. SCROLL REVEAL ANIMATIONS
// ============================================================
function configurarAnimacionesScroll() {
  const targets = document.querySelectorAll(
    '.section-block, .tech-card, .proceso-step-card, .norma-item, .space-card, .solucion-card, .roi-card, .comp-table-wrap'
  );
  if (!('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('is-visible'));
    return;
  }
  targets.forEach((el, idx) => {
    el.classList.add('reveal-on-scroll');
    el.style.transitionDelay = ((idx % 4) * 55) + 'ms';
  });
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -25px 0px' });
  targets.forEach(el => observer.observe(el));
}


// ============================================================
// 19. LENIS SMOOTH SCROLL + GSAP SCROLLTRIGGER (EDITORIAL)
// ============================================================
function configurarAnimacionesEditorialGSAP() {
  // 1. Lenis Smooth Scroll
  if (typeof Lenis !== 'undefined') {
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true
    });

    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    } else {
      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    }
  }

  // Fallback if GSAP is not loaded
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    configurarAnimacionesScroll();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // 2. Text Reveal (h1, h2 with y: 40, opacity: 0, clip-path)
  gsap.utils.toArray('#modo-publico h1, #modo-publico h2').forEach((heading) => {
    gsap.fromTo(
      heading,
      {
        y: 40,
        opacity: 0,
        clipPath: 'inset(0 0 100% 0)'
      },
      {
        y: 0,
        opacity: 1,
        clipPath: 'inset(0 0 0% 0)',
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: heading,
          start: 'top 88%',
          once: true
        }
      }
    );
  });

  // 3. Hairline Draw (1px horizontal lines scaleX 0 -> 1 from left)
  gsap.utils.toArray('.linea-galeria').forEach((line) => {
    gsap.fromTo(
      line,
      { scaleX: 0 },
      {
        scaleX: 1,
        transformOrigin: 'left center',
        duration: 1.0,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: line,
          start: 'top 90%',
          once: true
        }
      }
    );
  });

  // 4. Number Counters (Track Record)
  gsap.utils.toArray('.gs-counter').forEach((el) => {
    const target = parseFloat(el.dataset.target || '0');
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const obj = { val: 0 };

    gsap.to(obj, {
      val: target,
      duration: 1.6,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '#track-record-strip',
        start: 'top 85%',
        once: true
      },
      onUpdate: () => {
        el.textContent = prefix + Math.round(obj.val) + suffix;
      }
    });
  });

  // 5. Subtle Hero Parallax
  const heroVisual = document.getElementById('hero-parallax-block');
  if (heroVisual) {
    gsap.to(heroVisual, {
      y: -36,
      ease: 'none',
      scrollTrigger: {
        trigger: '#inicio',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });
  }
}


// ============================================================
// 20. PUBLIC CONTACT FORM FEEDBACK
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const formContacto = document.getElementById('form-contacto-publico');
  const confirmMsg = document.getElementById('contacto-confirmacion');
  if (formContacto) {
    formContacto.addEventListener('submit', (e) => {
      e.preventDefault();
      if (confirmMsg) confirmMsg.classList.remove('oculto');
      formContacto.reset();
    });
  }
});

// ============================================================
// 21. PARKSENSE HERO VIDEO — PAUSE ON SCROLL & REDUCED MOTION
// ============================================================
(function () {
  'use strict';
  const video = document.getElementById('parksense-hero-video');
  const hero  = document.getElementById('inicio');
  if (!video || !hero) return;

  const rm = window.matchMedia('(prefers-reduced-motion: reduce)');
  let inView = true;

  function syncVideo(visible) {
    if (rm.matches || !visible) {
      video.pause();
    } else {
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    }
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      syncVideo(inView);
    }, { threshold: 0.1 }).observe(hero);
  }

  if (rm.addEventListener) {
    rm.addEventListener('change', function () { syncVideo(inView); });
  }

  // Initial play attempt
  syncVideo(true);
})();

// ============================================================
// 21. NAVEGACIÓN MÓVIL Y PESTAÑAS INTERACTIVAS DE CÓDIGO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Menú móvil para los 11 enlaces de la Navbar
  const btnMobile = document.getElementById('btn-nav-mobile');
  const navLinks = document.getElementById('nav-menu-links');
  if (btnMobile && navLinks) {
    btnMobile.addEventListener('click', () => {
      navLinks.classList.toggle('nav-open');
    });
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('nav-open');
      });
    });
  }

  // Pestañas interactivas de la sección #codigo (PSeInt / Java / ESP32)
  const tabBtns = document.querySelectorAll('.codigo-tab-btn');
  const tabPanels = document.querySelectorAll('.codigo-panel');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById('tab-panel-' + targetTab);
      if (panel) panel.classList.add('active');
    });
  });
});
