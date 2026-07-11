# Notas

App independiente de notas rápidas: listas (checklist), gastos rápidos y notas de texto libre, con post-its de colores sobre un corcho. Sincroniza en tiempo real con Firebase Firestore, funciona como PWA instalable, y cada nota se puede compartir por WhatsApp.

Es el módulo de Notas de "Bitácora del Dueño", separado para poder compartirse como herramienta independiente.

## Archivos

- `index.html` — estructura de la página
- `style.css` — estilos (tema oscuro + post-its)
- `app.js` — toda la lógica (Firestore, render, interacciones)
- `firebase-config.js` — **aquí van tus llaves de Firebase** (plantilla, hay que llenarla)
- `manifest.json` / `service-worker.js` / `icons/` — soporte PWA (instalable, funciona offline)

## Pasos para dejarla funcionando

### 1. Crear el proyecto de Firebase (nuevo, separado del de Bitácora)
1. Ve a https://console.firebase.google.com/ → **Agregar proyecto** (ej. `notas-app-mp`).
2. Dentro del proyecto: **Compilación → Firestore Database → Crear base de datos**. Empieza en modo de prueba mientras la pruebas.
3. En el ícono de engrane → **Configuración del proyecto → Tus apps → Agregar app → Web (</>)**. Regístrala con cualquier apodo.
4. Copia el objeto `firebaseConfig` que te muestra Firebase.

### 2. Llenar `firebase-config.js`
Pega los valores copiados en el archivo `firebase-config.js`, reemplazando los placeholders (`TU_API_KEY`, `TU_PROYECTO`, etc.).

### 3. Reglas de Firestore
Mientras la pruebas tú solo, el modo de prueba está bien. Antes de compartir el link más ampliamente, avísame y ajustamos las reglas (por ejemplo, para que no cualquiera con el link pueda borrar todo).

### 4. Subir a GitHub Pages
1. Crea un repo nuevo en `materialespalenque-spec` (ej. `notas-app`).
2. Sube estos archivos tal cual (misma estructura de carpetas, incluyendo `icons/`).
3. Activa GitHub Pages en la configuración del repo (rama `main`, carpeta raíz).
4. Tu link quedará como `https://materialespalenque-spec.github.io/notas-app/`.

### 5. Instalar como app
Al abrir el link en el navegador (Chrome/Edge en computadora, o Chrome/Safari en celular), debería aparecer la opción de "Instalar" o "Agregar a pantalla de inicio".

## Notas de diseño
Los íconos en `icons/` son un placeholder simple (cuadro amarillo tipo post-it). Si quieres un ícono más elaborado para cuando la compartas, lo hacemos aparte.
