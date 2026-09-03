import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';
import { Button } from '@/components/Button';
import { colors, spacing, radii } from '@/theme';

export default function AuthScreen() {
  const router = useRouter();
  const setEmail = useAppStore((s) => s.setEmail);
  const setUserName = useAppStore((s) => s.setUserName);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmailInput] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    if (!email.trim() || !password.trim()) return;
    // PROTOTYPE : pas de vrai backend. On stocke simplement.
    setEmail(email.trim());
    setUserName(email.trim().split('@')[0] || 'Héros');
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</Text>

      <Text style={styles.hint}>
        Prototype : aucune vraie authentification. Saisis n'importe quoi pour continuer.
      </Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmailInput}
        placeholder="ton@email.fr"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />

      <Text style={styles.label}>Mot de passe</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        autoComplete="password"
      />

      <Button label={mode === 'login' ? 'Se connecter' : 'Créer mon compte'} onPress={handleSubmit} />

      <Button
        label={mode === 'login' ? 'Pas de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
        variant="secondary"
        onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xxl, justifyContent: 'center', gap: spacing.md },
  title: { color: colors.primary, fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
  hint: { color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  label: { color: colors.text, fontSize: 15, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
});