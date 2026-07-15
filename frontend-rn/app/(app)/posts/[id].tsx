import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { postsApi } from '../../../services/api';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { useAuthStore } from '../../../store/auth';
import { Colors, FontSize, FontWeight, Spacing } from '../../../constants/theme';

export default function PostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    postsApi.get(Number(id)).then(r => setPost(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async () => {
    try {
      await postsApi.submit(Number(id));
      Alert.alert('Success', 'Post submitted for approval!');
      setPost({ ...post, status: 'pending_approval' });
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'Failed to submit.');
    }
  };

  if (loading || !post) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading post...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{post.title}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={{ gap: Spacing.md }}>
          <View style={styles.statusRow}>
            <Badge label={post.status?.replace(/_/g, ' ')} variant={post.status} />
            <Text style={styles.meta}>{post.platform}</Text>
          </View>

          <Text style={styles.title}>{post.title}</Text>
          <Text style={styles.body}>{post.content}</Text>

          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.meta}>{post.requestor?.name ?? 'Unknown'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.meta}>{post.created_at?.split('T')[0]}</Text>
          </View>
        </Card>

        {/* Actions based on status and role */}
        {post.status === 'draft' && user?.role === 'requestor' && (
          <Button
            title="Submit for Approval"
            onPress={handleSubmit}
            icon={<Ionicons name="send-outline" size={16} color="#fff" />}
          />
        )}

        {(post.status === 'pending_approval') && (
          <Button
            title="Review & Approve"
            onPress={() => router.push(`/(app)/posts/${id}/approve` as any)}
            icon={<Ionicons name="checkmark-circle-outline" size={16} color="#fff" />}
          />
        )}

        {post.status === 'pending_imc' && (
          <Button
            title="AI Compliance Check"
            onPress={() => router.push(`/(app)/posts/${id}/ai-check` as any)}
            icon={<Ionicons name="shield-checkmark-outline" size={16} color="#fff" />}
          />
        )}

        {post.status === 'approved' && user?.role === 'it_publisher' && (
          <Button
            title="Publish Post"
            onPress={() => router.push(`/(app)/posts/${id}/publish` as any)}
            icon={<Ionicons name="cloud-upload-outline" size={16} color="#fff" />}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textMuted, fontSize: FontSize.md },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  headerTitle: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff', textAlign: 'center' },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  body: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 24 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontSize: FontSize.sm, color: Colors.textMuted },
});
