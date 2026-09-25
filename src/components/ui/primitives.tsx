import type { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';

export function Screen({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) { return <SafeAreaView style={[styles.screen, style]} edges={['top', 'left', 'right']}>{children}</SafeAreaView>; }
export function PageScroll({ children }: PropsWithChildren) { return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>{children}</ScrollView>; }
export function Header({ title, subtitle }: { title: string; subtitle?: string }) { return <View style={styles.header}><Text style={styles.title}>{title}</Text>{subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}</View>; }
export function Button({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) { return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, pressed && { opacity: 0.82 }, disabled && { opacity: 0.45 }]}><Text style={styles.buttonText}>{title}</Text></Pressable>; }
export function Field(props: TextInputProps) { return <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.field, props.style]} />; }
export function SectionLabel({ children }: PropsWithChildren) { return <Text style={styles.label}>{children}</Text>; }
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, scroll: { paddingBottom: 30 }, header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }, title: { color: colors.text, fontSize: 27, fontWeight: '800', letterSpacing: -0.5 }, subtitle: { color: colors.muted, fontSize: 14, marginTop: 5 }, button: { backgroundColor: colors.accent, minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }, buttonText: { color: '#10150B', fontSize: 15, fontWeight: '800' }, field: { borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surface, color: colors.text, borderRadius: 15, paddingHorizontal: 15, paddingVertical: 15, fontSize: 15 }, label: { color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 } });
