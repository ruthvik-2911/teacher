import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedLogo } from '@/components/ThemedLogo';
import { loginSchool, loginGlobal } from '@/src/services/auth';

export default function LoginScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(isDark);
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();

  const [selectedRole, setSelectedRole] = useState<'Student' | 'Teacher' | 'Admin'>(
    params.role ? String(params.role) as 'Student' | 'Teacher' | 'Admin' : 'Student'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<{ show: boolean; title: string; message: string }>({
    show: false,
    title: '',
    message: ''
  });

  const showError = (title: string, message: string) => {
    setErrorModal({ show: true, title, message });
  };

  const handleLogin = async () => {
    if (!email || !password || !schoolCode) {
      showError('Missing Information', 'Please fill in all fields:\n• Email or ID\n• Password\n• School Code');
      return;
    }
    setLoading(true);
    try {
      console.log(`Attempting login with: ${email} (email or userId), school code: ${schoolCode}`);
      // Use identifier (email or userId) for login - backend supports both
      const res = await loginSchool({ identifier: email, password, schoolCode });

      if (!res || !res.success) {
        const errorMsg = res?.message || 'Login failed';
        const lowerMsg = errorMsg.toLowerCase();

        // Provide specific error messages based on the response
        // Check for specific error patterns
        if (lowerMsg.includes('incorrect password') || (lowerMsg.includes('password') && !lowerMsg.includes('school'))) {
          showError('Incorrect Password', 'The password you entered is incorrect. Please try again.');
        } else if (lowerMsg.includes('invalid email/user id or school code')) {
          // This error means either user doesn't exist OR school code is wrong
          // Show a combined message
          showError('Invalid Credentials', 'The email/ID or school code you entered is incorrect. Please verify both and try again.');
        } else if (lowerMsg.includes('school code') || lowerMsg.includes('school not found')) {
          showError('Invalid School Code', 'The school code you entered is incorrect. Please check and try again.');
        } else if (lowerMsg.includes('user not found') || lowerMsg.includes('email not found') || lowerMsg.includes('invalid credentials')) {
          showError('User Not Found', `The ${selectedRole === 'Student' ? 'student' : 'teacher'} email or ID you entered does not exist. Please check and try again.`);
        } else {
          showError('Login Failed', errorMsg);
        }
        setLoading(false);
        return;
      }
      console.log('Login successful, navigating to tabs');
      router.replace('/(tabs)');
    } catch (e: any) {
      console.error('Login error:', e);
      const errorMessage = e?.response?.data?.message || e?.message || '';
      const lowerMsg = errorMessage.toLowerCase();

      // Provide specific error messages
      if (lowerMsg.includes('incorrect password') || (lowerMsg.includes('password') && !lowerMsg.includes('school'))) {
        showError('Incorrect Password', 'The password you entered is wrong. Please check your password and try again.');
      } else if (lowerMsg.includes('invalid email/user id or school code')) {
        // This error means either user doesn't exist OR school code is wrong
        showError('Invalid Credentials', 'The email/ID or school code you entered is incorrect. Please verify both and try again.');
      } else if (lowerMsg.includes('school code') || lowerMsg.includes('school not found')) {
        showError('Invalid School Code', 'The school code you entered is incorrect. Please verify your school code and try again.');
      } else if (lowerMsg.includes('user not found') || lowerMsg.includes('email not found') || lowerMsg.includes('invalid credentials')) {
        showError('User Not Found', `The ${selectedRole === 'Student' ? 'student' : 'teacher'} email or ID you entered does not exist in our system. Please check your credentials.`);
      } else if (lowerMsg.includes('network') || lowerMsg.includes('connection')) {
        showError('Connection Error', 'Unable to connect to the server. Please check your internet connection and try again.');
      } else {
        showError('Login Error', errorMessage || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.logoContainer}>
            <View style={styles.logoPlaceholder}>
              <ThemedLogo
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.logoTitle}>GOODSYNK ERP</Text>
              <Text style={styles.logoSubtitle}>EMPOWERING TECHNOLOGIES</Text>
            </View>
          </View>

          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeTitle}>Welcome</Text>
            <Text style={styles.welcomeSubtitle}>Login in to your account</Text>
          </View>

          <View style={styles.roleContainer}>
            {(['Student', 'Teacher'] as const).map((role) => (
              <TouchableOpacity
                key={role}
                style={[styles.roleButton, selectedRole === role && styles.roleButtonActive]}
                onPress={() => setSelectedRole(role)}
              >
                <Text style={[styles.roleButtonText, selectedRole === role && styles.roleButtonTextActive]}>{role}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {selectedRole === 'Student' ? 'Email or Student ID' : 'Email or Teacher ID'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={selectedRole === 'Student' ? 'Enter your email or student ID' : 'Enter your email or teacher ID'}
                placeholderTextColor={isDark ? '#6B7280' : '#93C5FD'}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput style={styles.passwordInput} placeholder="Enter your password" placeholderTextColor={isDark ? '#6B7280' : '#93C5FD'} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                  <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>School Code</Text>
              <TextInput style={styles.input} placeholder="Enter your school code" placeholderTextColor={isDark ? '#6B7280' : '#93C5FD'} value={schoolCode} onChangeText={setSchoolCode} autoCapitalize="characters" />
            </View>

            <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginButtonText}>Login</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Error Modal */}
      <Modal
        visible={errorModal.show}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setErrorModal({ show: false, title: '', message: '' })}
      >
        <View style={styles.errorModalOverlay}>
          <View style={styles.errorModalContent}>
            <View style={styles.errorIconContainer}>
              <Text style={styles.errorIcon}>⚠️</Text>
            </View>
            <Text style={styles.errorModalTitle}>{errorModal.title}</Text>
            <Text style={styles.errorModalMessage}>{errorModal.message}</Text>
            <TouchableOpacity
              style={styles.errorModalButton}
              onPress={() => setErrorModal({ show: false, title: '', message: '' })}
            >
              <Text style={styles.errorModalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function getStyles(isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#0B0F14' : '#E0F2FE' },
    keyboardView: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
    logoContainer: { alignItems: 'center', marginTop: 20, marginBottom: 30 },
    logoPlaceholder: { alignItems: 'center' },
    logoImage: { width: 125, height: 125, marginBottom: 9 },
    logoTitle: { fontSize: 32, fontWeight: '700', color: isDark ? '#93C5FD' : '#1E3A8A', marginBottom: 4 },
    logoSubtitle: { fontSize: 10, color: isDark ? '#93C5FD' : '#1E3A8A', letterSpacing: 2 },
    welcomeContainer: { alignItems: 'center', marginBottom: 24 },
    welcomeTitle: { fontSize: 28, fontWeight: '700', color: isDark ? '#93C5FD' : '#1E3A8A', marginBottom: 4 },
    welcomeSubtitle: { fontSize: 14, color: '#60A5FA' },
    roleContainer: { flexDirection: 'row', marginBottom: 24, gap: 8 },
    roleButton: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderWidth: 2, borderColor: isDark ? '#1F2937' : '#93C5FD', alignItems: 'center' },
    roleButtonActive: { backgroundColor: '#60A5FA', borderColor: '#60A5FA' },
    roleButtonText: { fontSize: 14, fontWeight: '600', color: isDark ? '#93C5FD' : '#1E3A8A' },
    roleButtonTextActive: { color: '#FFFFFF' },
    formContainer: { backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderRadius: 20, padding: 24, borderWidth: 2, borderColor: isDark ? '#1F2937' : '#93C5FD' },
    inputGroup: { marginBottom: 20 },
    inputLabel: { fontSize: 14, fontWeight: '600', color: isDark ? '#93C5FD' : '#1E3A8A', marginBottom: 8 },
    input: { backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderWidth: 2, borderColor: isDark ? '#1F2937' : '#93C5FD', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: isDark ? '#E5E7EB' : '#1E3A8A' },
    passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderWidth: 2, borderColor: isDark ? '#1F2937' : '#93C5FD', borderRadius: 12 },
    passwordInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: isDark ? '#E5E7EB' : '#1E3A8A' },
    eyeButton: { paddingHorizontal: 12 },
    eyeIcon: { fontSize: 20 },
    loginButton: { backgroundColor: '#60A5FA', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
    loginButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
    // Error Modal Styles
    errorModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    errorModalContent: {
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      borderRadius: 20,
      padding: 28,
      width: '100%',
      maxWidth: 400,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: isDark ? '#1F2937' : '#93C5FD',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    errorIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: isDark ? '#7F1D1D' : '#FEE2E2',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    errorIcon: {
      fontSize: 36,
    },
    errorModalTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: isDark ? '#EF4444' : '#DC2626',
      marginBottom: 12,
      textAlign: 'center',
    },
    errorModalMessage: {
      fontSize: 16,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginBottom: 24,
      textAlign: 'center',
      lineHeight: 24,
    },
    errorModalButton: {
      backgroundColor: '#60A5FA',
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 40,
      minWidth: 120,
      alignItems: 'center',
    },
    errorModalButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
}


