#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>
#include <WiFi.h>
#include <HTTPClient.h>

// ======================================================
// CONFIGURACION DE RED WIFI Y SERVIDOR WEB
// ======================================================

const char* WIFI_SSID     = "MALDONADO - GoNet";         // Nombre de tu red WiFi (2.4 GHz)
const char* WIFI_PASSWORD = "CJPM@2026";       // Clave de tu red WiFi

// IP del computador donde corre el servidor Node.js (averiguar con ipconfig)
const char* SERVER_IP   = "192.168.3.7";
const int   SERVER_PORT = 3000;

// Cada cuanto se envian y consultan los datos con la web (800 ms para respuesta agil)
const unsigned long INTERVALO_ENVIO_MS = 800;

// Si el envio falla (sin WiFi o servidor apagado), espera esto antes de reintentar.
// Asi las barreras no se quedan trabadas esperando a la red.
const unsigned long ESPERA_TRAS_FALLO_MS = 8000;

// Cada cuanto intenta reconectar el WiFi si se pierde
const unsigned long REINTENTO_WIFI_MS = 10000;

unsigned long ultimoEnvio = 0;
unsigned long esperaEnvioMs = INTERVALO_ENVIO_MS;
unsigned long ultimoIntentoWiFi = 0;

// ======================================================
// CONFIGURACION DE LA PANTALLA LCD
// ======================================================

// Direccion I2C habitual: 0x27
// Si la pantalla no funciona, prueba cambiando 0x27 por 0x3F
LiquidCrystal_I2C lcd(0x27, 16, 2);

// Pines I2C predeterminados del ESP32
const int PIN_SDA = 21;
const int PIN_SCL = 22;

// ======================================================
// CONFIGURACION DEL PARQUEADERO
// ======================================================

const int CANTIDAD_PLAZAS = 4;

// Pines TRIG de los cuatro sensores HC-SR04
const int pinesTrig[CANTIDAD_PLAZAS] = {
  13,  // Plaza 1
  13,  // Plaza 2 (CAMBIO: comparte el TRIG de la plaza 1 y libera D14)
  13,  // Plaza 3 (CAMBIO: comparte el TRIG de la plaza 1 y libera D27)
  13   // Plaza 4 (CAMBIO: comparte el TRIG de la plaza 1 y libera D26)
};

// Pines ECHO de los cuatro sensores HC-SR04
const int pinesEcho[CANTIDAD_PLAZAS] = {
  34,  // Plaza 1
  35,  // Plaza 2
  32,  // Plaza 3
  33   // Plaza 4
};

// Pines de los cuatro LED verdes
const int pinesLedVerde[CANTIDAD_PLAZAS] = {
  4,   // Plaza 1
  16,  // Plaza 2
  17,  // Plaza 3
  18   // Plaza 4
};

// Pines de los cuatro LED rojos
const int pinesLedRojo[CANTIDAD_PLAZAS] = {
  19,  // Plaza 1
  23,  // Plaza 2
  25,  // Plaza 3
  5    // Plaza 4
};

// Guarda las distancias medidas
float distancias[CANTIDAD_PLAZAS];

// Guarda el estado de cada plaza
// true = ocupada
// false = libre
bool plazasOcupadas[CANTIDAD_PLAZAS];

// Distancia utilizada para detectar un vehiculo.
// Debes ajustar este valor despues de probar la maqueta.
const float DISTANCIA_OCUPADA_CM = 12.0;

// Distancia minima aceptada
const float DISTANCIA_MINIMA_CM = 2.0;

// Tiempo maximo de espera del eco
const unsigned long TIEMPO_MAXIMO_ECO = 30000;

// ======================================================
// CONFIGURACION DE LAS BARRERAS (ENTRADA Y SALIDA)
// ======================================================

// Ponlo en false mientras los sensores de entrada y salida
// no esten conectados (sin conectar, pueden dar lecturas falsas)
const bool BARRERAS_ACTIVAS = true;

// Los dos sensores de las barreras comparten el mismo pin TRIG
const int PIN_TRIG_BARRERAS = 2;
const int PIN_ECHO_ENTRADA = 36;   // VP (solo entrada)
const int PIN_ECHO_SALIDA = 39;    // VN (solo entrada)

