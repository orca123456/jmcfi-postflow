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

interface PolicyRulesViewProps {
  /** Accent color for the header icon / section title */
  accentColor?: string;
}

export function PolicyRulesView({ accentColor = '#0B2545' }: PolicyRulesViewProps) {
  const { policySections, effectiveDate, lastUpdatedDate } = usePolicyStore();
  const [searchQuery, setSearchQuery] = useState('');
  const { width } = useWindowDimensions();
  const isLarge = width > 1024;

  const SECTION_COLORS: Record<string, { badgeBg: string; iconBg: string; iconColor: string; accent: string; iconName: any }> = {
    '1': { badgeBg: '#0B2545', iconBg: '#EFF6FF', iconColor: '#2563EB', accent: '#2563EB', iconName: 'book-outline' },
    '2': { badgeBg: '#7C3AED', iconBg: '#F3E8FF', iconColor: '#7C3AED', accent: '#7C3AED', iconName: 'shield-checkmark-outline' },
    '3': { badgeBg: '#16A34A', iconBg: '#DCFCE7', iconColor: '#16A34A', accent: '#16A34A', iconName: 'checkmark-circle-outline' },
    '4': { badgeBg: '#DC2626', iconBg: '#FEE2E2', iconColor: '#DC2626', accent: '#DC2626', iconName: 'close-circle-outline' },
    '5': { badgeBg: '#0B2545', iconBg: '#FEF3C7', iconColor: '#D97706', accent: '#D97706', iconName: 'copy-outline' },
  };

  const filtered = policySections.filter((sec) => {
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

            {/* Section 1: Policy Statement card */}
            {secNumber === '1' ? (
              <Card style={styles.statementCard}>
                <View style={[styles.cardIconSquare, { backgroundColor: colors.iconBg }]}>
                  <Ionicons name={colors.iconName} size={18} color={colors.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statementLabel}>Policy statement</Text>
                  <FormattedText style={styles.statementBody}>
                    {section.content || ''}
                  </FormattedText>
                </View>
              </Card>
            ) : hasBullets ? (
              /* Grid cards for bullets/steps */
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
            ) : (
              /* Simple content box */
              <View style={styles.simpleContentBox}>
                <FormattedText style={styles.simpleContentText}>
                  {section.content || ''}
                </FormattedText>
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
    color: '#111827',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  subTitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  dateRow: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    minWidth: 240,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
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
  },
  numberBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  sectionTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
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
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statementBody: {
    fontSize: 13,
    color: '#374151',
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
    color: '#111827',
    flex: 1,
  },
  cardAccentBar: {
    height: 2,
    borderRadius: 2,
    marginVertical: 2,
  },
  cardDesc: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  simpleContentBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  simpleContentText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
});
