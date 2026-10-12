import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/theme';
import { deriveAlertTitle } from './ui/Toast';

export function CustomAlertProvider({ children }: { children: React.ReactNode }) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const [alertConfig, setAlertConfig] = useState<{
    title?: string;
    message: string;
    visible: boolean;
    type?: 'success' | 'error' | 'info' | 'warning';
    onOk?: () => void;
    onDismiss?: () => void;
  }>({
    title: '',
    message: '',
    visible: false,
    type: 'error',
  });

  useEffect(() => {
    let originalWindowAlert: any = null;
    let originalAlertAlert: any = null;

    if (Platform.OS === 'web') {
      originalWindowAlert = window.alert;
      window.alert = (message: any) => {
        const msgStr = String(message ?? '');
        setAlertConfig({
          title: deriveAlertTitle(undefined, msgStr, 'error'),
          message: msgStr,
          visible: true,
          type: 'error',
          onOk: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
          onDismiss: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
        });
      };
    }

    originalAlertAlert = Alert.alert;
    Alert.alert = (title: string, message?: string, buttons?: any[]) => {
      let finalTitle = title;
      let finalMessage = message;
      let alertType: 'error' | 'warning' | 'info' | 'success' = 'error';

      if (!message) {
        finalMessage = title;
        finalTitle = deriveAlertTitle(undefined, title, 'error');
      } else {
        const lowerTitle = (title || '').toLowerCase();
        if (lowerTitle.includes('success') || lowerTitle.includes('completed')) {
          alertType = 'success';
        } else if (lowerTitle.includes('warning') || lowerTitle.includes('select')) {
          alertType = 'warning';
        } else if (lowerTitle.includes('info')) {
          alertType = 'info';
        } else {
          alertType = 'error';
        }
      }

      let onOkHandler = () => setAlertConfig((prev) => ({ ...prev, visible: false }));
      let onDismissHandler = () => setAlertConfig((prev) => ({ ...prev, visible: false }));

      if (Array.isArray(buttons) && buttons.length > 0) {
        const okBtn =
          buttons.find(
            (b) =>
              (b?.text || '').toLowerCase() === 'ok' ||
              b?.style !== 'cancel'
          ) || buttons[buttons.length - 1];
        const cancelBtn = buttons.find(
          (b) =>
            b?.style === 'cancel' ||
            (b?.text || '').toLowerCase() === 'cancel' ||
            (b?.text || '').toLowerCase() === 'dismiss'
        );

        if (okBtn && typeof okBtn.onPress === 'function') {
          const originalPress = okBtn.onPress;
          onOkHandler = () => {
            setAlertConfig((prev) => ({ ...prev, visible: false }));
            originalPress();
          };
        }
        if (cancelBtn && typeof cancelBtn.onPress === 'function') {
          const originalCancel = cancelBtn.onPress;
          onDismissHandler = () => {
            setAlertConfig((prev) => ({ ...prev, visible: false }));
            originalCancel();
          };
        }
      }

      setAlertConfig({
        title: finalTitle,
        message: finalMessage || '',
        visible: true,
        type: alertType,
        onOk: onOkHandler,
        onDismiss: onDismissHandler,
      });
    };

    return () => {
      if (Platform.OS === 'web' && originalWindowAlert) {
        window.alert = originalWindowAlert;
      }
      if (originalAlertAlert) {
        Alert.alert = originalAlertAlert;
      }
    };
  }, []);

  const isSuccess = alertConfig.type === 'success';
  const displayTitle = deriveAlertTitle(alertConfig.title, alertConfig.message, alertConfig.type || 'error');

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
  }[alertConfig.type || 'error'] || {
    name: 'alert-circle-outline' as const,
    color: '#EF4444',
    darkColor: '#F87171',
    haloBg: '#FEE2E2',
    darkHaloBg: 'rgba(239, 68, 68, 0.18)',
  };

  const activeColor = isDarkMode ? iconConfig.darkColor : iconConfig.color;
  const activeHaloBg = isDarkMode ? iconConfig.darkHaloBg : iconConfig.haloBg;

  const handleDismiss = () => {
    if (alertConfig.onDismiss) {
      alertConfig.onDismiss();
    } else {
      setAlertConfig((prev) => ({ ...prev, visible: false }));
    }
  };

  const handleOk = () => {
    if (alertConfig.onOk) {
      alertConfig.onOk();
    } else {
      setAlertConfig((prev) => ({ ...prev, visible: false }));
    }
  };

  return (
    <>
      {children}
      {alertConfig.visible && (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={handleDismiss}
        >
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
                {alertConfig.message}
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
      )}
    </>
  );
}

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
