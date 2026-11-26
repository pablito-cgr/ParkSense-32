SubProceso MostrarMenu
	Escribir "                  SISTEMA DE PARQUEADERO: LA PIAZZA"
	Escribir "1. Ver disponibilidad del parqueadero."
	Escribir "2. Registrar ingreso de vehiculo."
	Escribir "3. Registrar salida de vehiculo."
	Escribir "4. Consultar un espacio especifico."
	Escribir "5. Visualizar mapa del parqueadero."
	Escribir "6. Ver porcentaje de ocupacion."
	Escribir "7. Consultar historial de movimientos."
	Escribir "8. Salir del sistema."
	Escribir "                 Seleccione una opcion del 1 al 8:"
FinSubProceso

Algoritmo ProyectoIntegradorParqueadero
	Definir seleccion Como Entero
	Definir espaciosTotales Como Entero
	Definir libres, ocupados Como Entero
	Definir filas, columnas Como Entero
	Definir contador Como Entero
	Definir mapa Como Entero
	Definir posicionPlaca Como Entero
	Definir placa, placas Como Cadena
	Definir espacioEncontrado Como Cadena
	Definir espacioSeleccionado Como Cadena
	Definir placaExiste Como Logico
	Definir porcentajeOcupacion Como Real
	Definir ingresoCorrecto Como Logico
	Definir tipoMovimiento, historialPlaca, historialEspacio Como Cadena
	Definir contadorHistorial Como Entero
	Definir espacioValido Como Logico
	
	Dimension tipoMovimiento[20]
	Dimension historialPlaca[20]
	Dimension historialEspacio[20]
	Dimension placas[4]
	Dimension mapa[2,2]
	
	// Inicializar los espacios como libres
	mapa[1,1] <- 0
	mapa[1,2] <- 0
	mapa[2,1] <- 0
	mapa[2,2] <- 0
	
	// Inicializar las placas
	placas[1] <- ""
	placas[2] <- ""
	placas[3] <- ""
	placas[4] <- ""
	
	contadorHistorial <- 0
	libres <- 4
	ocupados <- 0
	espaciosTotales <- 4
	seleccion <- 0
	Mientras seleccion <> 8 Hacer
		MostrarMenu
		Leer seleccion
		Segun seleccion Hacer
			
			1:
				libres <- 0
				ocupados <- 0
				Para filas <- 1 Hasta 2 Hacer
					Para columnas <- 1 Hasta 2 Hacer
						Si mapa[filas,columnas] == 0 Entonces
							libres <- libres + 1
						SiNo
							ocupados <- ocupados + 1
						FinSi
					FinPara
				FinPara
				Escribir "                 DISPONIBILIDAD DEL PARQUEADERO"
				Escribir "Cantidad total de espacios: ", espaciosTotales
				Escribir "Espacios libres: ", libres
				Escribir "Espacios ocupados: ", ocupados
				
			2:
				espacioEncontrado <- BuscarEspacioLibre(mapa)
				Si espacioEncontrado <> "LLENO" Entonces
					Escribir "                   REGISTRO DE INGRESO"
					Escribir "Hay espacios disponibles."
					Escribir "Primer espacio disponible recomendado: ", espacioEncontrado
					Escribir "Ingrese la placa del vehiculo:"
					Leer placa
					placaExiste <- Falso
					Para contador <- 1 Hasta 4 Hacer
						Si placas[contador] == placa Entonces
							placaExiste <- Verdadero
						FinSi
					FinPara
					Si placaExiste == Verdadero Entonces
						Escribir "              VEHICULO YA REGISTRADO"
						Escribir "La placa ", placa, " ya se encuentra en el parqueadero."
						Escribir "No es posible registrar nuevamente el vehiculo."
					SiNo
						Escribir "                 SELECCION DE ESPACIO"
						Escribir "Espacios disponibles para seleccion:"
						Escribir "A1 - A2"
						Escribir "B1 - B2"
						espacioValido <- Falso
						Repetir
							Escribir "Ingrese el identificador del espacio libre:"
							Leer espacioSeleccionado
							Si espacioSeleccionado == "A1" Entonces
								filas <- 1
								columnas <- 1
								posicionPlaca <- 1
							SiNo
								Si espacioSeleccionado == "A2" Entonces
									filas <- 1
									columnas <- 2
									posicionPlaca <- 2
								SiNo
									Si espacioSeleccionado == "B1" Entonces
										filas <- 2
										columnas <- 1
										posicionPlaca <- 3
									SiNo
										Si espacioSeleccionado == "B2" Entonces
											filas <- 2
											columnas <- 2
											posicionPlaca <- 4
										SiNo
											filas <- 0
											columnas <- 0
										FinSi
									FinSi
								FinSi
							FinSi
							Si filas == 0 Entonces
								Escribir "Espacio incorrecto. Ingrese A1, A2, B1 o B2."
							SiNo
								Si mapa[filas,columnas] == 1 Entonces
									Escribir "Ese espacio esta ocupado. Elija otro."
								SiNo
									espacioValido <- Verdadero
								FinSi
							FinSi
						Hasta Que espacioValido == Verdadero
						ingresoCorrecto <- Falso
						mapa[filas,columnas] <- 1
						placas[posicionPlaca] <- placa
						ingresoCorrecto <- Verdadero
						Escribir "              INGRESO REGISTRADO CORRECTAMENTE"
						Escribir "Placa: ", placa
						Escribir "Espacio ocupado: ", espacioSeleccionado
						Si ingresoCorrecto == Verdadero Entonces
							ocupados <- ocupados + 1
							Si contadorHistorial < 20 Entonces
								contadorHistorial <- contadorHistorial + 1
								tipoMovimiento[contadorHistorial] <- "INGRESO"
								historialPlaca[contadorHistorial] <- placa
								historialEspacio[contadorHistorial] <- espacioSeleccionado
							SiNo
								Escribir "Aviso: el historial esta lleno; el ingreso no se guardo en el historial."
							FinSi
						FinSi
						
					FinSi
				SiNo
					Escribir "                     PARQUEADERO LLENO"
					Escribir "No existen espacios disponibles en este momento."
					Escribir "No se puede registrar el ingreso del vehiculo."
				FinSi
				
			3:
				Escribir "                   REGISTRO DE SALIDA"
				Repetir
					Escribir "Ingrese el espacio que desea salirse:"
					Escribir "A1 - A2"
					Escribir "B1 - B2"
					Leer espacioSeleccionado
					Si espacioSeleccionado <> "A1" Y espacioSeleccionado <> "A2" Y espacioSeleccionado <> "B1" Y espacioSeleccionado <> "B2" Entonces
						Escribir "Espacio incorrecto. Intente nuevamente."
					FinSi
				Hasta Que espacioSeleccionado = "A1" O espacioSeleccionado = "A2" O espacioSeleccionado = "B1" O espacioSeleccionado = "B2"
				Si espacioSeleccionado == "A1" Entonces
					filas <- 1
					columnas <- 1
					posicionPlaca <- 1
				FinSi
				Si espacioSeleccionado == "A2" Entonces
					filas <- 1
					columnas <- 2
					posicionPlaca <- 2
				FinSi
				Si espacioSeleccionado == "B1" Entonces
					filas <- 2
					columnas <- 1
					posicionPlaca <- 3
				FinSi
				Si espacioSeleccionado == "B2" Entonces
					filas <- 2
					columnas <- 2
					posicionPlaca <- 4
				FinSi
				Si mapa[filas,columnas] == 1 Entonces
					Escribir "              SALIDA REGISTRADA CORRECTAMENTE"
					Escribir "Placa del vehiculo: ", placas[posicionPlaca]
					Escribir "Espacio liberado: ", espacioSeleccionado
					// Guardar movimiento antes de borrar la placa
					Si contadorHistorial < 20 Entonces
						contadorHistorial <- contadorHistorial + 1
						tipoMovimiento[contadorHistorial] <- "SALIDA"
						historialPlaca[contadorHistorial] <- placas[posicionPlaca]
						historialEspacio[contadorHistorial] <- espacioSeleccionado
					SiNo
						Escribir "Aviso: el historial esta lleno; la salida no se guardo en el historial."
					FinSi
					mapa[filas,columnas] <- 0
					placas[posicionPlaca] <- ""
					ocupados <- ocupados - 1
					Escribir "El espacio ", espacioSeleccionado, " ahora esta disponible."
				SiNo
					Escribir "                    ESPACIO LIBRE"
					Escribir "El espacio ", espacioSeleccionado, " ya se encuentra libre."
					Escribir "No existe un vehiculo para registrar su salida."
				FinSi
				
			4:
				Escribir "              CONSULTAR ESPACIO ESPECIFICO"
				Escribir "Posiciones del parqueadero:"
				Escribir "A1   A2"
				Escribir "B1   B2"
				Escribir "Ingrese el espacio que desea consultar:"
				Leer espacioSeleccionado
				espacioValido <- Verdadero
				Si espacioSeleccionado == "A1" Entonces
					filas <- 1
					columnas <- 1
					posicionPlaca <- 1
				SiNo
					Si espacioSeleccionado == "A2" Entonces
						filas <- 1
						columnas <- 2
						posicionPlaca <- 2
					SiNo
						Si espacioSeleccionado == "B1" Entonces
							filas <- 2
							columnas <- 1
							posicionPlaca <- 3
						SiNo
							Si espacioSeleccionado == "B2" Entonces
								filas <- 2
								columnas <- 2
								posicionPlaca <- 4
							SiNo
								espacioValido <- Falso
							FinSi
						FinSi
					FinSi
				FinSi
				Si espacioValido == Verdadero Entonces
					Escribir "Espacio consultado: ", espacioSeleccionado
					Si mapa[filas,columnas] == 0 Entonces
						Escribir "Estado: LIBRE (0)"
					SiNo
						Escribir "Estado: OCUPADO (1)"
						Escribir "Placa registrada: ", placas[posicionPlaca]
					FinSi
				SiNo
					Escribir "              ESPACIO NO VALIDO"
					Escribir "El espacio ingresado no existe."
					Escribir "Ingrese A1, A2, B1 o B2."
				FinSi				
			5:
				MostrarMapa(mapa)
				
			6:
				ocupados <- 0
				
				Para filas <- 1 Hasta 2 Hacer
					Para columnas <- 1 Hasta 2 Hacer
						
						Si mapa[filas,columnas] == 1 Entonces
							ocupados <- ocupados + 1
						FinSi
						
					FinPara
				FinPara
				
				porcentajeOcupacion <- CalcularPorcentaje(ocupados, espaciosTotales)
				
				Escribir "                 PORCENTAJE DE OCUPACION"
				Escribir "Espacios ocupados: ", ocupados, " de ", espaciosTotales
				Escribir "Porcentaje de ocupacion: ", porcentajeOcupacion, "%"
				
			7:
				Escribir "                  HISTORIAL DE MOVIMIENTOS"
				Si contadorHistorial == 0 Entonces
					Escribir "No existen movimientos registrados."
				SiNo
					Para contador <- 1 Hasta contadorHistorial Hacer
						Escribir "Movimiento #", contador
						Escribir "Tipo: ", tipoMovimiento[contador]
						Escribir "Placa: ", historialPlaca[contador]
						Escribir "Espacio: ", historialEspacio[contador]
					FinPara
				FinSi
				
			8:
				Escribir "                 CERRANDO SISTEMA"
				Escribir "Gracias por utilizar el Sistema de Parqueadero La Piazza."
				Escribir "Programa finalizado correctamente."
				
			De Otro Modo:
				Escribir "Opcion incorrecta."
				Escribir "Seleccione una opcion valida del 1 al 8."
				
		FinSegun
	FinMientras
