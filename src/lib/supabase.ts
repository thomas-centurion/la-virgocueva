import 'expo-sqlite/localStorage/install';

import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseApiKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseApiKey) {
  throw new Error('Configura EXPO_PUBLIC_SUPABASE_URL y una clave pública Supabase en .env.local (PUBLISHABLE_KEY o ANON_KEY legado).');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseApiKey, {
  auth: {
    storage: localStorage,
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
