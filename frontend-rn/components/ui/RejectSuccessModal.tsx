import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/theme';

export interface RejectSuccessModalProps {
  visible: boolean;
  role: 'office_head' | 'vpaa' | 'vice_president' | 'imc_qa' | 'imc_qa_checker' | 'department_head';
  postTitle: string;
  onClose: () => void;
}

export const RejectSuccessModal: React.FC<RejectSuccessModalProps> = ({
  visible,
  role,
  postTitle,
  onClose,
}) => {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

  if (!visible) return null;

  let roleLabel = 'the Reviewer';
  if (role === 'office_head' || role === 'department_head') {
    roleLabel = 'the Department Head';
  } else if (role === 'vice_president' || role === 'vpaa') {
    roleLabel = 'the VPAA';
  } else if (role === 'imc_qa' || role === 'imc_qa_checker') {
    roleLabel = 'Integrated Marketing Communications';
  }

  const title = 'Request Rejected';
  const subtitle1 = `“${postTitle}” was rejected by ${roleLabel}.`;
  const subtitle2 = 'The requester has been notified of the reason.';

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalBox,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
        >
          {/* Top-Right Close Button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color={isDarkMode ? '#94A3B8' : '#64748B'} />
          </TouchableOpacity>

          {/* Centered Soft Red Halo with Red Circle & X Icon */}
          <View
            style={[
              styles.iconHalo,
              {
                backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2',
              },
            ]}
          >
            <View
              style={[
                styles.iconCircle,
                {
                  borderColor: isDarkMode ? '#F87171' : '#EF4444',
                },
              ]}
            >
              <Ionicons
                name="close"
                size={22}
                color={isDarkMode ? '#F87171' : '#EF4444'}
              />
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
            {title}
          </Text>

          {/* Subtitle Line 1 */}
          <Text style={[styles.subtitle1, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
            {subtitle1}
          </Text>

          {/* Subtitle Line 2 */}
          <Text style={[styles.subtitle2, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            {subtitle2}
          </Text>

          {/* Action Button: Purple 'Done' pill button */}
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 99999,
  },
  modalBox: {
    width: 360,
    maxWidth: '92%',
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 28,
    elevation: 14,
  },
  closeBtn: {
    position: 'absolute',
    top: 18,
    right: 18,
    padding: 4,
    zIndex: 10,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  iconHalo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  subtitle1: {
    fontSize: 14.5,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
    paddingHorizontal: 6,
  },
  subtitle2: {
    fontSize: 13.5,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 6,
  },
  doneBtn: {
    width: '100%',
    height: 48,
    borderRadius: 16,
    backgroundColor: '#3B0764',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B0764',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
