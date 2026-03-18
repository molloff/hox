import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  sendMessage, getMessages, listConversations,
  type AiMessage, type AiConversation,
} from '../../services/ai';
import { colors } from '../../theme/colors';

const QUICK_PROMPTS = [
  { label: '💰 Финансов преглед', prompt: 'Дай ми пълен финансов преглед — сметки, задължения, Score' },
  { label: '📄 Изтичащи документи', prompt: 'Кои мои документи изтичат скоро?' },
  { label: '📊 Как да вдигна Score', prompt: 'Как мога да подобря HOX Score-а си?' },
  { label: '🔍 Търси във Vault', prompt: 'Какви документи имам във Vault?' },
];

export function AiChatScreen({ navigation, route }: any) {
  const initialConvoId = route?.params?.conversationId;
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConvoId);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const flatListRef = useRef<FlatList>(null);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const msgs = await getMessages(conversationId);
      setMessages(msgs);
    } catch {}
  }, [conversationId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const handleSend = async (text?: string) => {
    const msg = (text || inputText).trim();
    if (!msg || sending) return;
    setInputText('');
    setSending(true);

    // Optimistic add
    const tempMsg: AiMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: msg,
      tool_calls: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const result = await sendMessage(msg, conversationId);
      setConversationId(result.conversationId);

      const assistantMsg: AiMessage = {
        id: `resp-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        tool_calls: result.toolsUsed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: AiMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Съжалявам, възникна грешка. Опитай отново.',
        tool_calls: [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    }
  };

  const handleNewChat = () => {
    setConversationId(undefined);
    setMessages([]);
  };

  const handleLoadConversation = async (convoId: string) => {
    setConversationId(convoId);
    setShowHistory(false);
    try {
      const msgs = await getMessages(convoId);
      setMessages(msgs);
    } catch {}
  };

  const loadHistory = async () => {
    try {
      const convos = await listConversations();
      setConversations(convos);
      setShowHistory(true);
    } catch {}
  };

  const renderMessage = ({ item }: { item: AiMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && <View style={styles.aiAvatar}><Text style={styles.aiAvatarText}>AI</Text></View>}
        <View style={[styles.msgBubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={[styles.msgText, isUser && styles.userText]}>{item.content}</Text>
          {!isUser && item.tool_calls && item.tool_calls.length > 0 && (
            <Text style={styles.toolsUsed}>
              🔧 {item.tool_calls.join(', ')}
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (showHistory) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.historyHeader}>
          <Pressable onPress={() => setShowHistory(false)}>
            <Text style={styles.backText}>← Назад</Text>
          </Pressable>
          <Text style={styles.historyTitle}>История</Text>
          <Pressable onPress={handleNewChat}>
            <Text style={styles.newChatText}>+ Нов</Text>
          </Pressable>
        </View>
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <Pressable style={styles.historyCard} onPress={() => handleLoadConversation(item.id)}>
              <Text style={styles.historyCardTitle} numberOfLines={1}>{item.title || 'Разговор'}</Text>
              <Text style={styles.historyCardDate}>
                {new Date(item.updated_at).toLocaleDateString('bg-BG')}
              </Text>
            </Pressable>
          )}
          contentContainerStyle={styles.historyList}
          ListEmptyComponent={<Text style={styles.emptyText}>Няма предишни разговори</Text>}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>HOX AI</Text>
          <Text style={styles.headerSub}>Личен асистент</Text>
        </View>
        <Pressable onPress={loadHistory} style={styles.headerBtn}>
          <Text style={styles.historyBtn}>📋</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.msgList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.welcome}>
              <Text style={styles.welcomeIcon}>🤖</Text>
              <Text style={styles.welcomeTitle}>Здравей! Аз съм HOX AI.</Text>
              <Text style={styles.welcomeText}>
                Мога да ти помогна със сметки, документи, Score и сделки.
                Питай ме каквото искаш!
              </Text>
              <View style={styles.quickPrompts}>
                {QUICK_PROMPTS.map((qp, i) => (
                  <Pressable
                    key={i}
                    style={styles.quickPrompt}
                    onPress={() => handleSend(qp.prompt)}
                  >
                    <Text style={styles.quickPromptText}>{qp.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
        />

        {sending && (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.typingText}>HOX AI мисли...</Text>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Попитай HOX AI..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={4000}
          />
          <Pressable
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || sending}
          >
            <Text style={styles.sendBtnText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBtn: { padding: 8 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.primary },
  headerSub: { fontSize: 11, color: colors.textMuted },
  backText: { fontSize: 22, color: colors.primary },
  historyBtn: { fontSize: 20 },
  msgList: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  msgRowUser: { justifyContent: 'flex-end' },
  aiAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', marginRight: 8, marginBottom: 2,
  },
  aiAvatarText: { fontSize: 10, fontWeight: '800', color: colors.white },
  msgBubble: { maxWidth: '78%', borderRadius: 18, padding: 12 },
  userBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  msgText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  userText: { color: colors.white },
  toolsUsed: { fontSize: 10, color: colors.textMuted, marginTop: 6, fontStyle: 'italic' },
  welcome: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 20 },
  welcomeIcon: { fontSize: 56 },
  welcomeTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 16 },
  welcomeText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  quickPrompts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 24 },
  quickPrompt: {
    backgroundColor: colors.primaryLight, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  quickPromptText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  typingRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8,
  },
  typingText: { fontSize: 13, color: colors.textMuted, marginLeft: 8 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, backgroundColor: colors.background, borderRadius: 22,
    paddingHorizontal: 18, paddingVertical: 12, fontSize: 15, color: colors.text,
    maxHeight: 120, borderWidth: 1, borderColor: colors.border,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: 20, color: colors.white, fontWeight: '700' },
  // History
  historyHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  historyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  newChatText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  historyList: { padding: 16 },
  historyCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  historyCardTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  historyCardDate: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 14, paddingTop: 40 },
});
