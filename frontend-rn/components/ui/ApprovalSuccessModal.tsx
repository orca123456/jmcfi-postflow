import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/theme';

export interface ApprovalSuccessModalProps {
  visible: boolean;
  role: 'office_head' | 'vpaa' | 'vice_president' | 'imc_qa' | 'imc_qa_checker' | 'department_head';
  postTitle: string;
  isScheduled?: boolean;
  onClose: () => void;
}

export const ApprovalSuccessModal: React.FC<ApprovalSuccessModalProps> = ({
  visible,
  role,
  postTitle,
  isScheduled = false,
  onClose,
}) => {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

  if (!visible) return null;

  let title = 'Request Approved';
  let subtitle1 = `“${postTitle}” was approved successfully.`;
  let subtitle2 = 'Forwarded for the next review.';

  if (role === 'office_head') {
    title = 'Request Approved';
    subtitle1 = `“${postTitle}” was approved successfully.`;
    subtitle2 = 'Forwarded to VPAA for the next review.';
  } else if (role === 'vice_president' || role === 'vpaa') {
    title = 'Request Approved';
    subtitle1 = `“${postTitle}” was approved successfully.`;
    subtitle2 = 'Forwarded to IMC / QA for final review.';
  } else if (role === 'imc_qa' || role === 'imc_qa_checker') {
    if (isScheduled) {
      title = 'Approved & Scheduled';
      subtitle1 = `“${postTitle}” was approved and scheduled.`;
      subtitle2 = 'The post is scheduled for publishing on its selected platforms.';
    } else {
      title = 'Approved & Published';
      subtitle1 = `“${postTitle}” was approved and published.`;
      subtitle2 = 'The post is now live on its selected platforms.';
    }
  }

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

          {/* Centered Green Circle with Green Checkmark */}
          <View
            style={[
              styles.iconHalo,
              {
                backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.18)' : '#DCFCE7',
              },
            ]}
          >
            <View
              style={[
                styles.iconCircle,
                {
                  borderColor: isDarkMode ? '#34D399' : '#16A34A',
                },
              ]}
            >
              <Ionicons
                name="checkmark"
                size={22}
                color={isDarkMode ? '#34D399' : '#16A34A'}
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
