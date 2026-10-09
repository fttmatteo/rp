---
name: RP Software
description: El cuaderno de la granja, ordenado y legible en el computador y en el celular.
colors:
  ambar: "#FE9A00"
  ambar-hondo: "#E17100"
  ambar-foco: "#BB4D00"
  ambar-claro: "#FFFBEB"
  terracota-logo: "#A63F1C"
  crema-logo: "#F4E7CF"
  papel: "#FAFAF9"
  hoja: "#FFFFFF"
  renglon-suave: "#F5F5F4"
  renglon: "#E7E5E4"
  borde-campo: "#D6D3D1"
  tinta-tenue: "#79716B"
  tinta-media: "#57534D"
  tinta-firme: "#44403B"
  tinta: "#1C1917"
  deuda: "#C10007"
  deuda-fondo: "#FEF2F2"
  deuda-borde: "#FFA2A2"
  al-dia: "#008236"
  al-dia-fondo: "#F0FDF4"
  al-dia-borde: "#7BF1A8"
  aviso: "#193CB8"
  aviso-fondo: "#EFF6FF"
  aviso-borde: "#8EC5FF"
typography:
  display:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
  headline:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.55
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
  dato:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
rounded:
  base: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  boton-primario:
    backgroundColor: "{colors.ambar}"
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.base}"
    padding: "10px 16px"
    height: "44px"
  boton-primario-hover:
    backgroundColor: "{colors.ambar-hondo}"
    textColor: "{colors.tinta}"
  boton-secundario:
    backgroundColor: "{colors.hoja}"
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.base}"
    padding: "10px 16px"
    height: "44px"
  boton-secundario-hover:
    backgroundColor: "{colors.renglon-suave}"
  boton-peligro:
    backgroundColor: "{colors.hoja}"
    textColor: "{colors.deuda}"
    typography: "{typography.label}"
    rounded: "{rounded.base}"
    padding: "10px 16px"
    height: "44px"
  boton-peligro-hover:
    backgroundColor: "{colors.deuda-fondo}"
  campo:
    backgroundColor: "{colors.hoja}"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.base}"
    padding: "8px 12px"
    height: "44px"
  tarjeta:
    backgroundColor: "{colors.hoja}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.base}"
    padding: "16px"
  pestana-activa:
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    padding: "8px 12px"
  opcion-elegida:
    backgroundColor: "{colors.ambar-claro}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.base}"
    padding: "8px 12px"
  etiqueta:
    backgroundColor: "{colors.renglon-suave}"
    textColor: "{colors.tinta-firme}"
    typography: "{typography.dato}"
    rounded: "{rounded.base}"
    padding: "2px 8px"
  aviso:
    backgroundColor: "{colors.aviso-fondo}"
    textColor: "{colors.aviso}"
    typography: "{typography.body}"
    rounded: "{rounded.base}"
    padding: "8px 12px"
---

# Design System: RP Software

## Overview

**Creative North Star: "El cuaderno de la granja"**

Lo que antes se anotaba a mano en un cuaderno, ahora en hojas blancas, con renglones claros y números que cuadran. La interfaz es papel y tinta: fondo casi blanco, hojas blancas con un borde fino, texto en tinta cálida (grises piedra) y un solo color de acento, el ámbar, reservado para lo que se toca y para marcar dónde se está. Como el subrayador amarillo sobre la página: señala, no decora. No hay sombras, ni degradados, ni movimiento: cada pantalla aparece completa y quieta, como una página que se abre.

La densidad es la de un cuaderno contable bien llevado: listas, tablas y totales a la vista, sin decoración que compita con los números. El dinero, la deuda y lo que falta por revisar se marcan con color de estado (rojo deuda, verde al día, azul aviso), siempre acompañado de palabras, nunca solo con color. La misma página sirve en el computador de la oficina y en el celular del repartidor en la calle, con sol: por eso el texto es grande, el contraste alto y los controles se pueden tocar con el pulgar. El ámbar lleno con texto en tinta oscura es de lo más visible bajo el sol.

