# 🎸 Afinador Pro - Afinador de Guitarra Móvil en Pantalla Única

Una aplicación web progresiva (PWA) moderna, elegante y ultra precisa, diseñada específicamente para pantallas de smartphones. Funciona directamente en el navegador del móvil capturando el sonido del micrófono en tiempo real y filtrando el ruido ambiental.

---

## ✨ Características Principales

- **📱 Diseño en Pantalla Única (100dvh)**: Pensado para móviles sin necesidad de scroll, con estética oscura moderna (*dark mode* estilo estudio musical con acentos esmeralda y cian).
- **🛡️ Aislamiento y Limpieza de Ruido Ambiental**:
  - **Filtro Paso-Alto (High-Pass a 65 Hz)**: Suprime frecuencias subsónicas, golpes en la mesa, roces del teléfono y viento.
  - **Filtro Paso-Bajo (Low-Pass a 1000 Hz)**: Elimina ruido blanco, voces de fondo y siseos agudos.
  - **Noise Gate (Puerta de ruido RMS)**: Descarta el ruido ambiente cuando la guitarra no está sonando para evitar saltos o parpadeos molestos en pantalla.
  - Botón de alternancia rápida para activar/desactivar el filtro de ruido en cualquier momento.
- **🎯 Precisión de Tono con Algoritmo YIN**:
  - Implementación del algoritmo **YIN con interpolación parabólica**, el estándar de oro para instrumentos de cuerda monofónicos que evita confusiones con los armónicos (elimina el típico error de salto de octava).
  - Medidor de desviación en **Cents** (-50 a +50) con aguja analógica suavizada por física LERP a 60 FPS.
  - Zona de afinación perfecta (±3 cents) con feedback lumínico y vibración háptica en móviles compatibles.
- **🎼 Notación Dual Simultánea**:
  - **Notación Americana**: En tamaño grande y legible a distancia (`E`, `A`, `D`, `G`, `B`, `E`).
  - **Notación Europea**: Debajo, elegante y clara (`Mi`, `La`, `Re`, `Sol`, `Si`, `Mi`).
- **🎸 Identificación Automática de Cuerda**:
  - Detecta automáticamente qué cuerda estás tocando y la resalta en el rack inferior con grosor visual realista según el calibre de cada cuerda.
  - Posibilidad de seleccionar manualmente una cuerda tocándola o dejar el modo `AUTO`.
- **⚡ Afinaciones Rápidas Incluidas**:
  1. **Estándar** (E A D G B E)
  2. **Drop D** (D A D G B E)
  3. **DADGAD** (D A D G A D)
  4. **Open D** (D A D F# A D)
  5. **Open G** (D G D G B D)
  6. **Eb / Medio tono abajo** (Eb Ab Db Gb Bb Eb)
  7. **Drop C** (C G C F A D)
- **📲 PWA Offline Ready**: Incluye `manifest.json` y `Service Worker` para instalarse en la pantalla de inicio del teléfono y funcionar sin conexión a internet.

---

## 🚀 Cómo Alojarlo Gratis en GitHub Pages (Paso a Paso)

GitHub Pages te permite alojar esta web de forma 100% gratuita, con certificado SSL seguro (HTTPS obligatorio para que los móviles permitan el acceso al micrófono) y sin servidores ni costes de mantenimiento.

### Método 1: Desde la web de GitHub (Sin usar comandos)

1. **Crea un repositorio en GitHub**:
   - Entra en [github.com](https://github.com) e inicia sesión.
   - Pulsa el botón verde **"New"** (Nuevo repositorio).
   - Nómbralo, por ejemplo: `afinador-guitarra`.
   - Selecciona **Public** y pulsa **"Create repository"**.

2. **Sube los archivos**:
   - En la página del repositorio creado, haz clic en **"uploading an existing file"** (subir archivos existentes).
   - Arrastra todos los archivos de esta carpeta (`index.html`, `styles.css`, `app.js`, `audio-processor.js`, `manifest.json`, `sw.js`, `icon-192.svg`, `icon-512.svg`).
   - Abajo haz clic en el botón verde **"Commit changes"**.

3. **Activar GitHub Pages**:
   - En la barra superior de tu repositorio, ve a **Settings** (Configuración).
   - En el menú lateral izquierdo, haz clic en **Pages**.
   - En el apartado **"Build and deployment" > Branch**:
     - Selecciona la rama `main` (o `master`).
     - Deja la carpeta en `/ (root)`.
     - Haz clic en **Save** (Guardar).

4. **¡Listo!**:
   - En 1-2 minutos, GitHub te dará el enlace público:
     `https://<tu-usuario>.github.io/afinador-guitarra/`

---

### Método 2: Usando la terminal (Git)

Si tienes `git` configurado en tu ordenador:

```bash
git init
git add .
git commit -m "Afinador de guitarra para móvil"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/afinador-guitarra.git
git push -u origin main
```

Luego ve a **Settings > Pages** en GitHub y activa la rama `main`.

---

## 📱 Cómo Instalarlo en el Móvil como App

Una vez abierto el enlace en el navegador de tu móvil:

- **En iPhone / iPad (Safari)**:
  1. Pulsa el botón **Compartir** (icono de cuadrado con flecha hacia arriba en la barra inferior).
  2. Elige la opción **"Añadir a la pantalla de inicio"**.
  3. Ahora aparecerá como una app nativa en tu pantalla de inicio a pantalla completa.

- **En Android (Chrome)**:
  1. Pulsa en el menú de los **tres puntos** (arriba a la derecha).
  2. Selecciona **"Añadir a pantalla de inicio"** o **"Instalar aplicación"**.
  3. Se abrirá como app independiente sin barras de navegador.
