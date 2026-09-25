# VirgoCueva

Una red social privada para amigos, desarrollada desde cero con React Native, Expo, TypeScript y Supabase.

VirgoCueva es una pequeña red social pensada para un grupo privado de amigos. Incluye las funciones principales de una plataforma social, con una identidad propia y espacio para futuras opciones de personalización.

## ✨ Funcionalidades

- 🔐 Autenticación con Supabase Auth
- 👤 Perfiles de usuario con avatar, portada, biografía y nombre de usuario
- ✏️ Edición de perfil
- 📝 Publicaciones de texto
- 🖼️ Publicaciones con imágenes
- ❤️ Me gusta
- 🔁 Revirgs
- 👥 Sistema de seguimiento
- 💬 Comentarios y respuestas anidadas
- 📷 Imágenes en comentarios y respuestas
- 🔔 Notificaciones
- 🔎 Búsqueda de usuarios
- 🖼️ Visor de imágenes a pantalla completa
- 🕐 Fechas relativas
- 🌙 Interfaz oscura
- 📱 Persistencia de la sesión de autenticación

## 🛠️ Tecnologías

- **React Native**
- **Expo SDK 57**
- **TypeScript**
- **Expo Router**
- **Supabase**
  - Autenticación
  - PostgreSQL
  - Storage
  - Row Level Security
- **Expo SQLite** para la persistencia de la sesión
- **Expo Image Picker** para seleccionar imágenes

## 🏗️ Arquitectura

La aplicación está construida sobre React Native y Expo, utilizando Supabase como infraestructura de backend.

```text
┌──────────────────────────────┐
│       React Native / Expo    │
│                              │
│        Expo Router           │
│                              │
│  Inicio · Buscar · Publicar  │
│  Notificaciones · Perfil     │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│           Supabase           │
│                              │
│  Auth                        │
│  PostgreSQL                  │
│  Row Level Security          │
│  Storage                     │
└──────────────────────────────┘
```

El cliente móvil utiliza una única instancia de Supabase y mantiene el estado de autenticación localmente mediante Expo SQLite.

## 📁 Estructura del proyecto

```text
src/
├── app/
│   ├── (auth)/
│   ├── (tabs)/
│   ├── auth/
│   ├── post/
│   └── user/
│
├── components/
│   ├── posts/
│   ├── profiles/
│   └── ui/
│
├── features/
│   ├── auth/
│   ├── app-state.tsx
│   ├── mock-data.ts
│   └── supabase-social.ts
│
├── lib/
│   └── supabase.ts
│
└── types/
    └── database.ts

supabase/
└── migrations/
```

## 🔐 Seguridad

VirgoCueva utiliza Row Level Security de Supabase para restringir el acceso y las modificaciones sobre los datos de los usuarios.

Algunos ejemplos:

- Los usuarios solo pueden modificar su propio perfil.
- Los usuarios solo pueden crear, editar y eliminar sus propias publicaciones y comentarios.
- Los Me gusta y Revirgs están asociados al usuario autenticado.
- Las relaciones de seguimiento solo pueden ser creadas o eliminadas por quien sigue.
- Las notificaciones se generan desde el servidor y no pueden ser creadas directamente desde el cliente móvil.
- Las escrituras en Storage están restringidas a la carpeta del usuario autenticado.
- Las imágenes privadas se sirven mediante URLs firmadas temporales.

La aplicación móvil nunca utiliza una clave `service_role` de Supabase.

## 🗄️ Base de datos

La base de datos actual incluye:

- `profiles`
- `posts`
- `comments`
- `likes`
- `reposts`
- `follows`
- `notifications`

Los cambios de la base de datos se gestionan mediante migraciones SQL ubicadas en:

```text
supabase/migrations/
```

## 🖼️ Storage

Se utilizan buckets privados de Supabase Storage para:

- avatares
- portadas
- imágenes de publicaciones
- imágenes de comentarios

Las imágenes se almacenan dentro de rutas específicas por usuario y se obtienen mediante URLs firmadas.

## 🚀 Cómo ejecutar el proyecto

### Requisitos

- Node.js
- npm
- Android Studio / Android SDK para desarrollo en Android
- Entorno de desarrollo de Expo

### Instalación

Clonar el repositorio:

```bash
git clone <url-de-tu-repositorio>
cd virgocueva
```

Instalar las dependencias:

```bash
npm install
```

Crear el archivo de variables de entorno local:

```bash
cp .env.example .env.local
```

Agregar las credenciales de Supabase:

```env
EXPO_PUBLIC_SUPABASE_URL=tu_supabase_url
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu_supabase_publishable_key
```

Nunca utilizar una clave `service_role` de Supabase dentro de la aplicación móvil.

### Ejecutar el proyecto

Iniciar el servidor de desarrollo de Expo:

```bash
npx expo start --dev-client
```

Para Android:

```bash
npx expo run:android
```

## 🧪 Validación

Para comprobar los tipos de TypeScript:

```bash
npx tsc --noEmit
```

Para generar el export de Android:

```bash
npx expo export --platform android
```

## 📱 Navegación actual

```text
Inicio
Buscar
Publicar
Notificaciones
Perfil
```

## 🗺️ Roadmap

Algunas ideas consideradas para futuras versiones:

- 🎵 Integración con Spotify y "Now Playing"
- 🎨 Perfiles más personalizables
- 🟢 Estado o actividad personalizada
- 🎨 Dibujo aleatorio diario
- 😂 Herramientas para crear memes
- 💬 Libros de visitas en los perfiles
- 🎮 Pequeños juegos sociales
- 🖼️ Álbumes comunitarios y contenido de viajes
- 🔗 Enlaces personalizados en los perfiles
- 🎛️ Widgets para los perfiles

Estas funcionalidades son ideas para futuras versiones y no forman parte de la versión actual.

## 📄 Licencia

Actualmente, este proyecto es un proyecto personal para portfolio.
