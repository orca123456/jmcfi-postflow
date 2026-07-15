import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { postsApi } from '../../../../services/api';
import { Card } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Badge } from '../../../../components/ui/Badge';
import { Colors, FontSize, FontWeight, Spacing } from '../../../../constants/theme';

export default function AiCheckScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<any>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    postsApi.get(Number(id)).then(r => setPost(r.data)).catch(() => {});
  }, [id]);

  const runAiCheck = async () => {
    setChecking(true);
    try {
      const result = await postsApi.aiCheck(Number(id));
      setAiResult(result.data);
    } catch (e: any) {
      Alert.alert('AI Check Failed', e.response?.data?.message ?? 'Could not complete AI compliance check.');
    } finally { setChecking(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Compliance Check</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {post && (
          <Card style={{ gap: Spacing.sm }}>
            <Text style={styles.postTitle}>{post.title}</Text>
            <Text style={styles.postBody} numberOfLines={3}>{post.content}</Text>
          </Card>
        )}

        {!aiResult && (
          <Button
            title={checking ? 'Running AI Check...' : 'Run AI Compliance Check'}
            onPress={runAiCheck}
            loading={checking}
            icon={!checking && <Ionicons name="shield-checkmark-outline" size={16} color="#fff" />}
          />
        )}

        {aiResult && (
          <Card style={{ gap: Spacing.md }}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>AI Analysis Result</Text>
              <Badge
                label={aiResult.is_compliant ? 'Compliant' : 'Non-Compliant'}
                variant={aiResult.is_compliant ? 'approved' : 'rejected'}
              />
            </View>

            <View style={styles.scoreRow}>
              <Text style={styles.label}>Compliance Score</Text>
              <Text style={[styles.score, { color: aiResult.compliance_score > 70 ? Colors.success : Colors.error }]}>
                {aiResult.compliance_score ?? '—'}%
              </Text>
            </View>

            {aiResult.violations?.length > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={styles.label}>VIOLATIONS FOUND</Text>
                {aiResult.violations.map((v: string, i: number) => (
                  <View key={i} style={styles.violationRow}>
                    <Ionicons name="warning-outline" size={14} color={Colors.warning} />
                    <Text style={styles.violationText}>{v}</Text>
                  </View>
                ))}
              </View>
            )}

            {aiResult.suggestions && (
              <View style={{ gap: 6 }}>
                <Text style={styles.label}>SUGGESTIONS</Text>
                <Text style={styles.suggestion}>{aiResult.suggestions}</Text>
              </View>
            )}

            <Button
              title="Re-Run Check"
              onPress={() => { setAiResult(null); }}
              variant="ghost"
            />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  headerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff' },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  postTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  postBody: { fontSize: FontSize.sm, color: Colors.textSecondary },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  score: { fontSize: FontSize.xxl, fontWeight: FontWeight.extraBold },
  label: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' },
  violationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  violationText: { fontSize: FontSize.sm, color: Colors.warning, flex: 1 },
  suggestion: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
});
