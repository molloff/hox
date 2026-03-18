import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, TextInput, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import {
  listFiles, searchVault, deleteFile,
  type VaultFile, type VaultCategory,
} from '../../services/vault';
import { colors } from '../../theme/colors';

const CATEGORIES: { value: VaultCategory | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'Всички', icon: '📁' },
  { value: 'documents', label: 'Документи', icon: '🪪' },
  { value: 'receipts', label: 'Бележки', icon: '🧾' },
  { value: 'warranties', label: 'Гаранции', icon: '🛡' },
  { value: 'health', label: 'Здраве', icon: '❤️' },
  { value: 'children', label: 'Деца', icon: '👶' },
  { value: 'pets', label: 'Любимци', icon: '🐾' },
  { value: 'diary', label: 'Дневник', icon: '📝' },
  { value: 'contracts', label: 'Договори', icon: '📄' },
  { value: 'certificates', label: 'Сертификати', icon: '🎓' },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function VaultScreen({ navigation }: any) {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<VaultCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const fetchFiles = useCallback(async () => {
    try {
      const cat = category === 'all' ? undefined : category;
      const data = await listFiles(cat);
      setFiles(data);
    } catch {
      Alert.alert('Грешка', 'Неуспешно зареждане');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) { fetchFiles(); return; }
    setSearching(true);
    try {
      const results = await searchVault(searchQuery);
      setFiles(results);
    } catch {
      Alert.alert('Грешка', 'Търсенето не успя');
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = (file: VaultFile) => {
    Alert.alert('Изтриване', `Изтрий "${file.title}"?`, [
      { text: 'Отказ', style: 'cancel' },
      {
        text: 'Изтрий', style: 'destructive', onPress: async () => {
          try {
            await deleteFile(file.id);
            setFiles((f) => f.filter((x) => x.id !== file.id));
          } catch { Alert.alert('Грешка', 'Неуспешно изтриване'); }
        },
      },
    ]);
  };

  const renderFile = ({ item }: { item: VaultFile }) => {
    const catInfo = CATEGORIES.find((c) => c.value === item.category);
    const isExpiring = item.expires_at && new Date(item.expires_at).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;

    return (
      <Pressable
        style={styles.fileCard}
        onPress={() => navigation.navigate('VaultFileDetail', { fileId: item.id })}
        onLongPress={() => handleDelete(item)}
      >
        <Text style={styles.fileIcon}>{catInfo?.icon || '📁'}</Text>
        <View style={styles.fileInfo}>
          <Text style={styles.fileTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.fileMeta}>
            {formatSize(item.size_bytes)} · {formatDate(item.created_at)}
            {item.ocr_status === 'done' ? ' · OCR ✓' : ''}
          </Text>
          {isExpiring && (
            <Text style={styles.expiryWarning}>
              ⚠ Изтича {formatDate(item.expires_at!)}
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenWrapper>
      <Text style={styles.title}>Vault</Text>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Търси в документите..."
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searching && <ActivityIndicator color={colors.primary} style={styles.searchSpinner} />}
      </View>

      {/* Categories */}
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(c) => c.value}
        showsHorizontalScrollIndicator={false}
        style={styles.catList}
        renderItem={({ item: c }) => (
          <Pressable
            style={[styles.catChip, category === c.value && styles.catChipActive]}
            onPress={() => setCategory(c.value)}
          >
            <Text style={styles.catIcon}>{c.icon}</Text>
            <Text style={[styles.catLabel, category === c.value && styles.catLabelActive]}>
              {c.label}
            </Text>
          </Pressable>
        )}
      />

      {/* File list */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={files}
          keyExtractor={(f) => f.id}
          renderItem={renderFile}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFiles(); }} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📂</Text>
              <Text style={styles.emptyText}>Няма файлове</Text>
              <Text style={styles.emptyHint}>Качи документ, бележка или гаранция</Text>
            </View>
          }
        />
      )}

      {/* Upload FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('VaultUpload')}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text, paddingTop: 8, paddingBottom: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  searchSpinner: { marginLeft: 8 },
  catList: { maxHeight: 44, marginBottom: 12 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  catChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  catIcon: { fontSize: 14, marginRight: 4 },
  catLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  catLabelActive: { color: colors.primary, fontWeight: '700' },
  loader: { flex: 1, justifyContent: 'center' },
  list: { paddingBottom: 80 },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fileIcon: { fontSize: 28, marginRight: 14 },
  fileInfo: { flex: 1 },
  fileTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  fileMeta: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  expiryWarning: { fontSize: 12, color: colors.warning, fontWeight: '600', marginTop: 3 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 12 },
  emptyHint: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  fabText: { fontSize: 28, color: colors.white, fontWeight: '300', marginTop: -2 },
});
