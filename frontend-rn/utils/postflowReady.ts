import { Platform } from 'react-native';

/**
 * Signals to the HTML loading shell (injected into index.html) that
 * the React app has real content ready to show. The shell listens for
 * the 'postflow-ready' event and fades out cleanly.
 *
 * Call this once per dashboard when isInitialLoading transitions to false.
 * It's safe to call multiple times — the shell only responds once.
 */
let _dispatched = false;

export function signalPostflowReady() {
  if (Platform.OS !== 'web') return;
  if (_dispatched) return;
  _dispatched = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('postflow-ready'));
  }
}
