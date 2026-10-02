# Plataforma de Eventos Deportivos - Pre-entrega 7

Proyecto backend en Node.js y Express para la gestión e inscripción a eventos deportivos. Esta entrega implementa el **flujo completo de inscripción**: la entidad `Ticket`, control de cupos, cancelaciones y el envío de un email de confirmación con Nodemailer, todo protegido por el sistema de **roles y autorización** (`401` sin sesión, `403` sin permisos) y con las reglas de negocio en la capa de `services`.

### ✅ Resumen de lo incorporado en esta entrega

- **Entidad `Ticket`** con control de cupos, estados (`confirmed`/`pending`/`cancelled`), código de reserva y referencias (no objetos embebidos) a `User` y `Event`.
- **Email de confirmación con Nodemailer**, credenciales siempre desde variables de entorno.
- Reemplaza al módulo `Inscription` de la corrección anterior: `Ticket` cubre el mismo flujo secundario con el modelo y los endpoints exactos que pide esta consigna, así que `Inscription` se eliminó para no mantener dos colecciones redundantes para lo mismo.
- Se mantiene el manejo de errores centralizado y los tests automatizados agregados en la entrega anterior, ahora extendidos a `tickets.service.js`.

---

## 🛠️ Tecnologías y dependencias
- **Node.js** & **Express**
- **MongoDB** & **Mongoose** (persistencia y modelos)
- **Passport.js** (`passport-local`, `passport-jwt` para autenticación con cookies httpOnly)
- **bcrypt** (hasheo de contraseñas)
- **Nodemailer** (email de confirmación de tickets)
- **cookie-parser** & **dotenv**

---

## 👥 Roles y registro

El modelo `User` maneja 3 roles posibles: `user` (por defecto), `organizer` y `admin`.

- **Registro público (`POST /api/sessions/register`):** Todo usuario nuevo se crea obligatoriamente con rol `user`. El endpoint ignora cualquier campo `role` enviado en el body para evitar que alguien se auto-asigne permisos de admin u organizer.
- **Asignación de roles con privilegios:** Los roles `organizer` o `admin` se asignan manualmente en la base de datos.

---

## 🔐 Matriz de permisos

| Acción | Endpoint | `user` | `organizer` | `admin` |
| :--- | :--- | :---: | :---: | :---: |
| Consultar eventos | `GET /api/events`, `GET /api/events/:id` | ✅ | ✅ | ✅ |
| Crear eventos | `POST /api/events` | ❌ | ✅ | ✅ |
| Modificar eventos propios | `PUT /api/events/:id` | ❌ | ✅ | ✅ |
| Cambiar estado de eventos propios (incluye cancelar) | `PATCH /api/events/:id/status` | ❌ | ✅ | ✅ |
| Modificar / cambiar estado de eventos ajenos | `PUT` / `PATCH /api/events/:id/status` | ❌ | ❌ | ✅ |
| Listar todos los usuarios | `GET /api/users` | ❌ | ❌ | ✅ |
| Ver perfil en sesión | `GET /api/sessions/current` | ✅ | ✅ | ✅ |
| Inscribirse a un evento / ver mis tickets | `POST /api/events/:eid/tickets`, `GET /api/tickets/my-tickets` | ✅ | ✅ | ✅ |
| Ver tickets de un evento propio | `GET /api/events/:eid/tickets` | ❌ | ✅ (solo si es el dueño) | ✅ |
| Cancelar un ticket propio | `PATCH /api/tickets/:tid/cancel` | ✅ (solo el propio) | ✅ (solo el propio) | ✅ (cualquiera) |

---

## 🛡️ Middlewares de seguridad

Separé la autenticación y la autorización en dos middlewares reutilizables dentro de `src/middlewares/`:

1. **`auth.middleware.js` (`auth`):**
   - Extrae y valida el token JWT desde la cookie `currentUser` usando la estrategia `'current'` de Passport.
   - Si el token es válido, puebla `req.user`.
   - Si no hay cookie o el token expiró/es inválido, devuelve **`401 Unauthorized`** (`{ "status": "error", "message": "No autenticado" }`).

2. **`authorize.middleware.js` (`authorize(...roles)`):**
   - Recibe como argumento los roles permitidos (ej. `authorize('organizer', 'admin')`).
   - Compara contra `req.user.role`.
   - Si el rol no está en la lista, devuelve **`403 Forbidden`** (`{ "status": "error", "message": "No tenés permisos para realizar esta acción" }`).

