import { create } from 'zustand';

interface LoadingBarState {
  progress: number;
  visible: boolean;
  activeCount: number;
  start: () => void;
  finish: () => void;
  setProgress: (val: number) => void;
}

let trickleTimer: any = null;
let resetTimer: any = null;

export const useLoadingBar = create<LoadingBarState>((set, get) => ({
  progress: 0,
  visible: false,
  activeCount: 0,

  start: () => {
    const currentCount = get().activeCount;
    set({ activeCount: currentCount + 1, visible: true });

    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }

    if (currentCount === 0) {
      if (trickleTimer) clearInterval(trickleTimer);
      set({ progress: 20 });

      trickleTimer = setInterval(() => {
        const p = get().progress;
        if (p < 85) {
          const step = Math.max(1, (85 - p) * 0.2);
          set({ progress: Math.min(85, p + step) });
        }
      }, 180);
    }
  },

  finish: () => {
    const nextCount = Math.max(0, get().activeCount - 1);
    set({ activeCount: nextCount });

    if (nextCount === 0) {
      if (trickleTimer) {
        clearInterval(trickleTimer);
        trickleTimer = null;
      }
      set({ progress: 100 });
      resetTimer = setTimeout(() => {
        if (get().activeCount === 0) {
          set({ visible: false, progress: 0 });
        }
      }, 350);
    }
  },

  setProgress: (val: number) => {
    set({ progress: val, visible: val > 0 });
  },
}));

export const topLoadingBar = {
  start: () => useLoadingBar.getState().start(),
  finish: () => useLoadingBar.getState().finish(),
};