Este documento fija el sistema hacia donde va el código. Los componentes de `src/components/ui.tsx` y `globals.css` ya siguen este sistema. Quedan dos deudas que se pagan al tocar cada pantalla: algunas páginas todavía pintan avisos en ámbar con clases propias, y mucho texto está en 14px y 12px en vez del mínimo de 16px.

**Key Characteristics:**
- Plano: hojas blancas con borde fino de 1px sobre fondo papel; cero sombras.
- Un solo acento (ámbar) para botón principal, pestaña activa, opción elegida y foco.
- Sobre ámbar, siempre texto en tinta oscura; nunca blanco.
- Color de estado solo para el dinero, el inventario y los pendientes, siempre con texto.
- Fuente del sistema, 16px mínimo para leer y tocar.
- Esquinas apenas redondeadas (4px) en todo.
- Sin animaciones ni transiciones, por regla global en `src/app/globals.css`.
- Solo HTML y Tailwind; los componentes viven en `src/components/ui.tsx`.

## Colors

Papel y tinta cálidos (la familia `stone` de Tailwind), el ámbar como única voz de acción y tres colores de estado que no se confunden con él: rojo, verde y azul. Los valores son los de Tailwind v4 (`amber-500`, `amber-600`, `amber-700`, `amber-50`, `blue-800`...), pasados a hex.

### Primary
- **Ámbar** (`amber-500`): el relleno del botón principal, con texto en tinta (8.2:1). Una acción principal por formulario.
- **Ámbar hondo** (`amber-600`): hover y presionado del botón principal, también con texto en tinta (5.5:1); borde del botón principal; subrayado de 2px de la pestaña activa y borde de la opción elegida. Como línea sobre blanco da 3.2:1, suficiente para un indicador gráfico, nunca para texto.
- **Ámbar de foco** (`amber-700`): el contorno de foco del teclado en todo lo que se toca (5.1:1 sobre hoja, 4.8:1 sobre papel). Es el único ámbar que puede ir como línea fina sin perderse.
- **Ámbar claro** (`amber-50`): fondo de la opción elegida en "Qué vas a registrar". Tinta encima da 16.9:1.

### Secondary
- **Terracota del logo** y **Crema del logo**: solo en el logo, los íconos, la pantalla de arranque y el color de la app instalada (`public/manifest.webmanifest`). No se usan en botones, pestañas, texto ni fondos de la interfaz.

### Neutral
- **Papel** (`stone-50`): fondo de la página, debajo de las hojas.
- **Hoja**: fondo de tarjetas, tablas, campos y botones secundarios.
- **Renglón suave** (`stone-100`): cabecera de tablas, franja de totales, etiqueta gris, hover del botón secundario y del menú.
- **Renglón** (`stone-200`): borde de tarjetas y tablas, línea bajo las pestañas, divisiones de listas.
- **Borde de campo** (`stone-300`): borde de campos y botones secundarios; también la línea punteada del estado vacío.
- **Tinta tenue** (`stone-500`): texto de ayuda, estados vacíos, datos terciarios. Es el gris más claro permitido para texto (4.8:1 sobre hoja).
- **Tinta media** (`stone-600`): rótulos de datos (`dt`), subtítulos, enlaces de menú y pestañas inactivos.
- **Tinta firme** (`stone-700`): rótulos de campos y texto de etiquetas grises.
- **Tinta** (`stone-900`): texto principal, títulos y texto sobre ámbar.