### 📌 Diferencia entre 401 y 403
- **`401 Unauthorized`:** El usuario **no está autenticado** (no inició sesión o no mandó cookie válida).
- **`403 Forbidden`:** El usuario **sí está autenticado**, pero **no tiene los permisos suficientes** para esa acción o recurso.
- Ninguno de estos errores devuelve `500`.

### 🏷️ Validación de propiedad de eventos
Al momento de modificar (`PUT`) o cambiar el estado (`PATCH .../status`) de un evento:
- El `admin` puede modificar cualquier evento.
- El `organizer` solo puede modificar aquellos donde `event.organizer === req.user.id`. Si intenta modificar un evento de otro organizador, el servicio arroja un error **`403`**.

---

## 🎟️ Entidad Event: CRUD y reglas de negocio

### Modelo (`src/models/Event.js`)

| Campo | Tipo | Reglas |
| :--- | :--- | :--- |
| `title` | String | Obligatorio |
| `description` | String | Obligatorio |
| `category` | String | Obligatorio (ej. `workshop`, `torneo`) |
| `location` | String | Obligatorio |
| `date` | Date | Obligatorio. No puede ser una fecha pasada al **crear** el evento |
| `capacity` | Number | Obligatorio, debe ser `> 0` |
| `price` | Number | Debe ser `>= 0` (default `0`) |
| `status` | String | Uno de `draft`, `published`, `cancelled`, `finished`. Nace siempre en `draft` |
| `organizer` | ObjectId (ref `User`) | Se asigna automáticamente desde `req.user.id`; **nunca** se acepta desde el body |

`sport_type` se mantiene como campo opcional heredado de la temática (torneos deportivos), sin ser parte de las reglas de negocio de esta entrega.

### Endpoints

| Método | Ruta | Acceso |
| :--- | :--- | :--- |
| `POST` | `/api/events` | `organizer`, `admin` |
| `GET` | `/api/events` | Público |
| `GET` | `/api/events/:id` | Público |
| `PUT` | `/api/events/:id` | Dueño del evento o `admin` |
| `PATCH` | `/api/events/:id/status` | Dueño del evento o `admin` |

- **`POST /api/events`**: crea el evento con `status: 'draft'` (cualquier `status` recibido en el body se ignora). Valida campos obligatorios, fecha futura, `capacity > 0` y `price >= 0`. Respuesta `201`.
- **`GET /api/events`**: listado público con filtros, paginación y ordenamiento (ver abajo). Respuesta `200` con `{ data, page, limit, total, totalPages }`.
- **`GET /api/events/:id`**: devuelve un evento puntual. `404` si el id no existe o no tiene formato válido.
- **`PUT /api/events/:id`**: actualiza campos editables (`title`, `description`, `category`, `date`, `location`, `capacity`, `price`). No permite cambiar `status` ni `organizer` desde acá. Vuelve a validar fecha, `capacity` y `price` si vienen en el body.
- **`PATCH /api/events/:id/status`**: única vía para cambiar el `status` (incluida la cancelación, `status: 'cancelled'`). **No elimina el evento físicamente.**

### Reglas de negocio (en `events.service.js`, no en rutas ni controllers)

- No se puede crear un evento con `date` pasada.
- No se puede publicar (`status: 'published'`) un evento que ya está `finished`.
- `capacity <= 0` o `price < 0` se rechazan con `400`.
- Un evento en estado `cancelled` es un **estado terminal**: no admite más modificaciones vía `PUT` ni más cambios de `status` vía `PATCH` (ambos responden `400`).
- Propiedad del recurso: `organizer` solo opera sobre sus propios eventos; `admin` sobre cualquiera (`403` si no corresponde).

### Filtros, paginación y ordenamiento (`GET /api/events`)

| Query param | Descripción |
| :--- | :--- |
| `status` | Filtra por estado exacto (`draft`, `published`, `cancelled`, `finished`) |
| `category` | Filtra por categoría exacta |
| `location` | Filtra por ubicación exacta |
| `dateFrom` / `dateTo` | Filtra eventos con `date` dentro del rango (inclusive) |
| `page` | Página a devolver (default `1`) |
| `limit` | Resultados por página (default `10`) |
| `sort` | Campo de orden: `date`, `price`, `capacity` o `createdAt`. Prefijo `-` para descendente (ej. `sort=-date`). Default: `date` ascendente |

Ejemplo: `GET /api/events?status=published&category=workshop&page=2&limit=5&sort=-date`

Respuesta:
```json
{
  "status": "success",
  "data": [ { "id": "...", "title": "...", "...": "..." } ],
  "page": 2,
  "limit": 5,
  "total": 23,
  "totalPages": 5
}
```

---

## 🎟️ Tickets, inscripciones y control de cupos

