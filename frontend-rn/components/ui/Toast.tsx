import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/theme';

export interface ToastProps {
  visible: boolean;
  message: string;
  title?: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onHide: () => void;
  onDismiss?: () => void;
  duration?: number; // Kept for compatibility but not used
}

export function deriveAlertTitle(
  explicitTitle?: string,
  message?: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'error'
): string {
  if (
    explicitTitle &&
    explicitTitle.trim() &&
    !['error', 'alert', 'notice', 'warning', 'info', 'success', 'jmcfi postflow'].includes(
      explicitTitle.trim().toLowerCase()
    )
  ) {
    return explicitTitle.trim();
  }

  const text = `${explicitTitle || ''} ${message || ''}`.toLowerCase();

  // Success-specific titles
  if (type === 'success' || text.includes('success') || text.includes('successfully') || text.includes('applied')) {
    if (text.includes('caption') || text.includes('refined caption')) return 'Caption Applied';
    if (text.includes('profile')) return 'Profile Updated';
    if (text.includes('password')) return 'Password Changed';
    if (text.includes('photo') && text.includes('remov')) return 'Photo Removed';
    if (text.includes('photo') || text.includes('avatar')) return 'Photo Updated';
    if (text.includes('token') && text.includes('clear')) return 'Tokens Cleared';
    if (text.includes('token')) return 'Tokens Saved';
    if (text.includes('email') && text.includes('sent')) return 'Email Sent';
    if (text.includes('email')) return 'Settings Saved';
    if (text.includes('publish')) return 'Post Published';
    if (text.includes('account created') || text.includes('user created')) return 'Account Created';
    if (text.includes('deleted')) return 'Deleted Successfully';
    if (text.includes('export')) return 'Export Successful';
    if (text.includes('download')) return 'Download Complete';
    if (text.includes('submitted')) return 'Submitted Successfully';
    if (text.includes('rule')) return 'Rules Saved';
    return 'Success';
  }

  // Error / Warning titles
  if (text.includes('caption')) return 'Caption Required';
  if (text.includes('full name') || text.includes('name required')) return 'Name Required';
  if (text.includes('password') && (text.includes('match') || text.includes('confirm'))) return 'Password Mismatch';
  if (text.includes('password')) return 'Password Required';
  if (text.includes('email')) return 'Email Required';
  if (text.includes('token')) return 'Token Required';
  if (text.includes('select platform') || text.includes('at least one platform')) return 'Select Platform';
  if (text.includes('video upload') || text.includes('videos are not allowed')) return 'Media Not Supported';
  if (text.includes('upload failed') || text.includes('failed to upload')) return 'Upload Failed';
  if (text.includes('policy')) return 'Policy Alignment';
  if (text.includes('unauthorized') || text.includes('forbidden') || text.includes('access denied')) return 'Access Denied';
  if (text.includes('network') || text.includes('connection')) return 'Connection Error';

  if (type === 'error') return 'Action Required';
  if (type === 'warning') return 'Notice';
  if (type === 'info') return 'Notice';
  return 'Notice';
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  title,
  type = 'error',
  onHide,
  onDismiss,
}) => {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

  if (!visible) return null;

  const isSuccess = type === 'success';
  const displayTitle = deriveAlertTitle(title, message, type);

  const iconConfig = {
    success: {
      name: 'checkmark' as const,
      color: '#10B981',
      darkColor: '#34D399',
      haloBg: '#DCFCE7',
      darkHaloBg: 'rgba(16, 185, 129, 0.18)',
    },
    error: {
      name: 'alert-circle-outline' as const,
      color: '#EF4444',
      darkColor: '#F87171',
      haloBg: '#FEE2E2',
      darkHaloBg: 'rgba(239, 68, 68, 0.18)',
    },
    warning: {
      name: 'alert-circle-outline' as const,
      color: '#F59E0B',
      darkColor: '#FBBF24',
      haloBg: '#FEF3C7',
      darkHaloBg: 'rgba(245, 158, 11, 0.18)',
    },
    info: {
      name: 'information-circle-outline' as const,
      color: '#2563EB',
      darkColor: '#60A5FA',
      haloBg: '#DBEAFE',
      darkHaloBg: 'rgba(37, 99, 235, 0.18)',
    },
  }[type] || {
    name: 'alert-circle-outline' as const,
    color: '#EF4444',
    darkColor: '#F87171',
    haloBg: '#FEE2E2',
    darkHaloBg: 'rgba(239, 68, 68, 0.18)',
  };

  const activeColor = isDarkMode ? iconConfig.darkColor : iconConfig.color;
  const activeHaloBg = isDarkMode ? iconConfig.darkHaloBg : iconConfig.haloBg;

  const handleDismiss = () => {
    if (onDismiss) onDismiss();
    else onHide();
  };

  const handleOk = () => {
    onHide();
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.alertBox,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
          {...({ 'data-modal': 'alert-box' } as any)}
        >
          {/* Top-Right Close Button (Hidden on Success Modal) */}
          {!isSuccess && (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleDismiss}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={isDarkMode ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          )}

          {/* Centered Glowing Halo & Icon */}
          <View style={[styles.iconHalo, { backgroundColor: activeHaloBg }]}>
            <Ionicons name={iconConfig.name} size={32} color={activeColor} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
            {displayTitle}
          </Text>

          {/* Subtitle / Message */}
          <Text style={[styles.message, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            {message}
          </Text>

          {/* Action Button: Single full-width OK button */}
          <TouchableOpacity
            style={styles.fullOkBtn}
            onPress={handleOk}
            activeOpacity={0.8}
          >
            <Text style={styles.okText}>OK</Text>
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
  alertBox: {
    width: 350,
    maxWidth: '92%',
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  dismissBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '600',
  },
  okBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  fullOkBtn: {
    width: '100%',
    height: 46,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  okText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});



