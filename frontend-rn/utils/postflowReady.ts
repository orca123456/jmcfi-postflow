import { Platform } from 'react-native';

/**
 * Signals to the HTML loading shell (injected into index.html) that
 * the React app has real content ready to show. The shell listens for
 * the 'postflow-ready' event and fades out cleanly.
 */
export function signalPostflowReady() {
  if (Platform.OS !== 'web') return;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('postflow-ready'));
    const shell = document.getElementById('postflow-shell');
    if (shell) {
      shell.classList.add('pf-hidden');
      setTimeout(() => {
        if (shell.parentNode) shell.parentNode.removeChild(shell);
      }, 150);
    }
  }
}