Colección `Ticket` (`src/models/Ticket.js`) que conecta a un `User` con un `Event` **solo por referencia** (nunca se embebe el objeto completo de usuario o evento). Cubre el flujo de inscripción del enunciado y queda protegida por el mismo esquema de permisos que el resto de la API: todas sus rutas pasan por el middleware `auth`, y la propiedad del recurso (quién puede ver/cancelar qué) se valida en `tickets.service.js`, nunca en el controller ni en la ruta.

### Modelo

| Campo | Tipo | Reglas |
| :--- | :--- | :--- |
| `user` | ObjectId (ref `User`) | Obligatorio |
| `event` | ObjectId (ref `Event`) | Obligatorio |
| `status` | String | `confirmed` (default), `pending` o `cancelled` |
| `quantity` | Number | Obligatorio, `> 0` (default `1`) |
| `reservationCode` | String | Único, se genera automáticamente al crear el ticket |
| `createdAt` | Date | Automático (`timestamps`) |
| `cancelledAt` | Date | `null` hasta que se cancela; se completa al cancelar |

**Solo los tickets con status `confirmed` o `pending` ocupan cupo** del evento; los `cancelled` nunca se cuentan, por lo que cancelar libera el lugar automáticamente para otra persona.

### Endpoints

| Método | Ruta | Acceso |
| :--- | :--- | :--- |
| `POST` | `/api/events/:eid/tickets` | Cualquier usuario autenticado |
| `GET` | `/api/tickets/my-tickets` | Autenticado (devuelve solo los propios) |
| `GET` | `/api/events/:eid/tickets` | `organizer` dueño de ese evento, o `admin` |
| `PATCH` | `/api/tickets/:tid/cancel` | Dueño del ticket, o `admin` |

- **`POST /api/events/:eid/tickets`**: body opcional `{ "quantity": 1 }` (default `1` si no se envía). Devuelve `201` con el ticket creado y dispara el email de confirmación.
- **`GET /api/tickets/my-tickets`**: devuelve los tickets del usuario autenticado con el evento parcialmente poblado (`title`, `date`, `location`); nunca expone datos de otros usuarios.
- **`GET /api/events/:eid/tickets`**: para el organizador consultar quién se inscribió a su propio evento; incluye datos básicos del usuario (`first_name`, `last_name`, `email`, nunca `password`).
- **`PATCH /api/tickets/:tid/cancel`**: cambia `status` a `cancelled` y completa `cancelledAt`. **No borra el documento.**

### Reglas de negocio (en `tickets.service.js`, nunca en el controller)

1. El evento debe existir (`404` si no).
2. El evento debe estar `published` (si está `cancelled` o `finished` responde `400` con un mensaje específico para cada caso).
3. `quantity` debe ser un entero `> 0`.
4. El usuario no puede tener ya un ticket activo (`confirmed`/`pending`) para ese evento (`409 Conflict`).
5. Debe haber cupo suficiente: `capacity - Σ quantity de tickets activos ≥ quantity solicitada`; si no, `400` con un mensaje que indica cuántos lugares quedan.
6. Al cancelar: el ticket debe existir (`404`), pertenecer al solicitante o ser `admin` (`403`), y no estar ya cancelado (`400`).

### 📧 Email de confirmación (Nodemailer)

Al crear un ticket exitosamente, `tickets.service.js` envía un email de confirmación con Nodemailer a través de `src/utils/mailer.js`. Las credenciales SMTP se leen **siempre** de variables de entorno, nunca hardcodeadas:

| Variable | Descripción |
| :--- | :--- |
| `MAIL_HOST` | Host del servidor SMTP |
| `MAIL_PORT` | Puerto SMTP (`465` usa TLS implícito, `587` STARTTLS) |
| `MAIL_USER` | Usuario/cuenta SMTP |
| `MAIL_PASS` | Contraseña o contraseña de aplicación |
| `MAIL_FROM` | Remitente que verá el destinatario |

El envío es **best effort**: si `MAIL_HOST`/`MAIL_USER`/`MAIL_PASS` no están configurados, o si el SMTP falla, el ticket queda creado igual (se loguea el error en consola) — una inscripción nunca debería fallar por un problema de mail.

---

## ⚠️ Manejo de errores centralizado

Antes, cada controlador repetía su propio `try/catch` para traducir errores a `{ status, message }`. Ahora:

