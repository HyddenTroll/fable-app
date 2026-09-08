/**
 * DIALOGUE FABLE — modale de confirmation / information, designée selon la
 * DA (pierre, obsidienne, radius 0, aucune ombre). Remplace Alert.alert et
 * window.confirm (qui ne conviennent pas à une appli mobile). Les erreurs
 * ne s'excusent pas : elles disent ce qui s'est passé.
 */
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, spacing } from '@/theme';

export interface DialogueAction {
  label: string;
  kind?: 'primary' | 'secondary' | 'alert';
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title?: string;
  message: string;
  /** kind 'erreur' → texte rouge (alerte), pas de bouton annuler par défaut. */
  kind?: 'confirm' | 'erreur';
  actions: DialogueAction[];
  onClose: () => void;
}

export function DialogueFable({ visible, title, message, kind = 'confirm', actions, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <Text style={[styles.message, kind === 'erreur' && { color: colors.alerte }]}>{message}</Text>
          <View style={styles.actions}>
            {actions.map((a, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.btn,
                  a.kind === 'primary' && styles.btnPrimary,
                  a.kind === 'alert' && styles.btnAlert,
                  !a.kind && styles.btnSecondary,
                ]}
                onPress={a.onPress}
                accessibilityRole="button"
                accessibilityLabel={a.label}
              >
                <Text
                  style={[styles.btnLabel, a.kind === 'primary' && styles.btnLabelPrimary, a.kind === 'alert' && styles.btnLabelAlert]}
                >
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(16,17,20,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.text,
    padding: spacing.xl,
  },
  title: { fontFamily: fonts.grec, fontSize: 19, color: colors.text, marginBottom: spacing.md },
  message: {
    fontFamily: fonts.ia,
    fontSize: 14,
    lineHeight: 21,
    color: colors.gris2,
    marginBottom: spacing.xl,
  },
  actions: { gap: spacing.sm },
  btn: {
    minHeight: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  btnPrimary: { backgroundColor: colors.text, borderColor: colors.text },
  btnSecondary: { borderColor: colors.text },
  btnAlert: { borderColor: colors.alerte },
  btnLabel: { fontFamily: fonts.iaMedium, fontSize: 15, color: colors.text },
  btnLabelPrimary: { color: colors.background },
  btnLabelAlert: { color: colors.alerte },
});