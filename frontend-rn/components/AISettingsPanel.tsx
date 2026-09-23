import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokenSettingsApi } from '../services/api';

type Settings = {
  provider: string;
  model: string;
  configured: boolean;
  verified_at: string | null;
  providers: { id: string; name: string }[];
};

const PROVIDER_META: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  deepseek: { icon: 'flash-outline', color: '#5B8EF0' },
  openai:   { icon: 'sparkles-outline', color: '#10A37F' },
  anthropic: { icon: 'color-wand-outline', color: '#D97706' },
  default:  { icon: 'hardware-chip-outline', color: '#8B5CF6' },
};

function getProviderMeta(id: string) {
  return PROVIDER_META[id] ?? PROVIDER_META.default;
}

export function AISettingsPanel() {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [provider, setProvider] = useState('deepseek');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [menu, setMenu] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [focused, setFocused] = useState('');

  const accept = (settings: Settings) => {
    setSaved(settings);
    setProvider(settings.provider);
    setModel(settings.model);
    setApiKey('');
    setShowKey(false);
    setConfirmClear(false);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      accept((await tokenSettingsApi.getAI()).data);
    } catch {
      setError('Unable to load AI settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (clear = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = clear
        ? await tokenSettingsApi.clearAI()
        : await tokenSettingsApi.updateAI({ provider, model: model.trim(), api_key: apiKey.trim() || undefined });
      accept(response.data);
      setMessage(clear ? 'AI credentials cleared. AI is disabled.' : 'Connection tested and settings saved.');
    } catch (e: any) {
      const errors = e.response?.data?.errors;
      setError(
        errors
          ? Object.values(errors).flat().join(' ')
          : e.response?.data?.message || 'Unable to update AI settings. Please retry.'
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const edited = () => { setError(''); setMessage(''); };

  const providerName = saved?.providers.find(p => p.id === provider)?.name ?? provider;
  const savedName    = saved?.providers.find(p => p.id === saved.provider)?.name ?? saved?.provider;
  const canKeepKey   = saved?.configured && saved.provider === provider;
  const canSave      = !!saved && !!model.trim() && (!!apiKey.trim() || canKeepKey) && !busy;
  const dirty        = !!saved && (provider !== saved.provider || model.trim() !== saved.model || !!apiKey.trim());
  const connected    = !!saved?.configured && !!saved.verified_at;
  const meta         = getProviderMeta(provider);
  const status       = loading ? 'Loading…'
    : !saved    ? 'Unavailable'
    : connected ? 'Connected'
    : saved.configured ? 'Not Verified'
    : 'Not Connected';

  return (
    <View testID="ai-settings-panel" style={styles.card}>

      {/* ── Card Header ──────────────────────────────────────────────── */}
      <View style={styles.cardHeader}>
        <View style={[styles.providerIconBox, { backgroundColor: meta.color + '20' }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.cardTitle}>AI Provider</Text>
          {saved && (
            <Text style={styles.cardSub} numberOfLines={1}>
              {savedName}{saved.model ? ` · ${saved.model}` : ''}
            </Text>
          )}
        </View>

        {/* Status pill */}
        <View style={[styles.pill, connected ? styles.pillGreen : styles.pillGray]}>
          <View style={[styles.pillDot, connected ? styles.pillDotGreen : styles.pillDotGray]} />
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.pillText, connected ? styles.pillTextGreen : styles.pillTextGray]}
          >
            {status}
          </Text>
        </View>
      </View>

      {/* ── Divider ──────────────────────────────────────────────────── */}
      <View style={styles.divider} />

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <View style={styles.body}>
        {/* Loading skeleton */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#7C3AED" accessibilityLabel="Loading AI settings" />
            <Text style={styles.loadingLabel}>Loading settings…</Text>
          </View>

        /* Fetch error / retry */
        ) : !saved ? (
          <View style={styles.retryWrap}>
            <View style={styles.retryCircle}>
              <Ionicons name="cloud-offline-outline" size={26} color="#94A3B8" />
            </View>
            <Text accessibilityRole="alert" style={styles.feedbackError}>{error}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Retry loading AI settings"
              style={styles.retryBtn}
              onPress={load}
            >
              <Ionicons name="refresh-outline" size={15} color="#7C3AED" />
              <Text style={styles.retryBtnLabel}>Retry</Text>
            </TouchableOpacity>
          </View>

        /* Main form */
        ) : (
          <>
            {/* Fields */}
            <View style={styles.fields}>

              {/* Provider picker */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Provider</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Select AI provider"
                  accessibilityState={{ expanded: menu, disabled: busy }}
                  disabled={busy}
                  onPress={() => setMenu(true)}
                  style={[styles.inputRow, styles.selectRow, busy && styles.inputDisabled]}
                >
                  <View style={[styles.providerDot, { backgroundColor: meta.color }]} />
                  <Text style={styles.inputRowText} numberOfLines={1}>{providerName}</Text>
                  <Ionicons name="chevron-down" size={15} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Model ID */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Model ID</Text>
                <View style={[styles.inputRow, focused === 'model' && styles.inputFocused]}>
                  <TextInput
                    accessibilityLabel="AI model ID"
                    style={styles.textInput}
                    value={model}
                    onChangeText={v => { setModel(v); edited(); }}
                    onFocus={() => setFocused('model')}
                    onBlur={() => setFocused('')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!busy}
                    maxLength={200}
                    placeholderTextColor="#CBD5E1"
                    placeholder="e.g. deepseek-chat"
                  />
                </View>
              </View>

              {/* API Key */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>API Key</Text>
                <View style={[styles.inputRow, focused === 'key' && styles.inputFocused]}>
                  <TextInput
                    accessibilityLabel="AI API key"
                    style={[styles.textInput, { flex: 1 }]}
                    value={apiKey}
                    onChangeText={v => { setApiKey(v); edited(); }}
                    onFocus={() => setFocused('key')}
                    onBlur={() => setFocused('')}
                    secureTextEntry={!showKey}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!busy}
                    maxLength={2048}
                    placeholderTextColor="#CBD5E1"
                    placeholder={canKeepKey ? '••••••  Saved key (unchanged)' : 'Enter your API key'}
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={showKey ? 'Hide API key' : 'Show API key'}
                    {...(Platform.OS === 'web' ? { title: showKey ? 'Hide API key' : 'Show API key' } : {})}
                    disabled={busy}
                    onPress={() => setShowKey(v => !v)}
                    style={styles.eyeBtn}
                  >
                    <Ionicons name={showKey ? 'eye-off-outline' : 'eye-outline'} size={17} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
                {canKeepKey && !apiKey && (
                  <Text style={styles.hintText}>Leave blank to keep the saved key.</Text>
                )}
              </View>
            </View>

            {/* Feedback banners */}
            {!!error && (
              <View style={styles.bannerError}>
                <Ionicons name="alert-circle-outline" size={15} color="#DC2626" />
                <Text accessibilityRole="alert" style={styles.feedbackError}>{error}</Text>
              </View>
            )}
            {!!message && (
              <View style={styles.bannerSuccess}>
                <Ionicons name="checkmark-circle-outline" size={15} color="#059669" />
                <Text accessibilityLiveRegion="polite" style={styles.feedbackSuccess}>{message}</Text>
              </View>
            )}

            {/* Footer */}
            <View style={styles.footer}>
              {dirty && !message
                ? <Text style={styles.unsavedLabel}>Unsaved changes</Text>
                : <View />
              }
              <View style={styles.actionRow}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Clear AI credentials"
                  disabled={busy || !saved.configured}
                  onPress={() => setConfirmClear(true)}
                  style={[styles.btnOutline, (busy || !saved.configured) && styles.btnDisabled]}
                >
                  <Ionicons name="trash-outline" size={14} color="#64748B" />
                  <Text style={styles.btnOutlineText}>Clear</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Save Changes"
                  disabled={!canSave}
                  onPress={() => save()}
                  style={[styles.btnPrimary, !canSave && styles.btnDisabled]}
                >
                  {busy
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <Ionicons name="shield-checkmark-outline" size={14} color="#FFFFFF" />
                  }
                  <Text style={styles.btnPrimaryText}>{busy ? 'Verifying…' : 'Save & Verify'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>

      {/* ── Provider Picker Modal ─────────────────────────────────────── */}
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Provider</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close provider menu"
                style={styles.sheetClose}
                onPress={() => setMenu(false)}
              >
                <Ionicons name="close" size={19} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {saved?.providers.map(opt => {
                const m = getProviderMeta(opt.id);
                const sel = provider === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    accessibilityLabel={opt.name}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sel }}
                    style={[styles.optionRow, sel && styles.optionRowActive]}
                    onPress={() => {
                      if (opt.id !== provider) {
                        setProvider(opt.id);
                        setApiKey('');
                        setShowKey(false);
                        setModel(opt.id === saved.provider ? saved.model : '');
                        edited();
                        setConfirmClear(false);
                      }
                      setMenu(false);
                    }}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: m.color + '20' }]}>
                      <Ionicons name={m.icon} size={17} color={m.color} />
                    </View>
                    <Text style={[styles.optionLabel, sel && styles.optionLabelActive]}>{opt.name}</Text>
                    {sel && <Ionicons name="checkmark-circle" size={18} color="#7C3AED" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Confirm Clear Modal ───────────────────────────────────────── */}
      <Modal
        visible={confirmClear}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!busy) setConfirmClear(false); }}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.dangerCircle}>
              <Ionicons name="warning-outline" size={24} color="#DC2626" />
            </View>
            <Text style={styles.sheetTitle}>Clear AI Credentials?</Text>
            <Text style={styles.sheetBody}>
              Policy checks and the chatbot will be unavailable until new credentials are saved.
            </Text>
            {!!error && (
              <View style={styles.bannerError}>
                <Ionicons name="alert-circle-outline" size={15} color="#DC2626" />
                <Text accessibilityRole="alert" style={styles.feedbackError}>{error}</Text>
              </View>
            )}
            <View style={styles.confirmActions}>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={busy}
                style={[styles.btnOutline, { flex: 1 }]}
                onPress={() => setConfirmClear(false)}
              >
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Confirm clear"
                disabled={busy}
                style={[styles.btnDanger, { flex: 1 }, busy && styles.btnDisabled]}
                onPress={() => save(true)}
              >
                {busy
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                }
                <Text style={styles.btnPrimaryText}>{busy ? 'Clearing…' : 'Yes, Clear'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  /* ── Card shell ─────────────────────────────────────────────────────── */
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' } as any) : {}),
  },

  /* ── Header ─────────────────────────────────────────────────────────── */
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FAFAFA',
  },
  providerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerInfo: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', lineHeight: 20 },
  cardSub:   { fontSize: 12, color: '#64748B', lineHeight: 17, marginTop: 1 },

  /* Status pill */
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    flexShrink: 0,
  },
  pillGreen: { backgroundColor: '#DCFCE7' },
  pillGray:  { backgroundColor: '#F1F5F9' },
  pillDot:   { width: 6, height: 6, borderRadius: 3 },
  pillDotGreen: { backgroundColor: '#22C55E' },
  pillDotGray:  { backgroundColor: '#94A3B8' },
  pillText:  { fontSize: 11, fontWeight: '700' },
  pillTextGreen: { color: '#15803D' },
  pillTextGray:  { color: '#64748B' },

  divider: { height: 1, backgroundColor: '#F1F5F9' },

  /* ── Body ───────────────────────────────────────────────────────────── */
  body: { padding: 20, gap: 16 },

  /* Loading */
  loadingWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 10 },
  loadingLabel: { fontSize: 13, color: '#94A3B8' },

  /* Retry */
  retryWrap:   { alignItems: 'center', gap: 12, paddingVertical: 22 },
  retryCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  retryBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#DDD6FE', backgroundColor: '#F5F3FF' },
  retryBtnLabel: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },

  /* Fields */
  fields:     { gap: 14 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#374151', letterSpacing: 0.2 },

  inputRow: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  inputFocused: {
    borderColor: '#7C3AED',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 0 0 3px rgba(124,58,237,0.1)' } as any) : {}),
  },
  inputDisabled: { opacity: 0.5, backgroundColor: '#F8FAFC' },
  selectRow: { paddingHorizontal: 12, gap: 8 },
  providerDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  inputRowText: { flex: 1, fontSize: 13, color: '#0F172A' },
  textInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
    ...(Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : {}),
  },
  eyeBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  hintText: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  /* Feedback banners */
  bannerError: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9,
  },
  bannerSuccess: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9,
  },
  feedbackError:   { fontSize: 13, color: '#DC2626', lineHeight: 19, flex: 1 },
  feedbackSuccess: { fontSize: 13, color: '#059669', lineHeight: 19, flex: 1 },

  /* Footer */
  footer: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, paddingTop: 2,
  },
  unsavedLabel: { fontSize: 12, color: '#F59E0B', fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },

  /* Buttons */
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9,
    backgroundColor: '#7C3AED', minHeight: 42, minWidth: 138, justifyContent: 'center',
  },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9,
    borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF',
    minHeight: 42, justifyContent: 'center',
  },
  btnDanger: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9,
    backgroundColor: '#DC2626', minHeight: 42, justifyContent: 'center',
  },
  btnDisabled:    { opacity: 0.4 },
  btnPrimaryText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  btnOutlineText: { fontSize: 13, fontWeight: '600', color: '#475569' },

  /* Modals */
  overlay: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  sheet: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 22,
    width: '100%', maxWidth: 400, maxHeight: '80%', gap: 14,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 32px rgba(0,0,0,0.18)' } as any) : {}),
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetTitle:  { flex: 1, fontSize: 16, fontWeight: '700', color: '#0F172A' },
  sheetBody:   { fontSize: 13, color: '#64748B', lineHeight: 20 },
  sheetClose: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',
  },

  /* Option rows */
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, paddingHorizontal: 10,
    borderRadius: 9, borderWidth: 1, borderColor: 'transparent', marginBottom: 4,
  },
  optionRowActive:  { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
  optionIcon:       { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  optionLabel:      { flex: 1, fontSize: 14, color: '#374151', fontWeight: '500' },
  optionLabelActive: { color: '#7C3AED', fontWeight: '700' },

  /* Confirm clear */
  dangerCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  confirmActions: { flexDirection: 'row', gap: 10, paddingTop: 4 },
});
