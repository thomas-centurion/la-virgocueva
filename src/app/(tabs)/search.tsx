import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Avatar } from '@/components/profiles/avatar';
import { Header, Screen } from '@/components/ui/primitives';
import { colors } from '@/constants/theme';
import { searchProfiles, type ProfileSearchResult } from '@/features/supabase-social';

const RESULT_LIMIT = 20;

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [retryVersion, setRetryVersion] = useState(0);
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [settledQuery, setSettledQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const term = query.trim().replace(/^@/, '').trim().toLowerCase();

  useEffect(() => {
    if (!term) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setHasError(false);
      void searchProfiles(term, RESULT_LIMIT).then((users) => {
        if (active) setResults(users);
      }).catch((error: unknown) => {
        console.error('No se pudo buscar perfiles en Supabase:', error);
        if (active) {
          setResults([]);
          setHasError(true);
        }
      }).finally(() => {
        if (active) {
          setSettledQuery(term);
          setLoading(false);
        }
      });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [retryVersion, term]);

  const searchingCurrentTerm = Boolean(term) && (loading || settledQuery !== term);
  const currentError = Boolean(term) && settledQuery === term && hasError;
  const currentResults = settledQuery === term ? results : [];

  return <Screen>
    <Header title="Buscar personas" subtitle="Buscá a alguno de los chicos en la VirgoCueva." />
    <View style={styles.searchBox}>
      <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor={colors.muted} size={21} weight="regular" />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar usuarios…"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Buscar usuarios"
        style={styles.input}
      />
    </View>
    {!term
      ? <View style={styles.state}><Text style={styles.stateText}>Escribí el nombre de alguien.</Text></View>
      : searchingCurrentTerm
        ? <View style={styles.state}><ActivityIndicator color={colors.accent} /><Text style={styles.stateText}>Buscando personas…</Text></View>
        : currentError
          ? <View style={styles.state}><Text style={styles.stateText}>No pudimos realizar la búsqueda.</Text><Pressable accessibilityRole="button" onPress={() => { setSettledQuery(''); setRetryVersion((version) => version + 1); }} style={styles.retry}><Text style={styles.retryText}>Reintentar</Text></Pressable></View>
          : currentResults.length === 0
            ? <View style={styles.state}><Text style={styles.stateText}>Ni vos ni yo conocemos a nadie que se llame así.</Text></View>
            : <FlatList
              data={currentResults}
              keyExtractor={(user) => user.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.results}
              renderItem={({ item }) => <Link href={{ pathname: '/user/[username]', params: { username: item.username } }} asChild>
                <Pressable accessibilityRole="link" accessibilityLabel={`Abrir perfil de ${item.name}, @${item.username}`} style={styles.result}>
                  <Avatar uri={item.avatar} size={48} />
                  <View style={styles.identity}>
                    <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
                    <Text numberOfLines={1} style={styles.username}>@{item.username}</Text>
                  </View>
                </Pressable>
              </Link>}
            />}
  </Screen>;
}

const styles = StyleSheet.create({
  searchBox: { height: 52, marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface },
  input: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 11 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28 },
  stateText: { color: colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  retry: { paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface },
  retryText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  results: { paddingTop: 12, paddingBottom: 24 },
  result: { minHeight: 72, paddingHorizontal: 20, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  identity: { flex: 1, gap: 4 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  username: { color: colors.muted, fontSize: 13 },
});
