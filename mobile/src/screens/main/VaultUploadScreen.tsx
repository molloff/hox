import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { uploadFile, type VaultCategory } from '../../services/vault';
import { colors } from '../../theme/colors';

const CATEGORIES: { value: VaultCategory; label: string; icon: string }[] = [
  { value: 'documents', label: 'Документи', icon: '🪪' },
  { value: 'receipts', label: 'Касови бележки', icon: '🧾' },
  { value: 'warranties', label: 'Гаранции', icon: '🛡' },
  { value: 'health', label: 'Здраве', icon: '❤️' },
  { value: 'children', label: 'Деца', icon: '👶' },
  { value: 'pets', label: 'Любимци', icon: '🐾' },
  { value: 'diary', label: 'Дневник', icon: '📝' },
  { value: 'contracts', label: 'Договори', icon: '📄' },
  { value: 'certificates', label: 'Сертификати', icon: '🎓' },
];

export function VaultUploadScreen({ navigation }: any) {
  const [category, setCategory] = useState<VaultCategory>('documents');
  const [title, setTitle] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ name: string; uri: string; mimeType: string; size: number } | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          name: asset.name,
          uri: asset.uri,
          mimeType: asset.mimeType || 'application/octet-stream',
          size: asset.size || 0,
        });
        if (!title) setTitle(asset.name.replace(/\.[^.]+$/, ''));
      }
    } catch {
      Alert.alert('Грешка', 'Неуспешно избиране на файл');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) {
      Alert.alert('Грешка', 'Избери файл и въведи заглавие');
      return;
    }

    setUploading(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(selectedFile.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await uploadFile({
        category,
        title: title.trim(),
        fileBase64: base64,
        originalName: selectedFile.name,
        mimeType: selectedFile.mimeType,
        expiresAt: expiresAt || undefined,
      });

      Alert.alert('Готово', 'Файлът е криптиран и качен в Vault', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Грешка', 'Качването не успя');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Качи във Vault</Text>

        {/* Category */}
        <Text style={styles.label}>Категория</Text>
        <View style={styles.catGrid}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.value}
              style={[styles.catBtn, category === c.value && styles.catBtnActive]}
              onPress={() => setCategory(c.value)}
            >
              <Text style={styles.catIcon}>{c.icon}</Text>
              <Text style={[styles.catLabel, category === c.value && styles.catLabelActive]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* File picker */}
        <Text style={styles.label}>Файл</Text>
        <Pressable style={styles.filePicker} onPress={pickFile}>
          {selectedFile ? (
            <View>
              <Text style={styles.fileName}>{selectedFile.name}</Text>
              <Text style={styles.fileSize}>
                {(selectedFile.size / 1024).toFixed(1)} KB
              </Text>
            </View>
          ) : (
            <Text style={styles.filePickerText}>Натисни за избор на файл</Text>
          )}
        </Pressable>

        {/* Title */}
        <Text style={styles.label}>Заглавие</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Напр: Лична карта, Гаранция хладилник..."
          placeholderTextColor={colors.textMuted}
          maxLength={200}
        />

        {/* Expiry date */}
        <Text style={styles.label}>Изтича на (по желание)</Text>
        <TextInput
          style={styles.input}
          value={expiresAt}
          onChangeText={setExpiresAt}
          placeholder="ГГГГ-ММ-ДД напр. 2027-05-15"
          placeholderTextColor={colors.textMuted}
          maxLength={10}
        />

        {/* Privacy note */}
        <View style={styles.note}>
          <Text style={styles.noteText}>
            🔒 Файлът се криптира с AES-256-GCM преди качване.
            Ключът е уникален за теб и е в HashiCorp Vault.
            Дори ние не можем да го прочетем.
          </Text>
        </View>

        {/* Upload button */}
        <Pressable
          style={[styles.uploadBtn, (uploading || !selectedFile) && styles.uploadBtnDisabled]}
          onPress={handleUpload}
          disabled={uploading || !selectedFile}
        >
          {uploading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.uploadBtnText}>Криптирай и качи</Text>
          )}
        </Pressable>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 20 },
  label: {
    fontSize: 13, fontWeight: '600', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 18, marginBottom: 8,
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  catBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  catIcon: { fontSize: 16, marginRight: 6 },
  catLabel: { fontSize: 13, color: colors.textSecondary },
  catLabelActive: { color: colors.primary, fontWeight: '700' },
  filePicker: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  filePickerText: { fontSize: 15, color: colors.textMuted },
  fileName: { fontSize: 15, fontWeight: '600', color: colors.text, textAlign: 'center' },
  fileSize: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  note: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
  },
  noteText: { fontSize: 12, color: colors.primaryDark, lineHeight: 18 },
  uploadBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  uploadBtnDisabled: { opacity: 0.5 },
  uploadBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