### Estados
- **Deuda** (`red-700`, con fondo `red-50` y borde `red-300`): lo que se debe, lo vencido, existencias bajo el mínimo, errores y el botón de peligro (anular). 6.4:1 sobre hoja.
- **Al día** (`green-700`, con fondo `green-50` y borde `green-300`): "No debe nada", confirmaciones. 4.9:1 sobre hoja.
- **Aviso** (`blue-800`, con fondo `blue-50` y borde `blue-300`): lo que pide atención sin ser error: "Para revisar" en el inicio, caja cerrada, cupo superado, transferencias sin verificar, ruta sin paradas. 8.1:1 sobre su fondo, 8.8:1 sobre hoja. El azul es el único color de la paleta que no se parece al ámbar, al rojo ni al verde, y se distingue de los tres aun con daltonismo rojo-verde.

### Named Rules
**La Regla del Ámbar que se Toca.** El ámbar solo va en lo que se puede tocar o en lo que marca dónde estás: botón principal, pestaña activa, opción elegida y foco. Nunca en texto, nunca en un número, nunca en avisos ni de fondo decorativo.

**La Regla de la Tinta sobre Ámbar.** Sobre ámbar el texto es siempre tinta (`stone-900`) en peso 500 o más. El blanco sobre ámbar da 3.2:1 y no se usa.

**La Regla del Aviso Azul.** El aviso es azul, nunca ámbar, para que no se confunda con lo que se toca. En el código ya no queda ningún aviso en ámbar: `Alerta tipo="aviso"`, `Etiqueta color="azul"`, el bloque "Para revisar" del inicio, el "Comprado por clasificar" de Inventario y los avisos de Caja son azules. El ámbar solo aparece en el botón principal, la pestaña activa, la opción elegida, las casillas y el foco.

**La Regla de la Deuda que Habla.** El rojo de la deuda nunca va solo: siempre acompaña una palabra ("Debe", "Vencida", "Anular", "Bajo el mínimo"). Un número rojo sin rótulo es un error de diseño.

## Typography

**Display Font:** system-ui (con -apple-system, Segoe UI, Roboto, sans-serif)
**Body Font:** la misma
**Label/Mono Font:** la misma; las cifras usan las del sistema

**Character:** Una sola familia, la del teléfono o del computador de cada quien: carga al instante, se lee como el resto del aparato y no distrae. La jerarquía sale del tamaño y del peso (400, 500, 600), no de cambiar de fuente.

### Hierarchy
- **Display** (600, 24px, 1.33): el número grande de cada tarjeta del inicio (ventas del día, cartera, efectivo en caja). Una cifra por tarjeta.
- **Headline** (600, 20px, 1.4): el título de cada página (`Titulo`), uno por pantalla.
- **Title** (600, 18px, 1.55): título de cada tarjeta (`Tarjeta`), nombre del cliente en cada parada de Mi ruta, títulos de diálogo, nombre del producto en la pantalla Acerca de.
- **Body** (400, 16px, 1.5): todo texto de lectura, valores en campos, filas de listas de Mi ruta, alertas.
- **Label** (500, 16px, 1.5): rótulos de campos, texto de botones, pestañas, menú.
- **Dato** (400, 14px, 1.43): solo para datos secundarios dentro de tablas densas de oficina (columnas de reportes, fecha y usuario de un movimiento) y para etiquetas de estado. Nunca para el texto principal de una fila ni para nada en Mi ruta.

### Named Rules
**La Regla de los 16.** Lo que se lee o se toca va en 16px o más. 14px solo para el dato secundario de una tabla de oficina. 12px no se usa. Los componentes de `ui.tsx` (botones, rótulos, ayudas, alertas, pestañas, etiquetas, estado vacío) ya cumplen. Mi ruta, el inicio, Pedidos, Contabilidad, Inventario, el menú principal y el selector de día también. *Pendiente en el código:* las demás páginas todavía tienen muchos `text-sm` y `text-xs` propios (totales, tablas, encabezado); se suben al tocar cada pantalla.

**La Regla de una Cifra Grande.** En una tarjeta del inicio hay una sola cifra en Display. Lo demás es Body o Dato. Si la cifra pide atención, se marca con la etiqueta azul "Para revisar" debajo, no pintando la cifra. Las cifras van en números tabulares (`tabular-nums`). El enlace de cada tarjeta va abajo (44px), alineado entre las tarjetas de una misma fila.

