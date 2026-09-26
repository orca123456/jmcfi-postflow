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

const SUGGESTED_QUESTIONS = [
  'How do I upload a document?',
  'Show pending requirements',
  'Summarize this file',
];

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'bot',
      text: 'Hello! How can I help you today?',
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

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isOpen ? 1 : 0,
      useNativeDriver: true,
      tension: 120,
      friction: 14,
    }).start();
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setIsRevealed(true);
  };

  const handleMouseLeave = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!isOpen) {
        setIsRevealed(false);
      }
    }, 600);
  };

  const handleClose = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setIsOpen(false);
    setIsRevealed(false);
  };

  const handleFabPress = () => {
    if (isOpen) {
      handleClose();
    } else {
      setIsRevealed(true);
      setIsOpen(true);
    }
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
    outputRange: [-24, 0],
  });
  const fabMarginBottom = edgeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-18, 0],
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
                <Text style={styles.chatHeaderTitle}>AI Assistant</Text>
                <Text style={styles.chatHeaderSub}>Ask me anything about accreditation.</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handleClose} style={styles.headerActionBtn}>
                <Ionicons name="remove-outline" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClose} style={styles.headerActionBtn}>
                <Ionicons name="close-outline" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
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

          {/* Suggested Questions */}
          <View style={styles.suggestedContainer}>
            <Text style={styles.suggestedTitle}>Suggested Questions</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.quickRepliesRow}
              contentContainerStyle={{ gap: 6, paddingHorizontal: 12, paddingVertical: 6 }}
            >
              {SUGGESTED_QUESTIONS.map((qr) => (
                <TouchableOpacity key={qr} style={styles.quickReplyChip} onPress={() => sendMessage(qr)}>
                  <Ionicons name="help-circle-outline" size={12} color="#5B0FB8" style={{ marginRight: 4 }} />
                  <Text style={styles.quickReplyText} numberOfLines={1}>{qr}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.chatInput}
              placeholder="Type your question…"
              placeholderTextColor="#94A3B8"
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

      {/* Corner-Hugging Peeking AI Assistant Mascot */}
      <Animated.View
        style={[
          styles.cornerPeekingWrap,
          {
            marginRight: fabMarginRight,
            marginBottom: fabMarginBottom,
          },
        ]}
        {...({
          onMouseEnter: handleMouseEnter,
          onMouseLeave: handleMouseLeave,
        } as any)}
      >
        {/* Hover Callout Tooltip */}
        {isRevealed && !isOpen && (
          <View style={styles.calloutTooltip}>
            <Text style={styles.calloutText}>Hi! Need help? 👋</Text>
            <View style={styles.calloutArrow} />
          </View>
        )}

        <TouchableOpacity style={styles.cornerMascotButton} onPress={handleFabPress} activeOpacity={0.9}>
          {isOpen ? (
            <View style={styles.closeIconBox}>
              <Ionicons name="close" size={22} color="#0B2545" />
            </View>
          ) : (
            <View style={styles.peekingMascotContainer}>
              {/* Peeled Paper Corner Effect */}
              <View style={styles.paperFoldCorner}>
                <View style={styles.paperFoldFlap} />
              </View>
              {/* AI Mascot Image Peeking Out */}
              <View style={styles.mascotImageWrap}>
                <Image source={require('../assets/images/chatbot-icon.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              </View>
              {/* AI Badge */}
              <View style={styles.cornerAiBadge}>
                <Ionicons name="sparkles" size={9} color="#0B2545" />
                <Text style={styles.cornerAiBadgeText}>AI</Text>
              </View>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerActionBtn: {
    padding: 4,
    borderRadius: 4,
  },
  suggestedContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: 2,
  },
  suggestedTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    paddingHorizontal: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickRepliesRow: {
    backgroundColor: '#FFFFFF',
    maxHeight: 44,
  },
  quickReplyChip: {
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickReplyText: {
    fontSize: 11,
    color: '#5B0FB8',
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
    height: 38,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 19,
    paddingHorizontal: 14,
    fontSize: 12,
    color: Colors.textPrimary,
    backgroundColor: '#F8FAFC',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#5B0FB8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  cornerPeekingWrap: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  calloutTooltip: {
    position: 'absolute',
    bottom: 74,
    right: 8,
    backgroundColor: '#0B2545',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100001,
  },
  calloutText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  calloutArrow: {
    position: 'absolute',
    bottom: -5,
    right: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#0B2545',
  },
  cornerMascotButton: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  peekingMascotContainer: {
    width: 72,
    height: 72,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paperFoldCorner: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 66,
    height: 66,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderBottomRightRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0B2545',
    shadowOffset: { width: -3, height: -3 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 8,
  },
  paperFoldFlap: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 26,
    height: 26,
    backgroundColor: '#F1F5F9',
    borderTopLeftRadius: 26,
    borderBottomRightRadius: 13,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  mascotImageWrap: {
    width: 50,
    height: 50,
    position: 'absolute',
    bottom: 5,
    right: 5,
  },
  cornerAiBadge: {
    position: 'absolute',
    top: 2,
    left: 2,
    backgroundColor: '#FFC72C',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  cornerAiBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0B2545',
  },
});
