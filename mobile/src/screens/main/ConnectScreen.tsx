import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import {
  searchUsers, listConversations, createConversation,
  type SearchProfile, type Conversation,
} from '../../services/connect';
import { colors } from '../../theme/colors';

type Tab = 'chats' | 'search';

export function ConnectScreen({ navigation }: any) {
  const [tab, setTab] = useState<Tab>('chats');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchResults, setSearchResults] = useState<SearchProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await listConversations();
      setConversations(data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchUsers(searchQuery.trim());
      setSearchResults(results);
      setTab('search');
    } catch {
      Alert.alert('Грешка', 'Търсенето не успя');
    } finally {
      setSearching(false);
    }
  };

  const handleStartChat = async (userId: string) => {
    try {
      const conversationId = await createConversation(userId);
      navigation.navigate('Chat', { conversationId, userId });
    } catch {
      Alert.alert('Грешка', 'Не успя');
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <Pressable
      style={styles.card}
      onPress={() => navigation.navigate('Chat', {
        conversationId: item.conversation.id,
        userId: item.otherUser.user_id,
      })}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(item.otherUser.display_name || '?')[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.otherUser.display_name || 'Потребител'}
          </Text>
          <Text style={styles.cardScore}>{item.otherUser.hox_score}%</Text>
        </View>
        {item.otherUser.skills.length > 0 && (
          <Text style={styles.cardSkills} numberOfLines={1}>
            {item.otherUser.skills.join(' · ')}
          </Text>
        )}
        {item.lastMessage && (
          <Text style={styles.cardLastMsg} numberOfLines={1}>
            🔒 Криптирано съобщение
          </Text>
        )}
      </View>
    </Pressable>
  );

  const renderSearchResult = ({ item }: { item: SearchProfile }) => (
    <Pressable style={styles.card} onPress={() => handleStartChat(item.user_id)}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(item.display_name || '?')[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.display_name || 'Потребител'}
          </Text>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreBadgeText}>{item.hox_score}%</Text>
          </View>
        </View>
        {item.skills.length > 0 && (
          <Text style={styles.cardSkills} numberOfLines={1}>
            {item.skills.join(' · ')}
          </Text>
        )}
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        {item.is_verified && <Text style={styles.verified}>✓ Верифициран</Text>}
      </View>
    </Pressable>
  );

  return (
    <ScreenWrapper>
      <Text style={styles.title}>Connect</Text>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Търси по умение: Електротехник, ВиК..."
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searching && <ActivityIndicator color={colors.primary} style={{ marginLeft: 8 }} />}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === 'chats' && styles.tabActive]} onPress={() => setTab('chats')}>
          <Text style={[styles.tabText, tab === 'chats' && styles.tabTextActive]}>
            Чатове ({conversations.length})
          </Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'search' && styles.tabActive]} onPress={() => setTab('search')}>
          <Text style={[styles.tabText, tab === 'search' && styles.tabTextActive]}>
            Търсене ({searchResults.length})
          </Text>
        </Pressable>
      </View>

      {loading && tab === 'chats' ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={tab === 'chats' ? conversations : searchResults}
          keyExtractor={(item: any) => item.conversation?.id || item.user_id}
          renderItem={tab === 'chats' ? renderConversation : renderSearchResult}
          contentContainerStyle={styles.list}
          refreshControl={tab === 'chats' ? <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchConversations(); }} /> : undefined}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>{tab === 'chats' ? '💬' : '🔍'}</Text>
              <Text style={styles.emptyText}>
                {tab === 'chats' ? 'Няма чатове' : 'Търси по умение за да намериш хора'}
              </Text>
            </View>
          }
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text, paddingTop: 8, paddingBottom: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  searchInput: {
    flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: colors.text,
  },
  tabs: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.primary },
  list: { paddingBottom: 20 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: colors.primary },
  cardBody: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  cardScore: { fontSize: 13, fontWeight: '700', color: colors.primary, marginLeft: 8 },
  scoreBadge: {
    backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
  },
  scoreBadgeText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  cardSkills: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  cardDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 16 },
  cardLastMsg: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  verified: { fontSize: 11, color: colors.success, fontWeight: '600', marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: colors.textMuted, marginTop: 12, textAlign: 'center' },
});
