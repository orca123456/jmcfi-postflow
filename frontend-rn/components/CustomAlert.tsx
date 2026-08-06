import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { Colors, BorderRadius } from '../constants/theme';

export function CustomAlertProvider({ children }: { children: React.ReactNode }) {
  const [alertConfig, setAlertConfig] = useState<{ message: string; visible: boolean }>({
    message: '',
    visible: false,
  });

  useEffect(() => {
    let originalWindowAlert: any = null;
    let originalAlertAlert: any = null;

    if (Platform.OS === 'web') {
      originalWindowAlert = window.alert;
      window.alert = (message: any) => {
        setAlertConfig({ message: String(message), visible: true });
      };
    }

    originalAlertAlert = Alert.alert;
    Alert.alert = (title: string, message?: string) => {
      const fullMessage = message ? `${title}\n\n${message}` : title;
      setAlertConfig({ message: fullMessage, visible: true });
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

  return (
    <>
      {children}
      <Modal
        transparent
        visible={alertConfig.visible}
        animationType="fade"
        onRequestClose={() => setAlertConfig({ ...alertConfig, visible: false })}
      >
        <View style={styles.overlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>JMCFI PostFlow</Text>
            <Text style={styles.alertMessage}>{alertConfig.message}</Text>
            <TouchableOpacity 
              style={styles.okButton} 
              onPress={() => setAlertConfig({ ...alertConfig, visible: false })}
            >
              <Text style={styles.okButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  alertBox: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.md,
    padding: 24,
    width: 320,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 12,
  },
  alertMessage: {
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 24,
    lineHeight: 20,
  },
  okButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-end',
  },
  okButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  }
});
