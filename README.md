# ParkSense 32

Sistema de estacionamiento inteligente basado en ESP32.

## Estructura del Proyecto

```text
ParkSense-32/
├── Electronica/
│   └── esp32_smart_parking.ino   # Firmware ESP32 (sensores HC-SR04, IR, servos SG90, LCD I2C y WiFi)
├── Java/
│   └── ParkSense32.java          # Implementación algorítmica orientada a objetos en Java
├── PSeInt/
│   └── pseudocodigo.psc          # Modelado inicial y pseudocódigo en PSeInt
├── data/
│   ├── config.json               # Configuración del sistema
│   └── datos.json                # Persistencia de estado de plazas y movimientos
├── public/
│   ├── assets/
│   │   └── images/               # Fotografías del prototipo, componentes, diseño y equipo
│   ├── index.html                # Interfaz web (Modo Público, Kiosco y Panel Admin)
│   ├── app.js                    # Lógica del frontend y comunicación con la API
│   ├── styles.css                # Estilos principales del sistema
│   ├── public-redesign.css       # Estilos de la vista pública
│   ├── suspension.html           # Vista de suspensión/mantenimiento
│   └── logo.svg                  # Ícono vectorial de la aplicación
├── server.js                     # Servidor backend Node.js / Express y API REST
├── package.json                  # Dependencias y scripts de Node.js
├── config.json                   # Configuración local del servidor
└── datos.json                    # Registro local de datos
```

## Integrantes

- **Líder:** Pablo