## Layout

Una columna central de hasta 1024px (`max-w-5xl`) con 16px de margen a los lados, centrada en pantallas grandes y a todo el ancho en el celular. Encabezado blanco con el icono y "RP Software" a la izquierda, usuario, operación, "Cambiar" y "Salir" a la derecha, y el menú principal debajo, que en el celular baja a una segunda línea en vez de esconderse en un menú hamburguesa o con desplazamiento lateral. El contenido va 24px debajo del encabezado.

Cada sección del menú agrupa sus páginas en pestañas subrayadas (Pedidos, Contabilidad, Usuarios), y las páginas largas parten su contenido en vistas con la misma apariencia (`Vistas`, en la URL con `?ver=`), para no apilarlo todo y obligar a bajar.

Las cuadrículas son simples y suben de columnas por ancho: una columna en el celular, 2 desde 640px (`sm`), 3 desde 1024px (`lg`); el inventario del inicio llega a 6. Pantallas de una sola tarea (entrada, elegir operación, Acerca de) usan una columna estrecha de 384 a 448px centrada.

Ritmo en la escala de 4px de Tailwind: 8px entre piezas pequeñas, 12px entre filas de formulario, 16px dentro de las tarjetas y entre tarjetas, 24px entre bloques de página. Los totales van arriba de cada lista, no al final: es lo primero que se busca.

**La Regla del Pulgar.** En el celular, todo lo que se toca mide al menos 44px de alto. Las acciones principales de Mi ruta (entregar, tomar pedidos, precierre) van a todo el ancho. `Boton`, campos, pestañas, menú principal, atajos del selector de día y todo Mi ruta ya miden 44px o más; en cada parada, la acción "Entregado y pagó" mide 56px. El encabezado también.

## Elevation & Depth

Totalmente plano. No hay ninguna sombra en el código y no debe haberla. La profundidad se da por capas de tono y por borde: papel (página) → hoja blanca con borde de 1px en tono renglón (tarjeta, tabla) → renglón suave (cabecera de tabla, franja de totales). Los diálogos nativos (`dialog`) se separan con un velo negro al 40%, no con sombra.

**La Regla de la Hoja sobre el Papel.** Una superficie se distingue por su borde fino y su fondo, nunca por una sombra ni por un degradado. Si algo necesita destacarse, se le da color de estado o se sube en la página, no se levanta.

## Shapes

Una sola esquina para todo: apenas redondeada (4px), en botones, campos, tarjetas, tablas, alertas, etiquetas y opciones. La única excepción es el ícono del software en Acerca de (16px). Bordes siempre de 1px sólidos; el estado vacío usa borde punteado. Las pestañas no tienen caja: solo una línea de 2px debajo de la activa.

## Components

### Buttons
Firmes y sin adornos, como un sello. Altura de 44px, texto en Label.
- **Shape:** esquina apenas redondeada (4px), borde de 1px.
- **Primary:** relleno ámbar, texto en tinta, borde ámbar hondo; la acción principal de cada formulario, una por formulario. En Mi ruta, a todo el ancho.
- **Hover / Focus:** hover a ámbar hondo con el mismo texto en tinta, sin transición. Foco con contorno de 2px en ámbar de foco, separado 2px del botón. Deshabilitado al 50% de opacidad.
- **Secundario:** hoja blanca, tinta, borde de campo; hover en renglón suave. Para "Ver", "Cancelar" y acciones al lado de la principal.
- **Peligro:** hoja blanca, texto rojo de deuda y borde de deuda; hover en fondo de deuda. Solo para anular.
- **Enlace de texto:** subrayado, en tinta: "Cambiar", "Salir", "Ver todo", y los `summary` que abren opciones menos frecuentes.
- **Acción de texto** (`BotonTexto`): un botón con forma de enlace subrayado, de 44px de alto, para acciones dentro de una fila ("Ya llegó al banco", "Quitar"); con `peligro` va en rojo de deuda ("Anular").

