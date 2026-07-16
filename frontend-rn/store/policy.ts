import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { policyApi } from '../services/api';

export interface PolicyBullet {
  title: string;
  desc: string;
}

export interface PolicySection {
  id: string;
  title: string;
  icon: any;
  bg: string;
  color: string;
  content?: string;
  bullets?: PolicyBullet[];
  steps?: PolicyBullet[];
  contact?: string;
}

interface PolicyStore {
  policySections: PolicySection[];
  effectiveDate: string;
  lastUpdatedDate: string;
  isLoading: boolean;
  error: string | null;

  fetchPolicy: () => Promise<void>;
  updatePolicy: (effectiveDate: string, lastUpdatedDate: string, sections: PolicySection[]) => Promise<boolean>;
}

// Cross-platform storage helpers
const storage = {
  set: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  get: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
};

const DEFAULT_SECTIONS: PolicySection[] = [
  {
    id: 'sec-1',
    title: '1. Purpose',
    icon: 'book-outline',
    bg: '#EFF6FF',
    color: '#0B2545',
    content: 'This policy governs all content published on the official Jose Maria College Foundation, Inc. website (jcm.edu.ph). It applies to all faculty, staff, students, and authorized contributors ("Posters"). The goal is to ensure a cohesive, safe, and professionally branded digital presence.',
  },
  {
    id: 'sec-2',
    title: '2. Scope & Limitations',
    icon: 'shield-checkmark-outline',
    bg: '#F3E8FF',
    color: '#7C3AED',
    bullets: [
      { title: 'Brand Integrity', desc: 'All content must adhere to the official JMCFI Brand Guidelines (colors, logos, typography).' },
      { title: 'Platform Limitation', desc: 'This policy applies exclusively to the official school domain and subdomains.' },
      { title: 'Editorial Control', desc: 'The school reserves the right to edit, reject, or remove any content without prior notice.' },
      { title: 'Non-Compliance', desc: 'Violation results in immediate removal from the platform and potential disciplinary action.' },
    ],
  },
  {
    id: 'sec-3',
    title: '3. Acceptable Content',
    icon: 'checkmark-circle-outline',
    bg: '#DCFCE7',
    color: '#16A34A',
    bullets: [
      { title: 'Academic & Professional', desc: 'Content must support the school\'s mission, be factually accurate, and maintain an inclusive tone.' },
      { title: 'Visual Standards', desc: 'Use approved templates, high-resolution media, and official school colors/logo only.' },
      { title: 'Consent (Minors Under 18)', desc: 'Written parental/guardian consent is required.' },
      { title: 'Consent (Adults 18+)', desc: 'Student\'s own signed consent is required.' },
    ],
  },
  {
    id: 'sec-4',
    title: '4. Prohibited Content',
    icon: 'alert-circle-outline',
    bg: '#FEE2E2',
    color: '#DC2626',
    bullets: [
      { title: 'Academic Misconduct', desc: 'Cheating guides, answer keys, or plagiarism.' },
      { title: 'Inappropriate Material', desc: 'Bullying, hate speech, explicit content, or harassment.' },
      { title: 'Commercial/Political', desc: 'Unauthorized ads, personal fundraising, or political endorsements.' },
      { title: 'Privacy Breach', desc: 'Publishing student grades, private addresses, or administrative records.' },
    ],
  },
  {
    id: 'sec-5',
    title: '5. Copyright & Intellectual Property',
    icon: 'copy-outline',
    bg: '#FEF3C7',
    color: '#D97706',
    bullets: [
      { title: 'Ownership rights', desc: 'Posters must own the rights to content or have written permission.' },
      { title: 'Student Work', desc: 'Showcasing student work requires proper consent (see Section 3).' },
      { title: 'Approved Media', desc: 'Images/music must be sourced from the school\'s asset library or royalty-free databases.' },
    ],
  },
  {
    id: 'sec-6',
    title: '6. Posting Process Flow',
    icon: 'git-network-outline',
    bg: '#EFF6FF',
    color: '#2563EB',
    steps: [
      { title: 'Content Creation', desc: 'Poster submits request (Title, Caption, Media).' },
      { title: 'Quality Check', desc: 'Verification of brand guidelines and factual accuracy.' },
      { title: 'Approval', desc: 'Multi-level sign-off (Dept Head, VP, President if required).' },
      { title: 'Publishing', desc: 'Final deployment by the IT Department.' },
    ],
  },
  {
    id: 'sec-7',
    title: '7. Enforcement & Contact',
    icon: 'warning-outline',
    bg: '#F5F5F5',
    color: '#4B5563',
    content: 'First Offense: Content removal and formal warning.\nRepeated Violations: Permanent revocation of posting privileges.\nSerious Breaches: Referral to the Disciplinary Board or HR.',
    contact: 'For questions, email communication@jmc.edu.ph or it@jmc.edu.ph.',
  },
];

export const usePolicyStore = create<PolicyStore>((set) => ({
  policySections: DEFAULT_SECTIONS,
  effectiveDate: 'Jun 26, 2026',
  lastUpdatedDate: 'July 15, 2026',
  isLoading: false,
  error: null,

  fetchPolicy: async () => {
    set({ isLoading: true, error: null });
    
    // First, try loading from local storage as cache
    try {
      const cachedSections = await storage.get('policy_sections');
      const cachedEffective = await storage.get('policy_effective_date');
      const cachedUpdated = await storage.get('policy_last_updated');
      if (cachedSections && cachedEffective && cachedUpdated) {
        set({
          policySections: JSON.parse(cachedSections),
          effectiveDate: cachedEffective,
          lastUpdatedDate: cachedUpdated,
        });
      }
    } catch (_) {}

    // Then attempt API fetch
    try {
      const response = await policyApi.get();
      const { effective_date, last_updated, sections } = response.data;
      
      // Save to cache
      await storage.set('policy_sections', JSON.stringify(sections));
      await storage.set('policy_effective_date', effective_date);
      await storage.set('policy_last_updated', last_updated);

      set({
        effectiveDate: effective_date,
        lastUpdatedDate: last_updated,
        policySections: sections,
        isLoading: false,
      });
    } catch (err: any) {
      console.log('Failed to fetch policy from API, using cached/default state');
      set({ isLoading: false });
    }
  },

  updatePolicy: async (effectiveDate: string, lastUpdatedDate: string, sections: PolicySection[]) => {
    set({ isLoading: true, error: null });
    
    // Optimistically/Always update cache and store locally
    try {
      await storage.set('policy_sections', JSON.stringify(sections));
      await storage.set('policy_effective_date', effectiveDate);
      await storage.set('policy_last_updated', lastUpdatedDate);
    } catch (_) {}

    try {
      await policyApi.update({
        effective_date: effectiveDate,
        last_updated: lastUpdatedDate,
        sections,
      });
      set({
        effectiveDate,
        lastUpdatedDate,
        policySections: sections,
        isLoading: false,
      });
      return true;
    } catch (err: any) {
      console.log('Failed to update policy via API, applied update locally', err);
      set({
        effectiveDate,
        lastUpdatedDate,
        policySections: sections,
        isLoading: false,
      });
      return true; // Return true because it is applied locally and will display correctly
    }
  },
}));
