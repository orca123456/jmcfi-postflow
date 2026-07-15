import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  SafeAreaView, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { postsApi } from '../../../services/api';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card } from '../../../components/ui/Card';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../constants/theme';

const PLATFORMS = ['Facebook', 'Instagram', 'Twitter/X', 'LinkedIn', 'YouTube'];
const CATEGORIES = ['Announcement', 'Event', 'News', 'Promotional', 'Academic', 'Administrative'];

export default function PostCreateScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [platform, setPlatform] = useState('Facebook');
  const [category, setCategory] = useState('Announcement');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async (asDraft = true) => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Missing Fields', 'Please fill in the title and content.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await postsApi.create({
        title, content, platform, category_id: 1,
        status: asDraft ? 'draft' : 'pending_approval',
      });
      if (!asDraft) {
        await postsApi.submit(response.data.id);
      }
      Alert.alert('Success', asDraft ? 'Post saved as draft!' : 'Post submitted for approval!');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'Failed to create post.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create New Post</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Input
            label="POST TITLE"
            value={title}
            onChangeText={setTitle}
            placeholder="Enter a descriptive title..."
            leftIcon="document-text-outline"
          />

          {/* Content */}
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>CONTENT</Text>
            <TextInput
              style={styles.textarea}
              value={content}
              onChangeText={setContent}
              placeholder="Write your post content here..."
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Platform */}
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>TARGET PLATFORM</Text>
            <View style={styles.chipRow}>
              {PLATFORMS.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.chip, platform === p && styles.chipActive]}
                  onPress={() => setPlatform(p)}
                >
                  <Text style={[styles.chipText, platform === p && styles.chipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Category */}
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>CATEGORY</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, category === c && styles.chipActive]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Card>

        <View style={styles.actions}>
          <Button
            title="Save as Draft"
            onPress={() => handleCreate(true)}
            variant="secondary"
            loading={isLoading}
            style={{ flex: 1 }}
          />
          <Button
            title="Submit for Approval"
            onPress={() => handleCreate(false)}
            loading={isLoading}
            style={{ flex: 1 }}
            icon={<Ionicons name="send-outline" size={16} color="#fff" />}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff' },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  label: {
    fontSize: FontSize.xs, fontWeight: '600',
    color: Colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase',
  },
  textarea: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    minHeight: 120,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: FontWeight.semiBold },
  actions: { flexDirection: 'row', gap: Spacing.sm },
});