### Chips (opciones de "Qué vas a registrar")
- **Style:** hoja blanca, borde de campo, esquina de 4px, 8px por 12px de relleno.
- **State:** la elegida lleva borde ámbar hondo, fondo ámbar claro y peso 600, con `aria-current`. Solo una a la vez; muestran un formulario a la vez.

### Etiquetas de estado
Pequeñas píldoras rectangulares (esquina de 4px, 2px por 8px) en Dato con peso 500: gris (renglón suave y tinta firme), verde (`green-100` con `green-800`), rojo (`red-100` con `red-800`) y azul (`blue-100` con `blue-800`). Marcan estados (Pendiente, Entregado, Anulado, Vencida, Sin verificar), nunca acciones. No hay etiqueta ámbar. "Inactivo" (clientes, proveedores, empleados) es siempre gris y sale de un solo componente, `EtiquetaInactivo`: es un estado, no una deuda; el rojo queda para lo vencido, lo anulado y los errores. "Vacío" y "Fuera de uso" de los galpones también son grises.

### Cards / Containers
- **Corner Style:** 4px.
- **Background:** hoja blanca.
- **Shadow Strategy:** ninguna; ver Elevation & Depth.
- **Border:** 1px en tono renglón.
- **Internal Padding:** 16px. Título opcional en Title (18px, 600) y 12px debajo, para que se distinga de los rótulos de campo (16px, 500).

### Inputs / Fields
- **Style:** hoja blanca, borde de campo de 1px, esquina de 4px, 8px por 12px, texto de 16px (evita el zoom de iOS), a todo el ancho. Rótulo arriba en Label, ayuda debajo en tinta tenue.
- **Focus:** contorno de 2px en ámbar de foco, separado 1px.
- **Error / Disabled:** el error va en una `Alerta` roja arriba del formulario, con `role="alert"`. Casillas de 20px.

### Navigation
- **Menú principal** (`MenuPrincipal`): enlaces de texto de 16px y 44px de alto, en una fila que baja a otra línea si no cabe; hover en renglón suave. La sección actual (incluidas sus subpáginas, por ejemplo `/caja/reporte` en Contabilidad) se marca como la opción elegida: borde ámbar hondo, fondo ámbar claro y peso 600, con `aria-current="page"`. Sin hamburguesa ni desplazamiento lateral: el celular ve todo el menú.
- **Encabezado:** "Cambiar" y "Salir" son enlaces subrayados de 44px de alto junto al nombre y la operación.
- **Pestañas:** texto en tinta media sobre una línea de 1px en tono renglón; la activa en tinta, peso 600 y subrayado de 2px en ámbar hondo, con `aria-current="page"`. Se desplazan de lado si no caben.

### Alertas
Caja con borde de 1px y fondo de estado, esquina de 4px, 8px por 12px: error (rojo de deuda), ok (verde al día) y aviso (azul). El bloque "Para revisar" del inicio es un aviso azul con título en peso 600 y una lista apretada de enlaces subrayados en azul aviso que llevan a cada pendiente, en dos columnas desde 640px. Con mouse las filas van juntas; en pantallas táctiles (`pointer-coarse`) cada enlace mide 44px de alto.

### Tablas
Dentro de una hoja con borde y desplazamiento lateral propio. Cabecera en renglón suave con texto en tinta media y peso 500; filas separadas por una línea muy tenue; celdas de 8px por 12px. Columnas secundarias se esconden en el celular y aparecen desde 640px; lo que no puede perderse baja como segunda línea en tinta media dentro de la columna principal (en Pedidos, el número y la fecha debajo del cliente), para que la tabla quepa sin desplazar de lado. El nombre de la fila es el enlace a su detalle. Las cifras van a la derecha en números tabulares.

