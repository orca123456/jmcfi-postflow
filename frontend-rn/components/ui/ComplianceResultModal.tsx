import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ComplianceResultModalProps {
  visible: boolean;
  onClose: () => void;
  score: number;
  status: string;
  analysisLogic: string;
  checks?: Record<string, { passed?: boolean; score?: number; issues?: string[]; suggestions?: string[] }>;
  suggestedCaption?: string | null;
  onApplySuggestedCaption?: (caption: string) => void;
}

export const ComplianceResultModal: React.FC<ComplianceResultModalProps> = ({
  visible,
  onClose,
  score,
  status,
  analysisLogic,
  checks = {},
  suggestedCaption,
  onApplySuggestedCaption,
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

  const criteriaKeys = [
    { key: 'accuracy', label: 'Accuracy', icon: 'shield-checkmark-outline' },
    { key: 'completeness', label: 'Completeness', icon: 'list-outline' },
    { key: 'branding', label: 'Branding', icon: 'color-palette-outline' },
    { key: 'privacy', label: 'Privacy', icon: 'lock-closed-outline' },
    { key: 'compliance', label: 'Policy Rules', icon: 'document-text-outline' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <View style={[styles.iconContainer, { padding: 0, backgroundColor: 'transparent' }]}>
                <Image source={require('../../assets/images/jmc_logo.png')} style={{ width: 28, height: 28 }} resizeMode="contain" />
              </View>
              <Text style={styles.headerTitle}>JMCFI Policy Alignment</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { cursor: 'pointer' as any }]}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Scrollable Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            
            {/* Score & Status Banner */}
            <View style={styles.scoreSection}>
              <View style={[styles.scoreCircle, { borderColor: statusColor }]}>
                <Text style={[styles.scoreText, { color: statusColor }]}>{score}%</Text>
                <Text style={styles.scoreLabel}>Alignment</Text>
              </View>
              
              <View style={styles.statusBadgeContainer}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
                  <Ionicons name={getStatusIcon() as any} size={16} color={statusColor} style={{ marginRight: 6 }} />
                  <Text style={[styles.statusBadgeText, { color: statusColor }]}>{getStatusText()}</Text>
                </View>
              </View>
            </View>

            {/* Criteria Breakdown Grid */}
            {Object.keys(checks).length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={styles.analysisTitle}>Criteria Breakdown</Text>
                <View style={styles.criteriaGrid}>
                  {criteriaKeys.map((crit) => {
                    const checkData = checks[crit.key];
                    if (!checkData) return null;
                    const passed = checkData.passed ?? (checkData.score !== undefined ? checkData.score >= 70 : true);
                    const itemColor = passed ? '#10B981' : '#F59E0B';
                    return (
                      <View key={crit.key} style={styles.criteriaItem}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name={crit.icon as any} size={15} color="#4B5563" />
                          <Text style={styles.criteriaLabel}>{crit.label}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons
                            name={passed ? 'checkmark-circle' : 'alert-circle'}
                            size={16}
                            color={itemColor}
                          />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: itemColor }}>
                            {checkData.score !== undefined ? `${checkData.score}%` : (passed ? 'Pass' : 'Review')}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* AI Analysis Logic */}
            <Text style={styles.analysisTitle}>AI Findings & Guidance</Text>
            <View style={styles.analysisScrollContainer}>
              <Text style={styles.analysisText}>
                {analysisLogic || 'No specific compliance issues identified.'}
              </Text>
            </View>

            {/* Suggested Caption Action (if provided) */}
            {suggestedCaption && onApplySuggestedCaption && (
              <View style={styles.suggestedCaptionCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Ionicons name="sparkles" size={15} color="#2563EB" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E40AF' }}>AI Suggested Refinement</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#374151', lineHeight: 18, marginBottom: 10 }}>
                  {suggestedCaption}
                </Text>
                <TouchableOpacity
                  style={styles.applyBtn}
                  onPress={() => onApplySuggestedCaption(suggestedCaption)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="color-wand-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.applyBtnText}>Apply Refinement to Caption</Text>
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.okButton, { cursor: 'pointer' as any }]} onPress={onClose} activeOpacity={0.85}>
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    backgroundColor: '#EFF6FF',
    padding: 6,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E3A8A', // JMCFI Navy Blue
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  scoreSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  scoreCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  scoreText: {
    fontSize: 28,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: 10,
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
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontWeight: '700',
    fontSize: 13,
  },
  analysisTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  criteriaGrid: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 8,
    gap: 6,
  },
  criteriaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  criteriaLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  analysisScrollContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 16,
  },
  analysisText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#374151',
  },
  suggestedCaptionCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    marginBottom: 16,
  },
  applyBtn: {
    backgroundColor: '#1E3A8A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  } as any,
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
    alignItems: 'flex-end',
  },
  okButton: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: 8,
  },
  okButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
