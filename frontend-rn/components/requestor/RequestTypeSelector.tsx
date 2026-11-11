import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/theme';

export type RequestSubmissionType = 'standard' | 'imc';

interface RequestTypeSelectorProps {
  initialType?: RequestSubmissionType;
  onSelectType: (type: RequestSubmissionType) => void;
  onBackToDashboard?: () => void;
}

export const RequestTypeSelector: React.FC<RequestTypeSelectorProps> = ({
  initialType = 'imc',
  onSelectType,
  onBackToDashboard,
}) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

  // 'imc' is preselected as shown in the design specification
  const [selectedType, setSelectedType] = useState<RequestSubmissionType>(initialType);

  const handleContinue = () => {
    onSelectType(selectedType);
  };

  return (
    <View style={styles.pageContainer}>
      {/* ================= PAGE HEADER & BREADCRUMB ================= */}
      <View style={styles.pageHeader}>
        <View style={styles.breadcrumbRow}>
          <TouchableOpacity
            onPress={onBackToDashboard}
            disabled={!onBackToDashboard}
            activeOpacity={onBackToDashboard ? 0.7 : 1}
            style={styles.breadcrumbLink}
          >
            <Text style={[styles.breadcrumbText, isDarkMode && styles.breadcrumbTextDark]}>
              POST REQUESTS
            </Text>
          </TouchableOpacity>
          <Text style={[styles.breadcrumbDivider, isDarkMode && styles.breadcrumbDividerDark]}>
            /
          </Text>
          <Text style={[styles.breadcrumbCurrent, isDarkMode && styles.breadcrumbCurrentDark]}>
            NEW REQUEST
          </Text>
        </View>

        <Text
          style={[
            styles.pageTitle,
            !isTablet && styles.pageTitleMobile,
            isDarkMode && styles.pageTitleDark,
          ]}
        >
          Create New Request
        </Text>
        <Text style={[styles.pageSubtitle, isDarkMode && styles.pageSubtitleDark]}>
          Select the type of request you wish to submit.
        </Text>
      </View>

      {/* ================= MAIN SELECTION CARD ================= */}
      <View
        style={[
          styles.mainCard,
          !isTablet && styles.mainCardMobile,
          isDarkMode && styles.mainCardDark,
        ]}
      >
        {/* Card Header Section */}
        <View style={styles.cardHeader}>
          <Text style={[styles.sectionBadge, isDarkMode && styles.sectionBadgeDark]}>
            REQUEST TYPE
          </Text>
          <Text
            style={[
              styles.questionTitle,
              !isTablet && styles.questionTitleMobile,
              isDarkMode && styles.questionTitleDark,
            ]}
          >
            How would you like to submit your request?
          </Text>
          <Text style={[styles.questionSubtitle, isDarkMode && styles.questionSubtitleDark]}>
            Select the appropriate process. Both options are available within JMCFI PostFlow.
          </Text>
        </View>

        {/* Options Row */}
        <View style={[styles.optionsRow, !isTablet && styles.optionsRowStacked]}>
          {/* OPTION 1: Standard Content Request */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              isTablet && styles.optionCardSideBySide,
              isDesktop && styles.optionCardDesktop,
              isDarkMode && styles.optionCardDark,
              selectedType === 'standard' && styles.optionCardSelected,
              selectedType === 'standard' && isDarkMode && styles.optionCardSelectedDark,
            ]}
            onPress={() => setSelectedType('standard')}
            activeOpacity={0.88}
          >
            <View style={styles.optionBody}>
              <View style={styles.optionTopRow}>
                <View style={[styles.iconBox, isDarkMode && styles.iconBoxDark]}>
                  <Ionicons
                    name="document-text-outline"
                    size={22}
                    color={isDarkMode ? '#C084FC' : '#581C87'}
                  />
                </View>

                {/* Radio indicator */}
                <View
                  style={[
                    styles.radioCircle,
                    isDarkMode && styles.radioCircleDark,
                    selectedType === 'standard' && styles.radioCircleSelected,
                  ]}
                >
                  {selectedType === 'standard' && (
                    <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                  )}
                </View>
              </View>

              <Text style={[styles.optionTitle, isDarkMode && styles.optionTitleDark]}>
                Standard Content Request
              </Text>

              <Text style={[styles.optionDescription, isDarkMode && styles.optionDescriptionDark]}>
                Submit content through the established departmental review and approval process.
              </Text>
            </View>

            <View style={styles.optionLinkRow}>
              <Text style={[styles.optionLinkText, isDarkMode && styles.optionLinkTextDark]}>
                Standard approval workflow
              </Text>
            </View>
          </TouchableOpacity>

          {/* OPTION 2: IMC Publication Request */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              isTablet && styles.optionCardSideBySide,
              isDesktop && styles.optionCardDesktop,
              isDarkMode && styles.optionCardDark,
              selectedType === 'imc' && styles.optionCardSelected,
              selectedType === 'imc' && isDarkMode && styles.optionCardSelectedDark,
            ]}
            onPress={() => setSelectedType('imc')}
            activeOpacity={0.88}
          >
            <View style={styles.optionBody}>
              <View style={styles.optionTopRow}>
                <View style={[styles.iconBox, isDarkMode && styles.iconBoxDark]}>
                  <Ionicons
                    name="paper-plane-outline"
                    size={21}
                    color={isDarkMode ? '#C084FC' : '#581C87'}
                  />
                </View>

                {/* Radio indicator */}
                <View
                  style={[
                    styles.radioCircle,
                    isDarkMode && styles.radioCircleDark,
                    selectedType === 'imc' && styles.radioCircleSelected,
                  ]}
                >
                  {selectedType === 'imc' && (
                    <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                  )}
                </View>
              </View>

              <Text style={[styles.optionTitle, isDarkMode && styles.optionTitleDark]}>
                IMC Publication Request
              </Text>

              <Text style={[styles.optionDescription, isDarkMode && styles.optionDescriptionDark]}>
                Submit publication materials directly to Integrated Marketing Communications for final preparation and posting.
              </Text>
            </View>

            <View style={styles.optionLinkRow}>
              <Text style={[styles.optionLinkText, isDarkMode && styles.optionLinkTextDark]}>
                Direct submission to IMC
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Card Footer Bar */}
        <View style={[styles.cardFooter, !isTablet && styles.cardFooterStacked]}>
          <Text style={[styles.footerNotice, isDarkMode && styles.footerNoticeDark]}>
            Your selected request type determines which form and review process will be used.
          </Text>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  pageContainer: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 18,
  },
  pageHeader: {
    width: '100%',
    gap: 4,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  breadcrumbLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#581C87',
    letterSpacing: 0.6,
  },
  breadcrumbTextDark: {
    color: '#C084FC',
  },
  breadcrumbDivider: {
    fontSize: 12,
    fontWeight: '700',
    color: '#581C87',
    marginHorizontal: 2,
  },
  breadcrumbDividerDark: {
    color: '#C084FC',
  },
  breadcrumbCurrent: {
    fontSize: 12,
    fontWeight: '800',
    color: '#581C87',
    letterSpacing: 0.6,
  },
  breadcrumbCurrentDark: {
    color: '#E9D5FF',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  pageTitleMobile: {
    fontSize: 22,
  },
  pageTitleDark: {
    color: '#F8FAFC',
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  pageSubtitleDark: {
    color: '#94A3B8',
  },

  // Main Card
  mainCard: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 32,
    paddingHorizontal: 32,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.06), 0 1px 4px 0 rgba(15, 23, 42, 0.04)',
        }
      : {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.05,
          shadowRadius: 16,
          elevation: 2,
        }),
  },
  mainCardMobile: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  mainCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.35)',
        }
      : {}),
  },
  cardHeader: {
    width: '100%',
    marginBottom: 24,
  },
  sectionBadge: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  sectionBadgeDark: {
    color: '#94A3B8',
  },
  questionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  questionTitleMobile: {
    fontSize: 18,
  },
  questionTitleDark: {
    color: '#F8FAFC',
  },
  questionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  questionSubtitleDark: {
    color: '#94A3B8',
  },

  // Options Row
  optionsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 24,
    marginBottom: 28,
  },
  optionsRowStacked: {
    flexDirection: 'column',
    gap: 16,
    marginBottom: 24,
  },
  optionCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 24,
    minHeight: 210,
    justifyContent: 'space-between',
    ...(Platform.OS === 'web'
      ? {
          cursor: 'pointer',
          transition: 'all 0.18s ease-in-out',
        }
      : {}),
  },
  optionCardSideBySide: {
    flex: 1,
    width: '48%' as any,
  },
  optionCardDesktop: {
    padding: 28,
    minHeight: 225,
  },
  optionCardDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  optionCardSelected: {
    borderColor: '#581C87',
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 0 0 1px #581C87, 0 4px 16px -2px rgba(88, 28, 135, 0.12)',
        }
      : {}),
  },
  optionCardSelectedDark: {
    borderColor: '#A855F7',
    backgroundColor: '#0F172A',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 0 0 1px #A855F7, 0 4px 16px -2px rgba(168, 85, 247, 0.25)',
        }
      : {}),
  },
  optionBody: {
    width: '100%',
  },
  optionTopRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBoxDark: {
    backgroundColor: '#3B0764',
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleDark: {
    borderColor: '#475569',
  },
  radioCircleSelected: {
    backgroundColor: '#581C87',
    borderColor: '#581C87',
    borderWidth: 0,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: -0.1,
  },
  optionTitleDark: {
    color: '#F8FAFC',
  },
  optionDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 21,
    marginBottom: 20,
  },
  optionDescriptionDark: {
    color: '#94A3B8',
  },
  optionLinkRow: {
    marginTop: 'auto',
    paddingTop: 4,
  },
  optionLinkText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#581C87',
  },
  optionLinkTextDark: {
    color: '#C084FC',
  },

  // Card Footer
  cardFooter: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    paddingTop: 4,
  },
  cardFooterStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 14,
  },
  footerNotice: {
    fontSize: 13.5,
    color: '#64748B',
    flex: 1,
  },
  footerNoticeDark: {
    color: '#94A3B8',
  },
  continueButton: {
    backgroundColor: '#FBBF24',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? {
          cursor: 'pointer',
          boxShadow: '0 2px 6px 0 rgba(245, 158, 11, 0.25)',
          transition: 'background-color 0.15s ease-in-out, transform 0.1s ease',
        }
      : {}),
  },
  continueButtonText: {
    color: '#0F172A',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