- **`src/utils/AppError.js`**: clase de error con `statusCode` (400/401/403/404/409...). La usan las estrategias de Passport, los middlewares `auth`/`authorize` y todos los `services`.
- **`src/utils/asyncHandler.js`**: envuelve cada handler async de un controlador y reenvía cualquier promesa rechazada a `next(error)`. Gracias a esto, **ningún controlador tiene try/catch**.
- **`src/middlewares/errorHandler.middleware.js`**: único lugar que arma la respuesta final. Lee `err.statusCode` (default `500`), normaliza errores típicos de Mongoose (`ValidationError` → `400`, `CastError` → `400`) y nunca filtra detalles internos en producción. Se registra al final de `app.js`, después de todas las rutas, junto con un `notFoundHandler` para rutas inexistentes (`404`).

Ejemplo de controlador sin try/catch:
```js
export const createEvent = asyncHandler(async (req, res) => {
    const event = await eventsService.createEvent(req.body, req.user.id);
    return res.status(201).json({ status: 'success', payload: event });
});
```
Si `eventsService.createEvent` lanza un `AppError('...', 400)`, `asyncHandler` lo reenvía a `errorHandler`, que responde `400` con el mensaje correspondiente. Ya no hay dos lugares distintos decidiendo el código de estado.

---

## 🧪 Tests automatizados

Se usa el test runner nativo de Node (`node:test` + `node:assert`), sin dependencias nuevas:

```bash
npm test
```

- **`src/models/Event.test.js`**: valida el esquema de Mongoose de forma aislada (`validateSync()`, sin conexión a base de datos): campos obligatorios, `capacity > 0`, `price >= 0`, enum de `status` y el default `draft`.
- **`src/services/events.service.test.js`**: testea las reglas de negocio de `events.service.js` mockeando `eventsRepository` con `t.mock.method` (sin tocar MongoDB): fecha pasada al crear y al actualizar (incluye el caso del bug corregido), `capacity`/`price` inválidos, estado `cancelled` como terminal, propiedad del recurso (`organizer` vs `admin`), transiciones de `status` inválidas y la forma de la respuesta paginada de `listEvents`.
- **`src/services/tickets.service.test.js`**: testea `tickets.service.js` mockeando `ticketsRepository`, `eventsRepository` y el mailer: evento inexistente/cancelado/finalizado/no publicado, `quantity` inválida, inscripción duplicada, cupo insuficiente (y que los `cancelled` no cuenten), que el email sea best-effort (un fallo de SMTP no rompe la creación del ticket), propiedad del ticket al cancelar y permisos para ver los tickets de un evento.

---

## 📂 Estructura del proyecto

```text
src/
├── app.js                     # Configuración de Express, montaje de rutas y error handler global
├── server.js                  # Conexión a MongoDB y arranque del server
├── config/
│   ├── config.js              # Variables de entorno
│   ├── db.js                  # Conexión a Mongoose
│   └── passport.config.js     # Estrategias register, login y current (JWT)
├── middlewares/
│   ├── auth.middleware.js     # Valida JWT en cookie -> 401
│   ├── authorize.middleware.js# Valida rol -> 403
│   └── errorHandler.middleware.js # Middleware global de errores + 404
├── controllers/
│   ├── events.controller.js
│   ├── sessions.controller.js
│   ├── users.controller.js
│   └── tickets.controller.js
├── routes/
│   ├── events.router.js       # incluye POST/GET /:eid/tickets
│   ├── sessions.router.js
│   ├── users.router.js
│   └── tickets.router.js      # /api/tickets/my-tickets y /api/tickets/:tid/cancel
├── services/
│   ├── events.service.js      # Lógica de negocio y validación de propiedad
│   ├── events.service.test.js # Tests unitarios (node:test)
│   ├── tickets.service.js     # Cupos, duplicados, cancelación y disparo del email
│   └── tickets.service.test.js# Tests unitarios (node:test)
├── repositories/
│   ├── events.repository.js
│   ├── users.repository.js
│   └── tickets.repository.js
├── dao/
│   ├── events.dao.js
│   ├── users.dao.js
│   └── tickets.dao.js
├── models/
│   ├── Event.js
│   ├── Event.test.js           # Tests unitarios del esquema (node:test)
│   ├── User.js
│   └── Ticket.js
└── utils/
    ├── hash.js                # bcrypt
    ├── jwt.js                 # jsonwebtoken
    ├── mailer.js              # Nodemailer: credenciales desde variables de entorno
    ├── AppError.js            # Error con statusCode para el error handler global
    └── asyncHandler.js        # Envuelve controllers async, elimina try/catch repetido
```

---

