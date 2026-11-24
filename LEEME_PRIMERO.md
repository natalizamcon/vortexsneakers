# VORTEX SNEAKERS · Cómo dejar la aplicación funcionando

Esta carpeta tiene todo: la aplicación (sirve igual en computadora y en celular) y la base de datos.
Solo vas a usar tres cosas: **Supabase** (donde se guardan los datos), **GitHub** (donde se guarda el código) y **Netlify** (la página web pública).

Sigue los pasos en orden. No hace falta saber programar.

---

## Parte 1 · Supabase (la base de datos)

### 1. Crear el proyecto
1. Entra a **supabase.com** e inicia sesión.
2. Toca **New project**.
3. Ponle un nombre (por ejemplo `vortex-sneakers`), escribe una contraseña para la base de datos (guárdala) y en **Region** elige **South America (São Paulo)**.
4. Toca **Create new project** y espera un par de minutos.

### 2. Crear todas las tablas (un solo copiar y pegar)
1. En el menú de la izquierda entra a **SQL Editor**.
2. Toca **New query**.
3. Abre el archivo `supabase/01_base_de_datos.sql` de esta carpeta (con el Bloc de notas, por ejemplo), copia **todo** y pégalo.
4. Toca **Run**. Debe decir **Success**.

Esto crea todo lo necesario: inventario, lotes, clientes, reservas, ventas, pagos, gastos, agenda, permisos y la carpeta de fotos. También deja cargados tus dos fardos iniciales (Bs 1.800 y Bs 1.900, con Bs 300 de envío).

### 3. Revisar la carpeta de fotos
1. En el menú de la izquierda entra a **Storage**.
2. Debe aparecer una carpeta llamada **productos** marcada como **Public**.
3. **Solo si no aparece:** toca **New bucket**, escribe exactamente `productos`, activa **Public bucket** y toca **Save**.

### 4. Crear tu usuario administrador
1. En el menú de la izquierda entra a **Authentication** → **Users**.
2. Toca **Add user** → **Create new user**.
3. Escribe tu correo y la contraseña que quieras.
4. **Marca la casilla “Auto Confirm User”**.
5. Toca **Create user**.

### 5. Darle permisos de administrador
1. Vuelve a **SQL Editor** → **New query**.
2. Abre el archivo `supabase/02_administrador.sql`.
3. Cambia solo estas dos líneas:
   - `tu-correo@ejemplo.com` → el **mismo correo** del paso 4.
   - `Administrador` → tu nombre.
4. Copia todo, pégalo y toca **Run**. Debe decir **Success**.

### 6. Copiar los dos datos de conexión
1. Entra a **Project Settings** (el engranaje) → **API** (o **Data API** / **API Keys**).
2. Copia la **Project URL** (empieza con `https://` y termina en `.supabase.co`).
3. Copia la **Publishable key** (empieza con `sb_publishable_`). Si tu proyecto muestra la versión anterior, usa la clave **anon public**.

⚠️ **Nunca** uses la clave **secret** ni **service_role**.

---

## Parte 2 · Conectar la aplicación (dos variables)

Abre el archivo `src/config.ts` y reemplaza solo lo que está entre comillas:

```ts
export const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";   // ← pega tu Project URL
export const SUPABASE_KEY = "PEGA-AQUI-TU-PUBLISHABLE-KEY";      // ← pega tu Publishable key
```

Guarda el archivo. Puedes hacerlo antes de subir la carpeta a GitHub, o después, directamente en GitHub (paso 8).

---

## Parte 3 · GitHub (guardar el código)

### 7. Subir la carpeta
1. Entra a **github.com** e inicia sesión.
2. Toca **New** (nuevo repositorio), ponle de nombre `vortex-sneakers`, elige **Private** y toca **Create repository**.
3. En la página que aparece, toca el enlace **uploading an existing file**.
4. Abre la carpeta `vortex-sneakers` en tu computadora, selecciona **todo su contenido** (no la carpeta, sino lo que hay dentro) y arrástralo a la página.
5. Abajo toca **Commit changes**.

