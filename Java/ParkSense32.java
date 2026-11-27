import java.util.Scanner;

public class ParkSense32 {

    // Posición 0..3 -> A1, A2, B1, B2
    static final String[] NOMBRES_ESPACIOS = { "A1", "A2", "B1", "B2" };

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);

        int seleccion;
        int espaciosTotales = 4;
        int libres;
        int ocupados = 0;
        int[][] mapa = new int[2][2]; // 0 = libre, 1 = ocupado
        String[] placas = new String[4];
        String[] tipoMovimiento = new String[20];
        String[] historialPlaca = new String[20];
        String[] historialEspacio = new String[20];
        int contadorHistorial = 0;

        // Inicializar los espacios como libres y las placas vacías
        for (int i = 0; i < 2; i++) {
            for (int j = 0; j < 2; j++) {
                mapa[i][j] = 0;
            }
        }
        for (int i = 0; i < 4; i++) {
            placas[i] = "";
        }

        seleccion = 0;
        while (seleccion != 8) {
            mostrarMenu();
            try {
                seleccion = Integer.parseInt(sc.nextLine().trim());
            } catch (NumberFormatException e) {
                seleccion = -1; // cae en la opción incorrecta
            }

            switch (seleccion) {

                case 1: {
                    libres = 0;
                    ocupados = 0;
                    for (int filas = 0; filas < 2; filas++) {
                        for (int columnas = 0; columnas < 2; columnas++) {
                            if (mapa[filas][columnas] == 0) {
                                libres++;
                            } else {
                                ocupados++;
                            }
                        }
                    }
                    System.out.println("                 DISPONIBILIDAD DEL PARQUEADERO");
                    System.out.println("Cantidad total de espacios: " + espaciosTotales);
                    System.out.println("Espacios libres: " + libres);
                    System.out.println("Espacios ocupados: " + ocupados);
                    break;
                }

                case 2: {
                    String espacioEncontrado = buscarEspacioLibre(mapa);
                    if (!espacioEncontrado.equals("LLENO")) {
                        System.out.println("                   REGISTRO DE INGRESO");
                        System.out.println("Hay espacios disponibles.");
                        System.out.println("Primer espacio disponible recomendado: " + espacioEncontrado);
                        System.out.println("Ingrese la placa del vehiculo:");
                        String placa = sc.nextLine();

                        boolean placaExiste = false;
                        for (int contador = 0; contador < 4; contador++) {
                            if (placas[contador].equals(placa)) {
                                placaExiste = true;
                            }
                        }

                        if (placaExiste) {
                            System.out.println("              VEHICULO YA REGISTRADO");
                            System.out.println("La placa " + placa + " ya se encuentra en el parqueadero.");
                            System.out.println("No es posible registrar nuevamente el vehiculo.");
                        } else {
                            System.out.println("                 SELECCION DE ESPACIO");
                            System.out.println("Espacios disponibles para seleccion:");
                            System.out.println("A1 - A2");
                            System.out.println("B1 - B2");

                            boolean espacioValido = false;
                            String espacioSeleccionado;
                            int posicionPlaca;
                            do {
                                System.out.println("Ingrese el identificador del espacio libre:");
                                espacioSeleccionado = sc.nextLine().trim();
                                posicionPlaca = obtenerPosicion(espacioSeleccionado);

                                if (posicionPlaca == -1) {
                                    System.out.println("Espacio incorrecto. Ingrese A1, A2, B1 o B2.");
                                } else if (mapa[posicionPlaca / 2][posicionPlaca % 2] == 1) {
                                    System.out.println("Ese espacio esta ocupado. Elija otro.");
                                } else {
                                    espacioValido = true;
                                }
                            } while (!espacioValido);

                            int filas = posicionPlaca / 2;
                            int columnas = posicionPlaca % 2;
                            mapa[filas][columnas] = 1;
                            placas[posicionPlaca] = placa;

                            System.out.println("              INGRESO REGISTRADO CORRECTAMENTE");
                            System.out.println("Placa: " + placa);
                            System.out.println("Espacio ocupado: " + espacioSeleccionado);

                            ocupados++;
                            if (contadorHistorial < 20) {
                                tipoMovimiento[contadorHistorial] = "INGRESO";
                                historialPlaca[contadorHistorial] = placa;
                                historialEspacio[contadorHistorial] = espacioSeleccionado;
                                contadorHistorial++;
                            } else {
                                System.out.println(
                                        "Aviso: el historial esta lleno; el ingreso no se guardo en el historial.");
                            }
                        }
                    } else {
                        System.out.println("                     PARQUEADERO LLENO");
                        System.out.println("No existen espacios disponibles en este momento.");
                        System.out.println("No se puede registrar el ingreso del vehiculo.");
                    }
                    break;
                }

                case 3: {
                    System.out.println("                   REGISTRO DE SALIDA");
                    String espacioSeleccionado;
                    int posicionPlaca;
                    do {
                        System.out.println("Ingrese el espacio que desea salirse:");
                        System.out.println("A1 - A2");
                        System.out.println("B1 - B2");
                        espacioSeleccionado = sc.nextLine().trim();
                        posicionPlaca = obtenerPosicion(espacioSeleccionado);
                        if (posicionPlaca == -1) {
                            System.out.println("Espacio incorrecto. Intente nuevamente.");
                        }
                    } while (posicionPlaca == -1);

                    int filas = posicionPlaca / 2;
                    int columnas = posicionPlaca % 2;

                    if (mapa[filas][columnas] == 1) {
                        System.out.println("              SALIDA REGISTRADA CORRECTAMENTE");
                        System.out.println("Placa del vehiculo: " + placas[posicionPlaca]);
                        System.out.println("Espacio liberado: " + espacioSeleccionado);

                        // Guardar movimiento antes de borrar la placa
                        if (contadorHistorial < 20) {
                            tipoMovimiento[contadorHistorial] = "SALIDA";
                            historialPlaca[contadorHistorial] = placas[posicionPlaca];
                            historialEspacio[contadorHistorial] = espacioSeleccionado;
                            contadorHistorial++;
                        } else {
                            System.out
                                    .println("Aviso: el historial esta lleno; la salida no se guardo en el historial.");
                        }

                        mapa[filas][columnas] = 0;
                        placas[posicionPlaca] = "";
                        ocupados--;
                        System.out.println("El espacio " + espacioSeleccionado + " ahora esta disponible.");
                    } else {
                        System.out.println("                    ESPACIO LIBRE");
                        System.out.println("El espacio " + espacioSeleccionado + " ya se encuentra libre.");
                        System.out.println("No existe un vehiculo para registrar su salida.");
                    }
                    break;
                }

                case 4: {
                    System.out.println("              CONSULTAR ESPACIO ESPECIFICO");
                    System.out.println("Posiciones del parqueadero:");
                    System.out.println("A1   A2");
                    System.out.println("B1   B2");
                    System.out.println("Ingrese el espacio que desea consultar:");
                    String espacioSeleccionado = sc.nextLine().trim();
                    int posicionPlaca = obtenerPosicion(espacioSeleccionado);

                    if (posicionPlaca != -1) {
                        int filas = posicionPlaca / 2;
                        int columnas = posicionPlaca % 2;
                        System.out.println("Espacio consultado: " + espacioSeleccionado);
                        if (mapa[filas][columnas] == 0) {
                            System.out.println("Estado: LIBRE (0)");
                        } else {
                            System.out.println("Estado: OCUPADO (1)");
                            System.out.println("Placa registrada: " + placas[posicionPlaca]);
                        }
                    } else {
                        System.out.println("              ESPACIO NO VALIDO");
                        System.out.println("El espacio ingresado no existe.");
                        System.out.println("Ingrese A1, A2, B1 o B2.");
                    }
                    break;
                }

                case 5:
                    mostrarMapa(mapa);
                    break;

                case 6: {
                    ocupados = 0;
                    for (int filas = 0; filas < 2; filas++) {
                        for (int columnas = 0; columnas < 2; columnas++) {
                            if (mapa[filas][columnas] == 1) {
                                ocupados++;
                            }
                        }
                    }
                    double porcentajeOcupacion = calcularPorcentaje(ocupados, espaciosTotales);
                    System.out.println("                 PORCENTAJE DE OCUPACION");
                    System.out.println("Espacios ocupados: " + ocupados + " de " + espaciosTotales);
                    System.out.println("Porcentaje de ocupacion: " + porcentajeOcupacion + "%");
                    break;
                }

                case 7:
                    System.out.println("                  HISTORIAL DE MOVIMIENTOS");
                    if (contadorHistorial == 0) {
                        System.out.println("No existen movimientos registrados.");
                    } else {
                        for (int contador = 0; contador < contadorHistorial; contador++) {
                            System.out.println("Movimiento #" + (contador + 1));
                            System.out.println("Tipo: " + tipoMovimiento[contador]);
                            System.out.println("Placa: " + historialPlaca[contador]);
                            System.out.println("Espacio: " + historialEspacio[contador]);
                        }
                    }
                    break;

                case 8:
                    System.out.println("                 CERRANDO SISTEMA");
                    System.out.println("Gracias por utilizar el Sistema de Parqueadero La Piazza.");
                    System.out.println("Programa finalizado correctamente.");
                    break;

                default:
                    System.out.println("Opcion incorrecta.");
                    System.out.println("Seleccione una opcion valida del 1 al 8.");
                    break;
            }
        }
        sc.close();
    }

    // ---------- SubProceso MostrarMenu ----------
    static void mostrarMenu() {
        System.out.println("                  SISTEMA DE PARQUEADERO: LA PIAZZA");
        System.out.println("1. Ver disponibilidad del parqueadero.");
        System.out.println("2. Registrar ingreso de vehiculo.");
        System.out.println("3. Registrar salida de vehiculo.");
        System.out.println("4. Consultar un espacio especifico.");
        System.out.println("5. Visualizar mapa del parqueadero.");
        System.out.println("6. Ver porcentaje de ocupacion.");
        System.out.println("7. Consultar historial de movimientos.");
        System.out.println("8. Salir del sistema.");
        System.out.println("                 Seleccione una opcion del 1 al 8:");
    }

    // ---------- Funcion BuscarEspacioLibre ----------
    static String buscarEspacioLibre(int[][] mapa) {
        for (int filas = 0; filas < 2; filas++) {
            for (int columnas = 0; columnas < 2; columnas++) {
                if (mapa[filas][columnas] == 0) {
                    return NOMBRES_ESPACIOS[filas * 2 + columnas];
                }
            }
        }
        return "LLENO";
    }

    // ---------- SubProceso MostrarMapa ----------
    static void mostrarMapa(int[][] mapa) {
        System.out.println("               MAPA DEL PARQUEADERO");
        System.out.println("0 = LIBRE");
        System.out.println("1 = OCUPADO");
        System.out.println();
        System.out.println("Posiciones:");
        System.out.println("A1   A2");
        System.out.println("B1   B2");
        System.out.println();
        System.out.println("Estados:");
        for (int filas = 0; filas < 2; filas++) {
            for (int columnas = 0; columnas < 2; columnas++) {
                System.out.print(mapa[filas][columnas] + "    ");
            }
            System.out.println();
        }
    }

    // ---------- Funcion CalcularPorcentaje ----------
    static double calcularPorcentaje(int ocupados, int espaciosTotales) {
        return ((double) ocupados / espaciosTotales) * 100;
    }

    // ---------- Auxiliar: identificador -> posición (0..3) o -1 si no existe
    // ----------
    static int obtenerPosicion(String espacio) {
        for (int i = 0; i < NOMBRES_ESPACIOS.length; i++) {
            if (NOMBRES_ESPACIOS[i].equals(espacio)) {
                return i;
            }
        }
        return -1;
    }
}
