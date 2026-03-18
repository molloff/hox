import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { OnboardingStack } from './OnboardingStack';
import { MainStack } from './MainStack';
import { colors } from '../theme/colors';

export function RootNavigator() {
  const { isLoading, isAuthenticated, isVerified } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Show onboarding if not authenticated or not verified
  if (!isAuthenticated || !isVerified) {
    return <OnboardingStack />;
  }

  return <MainStack />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
