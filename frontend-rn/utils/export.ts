import { Platform, Share } from 'react-native';

/**
 * Downloads or shares a CSV file safely across Web, iOS Safari/preview, and Native mobile platforms.
 * Uses non-bubbling click events on Web to prevent Expo Router from intercepting blob downloads as internal 404 routes.
 */
export const triggerCsvDownload = async (filename: string, csvContent: string): Promise<boolean> => {
  const contentWithBom = '\uFEFF' + csvContent; // Add UTF-8 BOM for Excel and iOS Safari compatibility

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    try {
      const blob = new Blob([contentWithBom], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);

      // CRITICAL: Dispatch event with bubbles: false so Expo Router's global document click handler does not catch it as a 404 route
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: false,
        cancelable: true,
      });
      link.dispatchEvent(clickEvent);

      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
      }, 1000);
      return true;
    } catch (e) {
      console.error('Blob CSV download failed, trying data URI fallback:', e);
      try {
        const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(contentWithBom);
        const link = document.createElement('a');
        link.href = encodedUri;
        link.download = filename;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        const clickEvent = new MouseEvent('click', { view: window, bubbles: false, cancelable: true });
        link.dispatchEvent(clickEvent);
        setTimeout(() => {
          if (document.body.contains(link)) document.body.removeChild(link);
        }, 1000);
        return true;
      } catch (err) {
        console.error('Data URI download failed:', err);
        return false;
      }
    }
  } else {
    // Native mobile (iOS / Android app)
    try {
      const result = await Share.share({
        title: filename,
        message: csvContent,
        url: `data:text/csv;charset=utf-8,${encodeURIComponent(contentWithBom)}`,
      });
      return result.action !== Share.dismissedAction;
    } catch (err) {
      console.error('Native Share error:', err);
      return false;
    }
  }
};
