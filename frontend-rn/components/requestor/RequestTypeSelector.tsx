import React, { useRef, useState, useCallback } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../../constants/theme';
import { useThemeStore } from '../../store/theme';

export type RequestSubmissionType = 'standard' | 'imc';

interface RequestTypeSelectorProps {
  initialType?: RequestSubmissionType;
  onSelectType: (type: RequestSubmissionType) => void;
  onBackToDashboard?: () => void;
}

const BRAND_PURPLE = '#4C007C';
const BRAND_GOLD = '#FFC72C';
const GOLD_INK = '#1A1A2E';
const PURPLE_TINT = '#F3E8FF';
const DARK_PURPLE = '#3B0764';
const LIGHT_PURPLE = '#C084FC';
const CONTROL_HEIGHT = 44;
const CHOICE_COLUMNS_MIN_WIDTH = 640;
const CTA_RADIUS = 8;

const REQUEST_TYPES: {
  type: RequestSubmissionType;
  title: string;
  description: string;
  workflow: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
    {
      type: 'standard',
      title: 'Standard Content Request',
      description: 'Submit content through your department\'s review and approval process.',
      workflow: 'Standard approval workflow',
      icon: 'document-text-outline',
    },
    {
      type: 'imc',
      title: 'IMC Publication Request',
      description: 'Send publication materials to Integrated Marketing Communications for final preparation and posting.',
      workflow: 'Direct submission to IMC',
      icon: 'paper-plane-outline',
    },
  ];

