import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { postsApi } from '../../../../services/api';
import { Card } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../../constants/theme';

export default function ApprovalScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    postsApi.get(Number(id)).then(r => setPost(r.data)).catch(() => {});
  }, [id]);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await postsApi.approve(Number(id), { notes });
      Alert.alert('Approved!', 'Post has been approved and sent to the next stage.');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'Approval failed.');
    } finally { setLoading(false); }
  };

  const handleReject = async () => {
    if (!notes.trim()) {
      Alert.alert('Notes Required', 'Please provide a reason for rejection.');
      return;
    }
    setLoading(true);
    try {
      await postsApi.reject(Number(id), { notes });
      Alert.alert('Rejected', 'Post has been rejected.');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'Rejection failed.');
    } finally { setLoading(false); }
  };

  const handleReturnRevision = async () => {
    setLoading(true);
    try {
      await postsApi.returnRevision(Number(id), { notes });
      Alert.alert('Returned', 'Post returned to requestor for revision.');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'Failed to return.');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Post</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {post && (
          <Card style={{ gap: Spacing.sm }}>
            <Text style={styles.postTitle}>{post.title}</Text>
            <Text style={styles.postBody}>{post.content}</Text>
            <Text style={styles.postMeta}>Platform: {post.platform}</Text>
            <Text style={styles.postMeta}>By: {post.requestor?.name}</Text>
          </Card>
        )}

        <Card style={{ gap: Spacing.sm }}>
          <Text style={styles.label}>REVIEW NOTES</Text>
          <TextInput
            style={styles.textarea}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes for approval or rejection..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholderTextColor={Colors.textMuted}
          />
        </Card>

        <View style={styles.actions}>
          <Button
            title="Approve"
            onPress={handleApprove}
            loading={loading}
            style={{ flex: 1, backgroundColor: Colors.success }}
            icon={<Ionicons name="checkmark-circle-outline" size={16} color="#fff" />}
          />
          <Button
            title="Return"
            onPress={handleReturnRevision}
            loading={loading}
            variant="secondary"
            style={{ flex: 1 }}
            icon={<Ionicons name="return-down-back-outline" size={16} color={Colors.textPrimary} />}
          />
        </View>
        <Button
          title="Reject Post"
          onPress={handleReject}
          loading={loading}
          variant="danger"
          icon={<Ionicons name="close-circle-outline" size={16} color="#fff" />}
        />
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
  postTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  postBody: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22 },
  postMeta: { fontSize: FontSize.sm, color: Colors.textMuted },
  label: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' },
  textarea: {
    backgroundColor: Colors.surfaceSecondary, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, minHeight: 100,
    fontSize: FontSize.md, color: Colors.textPrimary,
  },
  actions: { flexDirection: 'row', gap: Spacing.sm },
});
