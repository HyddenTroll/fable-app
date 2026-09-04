import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';
import { Button } from '@/components/Button';
import { colors, spacing, radii } from '@/theme';
import { signInWithEmail, signUpWithEmail, signInWithGoogle, type AuthResult } from '@/services/auth';

export default function AuthScreen() {
  const router = useRouter();
  const setEmail = useAppStore((s) => s.setEmail);
  const setUserName = useAppStore((s) => s.setUserName);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSuccess = (authEmail: string) => {
    setEmail(authEmail);
    setUserName(authEmail.split('@')[0] || 'Héros');
    router.replace('/(tabs)');
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    setInfo(null);

    let result: AuthResult;
    if (mode === 'login') {
      result = await signInWithEmail(email.trim(), password);
    } else {
      result = await signUpWithEmail(email.trim(), password);
    }
    setLoading(false);

    if (result.ok) {
      if (result.session) {
        onSuccess(email.trim());
      } else {
        // Inscription : confirmation d'email requise
        setInfo('Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.');
        setMode('login');
      }
    } else {
      setError(result.error);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);

    const result = await signInWithGoogle();
    setLoading(false);

    if (result.ok) {
      if (result.session?.user.email) {
        onSuccess(result.session.user.email);
      }
      // Sinon : l'app redirige automatiquement via onAuthStateChange
    } else {
      setError(result.error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</Text>

        {error && <Text style={styles.error}>{error}</Text>}
        {info && <Text style={styles.info}>{info}</Text>}

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
          editable={!loading}
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
          editable={!loading}
        />

        <View style={styles.buttonGap}>
          <Button
            label={mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            onPress={handleSubmit}
            disabled={loading}
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          label="Continuer avec Google"
          variant="secondary"
          onPress={handleGoogle}
          disabled={loading}
        />

        {loading && <ActivityIndicator color={colors.primary} style={styles.loader} />}

        <Button
          label={mode === 'login' ? 'Pas de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
          variant="secondary"
          onPress={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError(null);
            setInfo(null);
          }}
          disabled={loading}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.xxl, justifyContent: 'center', flexGrow: 1 },
  title: { color: colors.primary, fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: spacing.md },
  label: { color: colors.text, fontSize: 15, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  buttonGap: { marginTop: spacing.lg },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, marginHorizontal: spacing.md },
  loader: { marginVertical: spacing.md },
  error: { color: '#ff6b6b', textAlign: 'center', marginBottom: spacing.md, lineHeight: 19 },
  info: { color: colors.primary, textAlign: 'center', marginBottom: spacing.md, lineHeight: 19 },
});