### 8. (Si no lo hiciste antes) Pegar la URL y la clave en GitHub
1. En tu repositorio entra a `src` → `config.ts`.
2. Toca el lápiz ✏️ (Edit).
3. Pega tu URL y tu clave entre las comillas.
4. Toca **Commit changes**.

---

## Parte 4 · Netlify (publicar la página)

### 9. Conectar con GitHub
1. Entra a **netlify.com** e inicia sesión (puedes usar tu cuenta de GitHub).
2. Toca **Add new site** → **Import an existing project** → **GitHub**.
3. Autoriza el acceso y elige el repositorio `vortex-sneakers`.
4. No cambies nada: el archivo `netlify.toml` ya le indica a Netlify cómo construir la app.
5. Toca **Deploy**. En 1 o 2 minutos verás el enlace público (algo como `https://nombre.netlify.app`).

Cada vez que cambies algo en GitHub, Netlify vuelve a publicar solo.

### 10. Entrar
Abre el enlace de Netlify e inicia sesión con el correo y la contraseña del paso 4.

---

## Después de entrar

- **Crear cuentas para tu socio y empleados:** menú **Usuarios y permisos** → **Crear usuario**. Escribes nombre, correo, contraseña y rol (Administrador, Vendedor o Encargado de inventario). Queda listo al instante; no tienes que volver a Supabase.
- **Completar el proveedor inicial:** en **Compras y lotes**, toca el lápiz del proveedor para poner su nombre y número. Con el lápiz de cada fardo puedes corregir su fecha de compra.
- **Cargar los pares:** **Inventario** → **Nuevo par**, con las fotos tomadas desde el celular.
- **Instalar en el celular como una app:**
  - Android (Chrome): menú ⋮ → **Instalar aplicación** o **Agregar a pantalla principal**.
  - iPhone (Safari): botón Compartir → **Agregar a inicio**.
- **Reservas vencidas:** si una reserva vence y no tenía adelanto, el par vuelve solo a Disponibles. Si tenía adelanto, queda marcada en rojo para que ustedes decidan si la convierten en venta o la cancelan.
- **Avisos de la agenda:** toca la campana 🔔 y luego **Activar avisos en este dispositivo**. Los avisos llegan mientras la app está abierta.

## Si algo no funciona

| Lo que ves | Qué hacer |
|---|---|
| “Falta conectar la base de datos” | Revisa que pegaste bien la URL y la clave en `src/config.ts`. |
| “Correo o contraseña incorrectos” | Revisa el usuario en Supabase → Authentication → Users. |
| “Tu usuario todavía no tiene acceso” | Ejecuta `02_administrador.sql` con ese mismo correo. |
| “No se pudieron cargar los datos” | Ejecuta otra vez `01_base_de_datos.sql` (no borra nada). |
| Las fotos no suben | Revisa el paso 3: debe existir la carpeta `productos` marcada como pública. |

**Nota:** en el plan gratuito, Supabase pausa los proyectos que pasan 7 días sin uso. Si te ocurre, entra a supabase.com y toca **Restore project**; no se pierden datos.

## Tienda en línea (abierta al público)

- Quien abre la página **sin iniciar sesión ve el catálogo**: solo pares disponibles, con fotos, talla, cm, color, estado, descripción y precio. Nunca ve costos, fardos, lotes ni finanzas.
- Para **comprar o reservar**, el cliente crea su cuenta desde la misma tienda (nombre, celular, ciudad, correo y contraseña). No hace falta configurar nada en Supabase.
- El cliente elige cómo recibirlo: **recoger en tienda**, **envío a domicilio en Cochabamba** o **encomienda para recoger en la paquetería** de su ciudad.
- El pedido **aparta los pares** y llega a **Reservas** marcado como “Tienda”, con botón de WhatsApp. Al convertirlo en venta se convierten juntos todos los pares del pedido.
- El personal entra con su correo desde el botón **Ingresar** (o “¿Eres parte del equipo?” al pie de la tienda).
- Las cuentas de clientes **no tienen acceso** a ningún módulo interno: la base de datos se lo impide.
- Solo el personal puede instalar la app en el celular; a los clientes no se les ofrece.
