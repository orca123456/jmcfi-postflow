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
  const [isRevealed, setIsRevealed] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const edgeAnim = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<any>(null);

  useEffect(() => {
    Animated.spring(edgeAnim, {
      toValue: isRevealed || isOpen ? 1 : 0,
      useNativeDriver: true,
      tension: 110,
      friction: 14,
    }).start();
  }, [isRevealed, isOpen]);

  const handleMouseEnter = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setIsRevealed(true);
  };

  const handleMouseLeave = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setIsRevealed(false);
    }, 1800);
  };

  const handleFabPress = () => {
    setIsRevealed(true);
    setIsOpen((prev) => !prev);
  };

  const formatTime = (date: Date) => {
    try {
      return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

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
  const fabMarginRight = edgeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-26, 0],
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
            {...({ role: 'log' } as any)}
          >
            {messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.messageRow,
                  msg.role === 'user' ? styles.userRow : styles.botRow,
                ]}
              >
                {msg.role === 'bot' && (
                  <View style={styles.botBubbleAvatar}>
                    <Image source={require('../assets/images/chatbot-icon.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  </View>
                )}
                <View style={[styles.bubbleWrapper, msg.role === 'user' && { alignItems: 'flex-end' }]}>
                  {msg.role === 'bot' && <Text style={styles.chatSenderName}>PostFlow AI</Text>}
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
                  <View style={[styles.messageFooter, msg.role === 'user' ? styles.userFooter : styles.botFooter]}>
                    <Text style={styles.timestampText}>{formatTime(msg.timestamp)}</Text>
                    {msg.role === 'user' && (
                      <View style={styles.statusWrap}>
                        <Ionicons name="checkmark-done" size={12} color="#10B981" />
                        <Text style={styles.statusText}>Read</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}

            {isTyping && (
              <View style={[styles.messageRow, styles.botRow]}>
                <View style={styles.botBubbleAvatar}>
                  <Image source={require('../assets/images/chatbot-icon.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                </View>
                <View style={styles.bubbleWrapper}>
                  <Text style={styles.chatSenderName}>PostFlow AI</Text>
                  <View style={[styles.bubbleContent, styles.botBubbleContent, styles.typingBubble]}>
                    <View style={styles.typingDotRow}>
                      <View style={[styles.typingDot, styles.typingDot1]} />
                      <View style={[styles.typingDot, styles.typingDot2]} />
                      <View style={[styles.typingDot, styles.typingDot3]} />
                    </View>
                  </View>
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

      {/* FAB - Edge Hugging Drawer */}
      <Animated.View
        style={[
          styles.fabWrapper,
          { marginRight: fabMarginRight },
        ]}
        {...({
          onMouseEnter: handleMouseEnter,
          onMouseLeave: handleMouseLeave,
        } as any)}
      >
        <TouchableOpacity style={styles.fab} onPress={handleFabPress} activeOpacity={0.85}>
          {isOpen ? (
            <Ionicons name="close" size={24} color="#0B2545" />
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
    position: 'fixed' as any,
    bottom: 16,
    right: 16,
    alignItems: 'flex-end',
    zIndex: 99999,
  },
  chatPanel: {
    position: 'absolute',
    bottom: 64,
    right: 0,
    width: 350,
    maxWidth: 'calc(100vw - 32px)' as any,
    height: 480,
    maxHeight: 'calc(100vh - 100px)' as any,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#0B2545',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 100000,
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
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginVertical: 4,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  botRow: {
    justifyContent: 'flex-start',
  },
  botBubbleAvatar: {
    width: 24,
    height: 24,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  bubbleWrapper: {
    maxWidth: '78%',
  },
  chatSenderName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 3,
    marginLeft: 2,
  },
  bubbleContent: {
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userBubbleContent: {
    backgroundColor: '#0B2545',
    borderBottomRightRadius: 3,
  },
  botBubbleContent: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  messageText: {
    fontSize: 13,
    lineHeight: 19,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  botMessageText: {
    color: '#0F172A',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 4,
  },
  userFooter: {
    alignSelf: 'flex-end',
  },
  botFooter: {
    alignSelf: 'flex-start',
    marginLeft: 2,
  },
  timestampText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  statusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#10B981',
  },
  typingBubble: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  typingDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
  },
  typingDot1: { opacity: 0.4 },
  typingDot2: { opacity: 0.7 },
  typingDot3: { opacity: 1 },
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
    width: 52,
    height: 52,
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
