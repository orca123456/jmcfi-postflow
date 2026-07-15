import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { postsApi, publishingApi } from '../../../../services/api';
import { Card } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Colors, FontSize, FontWeight, Spacing } from '../../../../constants/theme';

const PLATFORMS = ['Facebook', 'Instagram', 'Twitter/X', 'LinkedIn', 'YouTube'];

export default function PublishScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<any>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['Facebook']);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    postsApi.get(Number(id)).then(r => setPost(r.data)).catch(() => {});
  }, [id]);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handlePublish = async () => {
    if (selectedPlatforms.length === 0) {
      Alert.alert('Select Platform', 'Please select at least one platform.');
      return;
    }
    setLoading(true);
    try {
      await publishingApi.publish(Number(id));
      Alert.alert('Published!', `Post successfully published to ${selectedPlatforms.join(', ')}!`);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'Publishing failed.');
    } finally { setLoading(false); }
  };

  const handleSchedule = async () => {
    setLoading(true);
    try {
      await publishingApi.schedule(Number(id), {
        platforms: selectedPlatforms,
        scheduled_at: new Date(Date.now() + 3600000).toISOString(),
      });
      Alert.alert('Scheduled!', 'Post scheduled for publishing in 1 hour.');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'Scheduling failed.');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Publish Post</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {post && (
          <Card style={{ gap: Spacing.sm }}>
            <Text style={styles.postTitle}>{post.title}</Text>
            <Text style={styles.postBody} numberOfLines={3}>{post.content}</Text>
          </Card>
        )}

        <Card style={{ gap: Spacing.md }}>
          <Text style={styles.label}>SELECT TARGET PLATFORMS</Text>
          <View style={styles.chipRow}>
            {PLATFORMS.map(p => {
              const active = selectedPlatforms.includes(p);
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => togglePlatform(p)}
                >
                  <Ionicons
                    name={active ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={active ? '#fff' : Colors.textSecondary}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{p}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <View style={styles.actions}>
          <Button
            title="Schedule"
            onPress={handleSchedule}
            loading={loading}
            variant="secondary"
            style={{ flex: 1 }}
            icon={<Ionicons name="calendar-outline" size={16} color={Colors.textPrimary} />}
          />
          <Button
            title="Publish Now"
            onPress={handlePublish}
            loading={loading}
            style={{ flex: 1, backgroundColor: Colors.success }}
            icon={<Ionicons name="cloud-upload-outline" size={16} color="#fff" />}
          />
        </View>
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
  label: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: FontWeight.semiBold },
  actions: { flexDirection: 'row', gap: Spacing.sm },
});
