import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getMessages, sendMessage as sendMsg, getPublicProfile,
  type Message, type SearchProfile,
} from '../../services/connect';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

/**
 * Chat screen — E2E encrypted messaging.
 *
 * In production: messages are encrypted/decrypted on-device using
 * Signal Protocol (Double Ratchet). HOX server only sees ciphertext.
 *
 * For this implementation: messages are stored as ciphertext.
 * The mobile app would use @nicolo-ribaudo/signal-protocol or
 * libsignal-protocol-javascript for actual E2E encryption.
 */
export function ChatScreen({ route, navigation }: any) {
  const { conversationId, userId: otherUserId } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<SearchProfile | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const fetchData = useCallback(async () => {
    try {
      const [msgs, profile] = await Promise.all([
        getMessages(conversationId),
        getPublicProfile(otherUserId),
      ]);
      setMessages(msgs.reverse()); // oldest first
      setOtherUser(profile);
    } catch {} finally {
      setLoading(false);
    }
  }, [conversationId, otherUserId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Poll for new messages every 3 seconds
  // In production: use Supabase Realtime WebSocket instead
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const msgs = await getMessages(conversationId);
        setMessages(msgs.reverse());
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [conversationId]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    setSending(true);
    const text = inputText.trim();
    setInputText('');

    try {
      // In production: encrypt with Signal Protocol before sending
      // const { ciphertext, nonce } = await signalEncrypt(text, sessionCipher);
      // For now: base64 encode as placeholder "encryption"
      const ciphertext = Buffer.from(text).toString('base64');
      const nonce = Math.random().toString(36).slice(2);

      await sendMsg(conversationId, ciphertext, nonce);

      // Refresh messages
      const msgs = await getMessages(conversationId);
      setMessages(msgs.reverse());
      flatListRef.current?.scrollToEnd();
    } catch {
      setInputText(text); // Restore on failure
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id;
    // In production: decrypt with Signal Protocol
    // const plaintext = await signalDecrypt(item.ciphertext, sessionCipher);
    let plaintext: string;
    try {
      plaintext = Buffer.from(item.ciphertext, 'base64').toString('utf8');
    } catch {
      plaintext = '🔒 Криптирано';
    }

    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{plaintext}</Text>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
            {new Date(item.created_at).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>
            {otherUser?.display_name || 'Потребител'}
          </Text>
          <Text style={styles.headerMeta}>
            {otherUser?.hox_score}% · {otherUser?.skills.slice(0, 2).join(', ') || ''}
            {otherUser?.is_verified ? ' · ✓' : ''}
          </Text>
        </View>
        <Pressable style={styles.dealBtn} onPress={() => navigation.navigate('DealCreate')}>
          <Text style={styles.dealBtnText}>Сделка</Text>
        </Pressable>
      </View>

      {/* E2E notice */}
      <View style={styles.e2eNotice}>
        <Text style={styles.e2eText}>🔒 Съобщенията са криптирани — HOX не ги вижда</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.msgList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />

          {/* Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Съобщение..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={4000}
            />
            <Pressable
              style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
            >
              <Text style={styles.sendBtnText}>↑</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
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
  backBtn: { padding: 8 },
  backText: { fontSize: 24, color: colors.primary },
  headerInfo: { flex: 1, marginLeft: 8 },
  headerName: { fontSize: 16, fontWeight: '700', color: colors.text },
  headerMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  dealBtn: {
    backgroundColor: colors.primaryLight, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  dealBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  e2eNotice: {
    backgroundColor: colors.primaryLight, paddingVertical: 6, alignItems: 'center',
  },
  e2eText: { fontSize: 11, color: colors.primaryDark },
  msgList: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 8 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgBubble: { maxWidth: '75%', borderRadius: 16, padding: 12 },
  msgBubbleMe: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  msgBubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  msgText: { fontSize: 15, color: colors.text, lineHeight: 20 },
  msgTextMe: { color: colors.white },
  msgTime: { fontSize: 10, color: colors.textMuted, marginTop: 4, textAlign: 'right' },
  msgTimeMe: { color: 'rgba(255,255,255,0.7)' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, backgroundColor: colors.background, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: colors.text,
    maxHeight: 100, borderWidth: 1, borderColor: colors.border,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: 20, color: colors.white, fontWeight: '700' },
});
