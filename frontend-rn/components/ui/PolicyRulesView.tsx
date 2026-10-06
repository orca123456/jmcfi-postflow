/**
 * PolicyRulesView — Shared read-only policy section renderer.
 * Used across all role dashboards (Requestor, Office Head, VP, IMC/QA, Publisher)
 * to display the same rich card layout as the IT Admin edit view.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { FormattedText } from './FormattedText';
import { usePolicyStore } from '../../store/policy';
import { useThemeStore } from '../../store/theme';
import { Colors } from '../../constants/theme';

interface PolicyRulesViewProps {
  /** Accent color for the header icon / section title */
  accentColor?: string;
}

export function PolicyRulesView({ accentColor = '#0B2545' }: PolicyRulesViewProps) {
  const { policySections, effectiveDate, lastUpdatedDate } = usePolicyStore();
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const [searchQuery, setSearchQuery] = useState('');
  const { width } = useWindowDimensions();
  const isLarge = width > 1024;

  const SECTION_COLORS: Record<string, { badgeBg: string; iconBg: string; iconColor: string; accent: string; iconName: any }> = {
    '1': { badgeBg: isDarkMode ? '#2563EB' : '#0B2545', iconBg: isDarkMode ? '#1E293B' : '#EFF6FF', iconColor: isDarkMode ? '#60A5FA' : '#2563EB', accent: '#2563EB', iconName: 'book-outline' },
    '2': { badgeBg: '#7C3AED', iconBg: isDarkMode ? '#2E1065' : '#F3E8FF', iconColor: isDarkMode ? '#C084FC' : '#7C3AED', accent: '#7C3AED', iconName: 'shield-checkmark-outline' },
    '3': { badgeBg: '#16A34A', iconBg: isDarkMode ? '#064E3B' : '#DCFCE7', iconColor: isDarkMode ? '#4ADE80' : '#16A34A', accent: '#16A34A', iconName: 'checkmark-circle-outline' },
    '4': { badgeBg: '#DC2626', iconBg: isDarkMode ? '#7F1D1D' : '#FEE2E2', iconColor: isDarkMode ? '#F87171' : '#DC2626', accent: '#DC2626', iconName: 'close-circle-outline' },
    '5': { badgeBg: '#D97706', iconBg: isDarkMode ? '#78350F' : '#FEF3C7', iconColor: isDarkMode ? '#FBBF24' : '#D97706', accent: '#D97706', iconName: 'copy-outline' },
    '6': { badgeBg: '#2563EB', iconBg: isDarkMode ? '#1E3A8A' : '#EFF6FF', iconColor: isDarkMode ? '#60A5FA' : '#2563EB', accent: '#2563EB', iconName: 'git-network-outline' },
    '7': { badgeBg: isDarkMode ? '#64748B' : '#4B5563', iconBg: isDarkMode ? '#1E293B' : '#F3F4F6', iconColor: isDarkMode ? '#94A3B8' : '#374151', accent: isDarkMode ? '#94A3B8' : '#4B5563', iconName: 'warning-outline' },
  };

  const sectionsList = Array.isArray(policySections) ? policySections : [];
  const filtered = sectionsList.filter((sec) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      sec.title?.toLowerCase().includes(q) ||
      sec.content?.toLowerCase().includes(q) ||
      sec.bullets?.some((b) => b.title?.toLowerCase().includes(q) || b.desc?.toLowerCase().includes(q)) ||
      (sec.steps as any)?.some((s: any) => s.title?.toLowerCase().includes(q) || s.desc?.toLowerCase().includes(q))
    );
  });

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.headerRow, { flexDirection: isLarge ? 'row' : 'column', gap: isLarge ? 0 : 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.mainTitle}>POLICY RULES</Text>
          <Text style={styles.subTitle}>
            Guidelines for publishing official school website content.
          </Text>
          <Text style={styles.dateRow}>
            Effective: {effectiveDate || '—'} • Last Updated: {lastUpdatedDate || '—'}
          </Text>
        </View>

        <View style={styles.searchBox}>
          <TextInput
            placeholder="Search policy rules..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          <Ionicons name="search" size={16} color="#6B7280" />
        </View>
      </View>

      {/* ── Sections ── */}
      {filtered.map((section, sIdx) => {
        const numMatch = section.title?.match(/^(\d+)\.\s*(.*)$/);
        const secNumber = numMatch ? numMatch[1] : `${sIdx + 1}`;
        const secCleanTitle = numMatch ? numMatch[2] : section.title;
        const colors = SECTION_COLORS[secNumber] ?? SECTION_COLORS['1'];

        const hasBullets = (section.bullets && section.bullets.length > 0) ||
          ((section as any).steps && (section as any).steps.length > 0);

        return (
          <View key={section.id || sIdx} style={styles.sectionBlock}>
            {/* Section Header */}
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.numberBadge, { backgroundColor: colors.badgeBg }]}>
                <Text style={styles.numberBadgeText}>{secNumber}</Text>
              </View>
              <Text style={styles.sectionTitleText}>{secCleanTitle}</Text>
            </View>

            {/* Section Description / Policy Statement White Card Box */}
            {section.content ? (
              <Card style={styles.statementCard}>
                <View style={[styles.cardIconSquare, { backgroundColor: colors.iconBg }]}>
                  <Ionicons name={colors.iconName} size={18} color={colors.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statementLabel}>
                    {secNumber === '1' ? 'Policy statement' : 'Guidelines & Enforcement'}
                  </Text>
                  <FormattedText style={styles.statementBody}>
                    {section.content}
                  </FormattedText>
                  {section.contact ? (
                    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                      <FormattedText style={[styles.statementBody, { fontWeight: '600', color: colors.accent }]}>
                        {section.contact}
                      </FormattedText>
                    </View>
                  ) : null}
                </View>
              </Card>
            ) : null}

            {/* Grid cards for bullets/steps */}
            {hasBullets && (
              <View style={styles.gridRow}>
                {((section.bullets || (section as any).steps) as any[])
                  .filter((b) => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return b.title?.toLowerCase().includes(q) || (b.desc || b.description)?.toLowerCase().includes(q);
                  })
                  .map((bullet: any, bIdx: number) => (
                    <Card key={bIdx} style={styles.gridCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.cardIconSquare, { backgroundColor: colors.iconBg }]}>
                          <Ionicons name={colors.iconName} size={16} color={colors.iconColor} />
                        </View>
                        <FormattedText style={styles.cardTitle}>{bullet.title}</FormattedText>
                      </View>
                      <View style={[styles.cardAccentBar, { backgroundColor: colors.accent }]} />
                      <FormattedText style={styles.cardDesc}>{bullet.desc || bullet.description}</FormattedText>
                    </Card>
                  ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 20,
  },
  headerRow: {
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  subTitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  dateRow: {
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    minWidth: 240,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
    outlineStyle: 'none',
  } as any,
  sectionBlock: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  numberBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  numberBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  sectionTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statementCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
  },
  cardIconSquare: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statementLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statementBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCard: {
    flex: 1,
    minWidth: 220,
    gap: 8,
    padding: 14,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  cardAccentBar: {
    height: 2,
    borderRadius: 2,
    marginVertical: 2,
  },
  cardDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  simpleContentBox: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  simpleContentText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
