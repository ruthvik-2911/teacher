import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { ThemedLogo } from '@/components/ThemedLogo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTeacherAssignments, getClasses, Assignment, Class } from '@/src/services/teacher';
import { getStudentMessages, Message, getSchoolInfo, SchoolInfo } from '@/src/services/student';

export default function TeacherHomeScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const router = useRouter();
  const styles = getStyles(isDark);

  const [teacherName, setTeacherName] = useState('Teacher');
  const [messages, setMessages] = useState<Message[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);

  const loadData = async () => {
    try {
      const [token, userData] = await AsyncStorage.multiGet(['authToken', 'userData']).then(entries => entries.map(e => e[1]));
      if (!token || !userData) {
        router.replace('/login');
        return;
      }

      const user = JSON.parse(userData);
      const displayName = user.name?.displayName || user.name?.firstName || 'Teacher';
      setTeacherName(displayName);

      console.log('[TEACHER HOME] Fetching teacher data...');

      // Fetch data with error handling for each API call
      let messagesData: Message[] = [];
      let assignmentsData: Assignment[] = [];
      let classesData: Class[] = [];
      let schoolData: SchoolInfo | null = null;

      try {
        schoolData = await getSchoolInfo();
        console.log('[TEACHER HOME] Fetched school info:', schoolData?.schoolName);
      } catch (error) {
        console.error('[TEACHER HOME] Error fetching school info:', error);
      }

      try {
        assignmentsData = await getTeacherAssignments();
        console.log('[TEACHER HOME] Fetched assignments:', assignmentsData.length);
      } catch (error) {
        console.error('[TEACHER HOME] Error fetching assignments:', error);
      }

      try {
        classesData = await getClasses();
        console.log('[TEACHER HOME] Fetched classes:', classesData.length);
      } catch (error) {
        console.error('[TEACHER HOME] Error fetching classes:', error);
      }

      // Fetch messages - use student messages endpoint to see the same messages
      try {
        console.log('[TEACHER HOME] Calling getStudentMessages (same as students see)...');
        messagesData = await getStudentMessages();
        console.log('[TEACHER HOME] Fetched messages:', messagesData.length);
        if (messagesData.length > 0) {
          console.log('[TEACHER HOME] Sample message:', messagesData[0]);
        } else {
          console.log('[TEACHER HOME] No messages returned from API');
        }
      } catch (error: any) {
        console.error('[TEACHER HOME] Error fetching messages:', error);
        console.error('[TEACHER HOME] Error details:', error?.response?.data);
      }

      setMessages(messagesData.slice(0, 3));
      setAssignments(assignmentsData.slice(0, 5));
      setClasses(classesData);
      setSchoolInfo(schoolData);
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    return now.toLocaleString('en-US', options);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#60A5FA" />
          <Text style={[styles.welcomeText, { marginTop: 12, fontSize: 16 }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#60A5FA" />
        }
      >
        <View style={styles.header}>
          <View style={[styles.headerLeft, { flex: 1, marginRight: 10 }]}>
            {schoolInfo?.logo ? (
              <Image
                source={{ uri: schoolInfo.logo }}
                style={styles.logoIcon}
                resizeMode="contain"
              />
            ) : (
              <ThemedLogo
                style={styles.logoIcon}
                resizeMode="contain"
              />
            )}
            <Text style={styles.logoText} numberOfLines={1}>{schoolInfo?.schoolName || 'GOODSYNK ERP'}</Text>
          </View>
          <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/menu')}>
            <Text style={styles.settingsIcon}>☰</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.welcomeSection}>
          <View>
            <Text style={styles.welcomeText}>Hi, {teacherName}</Text>
            <Text style={styles.dateText}>{getCurrentDateTime()}</Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.section}>
          <View style={styles.statsContainer}>
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => router.push('/(tabs)/classes')}
            >
              <Text style={styles.statIcon}>📚</Text>
              <Text style={styles.statValue}>{classes.length}</Text>
              <Text style={styles.statLabel}>Classes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => router.push('/(tabs)/assignments')}
            >
              <Text style={styles.statIcon}>📄</Text>
              <Text style={styles.statValue}>{assignments.length}</Text>
              <Text style={styles.statLabel}>Assignments</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => router.push('/(tabs)/activity')}
            >
              <Text style={styles.statIcon}>📢</Text>
              <Text style={styles.statValue}>{messages.length}</Text>
              <Text style={styles.statLabel}>Messages</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Messages */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Messages</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/activity')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {messages.length === 0 ? (
            <View style={styles.announcementCard}>
              <View style={[styles.announcementIcon, { backgroundColor: '#E0F2FE' }]}>
                <Text style={styles.announcementIconText}>📢</Text>
              </View>
              <View style={styles.announcementContent}>
                <Text style={styles.announcementTitle}>No Messages</Text>
                <Text style={styles.announcementText}>You don't have any messages yet</Text>
              </View>
            </View>
          ) : (
            messages.map((msg, index) => (
              <TouchableOpacity
                key={msg._id || index}
                style={styles.announcementCard}
                onPress={() => router.push('/(tabs)/activity')}
              >
                <View style={[styles.announcementIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Text style={styles.announcementIconText}>📧</Text>
                </View>
                <View style={styles.announcementContent}>
                  <Text style={styles.announcementTitle} numberOfLines={1}>
                    {msg.subject || msg.title}
                  </Text>
                  <Text style={styles.announcementText} numberOfLines={2}>
                    {msg.message}
                  </Text>
                  {msg.sender && (
                    <Text style={[styles.announcementText, { fontSize: 11, marginTop: 4, fontStyle: 'italic' }]}>
                      From: {msg.sender} {msg.senderRole ? `(${msg.senderRole})` : ''}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Recent Assignments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Assignments</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/assignments')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {assignments.length === 0 ? (
            <View style={styles.announcementCard}>
              <View style={[styles.announcementIcon, { backgroundColor: '#E0F2FE' }]}>
                <Text style={styles.announcementIconText}>📄</Text>
              </View>
              <View style={styles.announcementContent}>
                <Text style={styles.announcementTitle}>No Assignments</Text>
                <Text style={styles.announcementText}>You don't have any assignments yet</Text>
              </View>
            </View>
          ) : (
            assignments.map((assignment, index) => (
              <TouchableOpacity
                key={assignment._id || index}
                style={styles.announcementCard}
                onPress={() => router.push('/(tabs)/assignments')}
              >
                <View style={[styles.announcementIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Text style={styles.announcementIconText}>📄</Text>
                </View>
                <View style={styles.announcementContent}>
                  <Text style={styles.announcementTitle} numberOfLines={1}>
                    {assignment.subject} - {assignment.title}
                  </Text>
                  <Text style={styles.announcementText} numberOfLines={1}>
                    {assignment.class} {assignment.section ? `- ${assignment.section}` : ''}
                  </Text>
                  <Text style={styles.announcementText} numberOfLines={1}>
                    Due: {new Date(assignment.dueDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                  {assignment.totalSubmissions !== undefined && (
                    <Text style={[styles.announcementText, { marginTop: 4, fontSize: 11 }]}>
                      Submissions: {assignment.gradedSubmissions || 0}/{assignment.totalSubmissions || 0} graded
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Quick Access */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.quickAccessContainer}>
            <TouchableOpacity
              style={styles.quickAccessCard}
              onPress={() => router.push('/(tabs)/classes')}
            >
              <Text style={styles.quickAccessIcon}>📚</Text>
              <Text style={styles.quickAccessText}>Classes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAccessCard}
              onPress={() => router.push('/(tabs)/students')}
            >
              <Text style={styles.quickAccessIcon}>👥</Text>
              <Text style={styles.quickAccessText}>Students</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAccessCard}
              onPress={() => router.push('/(tabs)/assignments')}
            >
              <Text style={styles.quickAccessIcon}>📝</Text>
              <Text style={styles.quickAccessText}>Assignments</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0B0F14' : '#E0F2FE',
    },
    scrollView: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 16,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logoIcon: {
      width: 60,
      height: 60,
      marginRight: 10,
    },
    logoText: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#93C5FD' : '#1E3A8A',
    },
    settingsButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? '#111827' : '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingsIcon: {
      fontSize: 20,
      color: isDark ? '#FFFFFF' : '#1F2937',
    },
    welcomeSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    welcomeText: {
      fontSize: 24,
      fontWeight: '700',
      color: isDark ? '#93C5FD' : '#1E3A8A',
    },
    dateText: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#1E3A8A',
      marginTop: 4,
    },
    section: {
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? '#93C5FD' : '#1E3A8A',
    },
    viewAllText: {
      fontSize: 14,
      color: '#3B82F6',
      fontWeight: '600',
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: isDark ? '#1F2937' : '#93C5FD',
    },
    statIcon: {
      fontSize: 32,
      marginBottom: 8,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
      color: isDark ? '#93C5FD' : '#1E3A8A',
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#6B7280',
    },
    announcementCard: {
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      flexDirection: 'row',
      borderWidth: 2,
      borderColor: isDark ? '#1F2937' : '#93C5FD',
    },
    announcementIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    announcementIconText: {
      fontSize: 24,
    },
    announcementContent: {
      flex: 1,
    },
    announcementTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#E5E7EB' : '#1F2937',
      marginBottom: 4,
    },
    announcementText: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#6B7280',
    },
    quickAccessContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 12,
    },
    quickAccessCard: {
      flex: 1,
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: isDark ? '#1F2937' : '#93C5FD',
    },
    quickAccessIcon: {
      fontSize: 32,
      marginBottom: 8,
    },
    quickAccessText: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#93C5FD' : '#1E3A8A',
    },
  });
}

