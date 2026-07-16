import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing } from '../constants/theme';

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

const BOT_RESPONSES: Record<string, string> = {
  hello: "Hello! 👋 I'm the PostFlow Assistant. I can help you with the JMCFI content approval workflow. What can I assist you with today?",
  hi: "Hi there! 👋 I'm here to help with PostFlow. Ask me anything about content submission, approvals, or the workflow!",
  hey: "Hey! How can I help you with JMCFI PostFlow today?",
  workflow: "The JMCFI PostFlow approval workflow follows these steps:\n1️⃣ Submitted — Requestor creates post\n2️⃣ Dept Head — Department Head reviews\n3️⃣ VP / Pres — VP or President approves\n4️⃣ IMC QA — Quality assurance check\n5️⃣ Publisher — IT/Publisher schedules & publishes",
  steps: "The approval has 5 stages: Submitted → Dept Head → VP/Pres → IMC QA → Publisher. Each approver must review before it moves forward.",
  process: "Posts go through: Requestor submits → Dept Head → VP/Pres → IMC QA → IT Publisher. Would you like details on any specific stage?",
  roles: "PostFlow has these roles:\n👤 Requestor — Submits content requests\n👤 Dept Head — First-level approver\n👤 VP/President — Executive approver\n👤 IMC QA — Quality assurance\n👤 IT Publisher — Publishes to platforms\n👤 Admin — System administration",
  admin: "Admins manage system users, view all posts in pipeline, and monitor analytics. They can create accounts, assign roles, and view platform distribution stats.",
  requestor: "Requestors create and submit post requests. They can track approval status through the approval queue and view analytics.",
  publisher: "IT Publishers handle the final step — scheduling and publishing approved content to platforms like Facebook, Instagram, and Twitter/X.",
  "imc qa": "IMC QA reviewers are the 4th step in the workflow. They check content quality, compliance, and ensure it meets JMCFI standards before publishing.",
  "dept head": "Department Heads are the first approvers. They review content from their team before it moves up to the VP or President.",
  analytics: "The Analytics tab shows platform distribution (Facebook, Instagram, Twitter/X), approval timelines, and content performance metrics.",
  platforms: "PostFlow supports publishing to:\n📘 Facebook\n📸 Instagram\n🐦 Twitter/X\n📝 WordPress\nPlatforms are configured per post request.",
  schedule: "Publishers can schedule posts using the datetime picker in the Publishing Queue. Click the calendar icon next to a post to set the publish date and time.",
  status: "Post statuses include:\n🟡 Pending — Awaiting review\n✅ Approved — Cleared for next stage\n🔴 Rejected — Declined\n🔵 Revision Requested — Changes needed\n🟢 Published — Live on platforms",
  pending: "Pending posts are waiting for the current approver to review them. Check your Approval Queue to see items awaiting your action.",
  approved: "Approved posts move to the next stage in the workflow automatically. Once all stages are approved, it reaches the Publisher.",
  rejected: "Rejected posts are sent back to the Requestor. The requestor will be notified and can revise and resubmit the content.",
  help: "I can help you with:\n• 📋 Understanding the approval workflow\n• 👥 Role responsibilities\n• 📊 Analytics and reporting\n• 📅 Scheduling posts\n• 🔐 Account management\n\nJust ask me anything!",
  account: "Accounts can be created by Admins in the User Management section. Go to Admin Dashboard → User Management → Create New Institutional Account.",
  password: "If you need to reset your password, contact your system administrator. Admins can manage accounts from the User Management panel.",
};

function getBotResponse(input: string): string {
  const lower = input.toLowerCase().trim();
  for (const key of Object.keys(BOT_RESPONSES)) {
    if (lower.includes(key)) {
      return BOT_RESPONSES[key];
    }
  }
  return "I'm not sure about that specific topic, but I'm here to help with PostFlow! Try asking about:\n• The approval workflow\n• User roles\n• Post statuses\n• Publishing platforms\n• Account management";
}

