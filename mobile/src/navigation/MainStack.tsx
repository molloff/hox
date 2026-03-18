import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '../screens/main/ProfileScreen';
import { VaultScreen } from '../screens/main/VaultScreen';
import { VaultUploadScreen } from '../screens/main/VaultUploadScreen';
import { VaultFileDetailScreen } from '../screens/main/VaultFileDetailScreen';
import { PayScreen } from '../screens/main/PayScreen';
import { DealScreen } from '../screens/main/DealScreen';
import { DealCreateScreen } from '../screens/main/DealCreateScreen';
import { DealDetailScreen } from '../screens/main/DealDetailScreen';
import { IndexScreen } from '../screens/main/IndexScreen';
import { ConnectScreen } from '../screens/main/ConnectScreen';
import { ChatScreen } from '../screens/main/ChatScreen';
import { NotificationsScreen } from '../screens/main/NotificationsScreen';
import { NotificationSettingsScreen } from '../screens/main/NotificationSettingsScreen';
import { AiChatScreen } from '../screens/main/AiChatScreen';
import { VoiceDiaryScreen } from '../screens/main/VoiceDiaryScreen';
import { colors } from '../theme/colors';

export type MainStackParamList = {
  Profile: undefined;
  Vault: undefined;
  VaultUpload: undefined;
  VaultFileDetail: { fileId: string };
  Pay: undefined;
  Deal: undefined;
  DealCreate: undefined;
  DealDetail: { dealId: string };
  Index: undefined;
  Connect: undefined;
  Chat: { conversationId: string; userId: string };
  Notifications: undefined;
  NotificationSettings: undefined;
  AiChat: { conversationId?: string } | undefined;
  VoiceDiary: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Pay" component={PayScreen} />
      <Stack.Screen name="Vault" component={VaultScreen} />
      <Stack.Screen name="VaultUpload" component={VaultUploadScreen} />
      <Stack.Screen name="VaultFileDetail" component={VaultFileDetailScreen} />
      <Stack.Screen name="Deal" component={DealScreen} />
      <Stack.Screen name="DealCreate" component={DealCreateScreen} />
      <Stack.Screen name="DealDetail" component={DealDetailScreen} />
      <Stack.Screen name="Index" component={IndexScreen} />
      <Stack.Screen name="Connect" component={ConnectScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="AiChat" component={AiChatScreen} />
      <Stack.Screen name="VoiceDiary" component={VoiceDiaryScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}
