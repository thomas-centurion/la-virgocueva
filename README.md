# VirgoCueva

A private social network for friends, built from scratch with React Native, Expo, TypeScript and Supabase.

VirgoCueva is a small social network designed around a private group of friends. It includes the core features of a social platform while experimenting with a more personal and customizable approach to profiles and interactions.

## ✨ Features

- 🔐 Authentication with Supabase Auth
- 👤 User profiles with avatar, cover, bio and username
- ✏️ Profile editing
- 📝 Text posts
- 🖼️ Image posts
- ❤️ Likes
- 🔁 Revirgs
- 👥 Follow system
- 💬 Comments and threaded replies
- 📷 Images in comments and replies
- 🔔 Notifications
- 🔎 User search
- 🖼️ Fullscreen image viewer
- 🕐 Relative timestamps
- 🌙 Dark UI
- 📱 Persistent authentication session

## 🛠️ Tech Stack

- **React Native**
- **Expo SDK 57**
- **TypeScript**
- **Expo Router**
- **Supabase**
  - Authentication
  - PostgreSQL
  - Storage
  - Row Level Security
- **Expo SQLite** for auth session persistence
- **Expo Image Picker** for image selection

## 🏗️ Architecture

The application is built around React Native and Expo, with Supabase providing the backend infrastructure.

```text
┌──────────────────────────────┐
│       React Native / Expo    │
│                              │
│        Expo Router           │
│                              │
│  Home · Search · Create      │
│  Notifications · Profile    │
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

The mobile client uses a single Supabase client and keeps authentication state locally using Expo SQLite.

## 📁 Project Structure

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

## 🔐 Security

VirgoCueva uses Supabase Row Level Security to restrict access to user-owned data.

Examples include:

- Users can only modify their own profile.
- Users can only create, edit and delete their own posts and comments.
- Likes and Revirgs are tied to the authenticated user.
- Follow relationships can only be created or removed by the follower.
- Notifications are generated server-side and cannot be created directly by the mobile client.
- Storage writes are restricted to the authenticated user's folder.
- Private images are served through temporary signed URLs.

The mobile application never uses a Supabase `service_role` key.

## 🗄️ Database

The current database includes:

- `profiles`
- `posts`
- `comments`
- `likes`
- `reposts`
- `follows`
- `notifications`

Database changes are tracked through SQL migrations in:

```text
supabase/migrations/
```

## 🖼️ Storage

Private Supabase Storage buckets are used for:

- avatars
- covers
- post images
- comment images

Images are stored under user-specific paths and resolved through signed URLs.

## 🚀 Getting Started

### Requirements

- Node.js
- npm
- Android Studio / Android SDK for Android development
- Expo development environment

### Installation

Clone the repository:

```bash
git clone <your-repository-url>
cd virgocueva
```

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Add your Supabase project credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Never use a Supabase `service_role` key in the mobile application.

### Run the project

Start the Expo development server:

```bash
npx expo start --dev-client
```

For Android:

```bash
npx expo run:android
```

## 🧪 Validation

The project can be type-checked with:

```bash
npx tsc --noEmit
```

Android export:

```bash
npx expo export --platform android
```

## 📱 Current Navigation

```text
Inicio
Buscar
Publicar
Notificaciones
Perfil
```

## 🗺️ Roadmap

Some ideas being considered for future versions:

- 🎵 Spotify integration and "Now Playing"
- 🎨 More customizable user profiles
- 🟢 Custom activity/status
- 🎨 Daily random drawing
- 😂 Meme creation tools
- 💬 Profile guestbooks
- 🎮 Small social games
- 🖼️ Community albums and travel content
- 🔗 Custom profile links
- 🎛️ Profile widgets

These features are ideas for future development and are not part of the current release.

## 📄 License

This project is currently a personal portfolio project.
