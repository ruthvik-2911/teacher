import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { getStudentProfile, StudentProfile } from '@/src/services/student';

export default function ProfileScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(isDark);

  const [user, setUser] = useState<StudentProfile | null>(null);
  const [userRole, setUserRole] = useState<string>('student');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Get user role first
        const userStr = await AsyncStorage.getItem('userData');
        if (userStr) {
          const parsed = JSON.parse(userStr);
          setUserRole(parsed.role || 'student');
        }

        // Fetch student profile from students collection in school database
        const studentProfile = await getStudentProfile();
        if (studentProfile) {
          setUser(studentProfile);
        } else {
          // Fallback to AsyncStorage if API call fails
          if (userStr) setUser(JSON.parse(userStr));
        }
      } catch (error) {
        console.error('Error loading student profile:', error);
        // Fallback to AsyncStorage on error
        try {
          const userStr = await AsyncStorage.getItem('userData');
          if (userStr) setUser(JSON.parse(userStr));
        } catch { }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const infoRow = (label: string, value?: string | number) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value ? String(value) : '-'}</Text>
    </View>
  );

  const infoSection = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  if (loading || !user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Get student details for admission ID
  const studentDetails = user.studentDetails || {};

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>

        <View style={styles.card}>
          {infoSection('Account Information', (
            <>
              {infoRow('User ID', user.userId)}
              {userRole === 'student' && infoRow('Admission ID', studentDetails.admissionNumber || user._id)}
              {infoRow('School Code', user.schoolCode)}
              {infoRow('Status', user.isActive ? 'Active' : 'Inactive')}
              {infoRow('Last Login', formatDate(user.lastLogin))}
            </>
          ))}
          
          {userRole === 'student' && infoSection('Personal Information', (
            <>
              {infoRow('Name', user.name?.displayName || '-')}
              {infoRow('Date of Birth', formatDate(studentDetails.personal?.dateOfBirth))}
              {infoRow('Gender', studentDetails.personal?.gender)}
              {infoRow('Blood Group', studentDetails.personal?.bloodGroup)}
              {infoRow('Nationality', studentDetails.personal?.nationality)}
            </>
          ))}

          {userRole === 'student' && infoSection('Academic Details', (
            <>
              {infoRow('Class', studentDetails.academic?.currentClass)}
              {infoRow('Section', studentDetails.academic?.currentSection)}
              {infoRow('Roll No', studentDetails.academic?.rollNumber)}
              {infoRow('Academic Year', studentDetails.academic?.academicYear)}
            </>
          ))}

          {infoSection('Contact Details', (
            <>
              {infoRow('Email', user.email)}
              {infoRow('Mobile', user.contact?.primaryPhone)}
              {infoRow('Address', user.address?.permanent?.street || user.address?.permanent?.city)}
            </>
          ))}

          {userRole === 'student' && infoSection('Family Details', (
            <>
              {infoRow('Father Name', studentDetails.family?.father?.name)}
              {infoRow('Mother Name', studentDetails.family?.mother?.name)}
              {infoRow('Guardian', studentDetails.family?.guardian?.name)}
              {infoRow('Parent Mobile', studentDetails.family?.father?.phone)}
            </>
          ))}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#0B0F14' : '#E0F2FE' },
    scrollView: { flex: 1 },
    header: { padding: 20, paddingTop: 10 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: isDark ? '#93C5FD' : '#1E3A8A', textAlign: 'center' },
    card: { marginHorizontal: 20, backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 2, borderColor: isDark ? '#1F2937' : '#93C5FD' },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: isDark ? '#93C5FD' : '#1E3A8A', marginBottom: 12 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: isDark ? '#1F2937' : '#E5E7EB' },
    infoLabel: { fontSize: 14, color: isDark ? '#9CA3AF' : '#475569', flex: 1 },
    infoValue: { fontSize: 14, fontWeight: '600', color: isDark ? '#E5E7EB' : '#1F2937', flex: 1, textAlign: 'right' },
    loadingText: { fontSize: 16, color: isDark ? '#93C5FD' : '#1E3A8A' },
  });
}