### Franja de totales (signature)
Arriba de cada lista de dinero (`FranjaTotales` en `src/components/dinero.tsx`): una franja en renglón suave con tres datos (Efectivo, Transferencia, Total), rótulo en tinta media encima de cada valor, cifras tabulares y el Total en peso 600. En el celular el Total baja a su propia fila; desde 640px van los tres en una. Es la forma de "cuadrar" de un vistazo y se repite en Ingresos, Egresos, Caja y Reparto.

### Parada de Mi ruta (signature)
Una hoja por cliente: nombre en Title, dirección y zona en tinta media, deuda en rojo con "Debe" o en verde con "No debe nada", botones de llamar, WhatsApp y Maps, y el botón ámbar de entregar a todo el ancho. Lo menos frecuente (fiado, transferencia, entrega parcial, no entregado, solo abono) va escondido en `details` debajo, para que la parada se resuelva con un toque.

### Estado vacío
Texto centrado en tinta tenue dentro de un borde punteado de 1px, 24px de relleno. Dice qué falta en palabras de la granja ("No quedan pedidos de hoy sin tomar").

## Do's and Don'ts

### Do:
- **Do** usar ámbar solo para el botón principal, la pestaña activa, la opción elegida, las casillas marcadas (`accent-amber-600`) y el foco.
- **Do** poner texto en tinta (`stone-900`) sobre ámbar, en peso 500 o más.
- **Do** usar ámbar hondo (`amber-600`) o más oscuro cuando el ámbar es una línea sobre blanco, y ámbar de foco (`amber-700`) para el contorno de foco.
- **Do** marcar los avisos en azul (`blue-800` sobre `blue-50`).
- **Do** escribir 16px o más todo lo que se lee o se toca; 14px solo para el dato secundario de una tabla de oficina.
- **Do** dar al menos 44px de alto a todo lo que se toca en el celular, y a todo el ancho a las acciones principales de Mi ruta.
- **Do** acompañar cada color de estado con una palabra: "Debe", "Vencida", "Bajo el mínimo", "No debe nada", "Sin verificar".
- **Do** poner los totales arriba de la lista, en la franja de totales.
- **Do** separar superficies con borde de 1px y cambio de tono, siempre con esquina de 4px.
- **Do** reutilizar `Boton`, `Campo`, `Tarjeta`, `Alerta`, `Tabla`, `Vacio`, `Etiqueta` y `Pestanas` de `src/components/ui.tsx` antes de escribir clases nuevas.
- **Do** esconder en `details` lo poco frecuente, para que la acción común quede a un toque.

### Don't:
- **Don't** poner texto blanco sobre ámbar: da 3.2:1.
- **Don't** usar ámbar para avisos, etiquetas, texto o cifras.
- **Don't** usar la terracota ni la crema del logo en la interfaz.
- **Don't** poner el logo ni el nombre de RP Software como si fueran de la empresa: el encabezado de la app, el inicio de sesión, los recibos y los reportes llevan el nombre de la empresa (`nombreEmpresa()` de `src/lib/marca.ts`); el software solo firma con "Generado con RP Software" al pie de los documentos y conserva su ícono, "Acerca de" y el pie de la app.
- **Don't** usar animaciones, transiciones ni desplazamiento suave: la regla global de `globals.css` las anula y no se quita.
- **Don't** agregar librerías de componentes de UI; solo HTML y Tailwind.
- **Don't** usar sombras, degradados ni fondos con textura.
- **Don't** usar texto de 12px (`text-xs`) ni gris más claro que la tinta tenue (`stone-400` da 2.6:1 sobre blanco).
- **Don't** poner un número rojo sin rótulo.
- **Don't** esconder el menú en una hamburguesa ni cambiar de fuente; la fuente es la del sistema.
- **Don't** apilar varios formularios largos en una página: uno a la vez, con opciones o vistas.
