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
import { chatbotApi } from '../services/api';

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
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

  const sendMessage = async (text?: string) => {
    const msgText = (text ?? inputText).trim();
    if (!msgText) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: msgText,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputText('');
    setIsTyping(true);
    scrollToBottom();

    try {
      const apiPayload = updatedMessages.map(m => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: m.text
      }));

      const response = await chatbotApi.sendMessage(apiPayload);
      const reply = response?.data?.reply || 'Sorry, I did not understand that.';

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error('Chatbot API Error:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: 'Sorry, the Chatbot service is currently unavailable. Please try again later.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
      scrollToBottom();
    }
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