// Pines de senal de los servos
const int PIN_SERVO_ENTRADA = 15;
const int PIN_SERVO_SALIDA = 12;   // Pin delicado al arrancar: si no sube
                                   // el codigo, desconecta este cable un momento

// Angulos del servo
const int ANGULO_CERRADA = 0;
const int ANGULO_ABIERTA = 90;

// Distancia para detectar un vehiculo frente a la barrera
const float DISTANCIA_BARRERA_CM = 10.0;

// Detecciones seguidas necesarias para abrir (evita falsas lecturas)
const int DETECCIONES_PARA_ABRIR = 2;

// La barrera se cierra cuando el sensor lleva este tiempo sin detectar
// ningun vehiculo. NO depende de que el carro se estacione.
// Si cierra demasiado rapido, sube este valor. Si tarda, bajalo.
const unsigned long TIEMPO_CIERRE_MS = 1500;

Servo servoEntrada;
Servo servoSalida;

bool entradaAbierta = false;
bool salidaAbierta = false;

bool modoManualEntrada = false;
bool modoManualSalida = false;

bool vehiculoVistoEntrada = false;
bool vehiculoVistoSalida = false;

unsigned long tiempoAperturaEntrada = 0;
unsigned long tiempoAperturaSalida = 0;

// Si se abre desde el Kiosco pero nunca pasa un carro, se cierra tras este tiempo
const unsigned long TIEMPO_MAX_ESPERA_MS = 10000;

int deteccionesEntrada = 0;
int deteccionesSalida = 0;

unsigned long ultimoVehiculoEntrada = 0;
unsigned long ultimoVehiculoSalida = 0;

// Para avisar una sola vez cuando se rechaza un ingreso
bool rechazoMostrado = false;

float distanciaEntrada = -1;
float distanciaSalida = -1;

// ------------------------------------------------------
// SENSOR INFRARROJO Y BUZZER (ALERTA DE CONTRAMANO)
// ------------------------------------------------------
// El infrarrojo va en el lado de afuera de la barrera de salida.
// Si detecta algo mientras la salida NO esta en uso, alguien intenta
// entrar por la salida y suena el buzzer.

const int PIN_IR_SALIDA = 14;   // OUT del modulo infrarrojo
const int PIN_BUZZER = 27;      // Senal del buzzer

// El modulo FC-51 da LOW cuando detecta un objeto.
// Si el tuyo da HIGH al detectar, cambia esta linea a HIGH.
const int NIVEL_IR_DETECTA = LOW;

// Si tu buzzer suena con HIGH, deja estas dos como estan.
// Si suena todo el tiempo sin alerta (modulo de nivel bajo), intercambialas.
const int NIVEL_BUZZER_ON = HIGH;
const int NIVEL_BUZZER_OFF = LOW;

// Despues de que sale un vehiculo, se ignora el infrarrojo este tiempo
// para que el carro que sale no active la alarma
const unsigned long GRACIA_SALIDA_MS = 3000;

// Lecturas seguidas del infrarrojo para activar la alarma (evita falsas alarmas)
const int DETECCIONES_IR_PARA_ALARMA = 3;

// La alarma suena como minimo este tiempo y mientras el infrarrojo lo siga viendo
const unsigned long ALARMA_MIN_MS = 3000;

// Velocidad de los pitidos (encendido y apagado)
const unsigned long PERIODO_PITIDO_MS = 250;

volatile bool alarmaActiva = false;
int deteccionesIR = 0;
unsigned long inicioAlarma = 0;

// ------------------------------------------------------
// MOVIMIENTO SUAVE DE LOS SERVOS
// ------------------------------------------------------
// Cada servo gira 1 grado cada PAUSA_PASO_MS milisegundos.
// Mas pausa = mas lento y menos pico de corriente.
// 20 ms = unos 2 segundos para recorrer 90 grados.
// Si todavia se reinicia, prueba con 30 o 40.
const int PAUSA_PASO_MS = 20;

