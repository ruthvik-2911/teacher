import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { getSchoolInfo, SchoolInfo } from '@/src/services/student';
import { registerForPushNotificationsAsync, updatePushTokenOnBackend } from '@/src/services/NotificationService';

// Import the separate home screens
import StudentHomeScreen from './student-home';
import TeacherHomeScreen from './teacher-home';

export default function HomeScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const router = useRouter();
  const styles = getStyles(isDark);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [userName, setUserName] = useState<string>('');

  const checkRole = async () => {
    try {
      const [token, userData, storedRole, hasSeenWelcome] = await AsyncStorage.multiGet(['authToken', 'userData', 'role', 'hasSeenWelcome']).then(entries => entries.map(e => e[1]));
      
      if (!token || !userData) {
        router.replace('/login');
        return;
      }

      console.log('[HOME] User role:', storedRole);
      setRole(storedRole);

      // Register for push notifications
      try {
        const pushToken = await registerForPushNotificationsAsync();
        if (pushToken) {
          await updatePushTokenOnBackend(pushToken);
        }
      } catch (err) {
        console.log('Push registration error:', err);
      }

      // Check if user has seen welcome popup
      if (!hasSeenWelcome) {
        // Load user and school data for welcome popup
        try {
          const [schoolInfo] = await Promise.all([
            getSchoolInfo()
          ]);
          setSchool(schoolInfo);
          
          // Extract user name
          if (userData) {
            const userDataObj = JSON.parse(userData);
            const rawName = userDataObj?.name ?? userDataObj?.fullName ?? userDataObj?.displayName;
            let display = '';
            if (typeof rawName === 'string') {
              display = rawName;
            } else if (rawName && typeof rawName === 'object') {
              display = rawName.displayName || [rawName.firstName, rawName.middleName, rawName.lastName].filter(Boolean).join(' ');
            } else {
              display = [userDataObj?.firstName, userDataObj?.middleName, userDataObj?.lastName].filter(Boolean).join(' ');
            }
            setUserName(display || 'User');
          }
          
          setShowWelcome(true);
        } catch (error) {
          console.error('Error loading welcome data:', error);
          // Still show welcome even if data loading fails
          setShowWelcome(true);
        }
      }
    } catch (error) {
      console.error('Error checking role:', error);
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleWelcomeClose = async () => {
    setShowWelcome(false);
    // Mark that user has seen the welcome popup
    await AsyncStorage.setItem('hasSeenWelcome', 'true');
  };

  useEffect(() => {
    checkRole();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <ActivityIndicator size="large" color="#60A5FA" />
        <Text style={[styles.loadingText, { color: isDark ? '#93C5FD' : '#1E3A8A' }]}>Loading...</Text>
      </SafeAreaView>
    );
  }

  // Route to appropriate home screen based on role
  let homeScreen = null;
  if (role === 'teacher') {
    homeScreen = <TeacherHomeScreen />;
  } else if (role === 'student') {
    homeScreen = <StudentHomeScreen />;
  } else {
    // Fallback for unknown roles
    homeScreen = (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <Text style={[styles.errorText, { color: isDark ? '#EF4444' : '#DC2626' }]}>Unknown user role</Text>
        <Text style={[styles.loadingText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Please contact support</Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      {homeScreen}
      <Modal transparent visible={showWelcome} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{school?.schoolName || 'Welcome'}</Text>
              <Text style={styles.modalSubtitle}>Hi {userName}, welcome to GOODSYNK ERP!</Text>
            </View>
            <TouchableOpacity style={styles.modalButton} onPress={handleWelcomeClose}>
              <Text style={styles.modalButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function getStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0B0F14' : '#E0F2FE',
    },
    loadingText: {
      fontSize: 16,
      marginTop: 12,
    },
    errorText: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 8,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCard: {
      width: '84%',
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      borderRadius: 16,
      padding: 20,
      borderWidth: 2,
      borderColor: isDark ? '#1F2937' : '#93C5FD',
    },
    modalHeader: {
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#E5E7EB' : '#1E3A8A',
      marginTop: 8,
    },
    modalSubtitle: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#475569',
      marginTop: 4,
    },
    modalButton: {
      backgroundColor: '#3B82F6',
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    modalButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