const QUICK_REPLIES = [
  'How does the workflow work?',
  'What are the user roles?',
  'What post statuses exist?',
  'How do I schedule a post?',
];

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'bot',
      text: "👋 Hi! I'm the PostFlow Assistant. I can help you navigate the JMCFI content approval system. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isOpen) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isOpen]);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isOpen ? 1 : 0,
      useNativeDriver: true,
      tension: 100,
      friction: 12,
    }).start();
  }, [isOpen]);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const sendMessage = (text?: string) => {
    const msgText = (text ?? inputText).trim();
    if (!msgText) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: msgText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);
    scrollToBottom();

    setTimeout(() => {
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: getBotResponse(msgText),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
      scrollToBottom();
    }, 800);
  };

  const chatTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });
  const chatOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.container} pointerEvents="box-none">
      {isOpen && (
        <Animated.View
          style={[
            styles.chatPanel,
            { opacity: chatOpacity, transform: [{ translateY: chatTranslateY }] },
          ]}
        >
          {/* Header */}
          <View style={styles.chatHeader}>
            <View style={styles.chatHeaderLeft}>
              <View style={styles.botAvatar}>
                <Image source={require('../assets/images/chatbot-icon.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              </View>
              <View>
                <Text style={styles.chatHeaderTitle}>PostFlow Assistant</Text>
                <View style={styles.onlineRow}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.chatHeaderSub}>Online · Powered by AI</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={styles.messagesArea}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.messageBubble,
                  msg.role === 'user' ? styles.userBubble : styles.botBubble,
                ]}
              >
                {msg.role === 'bot' && (
                  <View style={styles.botBubbleAvatar}>
                    <Image source={require('../assets/images/chatbot-icon.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  </View>
                )}
                <View style={[
                  styles.bubbleContent,
                  msg.role === 'user' ? styles.userBubbleContent : styles.botBubbleContent,
                ]}>
                  <Text style={[
                    styles.messageText,
                    msg.role === 'user' ? styles.userMessageText : styles.botMessageText,
                  ]}>
                    {msg.text}
                  </Text>
                </View>
              </View>
            ))}

            {isTyping && (
              <View style={[styles.messageBubble, styles.botBubble]}>
                <View style={styles.botBubbleAvatar}>
                  <Image source={require('../assets/images/chatbot-icon.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                </View>
                <View style={[styles.bubbleContent, styles.botBubbleContent]}>
                  <Text style={styles.typingDots}>● ● ●</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Quick Replies */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickRepliesRow}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 12, paddingVertical: 8 }}
          >
            {QUICK_REPLIES.map((qr) => (
              <TouchableOpacity key={qr} style={styles.quickReplyChip} onPress={() => sendMessage(qr)}>
                <Text style={styles.quickReplyText} numberOfLines={1}>{qr}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.chatInput}
              placeholder="Ask me anything..."
              placeholderTextColor={Colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={() => sendMessage()}
              disabled={!inputText.trim()}
            >
              <Ionicons name="send" size={15} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* FAB */}
      <Animated.View style={[styles.fabWrapper, { transform: [{ scale: isOpen ? 1 : pulseAnim }] }]}>
        <TouchableOpacity style={styles.fab} onPress={() => setIsOpen(!isOpen)} activeOpacity={0.85}>
          {isOpen ? (
            <Ionicons name="close" size={28} color="#0B2545" />
          ) : (
            <Image source={require('../assets/images/chatbot-icon.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          )}
          {!isOpen && (
            <View style={styles.fabBadge}>
              <Text style={styles.fabBadgeText}>AI</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    alignItems: 'flex-end',
    zIndex: 9999,
  },
  chatPanel: {
    width: 340,
    height: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#0B2545',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chatHeader: {
    backgroundColor: '#0B2545',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  botAvatar: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
  },
  chatHeaderTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  chatHeaderSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
  },
  closeBtn: {
    padding: 4,
  },
  messagesArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  messagesContent: {
    padding: 12,
    gap: 8,
  },
  messageBubble: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginVertical: 2,
  },
  userBubble: {
    justifyContent: 'flex-end',
  },
  botBubble: {
    justifyContent: 'flex-start',
  },
  botBubbleAvatar: {
    width: 22,
    height: 22,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  bubbleContent: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  userBubbleContent: {
    backgroundColor: '#0B2545',
    borderBottomRightRadius: 4,
  },
  botBubbleContent: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageText: {
    fontSize: 12,
    lineHeight: 18,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  botMessageText: {
    color: '#1A1A2E',
  },
  typingDots: {
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 2,
  },
  quickRepliesRow: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
    maxHeight: 48,
  },
  quickReplyChip: {
    backgroundColor: '#EEF4F8',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#D1E3F0',
  },
  quickReplyText: {
    fontSize: 10,
    color: '#0B2545',
    fontWeight: FontWeight.medium,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  chatInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    paddingHorizontal: 14,
    fontSize: 12,
    color: Colors.textPrimary,
    backgroundColor: '#F9FAFB',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0B2545',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  fabWrapper: {
    // Shadows removed to prevent rectangular background box on web
  },
  fab: {
    width: 70,
    height: 70,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FFC72C',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  fabBadgeText: {
    fontSize: 8,
    fontWeight: FontWeight.bold,
    color: '#0B2545',
  },
});
