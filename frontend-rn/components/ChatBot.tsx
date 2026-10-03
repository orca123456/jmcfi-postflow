import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Image,
  PanResponder,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing } from '../constants/theme';
import { chatbotApi } from '../services/api';
import { useAuthStore } from '../store/auth';

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

export function ChatBot() {
  const user = useAuthStore((state) => state.user);

  const { roleCategory, isAdmin, isApprover, suggestedQuestions, welcomeMessage } = useMemo(() => {
    const rawRole = (user?.role || '').toLowerCase();
    const isAdminRole = rawRole === 'admin' || rawRole === 'it_publisher' || rawRole === 'it_admin';
    const isApproverRole = !isAdminRole && (
      rawRole === 'approver' ||
      rawRole === 'office_head' ||
      rawRole === 'vice_president' ||
      rawRole === 'imc_qa_checker' ||
      rawRole === 'president'
    );

    const category = isAdminRole ? 'admin' : isApproverRole ? 'approver' : 'requestor';
    const firstName = user?.first_name || user?.name?.split(' ')[0] || (isAdminRole ? 'Admin' : 'there');

    let questions: string[] = [];
    let greeting = '';

    if (isAdminRole) {
      greeting = `Hello, ${firstName}! You are in Admin Mode with NO BOUNDARIES. You can ask anything — from system health, audit logs, and platform tokens, to technical architecture, coding scripts, or open-ended inquiries. How can I assist you?`;
      questions = [
        'System health & publishing status',
        'How to manage user accounts & roles',
        'Review recent audit logs',
        'Platform token configuration',
        'Explain PostFlow system architecture',
        'Ask any technical or general question',
      ];
    } else if (isApproverRole) {
      greeting = `Hello, ${firstName}! I am your Approver Workflow Assistant. I can help guide you through compliance reviews, branding QA standards, returning posts for revision, and approval stages. How can I help?`;
      questions = [
        'How to review pending posts',
        'Compliance & branding guidelines',
        'Returning a post for revision',
        'Workflow approval stages',
        'Quality assurance criteria',
        'Show pending approvals',
      ];
    } else {
      greeting = `Hello, ${firstName}! I am here to help you navigate content creation, submission guidelines, media requirements, and status tracking in PostFlow. How can I help?`;
      questions = [
        'How do I upload a document?',
        'Show pending requirements',
        'Check post guidelines',
        'Summarize content rules',
        'Compliance policies',
        'Track my submission status',
      ];
    }

    return {
      roleCategory: category,
      isAdmin: isAdminRole,
      isApprover: isApproverRole,
      suggestedQuestions: questions,
      welcomeMessage: greeting,
    };
  }, [user]);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'bot',
      text: welcomeMessage,
      timestamp: new Date(),
    },
  ]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === '0') {
        return [
          {
            id: '0',
            role: 'bot',
            text: welcomeMessage,
            timestamp: new Date(),
          },
        ];
      }
      return prev;
    });
  }, [welcomeMessage]);

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const suggestedScrollRef = useRef<ScrollView>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const isDraggingSuggested = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);
  const dragMoved = useRef(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const edgeAnim = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<any>(null);

  // ── Drag & Drop PanResponder State ──
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const isDraggingRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },
      onPanResponderGrant: () => {
        isDraggingRef.current = false;
        pan.setOffset({
          x: (pan.x as any)._value || 0,
          y: (pan.y as any)._value || 0,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4) {
          isDraggingRef.current = true;
        }
        pan.x.setValue(gestureState.dx);
        pan.y.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        if (!isDraggingRef.current && Math.hypot(gestureState.dx, gestureState.dy) < 6) {
          handleFabPress();
        }
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
      },
    })
  ).current;

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

  const checkSuggestedScroll = () => {
    if (Platform.OS === 'web' && suggestedScrollRef.current) {
      const node = (suggestedScrollRef.current as any)?.getScrollableNode?.() || (suggestedScrollRef.current as any);
      if (node) {
        setCanScrollLeft(node.scrollLeft > 4);
        setCanScrollRight(node.scrollLeft < node.scrollWidth - node.clientWidth - 4);
      }
    }
  };

  const handleSuggestedScrollBy = (offset: number) => {
    if (Platform.OS === 'web' && suggestedScrollRef.current) {
      const node = (suggestedScrollRef.current as any)?.getScrollableNode?.() || (suggestedScrollRef.current as any);
      if (node && typeof node.scrollBy === 'function') {
        node.scrollBy({ left: offset, behavior: 'smooth' });
        setTimeout(checkSuggestedScroll, 200);
        return;
      }
    }
    suggestedScrollRef.current?.scrollTo({ x: offset > 0 ? 300 : 0, animated: true });
  };

  const handleChipPress = (qr: string) => {
    if (dragMoved.current) {
      return;
    }
    sendMessage(qr);
  };

  // Enable horizontal mouse wheel scrolling and mouse dragging on web
  useEffect(() => {
    if (Platform.OS !== 'web' || !isOpen) return;

    const cleanupFns: (() => void)[] = [];

    const timer = setTimeout(() => {
      const node = (suggestedScrollRef.current as any)?.getScrollableNode?.() || (suggestedScrollRef.current as any);
      if (!node || !node.addEventListener) return;

      checkSuggestedScroll();
      node.style.cursor = 'grab';

      const onWheel = (e: WheelEvent) => {
        if (e.deltaY !== 0 || e.deltaX !== 0) {
          e.preventDefault();
          e.stopPropagation();
          node.scrollLeft += e.deltaY !== 0 ? e.deltaY : e.deltaX;
          checkSuggestedScroll();
        }
      };

      const onMouseDown = (e: MouseEvent) => {
        isDraggingSuggested.current = true;
        dragMoved.current = false;
        dragStartX.current = e.pageX;
        dragScrollLeft.current = node.scrollLeft;
        node.style.cursor = 'grabbing';
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isDraggingSuggested.current) return;
        const diff = e.pageX - dragStartX.current;
        if (Math.abs(diff) > 4) {
          dragMoved.current = true;
        }
        node.scrollLeft = dragScrollLeft.current - diff;
        checkSuggestedScroll();
      };

      const onMouseUp = () => {
        if (isDraggingSuggested.current) {
          isDraggingSuggested.current = false;
          node.style.cursor = 'grab';
        }
      };

      node.addEventListener('wheel', onWheel, { passive: false });
      node.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);

      cleanupFns.push(() => {
        node.removeEventListener('wheel', onWheel);
        node.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      cleanupFns.forEach((fn) => fn());
    };
  }, [isOpen]);

  const renderFormattedMessage = (rawText: string, isUser: boolean) => {
    if (!rawText) return null;

    const baseTextStyle = [
      styles.messageText,
      isUser ? styles.userMessageText : styles.botMessageText,
    ];

    const boldTextStyle = {
      fontWeight: '700' as const,
      color: isUser ? '#FFFFFF' : '#0F172A',
    };

    const renderInline = (lineContent: string, keyPrefix: string) => {
      // Split by **bold**, __bold__, *italic*, or `code`
      const regex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*)/g;
      const segments = lineContent.split(regex);

      return segments.map((seg, idx) => {
        if (!seg) return null;

        // **bold** or __bold__
        if (
          (seg.startsWith('**') && seg.endsWith('**') && seg.length >= 4) ||
          (seg.startsWith('__') && seg.endsWith('__') && seg.length >= 4)
        ) {
          return (
            <Text key={`${keyPrefix}-b-${idx}`} style={[baseTextStyle, boldTextStyle]}>
              {seg.slice(2, -2)}
            </Text>
          );
        }

        // *italic*
        if (seg.startsWith('*') && seg.endsWith('*') && seg.length >= 2) {
          return (
            <Text key={`${keyPrefix}-i-${idx}`} style={[baseTextStyle, { fontStyle: 'italic' }]}>
              {seg.slice(1, -1)}
            </Text>
          );
        }

        // `code`
        if (seg.startsWith('`') && seg.endsWith('`') && seg.length >= 2) {
          return (
            <Text
              key={`${keyPrefix}-c-${idx}`}
              style={[
                baseTextStyle,
                {
                  fontFamily: 'monospace',
                  fontSize: 11,
                  backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : '#F1F5F9',
                  paddingHorizontal: 4,
                  borderRadius: 3,
                },
              ]}
            >
              {seg.slice(1, -1)}
            </Text>
          );
        }

        // Clean any leftover double asterisks or loose backticks
        const cleanSeg = seg.replace(/\*\*/g, '').replace(/`/g, '');
        return (
          <Text key={`${keyPrefix}-t-${idx}`} style={baseTextStyle}>
            {cleanSeg}
          </Text>
        );
      });
    };

    const lines = rawText.split('\n');
    const elements: React.ReactNode[] = [];
    let currentListItems: React.ReactNode[] = [];

    const flushList = (flushKey: string) => {
      if (currentListItems.length > 0) {
        elements.push(
          <View key={`list-${flushKey}`} style={styles.messageListContainer}>
            {currentListItems}
          </View>
        );
        currentListItems = [];
      }
    };

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();

      // Empty line -> small spacer
      if (!trimmed) {
        flushList(`flush-${lineIdx}`);
        elements.push(<View key={`spacer-${lineIdx}`} style={{ height: 6 }} />);
        return;
      }

      // Bullet item (- or * or •)
      const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
      if (bulletMatch) {
        const content = bulletMatch[1];
        currentListItems.push(
          <View key={`bullet-${lineIdx}`} style={styles.messageBulletRow}>
            <Text style={[styles.messageBulletDot, { color: isUser ? '#FFFFFF' : '#7C3AED' }]}>•</Text>
            <Text style={[styles.messageBulletText, isUser ? styles.userMessageText : styles.botMessageText]}>
              {renderInline(content, `b-${lineIdx}`)}
            </Text>
          </View>
        );
        return;
      }

      // Numbered list item (1. or 2.)
      const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (numberMatch) {
        const num = numberMatch[1];
        const content = numberMatch[2];
        currentListItems.push(
          <View key={`num-${lineIdx}`} style={styles.messageBulletRow}>
            <Text style={[styles.messageNumberIndex, { color: isUser ? '#FFFFFF' : '#7C3AED' }]}>{num}.</Text>
            <Text style={[styles.messageBulletText, isUser ? styles.userMessageText : styles.botMessageText]}>
              {renderInline(content, `n-${lineIdx}`)}
            </Text>
          </View>
        );
        return;
      }

      // If it's a regular line, flush any pending list items
      flushList(`flush-${lineIdx}`);

      // Markdown header (### or ## or #)
      const headerMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
      if (headerMatch) {
        const content = headerMatch[2];
        elements.push(
          <Text key={`h-${lineIdx}`} style={[baseTextStyle, boldTextStyle, { fontSize: 13, marginTop: 4, marginBottom: 2 }]}>
            {renderInline(content, `h-${lineIdx}`)}
          </Text>
        );
        return;
      }

      // Regular paragraph line
      elements.push(
        <Text key={`p-${lineIdx}`} style={baseTextStyle}>
          {renderInline(line, `p-${lineIdx}`)}
        </Text>
      );
    });

    flushList('final');
    return <View style={{ gap: 2 }}>{elements}</View>;
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
    <Animated.View
      style={[
        styles.container,
        {
          transform: pan.getTranslateTransform(),
        },
      ]}
      pointerEvents="box-none"
    >
      {isOpen && (
        <Animated.View
          style={[
            styles.chatPanel,
            { opacity: chatOpacity, transform: [{ translateY: chatTranslateY }] },
          ]}
        >
          {/* Header (Draggable) */}
          <View
            style={[styles.chatHeader, { cursor: 'grab' as any }]}
            {...panResponder.panHandlers}
          >
            <View style={styles.chatHeaderLeft}>
              <View style={styles.botAvatar}>
                <Image source={require('../assets/images/chatbot-icon.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              </View>
              <View style={{ flexShrink: 1 }}>
                <View style={styles.headerTitleRow}>
                  <Text style={styles.chatHeaderTitle}>AI Assistant</Text>
                  <View style={[
                    styles.roleBadge,
                    isAdmin ? styles.adminBadge : isApprover ? styles.approverBadge : styles.requestorBadge,
                  ]}>
                    <Text style={styles.roleBadgeText}>
                      {isAdmin ? 'ADMIN • UNRESTRICTED' : isApprover ? 'APPROVER' : 'REQUESTOR'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.chatHeaderSub} numberOfLines={1}>
                  {isAdmin
                    ? 'Unrestricted system & general intelligence mode'
                    : isApprover
                    ? 'Review, QA & workflow approval guidance'
                    : 'Content submission & guideline assistant'}
                </Text>
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
                    {renderFormattedMessage(msg.text, msg.role === 'user')}
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
            <View style={styles.suggestedHeaderRow}>
              <Text style={styles.suggestedTitle}>Suggested Questions</Text>
              <View style={styles.suggestedArrows}>
                <TouchableOpacity
                  onPress={() => handleSuggestedScrollBy(-160)}
                  style={[styles.suggestedArrowBtn, !canScrollLeft && styles.suggestedArrowBtnDisabled]}
                  disabled={!canScrollLeft}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back" size={13} color={canScrollLeft ? '#5B0FB8' : '#CBD5E1'} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleSuggestedScrollBy(160)}
                  style={[styles.suggestedArrowBtn, !canScrollRight && styles.suggestedArrowBtnDisabled]}
                  disabled={!canScrollRight}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-forward" size={13} color={canScrollRight ? '#5B0FB8' : '#CBD5E1'} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView
              ref={suggestedScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              onScroll={checkSuggestedScroll}
              scrollEventThrottle={16}
              style={styles.quickRepliesRow}
              contentContainerStyle={{ gap: 6, paddingHorizontal: 12, paddingVertical: 6 }}
            >
              {suggestedQuestions.map((qr) => (
                <TouchableOpacity
                  key={qr}
                  style={styles.quickReplyChip}
                  onPress={() => handleChipPress(qr)}
                  activeOpacity={0.7}
                >
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

      {/* Corner-Hugging Peeking AI Assistant Mascot (Draggable) */}
      <Animated.View
        style={[
          styles.cornerPeekingWrap,
          {
            marginRight: fabMarginRight,
            marginBottom: fabMarginBottom,
            cursor: 'grab' as any,
          },
        ]}
        {...panResponder.panHandlers}
        {...({
          onMouseEnter: handleMouseEnter,
          onMouseLeave: handleMouseLeave,
        } as any)}
      >
        {/* Hover Callout Tooltip */}
        {isRevealed && !isOpen && (
          <View style={styles.calloutTooltip}>
            <Text style={styles.calloutText}>Drag me anywhere or click! 👋</Text>
            <View style={styles.calloutArrow} />
          </View>
        )}

        <View style={styles.cornerMascotButton}>
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
        </View>
      </Animated.View>
    </Animated.View>
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatHeaderTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  adminBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderColor: '#F87171',
  },
  approverBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderWidth: 1,
    borderColor: '#60A5FA',
  },
  requestorBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1,
    borderColor: '#34D399',
  },
  roleBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  chatHeaderSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
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
  messageListContainer: {
    gap: 4,
    marginVertical: 2,
  },
  messageBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingLeft: 2,
  },
  messageBulletDot: {
    fontSize: 12,
    lineHeight: 19,
    fontWeight: '700',
  },
  messageNumberIndex: {
    fontSize: 12,
    lineHeight: 19,
    fontWeight: '700',
    minWidth: 16,
  },
  messageBulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
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
    paddingBottom: 4,
  },
  suggestedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  suggestedTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestedArrows: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  suggestedArrowBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer' as any,
  },
  suggestedArrowBtnDisabled: {
    opacity: 0.35,
    cursor: 'default' as any,
  },
  quickRepliesRow: {
    backgroundColor: '#FFFFFF',
    maxHeight: 46,
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
    flexShrink: 0,
    userSelect: 'none' as any,
    cursor: 'pointer' as any,
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