// Angulo al que debe llegar cada servo (lo cambian las barreras)
volatile int objetivoEntrada = ANGULO_CERRADA;
volatile int objetivoSalida = ANGULO_CERRADA;

// Angulo en el que esta cada servo en este momento
int actualEntrada = ANGULO_CERRADA;
int actualSalida = ANGULO_CERRADA;

// Tarea que mueve los servos poco a poco, sin detener el programa principal
void tareaServos(void* parametro) {

  for (;;) {

    if (actualEntrada < objetivoEntrada) {
      actualEntrada++;
      servoEntrada.write(actualEntrada);
    } else if (actualEntrada > objetivoEntrada) {
      actualEntrada--;
      servoEntrada.write(actualEntrada);
    }

    if (actualSalida < objetivoSalida) {
      actualSalida++;
      servoSalida.write(actualSalida);
    } else if (actualSalida > objetivoSalida) {
      actualSalida--;
      servoSalida.write(actualSalida);
    }

    // Pitidos del buzzer mientras la alarma este activa
    if (alarmaActiva) {
      bool encendido = ((millis() / PERIODO_PITIDO_MS) % 2) == 0;
      digitalWrite(PIN_BUZZER, encendido ? NIVEL_BUZZER_ON : NIVEL_BUZZER_OFF);
    } else {
      digitalWrite(PIN_BUZZER, NIVEL_BUZZER_OFF);
    }

    vTaskDelay(PAUSA_PASO_MS / portTICK_PERIOD_MS);
  }
}

// ======================================================
// FUNCIONES DE WIFI
// ======================================================

// Se usa una sola vez al iniciar (espera hasta 10 segundos)
void iniciarWiFi() {

  Serial.println();
  Serial.print("Conectando a la red WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 20) {
    delay(500);
    Serial.print(".");
    intentos++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Conectado.");
    Serial.print("[WiFi] IP de la ESP32: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Sin conexion. El sistema sigue funcionando sin la web.");
  }
}