FinAlgoritmo


// 2. Registrar ingreso de vehiculo.
Funcion espacioEncontrado <- BuscarEspacioLibre(mapa)
	Definir filas, columnas Como Entero
	Definir encontrado Como Logico
	filas <- 1
	columnas <- 1
	encontrado <- Falso
	espacioEncontrado <- "LLENO"
	Mientras encontrado == Falso Y filas <= 2 Hacer
		Si mapa[filas,columnas] == 0 Entonces
			encontrado <- Verdadero
		SiNo
			Si columnas < 2 Entonces
				columnas <- columnas + 1
			SiNo
				columnas <- 1
				filas <- filas + 1
			FinSi
		FinSi
	FinMientras
	Si encontrado == Verdadero Entonces
		Si filas == 1 Y columnas == 1 Entonces
			espacioEncontrado <- "A1"
		FinSi
		Si filas == 1 Y columnas == 2 Entonces
			espacioEncontrado <- "A2"
		FinSi
		Si filas == 2 Y columnas == 1 Entonces
			espacioEncontrado <- "B1"
		FinSi
		Si filas == 2 Y columnas == 2 Entonces
			espacioEncontrado <- "B2"
		FinSi
	FinSi
FinFuncion

// 5. Visualizar mapa del parqueadero.
SubProceso MostrarMapa(mapa)
	Definir filas, columnas Como Entero
	Escribir "               MAPA DEL PARQUEADERO"
	Escribir "0 = LIBRE"
	Escribir "1 = OCUPADO"
	Escribir ""
	Escribir "Posiciones:"
	Escribir "A1   A2"
	Escribir "B1   B2"
	Escribir ""
	Escribir "Estados:"
	Para filas <- 1 Hasta 2 Hacer
		Para columnas <- 1 Hasta 2 Hacer
			Escribir Sin Saltar mapa[filas,columnas], "    "
		FinPara
		Escribir ""
	FinPara
FinSubProceso
// 6. Calcular porcentaje de ocupacion.
Funcion porcentaje <- CalcularPorcentaje(ocupados, espaciosTotales)
	porcentaje <- (ocupados / espaciosTotales) * 100
FinFuncion