import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokenSettingsApi } from '../services/api';

type Settings = {
  provider: string;
  model: string;
  configured: boolean;
  verified_at: string | null;
  providers: { id: string; name: string }[];
};

export function AISettingsPanel() {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [provider, setProvider] = useState('deepseek');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const accept = (settings: Settings) => {
    setSaved(settings);
    setProvider(settings.provider);
    setModel(settings.model);
    setApiKey('');
    setConfirmClear(false);
  };
  const load = async () => {
    setLoading(true);
    setError('');
    try { accept((await tokenSettingsApi.getAI()).data); }
    catch { setError('Unable to load AI settings.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async (clear = false) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = clear ? await tokenSettingsApi.clearAI()
        : await tokenSettingsApi.updateAI({ provider, model: model.trim(), api_key: apiKey.trim() || undefined });
      accept(response.data);
      setMessage(clear ? 'AI credentials cleared. AI is disabled.' : 'Connection tested and settings saved.');
    } catch (e: any) {
      const errors = e.response?.data?.errors;
      setError(errors ? Object.values(errors).flat().join(' ') : (e.response?.data?.message || 'Unable to update AI settings. Please retry.'));
    } finally { setBusy(false); }
  };

  const providerName = saved?.providers.find(p => p.id === provider)?.name || provider;
  const canKeepKey = saved?.configured && saved.provider === provider;
  const canSave = !!saved && !!model.trim() && (!!apiKey.trim() || canKeepKey) && !busy;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Ionicons name="hardware-chip-outline" size={24} color="#17634A" />
        <Text style={styles.title}>AI Provider</Text>
      </View>
      {loading ? <ActivityIndicator accessibilityLabel="Loading AI settings" /> : saved ? (
        <>
          <Text style={styles.status}>
            {saved.configured ? `${saved.providers.find(p => p.id === saved.provider)?.name}: ${saved.model}` : 'AI disabled'}
            {saved.configured ? (saved.verified_at ? ' - Connection verified' : ' - Not yet tested') : ''}
          </Text>
          <View style={styles.fields}>
            <View style={styles.field}>
              <Text style={styles.label}>Provider</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Select AI provider" disabled={busy}
                onPress={() => setMenu(true)} style={styles.input}>
                <Text style={styles.value}>{providerName}</Text>
                <Ionicons name="chevron-down" size={18} color="#475569" />
              </TouchableOpacity>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Model ID</Text>
              <TextInput accessibilityLabel="AI model ID" style={styles.input} value={model} onChangeText={setModel}
                autoCapitalize="none" autoCorrect={false} editable={!busy} placeholder="Model ID from your provider" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>API Key</Text>
              <TextInput accessibilityLabel="AI API key" style={styles.input} value={apiKey} onChangeText={setApiKey}
                secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy}
                placeholder={canKeepKey ? 'Saved key retained unless replaced' : 'Enter provider API key'} />
            </View>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Test & Save" disabled={!canSave} onPress={() => save()}
              style={[styles.button, styles.primary, !canSave && styles.disabled]}>
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
              <Text style={styles.primaryText}>{busy ? 'Please wait...' : 'Test & Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear credentials" disabled={busy || !saved.configured} onPress={() => setConfirmClear(true)}
              style={[styles.button, (busy || !saved.configured) && styles.disabled]}>
              <Ionicons name="trash-outline" size={18} color="#9F1239" /><Text style={styles.clearText}>Clear credentials</Text>
            </TouchableOpacity>
          </View>
          {confirmClear && (
            <View style={styles.confirm}>
              <Text>Disable policy checks and the chatbot until new credentials are saved?</Text>
              <View style={styles.actions}>
                <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => save(true)}><Text style={styles.clearText}>Confirm clear</Text></TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => setConfirmClear(false)}><Text>Cancel</Text></TouchableOpacity>
              </View>
            </View>
          )}
        </>
      ) : <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={load}><Ionicons name="refresh-outline" size={18} /><Text>Retry</Text></TouchableOpacity>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text>}
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <View style={styles.overlay}>
          <View style={styles.menu}>
            <View style={styles.heading}><Text style={styles.title}>AI Provider</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close provider menu" onPress={() => setMenu(false)}><Ionicons name="close" size={24} /></TouchableOpacity>
            </View>
            <ScrollView>
              {saved?.providers.map(option => (
                <TouchableOpacity key={option.id} accessibilityLabel={option.name} accessibilityRole="radio" accessibilityState={{ checked: provider === option.id }}
                  style={styles.option} onPress={() => {
                    if (option.id !== provider) {
                      setProvider(option.id); setApiKey(''); setModel(option.id === saved.provider ? saved.model : '');
                      setError(''); setMessage(''); setConfirmClear(false);
                    }
                    setMenu(false);
                  }}>
                  <Text>{option.name}</Text>
                  <Ionicons name={provider === option.id ? 'radio-button-on' : 'radio-button-off'} size={20} color="#17634A" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: '#DCE2E5', gap: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700', flex: 1, color: '#20272D' },
  status: { fontSize: 14, color: '#475569', flexShrink: 1 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  field: { flexGrow: 1, flexBasis: 240, minWidth: 0, gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#AAB4BE', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF', fontSize: 14, flexDirection: 'row', alignItems: 'center', gap: 8, color: '#20272D' },
  value: { flex: 1, flexShrink: 1, fontSize: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  button: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: '#CAD2D8', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#17634A', borderColor: '#17634A' },
  primaryText: { color: '#FFFFFF', fontWeight: '600' },
  clearText: { color: '#9F1239' },
  disabled: { opacity: 0.45 },
  error: { color: '#B42318', fontSize: 14 },
  success: { color: '#17634A', fontSize: 14 },
  confirm: { gap: 12, paddingVertical: 12 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000066', padding: 24 },
  menu: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 20, width: '100%', maxWidth: 420, maxHeight: '85%', gap: 16 },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EDF0F2' },
});
