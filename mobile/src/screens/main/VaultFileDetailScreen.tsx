import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Alert, Share,
} from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import {
  createShare, revokeShare, getAuditLog, getFileShares,
  triggerOcr, deleteFile, type VaultFile,
} from '../../services/vault';
import api from '../../services/api';
import { colors } from '../../theme/colors';

export function VaultFileDetailScreen({ route, navigation }: any) {
  const { fileId } = route.params;
  const [file, setFile] = useState<VaultFile | null>(null);
  const [shares, setShares] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [filesRes, sharesRes, auditRes] = await Promise.all([
          api.get(`/vault/files`, { params: {} }),
          getFileShares(fileId),
          getAuditLog(fileId),
        ]);
        const found = filesRes.data.files.find((f: VaultFile) => f.id === fileId);
        setFile(found || null);
        setShares(sharesRes);
        setAudit(auditRes);
      } catch {
        Alert.alert('Грешка', 'Неуспешно зареждане');
      } finally {
        setLoading(false);
      }
    })();
  }, [fileId]);

  const handleOcr = async () => {
    setOcrLoading(true);
    try {
      await triggerOcr(fileId);
      Alert.alert('Готово', 'OCR текстът е извлечен');
    } catch {
      Alert.alert('Грешка', 'OCR не успя');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleShare = async (minutes: number) => {
    setShareLoading(true);
    try {
      const result = await createShare({ fileId, expiresInMinutes: minutes, maxViews: 1 });
      await Share.share({ message: result.url, title: 'HOX Vault QR' });
      setShares((s) => [{ ...result, id: result.shareId, is_revoked: false, view_count: 0 }, ...s]);
    } catch {
      Alert.alert('Грешка', 'Споделянето не успя');
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    try {
      await revokeShare(shareId);
      setShares((s) => s.map((x) => x.id === shareId ? { ...x, is_revoked: true } : x));
    } catch {
      Alert.alert('Грешка', 'Отмяната не успя');
    }
  };

  const handleDelete = () => {
    Alert.alert('Изтриване', 'Сигурен ли си? Това е необратимо.', [
      { text: 'Отказ', style: 'cancel' },
      {
        text: 'Изтрий', style: 'destructive', onPress: async () => {
          try {
            await deleteFile(fileId);
            navigation.goBack();
          } catch {
            Alert.alert('Грешка', 'Изтриването не успя');
          }
        },
      },
    ]);
  };

  if (loading) {
    return <ScreenWrapper><ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} /></ScreenWrapper>;
  }

  if (!file) {
    return <ScreenWrapper><Text style={styles.error}>Файлът не е намерен</Text></ScreenWrapper>;
  }

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{file.title}</Text>
        <Text style={styles.meta}>
          {file.original_name} · {(file.size_bytes / 1024).toFixed(1)} KB
        </Text>
        {file.expires_at && (
          <Text style={styles.expiry}>Изтича: {new Date(file.expires_at).toLocaleDateString('bg-BG')}</Text>
        )}

        {/* OCR */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OCR Текст</Text>
          {file.ocr_status === 'done' ? (
            <Text style={styles.ocrDone}>✓ Текстът е извлечен и търсим</Text>
          ) : (
            <Pressable style={styles.actionBtn} onPress={handleOcr} disabled={ocrLoading}>
              {ocrLoading ? <ActivityIndicator color={colors.white} /> : (
                <Text style={styles.actionBtnText}>Извлечи текст (OCR)</Text>
              )}
            </Pressable>
          )}
        </View>

        {/* Share */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QR Споделяне</Text>
          <View style={styles.shareRow}>
            <Pressable style={styles.shareBtn} onPress={() => handleShare(10)} disabled={shareLoading}>
              <Text style={styles.shareBtnText}>10 мин</Text>
            </Pressable>
            <Pressable style={styles.shareBtn} onPress={() => handleShare(30)} disabled={shareLoading}>
              <Text style={styles.shareBtnText}>30 мин</Text>
            </Pressable>
            <Pressable style={styles.shareBtn} onPress={() => handleShare(1440)} disabled={shareLoading}>
              <Text style={styles.shareBtnText}>24 часа</Text>
            </Pressable>
          </View>

          {shares.length > 0 && (
            <View style={styles.sharesList}>
              {shares.map((s: any) => (
                <View key={s.id} style={styles.shareItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shareInfo}>
                      {s.is_revoked ? '🚫 Отменен' : `👁 ${s.view_count || 0} прегледа`}
                    </Text>
                    <Text style={styles.shareMeta}>
                      Изтича: {new Date(s.expiresAt || s.expires_at).toLocaleString('bg-BG')}
                    </Text>
                  </View>
                  {!s.is_revoked && (
                    <Pressable onPress={() => handleRevoke(s.id)}>
                      <Text style={styles.revokeText}>Отмени</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Audit */}
        {audit.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Одит лог</Text>
            {audit.map((a: any) => (
              <View key={a.id} style={styles.auditItem}>
                <Text style={styles.auditText}>
                  {a.action} · {new Date(a.created_at).toLocaleString('bg-BG')}
                </Text>
                <Text style={styles.auditMeta}>IP: {a.accessor_ip || '—'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Delete */}
        <Pressable style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>Изтрий файла</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 8 },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  expiry: { fontSize: 13, color: colors.warning, fontWeight: '600', marginTop: 6 },
  error: { fontSize: 16, color: colors.error, textAlign: 'center', marginTop: 40 },
  section: {
    marginTop: 24,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 },
  ocrDone: { fontSize: 14, color: colors.success, fontWeight: '600' },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  shareRow: { flexDirection: 'row', gap: 8 },
  shareBtn: {
    flex: 1,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  shareBtnText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  sharesList: { marginTop: 12 },
  shareItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  shareInfo: { fontSize: 13, color: colors.text },
  shareMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  revokeText: { color: colors.error, fontSize: 13, fontWeight: '600' },
  auditItem: { paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  auditText: { fontSize: 13, color: colors.text },
  auditMeta: { fontSize: 11, color: colors.textMuted },
  deleteBtn: {
    borderWidth: 2,
    borderColor: colors.error,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  deleteBtnText: { color: colors.error, fontSize: 15, fontWeight: '700' },
});
