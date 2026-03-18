import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PhoneScreen } from '../screens/onboarding/PhoneScreen';
import { SmsCodeScreen } from '../screens/onboarding/SmsCodeScreen';
import { ConsentScreen } from '../screens/onboarding/ConsentScreen';
import { IdCardScreen } from '../screens/onboarding/IdCardScreen';
import { WaitingScreen } from '../screens/onboarding/WaitingScreen';
import { colors } from '../theme/colors';

export type OnboardingStackParamList = {
  Phone: undefined;
  SmsCode: { phone: string };
  Consent: undefined;
  IdCard: undefined;
  Waiting: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Phone" component={PhoneScreen} />
      <Stack.Screen name="SmsCode" component={SmsCodeScreen} />
      <Stack.Screen name="Consent" component={ConsentScreen} />
      <Stack.Screen name="IdCard" component={IdCardScreen} />
      <Stack.Screen name="Waiting" component={WaitingScreen} />
    </Stack.Navigator>
  );
}