// Reintenta conectar sin detener el programa
void revisarWiFi() {

  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  if (millis() - ultimoIntentoWiFi >= REINTENTO_WIFI_MS) {
    ultimoIntentoWiFi = millis();
    Serial.println("[WiFi] Sin conexion. Reintentando...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}

// ======================================================
// ENVIAR EL ESTADO A LA WEB (HTTP POST)
// ======================================================

bool enviarEstadoWeb() {

  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  String url = "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/api/estado";

  // Tiempos cortos para que un servidor apagado no trabe las barreras
  http.setConnectTimeout(1000);
  http.setTimeout(1000);
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // JSON: {"plazas":[{"id":1,"distancia":142.3,"ocupada":false}, ...],"barreras":{"entrada":"cerrada","salida":"cerrada"}}
  String json = "{\"plazas\":[";

  for (int i = 0; i < CANTIDAD_PLAZAS; i++) {

    json += "{\"id\":" + String(i + 1) + ",";

    if (distancias[i] < 0) {
      json += "\"distancia\":-1,";
    } else {
      json += "\"distancia\":" + String(distancias[i], 1) + ",";
    }

    json += "\"ocupada\":" + String(plazasOcupadas[i] ? "true" : "false");
    json += "}";

    if (i < CANTIDAD_PLAZAS - 1) {
      json += ",";
    }
  }

  json += "],\"barreras\":{\"entrada\":\"";
  json += (entradaAbierta ? "abierta" : "cerrada");
  json += "\",\"salida\":\"";
  json += (salidaAbierta ? "abierta" : "cerrada");
  json += "\"}}";

  int codigo = http.POST(json);
  String respuesta = "";
  if (codigo == 200 || codigo == 201) {
    respuesta = http.getString();
  }
  http.end();

  if (codigo == 200 || codigo == 201) {
    // Procesar comandos recibidos desde el Kiosco o Panel Admin
    // Formato esperado: ..."comandos":{"entrada":"abrir_auto","salida":"ninguno"}
    if (respuesta.indexOf("\"entrada\":\"abrir_auto\"") >= 0) {
      objetivoEntrada = ANGULO_ABIERTA;
      entradaAbierta = true;
      modoManualEntrada = false;
      vehiculoVistoEntrada = false;
      tiempoAperturaEntrada = millis();
      ultimoVehiculoEntrada = millis();
      Serial.println("[WEB] Kiosco ordeno ABRIR barrera de ENTRADA (cierra al pasar vehiculo)");
    } else if (respuesta.indexOf("\"entrada\":\"abrir\"") >= 0) {
      objetivoEntrada = ANGULO_ABIERTA;
      entradaAbierta = true;
      modoManualEntrada = true;
      Serial.println("[WEB] Admin ordeno SUBIR barrera de ENTRADA");
    } else if (respuesta.indexOf("\"entrada\":\"cerrar\"") >= 0) {
      objetivoEntrada = ANGULO_CERRADA;
      entradaAbierta = false;
      modoManualEntrada = false;
      vehiculoVistoEntrada = false;
      Serial.println("[WEB] Admin ordeno BAJAR barrera de ENTRADA");
    }

    if (respuesta.indexOf("\"salida\":\"abrir_auto\"") >= 0) {
      objetivoSalida = ANGULO_ABIERTA;
      salidaAbierta = true;
      modoManualSalida = false;
      vehiculoVistoSalida = false;
      tiempoAperturaSalida = millis();
      ultimoVehiculoSalida = millis();
      Serial.println("[WEB] Kiosco ordeno ABRIR barrera de SALIDA (cierra al pasar vehiculo)");
    } else if (respuesta.indexOf("\"salida\":\"abrir\"") >= 0) {
      objetivoSalida = ANGULO_ABIERTA;
      salidaAbierta = true;
      modoManualSalida = true;
      Serial.println("[WEB] Admin ordeno SUBIR barrera de SALIDA");
    } else if (respuesta.indexOf("\"salida\":\"cerrar\"") >= 0) {
      objetivoSalida = ANGULO_CERRADA;
      salidaAbierta = false;
      modoManualSalida = false;
      vehiculoVistoSalida = false;
      Serial.println("[WEB] Admin ordeno BAJAR barrera de SALIDA");
    }

    return true;
  }

  Serial.print("[HTTP] No se pudo enviar. Codigo: ");
  Serial.println(codigo);
  return false;
}

// ======================================================
// FUNCION PARA MEDIR LA DISTANCIA
// ======================================================

float medirDistancia(int pinTrig, int pinEcho) {

  // Asegura que TRIG comience apagado
  digitalWrite(pinTrig, LOW);
  delayMicroseconds(2);

  // Envia un pulso de 10 microsegundos
  digitalWrite(pinTrig, HIGH);
  delayMicroseconds(10);
  digitalWrite(pinTrig, LOW);

  // Mide cuanto tiempo permanece activa la señal ECHO
  unsigned long duracion = pulseIn(
    pinEcho,
    HIGH,
    TIEMPO_MAXIMO_ECO
  );

  // Si no se recibe eco, devuelve -1
  if (duracion == 0) {
    return -1;
  }

  // Conversion del tiempo a distancia en centimetros
  float distancia = duracion * 0.0343 / 2.0;

  return distancia;
}

// ======================================================
// FUNCION PARA OBTENER UNA MEDICION MAS ESTABLE
// ======================================================

float obtenerDistanciaPromedio(int pinTrig, int pinEcho) {

  const int CANTIDAD_LECTURAS = 3;

  float suma = 0;
  int lecturasValidas = 0;

  for (int lectura = 0; lectura < CANTIDAD_LECTURAS; lectura++) {

    float distancia = medirDistancia(pinTrig, pinEcho);

    if (distancia >= DISTANCIA_MINIMA_CM) {
      suma = suma + distancia;
      lecturasValidas++;
    }

    // Pequeña pausa para evitar interferencias
    delay(60);
  }

  if (lecturasValidas == 0) {
    return -1;
  }

  return suma / lecturasValidas;
}

// ======================================================
// FUNCION PARA DETERMINAR SI UNA PLAZA ESTA OCUPADA
// ======================================================

bool detectarVehiculo(float distancia) {

  // Si no hubo una medicion valida,
  // se considera que la plaza esta libre
  if (distancia < 0) {
    return false;
  }

  if (
    distancia >= DISTANCIA_MINIMA_CM &&
    distancia <= DISTANCIA_OCUPADA_CM
  ) {
    return true;
  }

  return false;
}

// ======================================================
// CONTAR PLAZAS LIBRES
// ======================================================

int contarLibres() {

  int libres = 0;

  for (int plaza = 0; plaza < CANTIDAD_PLAZAS; plaza++) {
    if (plazasOcupadas[plaza] == false) {
      libres++;
    }
  }

  return libres;
}

// ======================================================
// CONTROL DE LED DE UNA PLAZA
// ======================================================

void actualizarLeds(int numeroPlaza, bool ocupada) {

  if (ocupada == true) {

    // Ocupada: rojo encendido y verde apagado
    digitalWrite(pinesLedVerde[numeroPlaza], LOW);
    digitalWrite(pinesLedRojo[numeroPlaza], HIGH);

  } else {

    // Libre: verde encendido y rojo apagado
    digitalWrite(pinesLedVerde[numeroPlaza], HIGH);
    digitalWrite(pinesLedRojo[numeroPlaza], LOW);
  }
}

// ======================================================
// BARRERA DE ENTRADA
// ======================================================

bool detectarVehiculoBarrera(float distancia) {

  if (
    distancia >= DISTANCIA_MINIMA_CM &&
    distancia <= DISTANCIA_BARRERA_CM
  ) {
    return true;
  }

  return false;
}

void gestionarEntrada() {

  distanciaEntrada = medirDistancia(
    PIN_TRIG_BARRERAS,
    PIN_ECHO_ENTRADA
  );

  bool hayVehiculo = detectarVehiculoBarrera(distanciaEntrada);

  // Si fue abierta manualmente desde el panel Admin, no se cierra sola por sensor
  if (entradaAbierta == true && modoManualEntrada == true) {
    return;
  }

  if (entradaAbierta == true) {
    // Abierta tras registro en Kiosco: el sensor vigila el paso del vehiculo para cerrarla
    if (hayVehiculo == true) {
      vehiculoVistoEntrada = true;
      ultimoVehiculoEntrada = millis();
    } else {
      bool pasoCompleto = vehiculoVistoEntrada && (millis() - ultimoVehiculoEntrada >= TIEMPO_CIERRE_MS);
      bool tiempoAgotadoSinVehiculo = !vehiculoVistoEntrada && (millis() - tiempoAperturaEntrada >= TIEMPO_MAX_ESPERA_MS);

      if (pasoCompleto || tiempoAgotadoSinVehiculo) {
        objetivoEntrada = ANGULO_CERRADA;
        entradaAbierta = false;
        vehiculoVistoEntrada = false;
        deteccionesEntrada = 0;
        Serial.println("ENTRADA: vehiculo paso / sin vehiculo - barrera CERRADA");
      }
    }
  }
}

// ======================================================
// BARRERA DE SALIDA
// ======================================================

void gestionarSalida() {

  distanciaSalida = medirDistancia(
    PIN_TRIG_BARRERAS,
    PIN_ECHO_SALIDA
  );

  bool hayVehiculo = detectarVehiculoBarrera(distanciaSalida);

  // Si fue abierta manualmente desde el panel Admin, no se cierra sola por sensor
  if (salidaAbierta == true && modoManualSalida == true) {
    return;
  }

  if (salidaAbierta == true) {
    // Abierta tras registro de salida en Kiosco: el sensor vigila el paso para cerrarla
    if (hayVehiculo == true) {
      vehiculoVistoSalida = true;
      ultimoVehiculoSalida = millis();
    } else {
      bool pasoCompleto = vehiculoVistoSalida && (millis() - ultimoVehiculoSalida >= TIEMPO_CIERRE_MS);
      bool tiempoAgotadoSinVehiculo = !vehiculoVistoSalida && (millis() - tiempoAperturaSalida >= TIEMPO_MAX_ESPERA_MS);

      if (pasoCompleto || tiempoAgotadoSinVehiculo) {
        objetivoSalida = ANGULO_CERRADA;
        salidaAbierta = false;
        vehiculoVistoSalida = false;
        deteccionesSalida = 0;
        Serial.println("SALIDA: vehiculo paso / sin vehiculo - barrera CERRADA");
      }
    }
  }
}

// ======================================================
// ALERTA DE CONTRAMANO (INFRARROJO + BUZZER)
// ======================================================

void gestionarContramano() {

  bool irDetecta = (digitalRead(PIN_IR_SALIDA) == NIVEL_IR_DETECTA);

  // La salida esta en uso si la barrera esta abierta o se uso hace poco:
  // en ese caso es un vehiculo que sale, no una alerta
  bool salidaEnUso = salidaAbierta ||
                     (millis() - ultimoVehiculoSalida < GRACIA_SALIDA_MS);

  if (alarmaActiva == false) {

    if (irDetecta == true && salidaEnUso == false) {
      deteccionesIR++;
    } else {
      deteccionesIR = 0;
    }

    if (deteccionesIR >= DETECCIONES_IR_PARA_ALARMA) {
      alarmaActiva = true;
      inicioAlarma = millis();
      Serial.println("ALERTA: vehiculo entrando por la SALIDA - buzzer ACTIVADO");
    }

  } else {

    // Mientras el infrarrojo siga viendo el vehiculo, la alarma continua
    if (irDetecta == true) {
      inicioAlarma = millis();
    }

    if (millis() - inicioAlarma >= ALARMA_MIN_MS) {
      alarmaActiva = false;
      deteccionesIR = 0;
      Serial.println("ALERTA terminada - buzzer apagado");
    }
  }
}

void gestionarBarreras() {

  if (BARRERAS_ACTIVAS == false) {
    return;
  }

  gestionarEntrada();

  // Pausa para que el eco de un sensor no afecte al otro
  delay(30);

  gestionarSalida();

  gestionarContramano();
}

// ======================================================
// MOSTRAR RESULTADOS EN LA PANTALLA LCD
// ======================================================

void actualizarPantalla(
  int plazasLibres,
  int plazasOcupadasCantidad
) {

  lcd.setCursor(0, 0);
  lcd.print("Libres: ");
  lcd.print(plazasLibres);
  lcd.print(" de 4  ");

  lcd.setCursor(0, 1);
  lcd.print("Ocupadas: ");
  lcd.print(plazasOcupadasCantidad);
  lcd.print("   ");
}

// ======================================================
// MOSTRAR INFORMACION EN EL MONITOR SERIAL
// ======================================================

void mostrarMonitorSerial(
  int plazasLibres,
  int plazasOcupadasCantidad
) {

  Serial.println();
  Serial.println("================================");
  Serial.println(" ESTADO ACTUAL DEL PARQUEADERO");
  Serial.println("================================");

  for (int plaza = 0; plaza < CANTIDAD_PLAZAS; plaza++) {

    Serial.print("Plaza ");
    Serial.print(plaza + 1);
    Serial.print(": ");

    if (distancias[plaza] < 0) {
      Serial.print("sin lectura");
    } else {
      Serial.print(distancias[plaza], 1);
      Serial.print(" cm");
    }

    Serial.print(" - ");

    if (plazasOcupadas[plaza] == true) {
      Serial.println("OCUPADA");
    } else {
      Serial.println("LIBRE");
    }
  }

  Serial.println("--------------------------------");
  Serial.print("Plazas libres: ");
  Serial.println(plazasLibres);

  Serial.print("Plazas ocupadas: ");
  Serial.println(plazasOcupadasCantidad);

  if (BARRERAS_ACTIVAS == true) {

    Serial.println("--------------------------------");

    Serial.print("Entrada: ");
    if (distanciaEntrada < 0) {
      Serial.print("sin lectura");
    } else {
      Serial.print(distanciaEntrada, 1);
      Serial.print(" cm");
    }
    Serial.print(" - barrera ");
    Serial.println(entradaAbierta ? "ABIERTA" : "CERRADA");

    Serial.print("Salida: ");
    if (distanciaSalida < 0) {
      Serial.print("sin lectura");
    } else {
      Serial.print(distanciaSalida, 1);
      Serial.print(" cm");
    }
    Serial.print(" - barrera ");
    Serial.println(salidaAbierta ? "ABIERTA" : "CERRADA");
  }
}

// ======================================================
// CONFIGURACION INICIAL
// ======================================================

void setup() {

  Serial.begin(115200);

  // Configurar I2C
  Wire.begin(PIN_SDA, PIN_SCL);

  // Iniciar pantalla LCD
  lcd.init();
  lcd.backlight();
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("PARQUEADERO");
  lcd.setCursor(0, 1);
  lcd.print("INTELIGENTE");

  // Configurar sensores y LED
  for (int plaza = 0; plaza < CANTIDAD_PLAZAS; plaza++) {

    pinMode(pinesTrig[plaza], OUTPUT);
    pinMode(pinesEcho[plaza], INPUT);

    pinMode(pinesLedVerde[plaza], OUTPUT);
    pinMode(pinesLedRojo[plaza], OUTPUT);

    digitalWrite(pinesTrig[plaza], LOW);
    digitalWrite(pinesLedVerde[plaza], LOW);
    digitalWrite(pinesLedRojo[plaza], LOW);

    plazasOcupadas[plaza] = false;
    distancias[plaza] = -1;
  }

  // Configurar sensores de las barreras
  pinMode(PIN_TRIG_BARRERAS, OUTPUT);
  pinMode(PIN_ECHO_ENTRADA, INPUT);
  pinMode(PIN_ECHO_SALIDA, INPUT);
  digitalWrite(PIN_TRIG_BARRERAS, LOW);

  // Sensor infrarrojo y buzzer (alerta de contramano)
  pinMode(PIN_IR_SALIDA, INPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, NIVEL_BUZZER_OFF);

  // Configurar servos (barreras cerradas al iniciar)
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);

  servoEntrada.setPeriodHertz(50);
  servoSalida.setPeriodHertz(50);

  servoEntrada.attach(PIN_SERVO_ENTRADA, 500, 2400);
  servoSalida.attach(PIN_SERVO_SALIDA, 500, 2400);

  servoEntrada.write(ANGULO_CERRADA);
  servoSalida.write(ANGULO_CERRADA);

  // Inicia la tarea que mueve los servos poco a poco
  xTaskCreate(tareaServos, "servos", 3072, NULL, 1, NULL);

  // Conectar a la red WiFi (se intenta unos segundos al iniciar)
  iniciarWiFi();

  delay(2000);
  lcd.clear();

  Serial.println("Sistema de parqueadero iniciado.");
}

// ======================================================
// PROGRAMA PRINCIPAL
// ======================================================

void loop() {

  int cantidadOcupadas = 0;

  // Leer las cuatro plazas
  for (int plaza = 0; plaza < CANTIDAD_PLAZAS; plaza++) {

    // Revisa las barreras entre una plaza y otra para que respondan rapido
    gestionarBarreras();

    distancias[plaza] = obtenerDistanciaPromedio(
      pinesTrig[plaza],
      pinesEcho[plaza]
    );

    plazasOcupadas[plaza] = detectarVehiculo(
      distancias[plaza]
    );

    actualizarLeds(
      plaza,
      plazasOcupadas[plaza]
    );

    if (plazasOcupadas[plaza] == true) {
      cantidadOcupadas++;
    }
  }

  int cantidadLibres = CANTIDAD_PLAZAS - cantidadOcupadas;

  actualizarPantalla(
    cantidadLibres,
    cantidadOcupadas
  );

  mostrarMonitorSerial(
    cantidadLibres,
    cantidadOcupadas
  );

  gestionarBarreras();

  // Reconecta el WiFi si se perdio (sin bloquear el programa)
  revisarWiFi();

  // Envia el estado a la web cada 2 segundos
  if (millis() - ultimoEnvio >= esperaEnvioMs) {

    ultimoEnvio = millis();

    if (enviarEstadoWeb() == true) {
      esperaEnvioMs = INTERVALO_ENVIO_MS;
    } else {
      esperaEnvioMs = ESPERA_TRAS_FALLO_MS;
    }
  }

  delay(300);
}
