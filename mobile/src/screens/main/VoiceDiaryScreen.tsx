import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, TextInput, StyleSheet,
  ActivityIndicator, Alert, Animated, RefreshControl,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import {
  uploadVoiceEntry, listEntries, askDiary,
  type DiaryEntry,
} from '../../services/voiceDiary';
import { colors } from '../../theme/colors';

const MOOD_ICONS: Record<string, string> = {
  'положително': '😊',
  'неутрално': '😐',
  'отрицателно': '😔',
  'смесено': '🤔',
};

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return `${min}:${String(s).padStart(2, '0')}`;
}

export function VoiceDiaryScreen() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [askMode, setAskMode] = useState(false);
  const [question, setQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const fetch = useCallback(async () => {
    try {
      const data = await listEntries();
      setEntries(data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Pulse animation while recording
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Разрешение', 'Нужен е достъп до микрофона');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(rec);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1000);
      }, 1000);
    } catch (err) {
      Alert.alert('Грешка', 'Записът не успя да стартира');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    clearInterval(timerRef.current);
    setIsRecording(false);
    setProcessing(true);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) throw new Error('No recording URI');

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const status = await recording.getStatusAsync();
      const duration = status.durationMillis || recordingDuration;

      const result = await uploadVoiceEntry(base64, duration);

      // Add to list
      const newEntry: DiaryEntry = {
        id: result.recordingId,
        vault_file_id: result.vaultFileId,
        duration_ms: duration,
        transcript: result.transcript,
        transcript_status: 'done',
        ai_summary: result.summary,
        ai_tags: result.tags,
        ai_mood: result.mood,
        created_at: new Date().toISOString(),
      };
      setEntries((prev) => [newEntry, ...prev]);

      Alert.alert('Готово', `${result.summary}\n\nНастроение: ${MOOD_ICONS[result.mood] || ''} ${result.mood}`);
    } catch (err) {
      Alert.alert('Грешка', 'Обработката не успя. Опитай отново.');
    } finally {
      setProcessing(false);
    }
  };

  const handleAsk = async () => {
    if (!question.trim() || asking) return;
    setAsking(true);
    setAiAnswer(null);
    try {
      const answer = await askDiary(question.trim());
      setAiAnswer(answer);
    } catch {
      setAiAnswer('Грешка — опитай отново.');
    } finally {
      setAsking(false);
    }
  };

  const renderEntry = ({ item }: { item: DiaryEntry }) => (
    <View style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <Text style={styles.entryMood}>{MOOD_ICONS[item.ai_mood || ''] || '📝'}</Text>
        <View style={styles.entryMeta}>
          <Text style={styles.entryDate}>
            {new Date(item.created_at).toLocaleDateString('bg-BG', {
              day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </Text>
          <Text style={styles.entryDuration}>{formatDuration(item.duration_ms)}</Text>
        </View>
      </View>

      {item.ai_summary && <Text style={styles.entrySummary}>{item.ai_summary}</Text>}

      {item.transcript && (
        <Text style={styles.entryTranscript} numberOfLines={3}>{item.transcript}</Text>
      )}

      {item.ai_tags && item.ai_tags.length > 0 && (
        <View style={styles.tags}>
          {item.ai_tags.map((tag, i) => (
            <View key={i} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {item.transcript_status === 'processing' && (
        <View style={styles.processingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.processingText}>Обработва се...</Text>
        </View>
      )}
    </View>
  );

  return (
    <ScreenWrapper>
      <Text style={styles.title}>Дневник</Text>

      {/* Ask AI toggle */}
      <Pressable style={styles.askToggle} onPress={() => setAskMode(!askMode)}>
        <Text style={styles.askToggleText}>
          {askMode ? '📋 Покажи записите' : '🤖 Попитай AI за дневника'}
        </Text>
      </Pressable>

      {askMode ? (
        <View style={styles.askContainer}>
          <TextInput
            style={styles.askInput}
            value={question}
            onChangeText={setQuestion}
            placeholder="Напр: Как се чувствах миналата седмица?"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={2000}
          />
          <Pressable
            style={[styles.askBtn, (!question.trim() || asking) && styles.askBtnDisabled]}
            onPress={handleAsk}
            disabled={!question.trim() || asking}
          >
            {asking ? <ActivityIndicator color={colors.white} /> : (
              <Text style={styles.askBtnText}>Попитай</Text>
            )}
          </Pressable>
          {aiAnswer && (
            <View style={styles.answerBox}>
              <Text style={styles.answerLabel}>🤖 HOX AI:</Text>
              <Text style={styles.answerText}>{aiAnswer}</Text>
            </View>
          )}
        </View>
      ) : (
        <>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
          ) : (
            <FlatList
              data={entries}
              keyExtractor={(e) => e.id}
              renderItem={renderEntry}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>🎙️</Text>
                  <Text style={styles.emptyTitle}>Дневникът е празен</Text>
                  <Text style={styles.emptyText}>
                    Натисни и задръж микрофона за да запишеш.{'\n'}
                    AI ще транскрибира, анализира и криптира записа.
                  </Text>
                </View>
              }
            />
          )}
        </>
      )}

      {/* Recording button */}
      {!askMode && (
        <View style={styles.recordContainer}>
          {isRecording && (
            <Text style={styles.recordTimer}>{formatDuration(recordingDuration)}</Text>
          )}
          {processing ? (
            <View style={styles.processingBtn}>
              <ActivityIndicator color={colors.white} size="large" />
            </View>
          ) : (
            <Pressable
              onPressIn={startRecording}
              onPressOut={stopRecording}
              style={styles.recordBtnOuter}
            >
              <Animated.View style={[styles.recordBtn, { transform: [{ scale: pulseAnim }] }]}>
                <Text style={styles.recordIcon}>{isRecording ? '⏹' : '🎙️'}</Text>
              </Animated.View>
            </Pressable>
          )}
          <Text style={styles.recordHint}>
            {isRecording ? 'Пусни за край' : processing ? 'Обработва...' : 'Натисни и задръж'}
          </Text>
        </View>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text, paddingTop: 8, paddingBottom: 8 },
  askToggle: {
    backgroundColor: colors.primaryLight, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', marginBottom: 12,
  },
  askToggleText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  askContainer: { flex: 1, paddingTop: 8 },
  askInput: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: colors.text, minHeight: 80, textAlignVertical: 'top',
  },
  askBtn: {
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 12,
  },
  askBtnDisabled: { opacity: 0.4 },
  askBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  answerBox: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 16,
    marginTop: 16, borderWidth: 1, borderColor: colors.border,
  },
  answerLabel: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 8 },
  answerText: { fontSize: 14, color: colors.text, lineHeight: 22 },
  list: { paddingBottom: 140 },
  entryCard: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  entryHeader: { flexDirection: 'row', alignItems: 'center' },
  entryMood: { fontSize: 28, marginRight: 12 },
  entryMeta: { flex: 1 },
  entryDate: { fontSize: 13, fontWeight: '600', color: colors.text },
  entryDuration: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  entrySummary: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 10, lineHeight: 22 },
  entryTranscript: { fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 18, fontStyle: 'italic' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  processingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  processingText: { fontSize: 12, color: colors.textMuted, marginLeft: 8 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 12 },
  emptyText: { fontSize: 14, color: colors.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  recordContainer: { position: 'absolute', bottom: 24, left: 0, right: 0, alignItems: 'center' },
  recordTimer: { fontSize: 20, fontWeight: '700', color: colors.error, marginBottom: 8 },
  recordBtnOuter: { alignItems: 'center' },
  recordBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 8,
  },
  processingBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.textMuted,
    justifyContent: 'center', alignItems: 'center',
  },
  recordIcon: { fontSize: 28 },
  recordHint: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
});
