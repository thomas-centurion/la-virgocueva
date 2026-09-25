export const colors = {
  background: '#0B0D10',
  surface: '#13171C',
  surfaceRaised: '#1A2027',
  border: '#252C34',
  text: '#F4F6F8',
  muted: '#929AA5',
  accent: '#B9F26A',
  accentDark: '#24351A',
  danger: '#FF7185',
};

// Compatibility exports for the starter components that remain in the project.
export const Colors = {
  light: { text: colors.text, background: colors.background, backgroundElement: colors.surface, backgroundSelected: colors.surfaceRaised, textSecondary: colors.muted },
  dark: { text: colors.text, background: colors.background, backgroundElement: colors.surface, backgroundSelected: colors.surfaceRaised, textSecondary: colors.muted },
} as const;
export type ThemeColor = keyof typeof Colors.dark;
export const Fonts = { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' };
export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
export const BottomTabInset = 70;
export const MaxContentWidth = 800;