export const RequestTypeSelector: React.FC<RequestTypeSelectorProps> = ({
  initialType = 'standard',
  onSelectType,
  onBackToDashboard,
}) => {
  const isDarkMode = useThemeStore((store) => store.isDarkMode);
  const [contentWidth, setContentWidth] = useState(0);
  const [choiceWidth, setChoiceWidth] = useState(0);
  const handleContentLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setContentWidth((prev) => (Math.abs(prev - next) >= 4 ? next : prev));
  }, []);
  const handleChoiceLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setChoiceWidth((prev) => (Math.abs(prev - next) >= 4 ? next : prev));
  }, []);
  const [selectedType, setSelectedType] = useState<RequestSubmissionType>(initialType);
  const [hoveredControl, setHoveredControl] = useState<string | null>(null);
  const [focusedControl, setFocusedControl] = useState<string | null>(null);
  const optionRefs = useRef<Partial<Record<RequestSubmissionType, View | null>>>({});
  const nativeDark = Platform.OS !== 'web' && isDarkMode;
  const palette = {
    surface: nativeDark ? '#1C2541' : Colors.surface,
    border: nativeDark ? '#334155' : Colors.border,
    text: nativeDark ? '#F8FAFC' : Colors.textPrimary,
    secondaryText: nativeDark ? '#CBD5E1' : Colors.textSecondary,
  };
  const accentColor = isDarkMode ? LIGHT_PURPLE : BRAND_PURPLE;
  const isWide = contentWidth >= 700;
  const hasColumns = choiceWidth >= CHOICE_COLUMNS_MIN_WIDTH;
  const selectedOption = REQUEST_TYPES.find((option) => option.type === selectedType)!;

  const handleOptionKeyDown = (event: React.KeyboardEvent, type: RequestSubmissionType) => {
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      setSelectedType(type);
      return;
    }
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'standard' : event.key === 'End' ? 'imc'
      : type === 'standard' ? 'imc' : 'standard';
    setSelectedType(next);
    optionRefs.current[next]?.focus?.();
  };

  return (
    <View nativeID="requestor-type-selector" style={styles.pageContainer}
      onLayout={handleContentLayout}>
      {Platform.OS === 'web' && <style>{`
        #requestor-type-selector :is([role="button"], [role="radio"]) { cursor: pointer; }
        #requestor-type-selector :is([role="button"], [role="radio"]):focus-visible {
          outline: 2px solid ${accentColor} !important; outline-offset: 2px;
        }
        #requestor-type-selector #requestor-type-continue [dir="auto"] { color: ${GOLD_INK} !important; }
      `}</style>}

      <View style={styles.pageHeader}>
        <View style={styles.breadcrumbRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to post requests"
            accessibilityState={{ disabled: !onBackToDashboard }} disabled={!onBackToDashboard}
            onPress={onBackToDashboard} style={({ pressed }) => [styles.breadcrumbLink, pressed && styles.pressed]}>
            <Text style={[styles.breadcrumbText, { color: accentColor }]}>POST REQUESTS</Text>
          </Pressable>
          <Ionicons name="chevron-forward" size={12} color={palette.secondaryText} />
          <Text style={[styles.breadcrumbText, { color: palette.secondaryText }]}>NEW REQUEST</Text>
        </View>
        <Text accessibilityRole="header" {...(Platform.OS === 'web' ? { 'aria-level': 1 } : {})}
          style={[styles.pageTitle, { color: palette.text, fontSize: isWide ? FontSize.xxl : FontSize.xl }]}>
          Create New Request
        </Text>
        <Text style={[styles.supportingText, { color: palette.secondaryText }]}>
          Choose the process that fits your content.
        </Text>
      </View>

      <Card padding={isWide ? Spacing.lg : Spacing.md}
        style={[styles.mainCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.sectionBadge, { color: accentColor }]}>REQUEST TYPE</Text>
          <Text accessibilityRole="header" {...(Platform.OS === 'web' ? { 'aria-level': 2 } : {})}
            style={[styles.questionTitle, { color: palette.text }]}>
            How would you like to submit your request?
          </Text>
          <Text style={[styles.supportingText, { color: palette.secondaryText }]}>
            Select a request type to open the right form and review process.
          </Text>
        </View>

        <View accessibilityRole="radiogroup" accessibilityLabel="Request type"
          onLayout={handleChoiceLayout}
          style={[styles.optionsRow, !hasColumns && styles.stacked]}>
          {REQUEST_TYPES.map((option) => {
            const selected = selectedType === option.type;
            const highlighted = hoveredControl === option.type || focusedControl === option.type;
            return (
              <Pressable key={option.type}
                ref={(node) => { optionRefs.current[option.type] = node; }}
                accessibilityRole="radio" accessibilityLabel={option.title}
                accessibilityHint={option.description}
                accessibilityState={{ checked: selected }}
                {...(Platform.OS === 'web' ? {
                  'aria-checked': selected,
                  tabIndex: selected ? 0 as const : -1 as const,
                  onKeyDown: (event: React.KeyboardEvent) => handleOptionKeyDown(event, option.type),
                } : {})}
                onPress={() => setSelectedType(option.type)}
                onHoverIn={() => setHoveredControl(option.type)} onHoverOut={() => setHoveredControl(null)}
                onFocus={() => setFocusedControl(option.type)} onBlur={() => setFocusedControl(null)}
                style={({ pressed }) => [
                  styles.optionCard, hasColumns ? styles.optionColumn : styles.fullWidth,
                  { backgroundColor: palette.surface, borderColor: selected || highlighted ? accentColor : palette.border },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.optionBody}>
                  <View style={styles.optionTopRow}>
                    <View style={[styles.iconBox, { backgroundColor: isDarkMode ? DARK_PURPLE : PURPLE_TINT }]}>
                      <Ionicons name={option.icon} size={22} color={accentColor} />
                    </View>
                    <View style={styles.selectionState}>
                      {selected && <Text style={[styles.selectionLabel, { color: accentColor }]}>Selected</Text>}
                      <View style={[styles.radioCircle, {
                        borderColor: selected ? BRAND_PURPLE : palette.border,
                        backgroundColor: selected ? BRAND_PURPLE : palette.surface
                      }]}>
                        {selected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.optionTitle, { color: palette.text }]}>{option.title}</Text>
                  <Text style={[styles.supportingText, { color: palette.secondaryText }]}>{option.description}</Text>
                </View>
                <View style={[styles.optionWorkflow, { borderTopColor: palette.border }]}>
                  <Ionicons name={option.type === 'imc' ? 'send-outline' : 'git-branch-outline'} size={16} color={accentColor} />
                  <Text style={[styles.workflowText, { color: accentColor }]}>{option.workflow}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.cardFooter, !isWide && styles.stacked, { borderTopColor: palette.border }]}>
          <View style={styles.footerCopy} accessibilityLiveRegion="polite">
            <Text style={[styles.selectionSummary, { color: palette.text }]}>
              Selected: {selectedOption.title}
            </Text>
            <Text style={[styles.supportingText, { color: palette.secondaryText }]}>
              Continue to enter your request details.
            </Text>
          </View>
          <Pressable nativeID="requestor-type-continue" accessibilityRole="button"
            accessibilityLabel={`Continue with ${selectedOption.title}`}
            accessibilityHint="Opens the form for your selected request type."
            onPress={() => onSelectType(selectedType)}
            onHoverIn={() => setHoveredControl('continue')} onHoverOut={() => setHoveredControl(null)}
            style={({ pressed }) => [styles.continueButton, !isWide && styles.fullWidth,
            hoveredControl === 'continue' && styles.hoveredButton, pressed && styles.pressed]}>
            <Text style={styles.continueButtonText}>Continue to form</Text>
            <Ionicons name="arrow-forward" size={18} color={GOLD_INK} />
          </Pressable>
        </View>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  pageContainer: { width: '100%', minWidth: 0, gap: Spacing.lg },
  pageHeader: { width: '100%', minWidth: 0, gap: Spacing.sm },
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm },
  breadcrumbLink: { minHeight: CONTROL_HEIGHT, justifyContent: 'center' },
  breadcrumbText: { fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.semiBold },
  pageTitle: { fontWeight: FontWeight.bold },
  supportingText: { fontSize: FontSize.sm, lineHeight: 20, flexShrink: 1 },
  mainCard: { width: '100%', minWidth: 0, borderWidth: 1, gap: Spacing.lg },
  cardHeader: { minWidth: 0, gap: Spacing.sm },
  sectionBadge: { fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.semiBold },
  questionTitle: { fontSize: FontSize.lg, lineHeight: 24, fontWeight: FontWeight.bold },
  optionsRow: { width: '100%', minWidth: 0, flexDirection: 'row', alignItems: 'stretch', gap: Spacing.md },
  stacked: { flexDirection: 'column', alignItems: 'stretch' },
  fullWidth: { width: '100%' },
  optionColumn: { flex: 1, flexBasis: 0 },
  optionCard: { minWidth: 0, borderWidth: 2, borderRadius: BorderRadius.md, padding: Spacing.md, gap: Spacing.lg, justifyContent: 'space-between' },
  optionBody: { minWidth: 0, gap: Spacing.sm },
  optionTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, marginBottom: Spacing.sm },
  iconBox: { width: CONTROL_HEIGHT, height: CONTROL_HEIGHT, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  selectionState: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  selectionLabel: { fontSize: FontSize.xs, lineHeight: 16, fontWeight: FontWeight.semiBold },
  radioCircle: { width: Spacing.lg, height: Spacing.lg, borderWidth: 2, borderRadius: BorderRadius.full, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontSize: FontSize.lg, lineHeight: 24, fontWeight: FontWeight.semiBold },
  optionWorkflow: { flexDirection: 'row', alignItems: 'center', minWidth: 0, gap: Spacing.sm, paddingTop: Spacing.md, borderTopWidth: 1 },
  workflowText: { fontSize: FontSize.sm, lineHeight: 20, fontWeight: FontWeight.medium, flexShrink: 1 },
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', minWidth: 0, gap: Spacing.md, borderTopWidth: 1, paddingTop: Spacing.lg },
  footerCopy: { flex: 1, minWidth: 0, gap: Spacing.xs },
  selectionSummary: { fontSize: FontSize.sm, lineHeight: 20, fontWeight: FontWeight.semiBold },
  continueButton: { minHeight: CONTROL_HEIGHT, borderRadius: CTA_RADIUS, backgroundColor: BRAND_GOLD, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  continueButtonText: { color: GOLD_INK, fontSize: FontSize.sm, lineHeight: 20, fontWeight: FontWeight.semiBold },
  hoveredButton: { opacity: 0.92 },
  pressed: { opacity: 0.82 },
});
