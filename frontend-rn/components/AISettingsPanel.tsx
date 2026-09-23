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
  useWindowDimensions,
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
  deepseek:  { icon: 'flash', color: '#0284C7' },
  openai:    { icon: 'sparkles', color: '#10A37F' },
  anthropic: { icon: 'color-wand', color: '#D97706' },
  default:   { icon: 'hardware-chip', color: '#7C3AED' },
};

function getProviderMeta(id: string) {
  return PROVIDER_META[id] ?? PROVIDER_META.default;
}

export function AISettingsPanel() {
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 768;

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
    <View testID="ai-settings-panel" style={[styles.card, !isWide && styles.cardMobile]}>
      {/* ── Left Intro Panel ────────────────────────────────────────────── */}
      <View testID="ai-settings-intro" style={[styles.introPanel, !isWide && styles.introPanelMobile]}>
        <View style={styles.introTop}>
          <View style={styles.titleRow}>
            <View style={[styles.iconBox, { backgroundColor: meta.color }]}>
              <Ionicons name={meta.icon} size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.cardTitle}>AI Provider</Text>
          </View>
          <Text style={styles.cardDesc}>
            Configure your AI model for automatic policy checks and assistant responses.
          </Text>
        </View>

        {/* Status Badge */}
        <View style={[styles.statusBadge, connected ? styles.badgeConnected : styles.badgeNotConnected]}>
          <View style={[styles.badgeDot, connected ? styles.dotConnected : styles.dotNotConnected]} />
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.badgeText, connected ? styles.badgeTextConnected : styles.badgeTextNotConnected]}
          >
            {status}
          </Text>
        </View>
      </View>

      {/* ── Vertical / Horizontal Divider Line ──────────────────────────── */}
      <View style={isWide ? styles.verticalDivider : styles.horizontalDivider} />

      {/* ── Right Form Panel ────────────────────────────────────────────── */}
      <View style={styles.formPanel}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#7C3AED" accessibilityLabel="Loading AI settings" />
            <Text style={styles.loadingLabel}>Loading settings…</Text>
          </View>
        ) : !saved ? (
          <View style={styles.retryWrap}>
            <View style={styles.retryCircle}>
              <Ionicons name="cloud-offline-outline" size={26} color="#94A3B8" />
            </View>
            <Text accessibilityRole="alert" style={styles.feedbackError}>{error}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Retry"
              style={styles.retryBtn}
              onPress={load}
            >
              <Ionicons name="refresh-outline" size={15} color="#7C3AED" />
              <Text style={styles.retryBtnLabel}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Fields Row */}
            <View style={[styles.fieldsRow, !isWide && styles.fieldsRowMobile]}>
              {/* Field 1: Provider */}
              <View style={styles.fieldCol}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>Provider</Text>
                  <Ionicons name="information-circle-outline" size={14} color="#94A3B8" />
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Select AI provider"
                  accessibilityState={{ expanded: menu, disabled: busy }}
                  disabled={busy}
                  onPress={() => setMenu(true)}
                  style={[styles.inputBox, styles.selectBox, busy && styles.inputDisabled]}
                >
                  <Text style={styles.inputText} numberOfLines={1}>{providerName}</Text>
                  <Ionicons name="chevron-down" size={15} color="#94A3B8" />
                </TouchableOpacity>
                <Text style={styles.fieldHint}>Select AI model provider</Text>
              </View>

              {/* Field 2: Model ID */}
              <View style={styles.fieldCol}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>Model ID</Text>
                  <Ionicons name="information-circle-outline" size={14} color="#94A3B8" />
                </View>
                <View style={[styles.inputBox, focused === 'model' && styles.inputFocused, busy && styles.inputDisabled]}>
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
                    placeholderTextColor="#94A3B8"
                    placeholder="e.g. deepseek-chat"
                  />
                </View>
                <Text style={styles.fieldHint}>Enter AI model identifier</Text>
              </View>

              {/* Field 3: API Key */}
              <View style={styles.fieldCol}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>API Key</Text>
                  <Ionicons name="information-circle-outline" size={14} color="#94A3B8" />
                </View>
                <View style={[styles.inputBox, focused === 'key' && styles.inputFocused, busy && styles.inputDisabled]}>
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
                    placeholderTextColor="#94A3B8"
                    placeholder={canKeepKey ? '•••••• Saved key (unchanged)' : 'Enter API Key (Optional)'}
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
                <Text style={styles.fieldHint}>
                  {canKeepKey && !apiKey ? 'Leave blank to keep saved key' : 'Enter provider API key'}
                </Text>
              </View>
            </View>

            {/* Feedback Banners */}
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

            {/* Bottom Actions Row */}
            <View style={styles.actionRow}>
              {dirty && !message ? (
                <Text style={styles.unsavedLabel}>Unsaved changes</Text>
              ) : (
                <View />
              )}
              <View style={styles.actionGroup}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Clear credentials"
                  disabled={busy || !saved.configured}
                  onPress={() => setConfirmClear(true)}
                  style={[styles.btnClear, (busy || !saved.configured) && styles.btnDisabled]}
                >
                  <Text style={styles.btnClearText}>Clear</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Save Changes"
                  disabled={!canSave}
                  onPress={() => save()}
                  style={[styles.btnSave, !canSave && styles.btnDisabled]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                  )}
                  <Text style={styles.btnSaveText}>{busy ? 'Saving…' : 'Save Changes'}</Text>
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
                    <View style={[styles.optionIcon, { backgroundColor: m.color }]}>
                      <Ionicons name={m.icon} size={17} color="#FFFFFF" />
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
                accessibilityLabel="Cancel"
                disabled={busy}
                style={[styles.btnClear, { flex: 1 }]}
                onPress={() => setConfirmClear(false)}
              >
                <Text style={styles.btnClearText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Confirm clear"
                disabled={busy}
                style={[styles.btnDanger, { flex: 1 }, busy && styles.btnDisabled]}
                onPress={() => save(true)}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                )}
                <Text style={styles.btnSaveText}>{busy ? 'Clearing…' : 'Yes, Clear'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Outer Card Container */
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' } as any) : {}),
  },
  cardMobile: {
    flexDirection: 'column',
  },

  /* Left Panel */
  introPanel: {
    width: 250,
    padding: 24,
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  introPanelMobile: {
    width: '100%',
    padding: 20,
  },
  introTop: {
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },

  /* Status Badge */
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 20,
  },
  badgeConnected: {
    backgroundColor: '#DCFCE7',
  },
  badgeNotConnected: {
    backgroundColor: '#FEF3C7',
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotConnected: {
    backgroundColor: '#16A34A',
  },
  dotNotConnected: {
    backgroundColor: '#D97706',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextConnected: {
    color: '#15803D',
  },
  badgeTextNotConnected: {
    color: '#B45309',
  },

  /* Dividers */
  verticalDivider: {
    width: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  horizontalDivider: {
    height: 1,
    width: '100%',
    backgroundColor: '#F1F5F9',
  },

  /* Right Form Panel */
  formPanel: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
    gap: 16,
  },

  /* Loading & Retry */
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  loadingLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  retryWrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  retryCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: '#F5F3FF',
  },
  retryBtnLabel: {
    fontSize: 13,
    color: '#7C3AED',
    fontWeight: '600',
  },

  /* Form Fields */
  fieldsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  fieldsRowMobile: {
    flexDirection: 'column',
    gap: 14,
  },
  fieldCol: {
    flex: 1,
    minWidth: 0,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  inputBox: {
    height: 42,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  selectBox: {
    justifyContent: 'space-between',
  },
  inputFocused: {
    borderColor: '#7C3AED',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 0 0 3px rgba(124,58,237,0.1)' } as any) : {}),
  },
  inputDisabled: {
    opacity: 0.5,
    backgroundColor: '#F8FAFC',
  },
  inputText: {
    fontSize: 13,
    color: '#0F172A',
    flex: 1,
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontSize: 13,
    color: '#0F172A',
    ...(Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : {}),
  },
  eyeBtn: {
    paddingLeft: 8,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 5,
  },

  /* Feedback Banners */
  bannerError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bannerSuccess: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  feedbackError: {
    fontSize: 13,
    color: '#DC2626',
    lineHeight: 19,
    flex: 1,
  },
  feedbackSuccess: {
    fontSize: 13,
    color: '#059669',
    lineHeight: 19,
    flex: 1,
  },

  /* Action Buttons Row */
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  unsavedLabel: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '600',
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 'auto',
  },
  btnClear: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnClearText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  btnSave: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#6D28D9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    justifyContent: 'center',
  },
  btnSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDanger: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },

  /* Modals */
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    gap: 14,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 32px rgba(0,0,0,0.18)' } as any) : {}),
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  sheetBody: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Option Rows */
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 4,
  },
  optionRowActive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  optionLabelActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },

  /* Confirm Clear */
  dangerCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
  },
});