## 🚀 Instalación y cómo correr el proyecto

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Variables de entorno:**
   Crear un archivo `.env` tomando como base `.env.example`:
   ```env
   PORT=8080
   NODE_ENV=development
   MONGO_URL=mongodb://localhost:27017/eventos_db
   JWT_SECRET=secreto_para_firmar_jwt
   JWT_EXPIRES_IN=1h

   # Envío de email de confirmación de tickets (Nodemailer)
   MAIL_HOST=smtp.gmail.com
   MAIL_PORT=587
   MAIL_USER=tu_correo@gmail.com
   MAIL_PASS=tu_contraseña_de_aplicacion
   MAIL_FROM=tu_correo@gmail.com
   ```
   Las variables `MAIL_*` son opcionales para que el proyecto levante: si faltan, el envío de email se omite (con un warning en consola) y el resto del flujo de tickets funciona igual.

3. **Iniciar servidor:**
   - Modo desarrollo:
     ```bash
     npm run dev
     ```
   - Modo normal:
     ```bash
     npm start
     ```

4. **Correr los tests:**
   ```bash
   npm test
   ```

---

## 🧪 Casos de prueba principales

| Prueba | Endpoint | Rol / Condición | Resultado esperado |
| :--- | :--- | :--- | :--- |
| Crear evento con rol `user` | `POST /api/events` | Usuario `user` | `403 Forbidden` |
| Crear evento con fecha pasada | `POST /api/events` | `organizer`, `date` en el pasado | `400 Bad Request` |
| Crear evento con `capacity: 0` | `POST /api/events` | `organizer` | `400 Bad Request` |
| Crear evento con rol `organizer` | `POST /api/events` | Usuario `organizer` | `201 Created` |
| Modificar evento propio | `PUT /api/events/:id` | `organizer` dueño | `200 OK` |
| Modificar evento ajeno | `PUT /api/events/:id` | `organizer` no dueño | `403 Forbidden` |
| Modificar evento de otro organizador | `PUT /api/events/:id` | `admin` | `200 OK` |
| Cambiar estado de evento cancelado | `PATCH /api/events/:id/status` | Evento en `cancelled` | `400 Bad Request` |
| Listar con filtros | `GET /api/events?status=published&category=workshop&page=2&limit=5` | Público | `200 OK` con `data`, `page`, `limit`, `total`, `totalPages` |
| Consultar evento inexistente | `GET /api/events/:id` | Id inexistente o inválido | `404 Not Found` |
| Actualizar evento a fecha pasada (bug corregido) | `PUT /api/events/:id` | `organizer` dueño, `date` en el pasado | `400 Bad Request` |
| Ruta admin con rol `organizer` | `GET /api/users` | Usuario `organizer` | `403 Forbidden` |
| Ruta admin con rol `admin` | `GET /api/users` | Usuario `admin` | `200 OK` |
| Ruta privada sin sesión | `GET /api/sessions/current` | Sin cookie | `401 Unauthorized` |
| Ruta inexistente | cualquier método/ruta no definida | - | `404 Not Found` (manejado por el error handler global) |

### Tickets, cupos y notificaciones

| Prueba | Endpoint | Rol / Condición | Resultado esperado |
| :--- | :--- | :--- | :--- |
| Inscripción exitosa | `POST /api/events/:eid/tickets` | Cualquier rol autenticado, evento `published` | `201 Created` + email de confirmación |
| Inscripción sin sesión | `POST /api/events/:eid/tickets` | Sin cookie | `401 Unauthorized` |
| Inscripción a evento inexistente | `POST /api/events/:eid/tickets` | Id inexistente o inválido | `404 Not Found` |
| Inscripción a evento cancelado/finalizado/en borrador | `POST /api/events/:eid/tickets` | Evento no `published` | `400 Bad Request` (mensaje específico por estado) |
| Inscripción sin cupo suficiente | `POST /api/events/:eid/tickets` | `capacity` ya ocupada por tickets activos | `400 Bad Request` con cupos restantes en el mensaje |
| Inscripción duplicada activa | `POST /api/events/:eid/tickets` | Ya tiene un ticket `confirmed`/`pending` para ese evento | `409 Conflict` |
| Cancelación propia | `PATCH /api/tickets/:tid/cancel` | Dueño del ticket | `200 OK`, cupo liberado (nueva inscripción por ese lugar funciona) |
| Cancelación de ticket ajeno | `PATCH /api/tickets/:tid/cancel` | Rol `user`, no es el dueño | `403 Forbidden` |
| Ver tickets de un evento como `user` | `GET /api/events/:eid/tickets` | Rol `user` | `403 Forbidden` |
| Ver tickets de un evento ajeno | `GET /api/events/:eid/tickets` | `organizer` de otro evento | `403 Forbidden` |
| Ver mis tickets | `GET /api/tickets/my-tickets` | Autenticado | `200 OK` con el evento poblado (`title`, `date`, `location`) |
