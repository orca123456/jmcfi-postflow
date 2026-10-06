import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../../store/auth';
import { Colors } from '../../../constants/theme';

export default function AdminPostRedirectScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isInitialized } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) return;

    const targetPostId = id || '';
    const destinationPath = `/admin/posts/${targetPostId}`;

    if (!user) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('postflow_intended_url', destinationPath);
          sessionStorage.setItem('postflow_target_post_id', targetPostId);
          localStorage.setItem('postflow_intended_url', destinationPath);
          localStorage.setItem('postflow_target_post_id', targetPostId);
        } catch (e) {}
      }
      router.replace('/(auth)/login');
      return;
    }

    const query = targetPostId ? `?postId=${targetPostId}` : '';
    router.replace(`/dashboard/it-admin${query}` as any);
  }, [id, user, isInitialized, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>Opening admin post #{id}...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  text: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
  },
});
