import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ComplianceResultModalProps {
  visible: boolean;
  onClose: () => void;
  score: number;
  status: string;
  analysisLogic: string;
}

export const ComplianceResultModal: React.FC<ComplianceResultModalProps> = ({
  visible,
  onClose,
  score,
  status,
  analysisLogic,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'pass':
      case 'compliant':
        return '#10B981'; // Emerald 500
      case 'review_required':
      case 'needs_review':
        return '#F59E0B'; // Amber 500
      case 'fail':
      case 'non_compliant':
        return '#EF4444'; // Red 500
      default:
        return '#6B7280'; // Gray 500
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pass':
      case 'compliant':
        return 'Compliant';
      case 'review_required':
      case 'needs_review':
        return 'Needs Review';
      case 'fail':
      case 'non_compliant':
        return 'Non-Compliant';
      default:
        return 'Unknown';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'pass':
      case 'compliant':
        return 'checkmark-circle';
      case 'review_required':
      case 'needs_review':
        return 'warning';
      case 'fail':
      case 'non_compliant':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const statusColor = getStatusColor();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <View style={[styles.iconContainer, { padding: 0, backgroundColor: 'transparent' }]}>
                <Image source={require('../../assets/images/jmc_logo.png')} style={{ width: 28, height: 28 }} resizeMode="contain" />
              </View>
              <Text style={styles.headerTitle}>JMCFI PostFlow</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            
            <View style={styles.scoreSection}>
              {/* Circular Score Approximation */}
              <View style={[styles.scoreCircle, { borderColor: statusColor }]}>
                <Text style={[styles.scoreText, { color: statusColor }]}>{score}%</Text>
                <Text style={styles.scoreLabel}>Alignment</Text>
              </View>
              
              <View style={styles.statusBadgeContainer}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                  <Ionicons name={getStatusIcon()} size={16} color={statusColor} style={{ marginRight: 6 }} />
                  <Text style={[styles.statusBadgeText, { color: statusColor }]}>{getStatusText()}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.analysisTitle}>AI Analysis</Text>
            
            <View style={styles.analysisScrollContainer}>
              <ScrollView style={styles.analysisScroll} indicatorStyle="black">
                <Text style={styles.analysisText}>
                  {analysisLogic}
                </Text>
              </ScrollView>
            </View>

          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.okButton} onPress={onClose}>
              <Text style={styles.okButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 450,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    backgroundColor: '#EFF6FF',
    padding: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E3A8A', // JMCFI Navy Blue
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    padding: 24,
  },
  scoreSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  scoreText: {
    fontSize: 32,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  statusBadgeContainer: {
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontWeight: '600',
    fontSize: 14,
  },
  analysisTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  analysisScrollContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    maxHeight: 250,
  },
  analysisScroll: {
    flexGrow: 0,
  },
  analysisText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#4B5563',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
    alignItems: 'flex-end',
  },
  okButton: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  okButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
});
