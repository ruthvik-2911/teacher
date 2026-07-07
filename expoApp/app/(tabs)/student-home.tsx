import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image, Modal, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedLogo } from '@/components/ThemedLogo';
import { getStudentMessages, getStudentAssignments, getStudentAttendance, getStudentResults, getSchoolInfo, SchoolInfo } from '@/src/services/student';
import { io, Socket } from 'socket.io-client';
import ENV from '@/src/config/env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function StudentHomeScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const router = useRouter();
  const styles = getStyles(isDark);

  const [studentName, setStudentName] = useState('Student');
  const [messages, setMessages] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [attendanceStats, setAttendanceStats] = useState({ attendancePercentage: 0, presentDays: 0, totalDays: 0 });
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [sendingSOSAlert, setSendingSOSAlert] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(5);
  const socketRef = useRef<Socket | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);

  const loadData = async () => {
    try {
      // Ensure session exists before fetching
      const [token, userData] = await AsyncStorage.multiGet(['authToken', 'userData']).then(entries => entries.map(e => e[1]));
      if (!token || !userData) {
        // Not logged in yet – send to login and stop
        router.replace('/login');
        return;
      }

      // Get student info
      const user = JSON.parse(userData);
      const displayName = user.name?.displayName || user.name?.firstName || 'Student';
      setStudentName(displayName);
      setUserData(user);

      // Initialize Socket.IO connection
      if (!socketRef.current) {
        try {
          const socketUrl = ENV.API_BASE_URL.replace('/api', '');
          console.log('[SOCKET] Connecting to:', socketUrl);

          socketRef.current = io(socketUrl, {
            transports: ['polling', 'websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000,
            forceNew: true
          });

          socketRef.current.on('connect', () => {
            console.log('[SOCKET] Connected to server:', socketRef.current?.id);
            if (user.schoolCode) {
              socketRef.current?.emit('join-school', user.schoolCode);
              console.log('[SOCKET] Joined school room:', user.schoolCode);
            }
          });

          socketRef.current.on('connect_error', (error) => {
            console.error('[SOCKET] Connection error:', error.message);
          });

          socketRef.current.on('sos-success', (data) => {
            console.log('[SOCKET] SOS Success:', data);
            setSendingSOSAlert(false);
          });

          socketRef.current.on('sos-error', (error) => {
            console.error('[SOCKET] SOS Error:', error);
            const errorMsg = error.details || error.message || 'Failed to send SOS alert';
            Alert.alert(
              'SOS Alert Failed',
              `${errorMsg}\n\nPlease try again or contact school directly.`,
              [{ text: 'OK', style: 'default' }]
            );
            setSendingSOSAlert(false);
          });

          socketRef.current.on('disconnect', (reason) => {
            console.log('[SOCKET] Disconnected:', reason);
          });
        } catch (error) {
          console.error('[SOCKET] Failed to initialize:', error);
        }
      }

      // Fetch all student data (now authenticated)
      // For home page, fetch current month's attendance to ensure we get today's data
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      console.log('[STUDENT HOME] Fetching attendance for range:', startOfMonth, 'to', endOfMonth);

      // Fetch overall attendance stats (no date range) and current month for today's data
      const [messagesData, assignmentsData, overallAttendanceData, currentMonthAttendanceData, resultsData, schoolInfoData] = await Promise.all([
        getStudentMessages(),
        getStudentAssignments(),
        getStudentAttendance(), // Overall stats - no date range
        getStudentAttendance(startOfMonth, endOfMonth), // Current month for today's data
        getStudentResults(),
        getSchoolInfo()
      ]);

      setMessages(messagesData.slice(0, 3));
      setAssignments(assignmentsData.slice(0, 3));
      setSchoolInfo(schoolInfoData);

      // Use overall attendance stats for the percentage display
      setAttendanceStats(overallAttendanceData.stats);
      console.log('[STUDENT HOME] Setting overall attendance stats:', overallAttendanceData.stats);

      // Get today's attendance using local date formatting from current month data
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      console.log('[STUDENT HOME] Looking for today\'s attendance:', today);

      const todayRecord = currentMonthAttendanceData.records.find((record: any) => {
        const recordDateStr = record.dateString || record.date?.split('T')[0];
        console.log('[STUDENT HOME] Comparing record date:', recordDateStr, 'with today:', today);
        return recordDateStr === today;
      });

      console.log('[STUDENT HOME] Today\'s attendance record:', todayRecord ? 'Found' : 'Not found');
      setTodayAttendance(todayRecord);

      console.log('[STUDENT HOME] Results data received:', resultsData.length, 'results');
      resultsData.forEach((result: any, index: number) => {
        console.log(`[STUDENT HOME] Result ${index + 1}:`, {
          examType: result.examType,
          subjectsCount: result.subjects?.length,
          percentage: result.overallPercentage,
          grade: result.overallGrade
        });
      });
      setResults(resultsData.slice(0, 5));
    } catch (error) {
      console.error('Error loading student home data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Cleanup socket on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // SOS Countdown Timer
  useEffect(() => {
    let countdownInterval: ReturnType<typeof setInterval>;

    if (showSOSModal && sosCountdown > 0) {
      countdownInterval = setInterval(() => {
        setSosCountdown((prev) => {
          if (prev <= 1) {
            // Auto-send SOS when countdown reaches 0
            handleSOSConfirm();
            return 5; // Reset for next time
          }
          return prev - 1;
        });
      }, 1000);
    } else if (!showSOSModal) {
      // Reset countdown when modal closes
      setSosCountdown(5);
    }

    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [showSOSModal, sosCountdown]);

  const handleSOSPress = () => {
    setShowSOSModal(true);
    setSosCountdown(5); // Reset countdown when opening modal
  };

  const handleSOSConfirm = async () => {
    if (!userData || !socketRef.current) {
      Alert.alert('Error', 'Unable to send SOS alert. Please try again.');
      return;
    }

    setSendingSOSAlert(true);
    setShowSOSModal(false);

    try {
      console.log('[SOS] User data:', userData);
      console.log('[SOS] Socket connected:', socketRef.current.connected);
      console.log('[SOS] Socket ID:', socketRef.current.id);

      // Debug: Log all possible locations for class and roll number
      console.log('[SOS] Checking class from:');
      console.log('  - userData.studentDetails?.class:', userData.studentDetails?.class);
      console.log('  - userData.academicInfo?.class:', userData.academicInfo?.class);
      console.log('  - userData.class:', userData.class);
      console.log('  - userData.collection:', userData.collection);

      console.log('[SOS] Checking roll number from:');
      console.log('  - userData.studentDetails?.rollNumber:', userData.studentDetails?.rollNumber);
      console.log('  - userData.studentDetails?.rollNo:', userData.studentDetails?.rollNo);
      console.log('  - userData.academicInfo?.rollNumber:', userData.academicInfo?.rollNumber);
      console.log('  - userData.rollNumber:', userData.rollNumber);
      console.log('  - userData.rollNo:', userData.rollNo);

      // Extract class and roll number from various possible locations
      // Try multiple nested paths based on the actual data structure
      const studentClass = userData.studentDetails?.class ||
        userData.academicInfo?.class ||
        userData.class ||
        userData.section || // Sometimes stored as section
        (typeof userData.studentDetails === 'object' && userData.studentDetails !== null ?
          Object.values(userData.studentDetails).find(v => typeof v === 'string' && /^[0-9]{1,2}[A-Z]?$/.test(v)) : null) ||
        'N/A';

      const studentRollNo = userData.studentDetails?.rollNumber ||
        userData.studentDetails?.rollNo ||
        userData.studentDetails?.admissionNumber ||
        userData.academicInfo?.rollNumber ||
        userData.rollNumber ||
        userData.rollNo ||
        userData.admissionNumber ||
        userData.userId?.split('-').pop() || // Extract from userId like AB-S-0006
        'N/A';

      console.log('[SOS] Final extracted values:');
      console.log('  - Class:', studentClass);
      console.log('  - Roll No:', studentRollNo);

      const sosData = {
        schoolCode: userData.schoolCode,
        studentId: userData._id,
        studentName: userData.name?.displayName || `${userData.name?.firstName} ${userData.name?.lastName}`,
        studentClass,
        studentRollNo,
        location: 'Mobile App',
        timestamp: new Date().toISOString()
      };

      console.log('[SOS] Sending alert with data:', JSON.stringify(sosData, null, 2));

      if (!sosData.schoolCode) {
        throw new Error('School code is missing from user data');
      }
      if (!sosData.studentId) {
        throw new Error('Student ID is missing from user data');
      }
      if (!sosData.studentName) {
        throw new Error('Student name is missing from user data');
      }

      socketRef.current.emit('student-sos', sosData);

      // Show success message
      Alert.alert(
        'SOS Alert Sent',
        'Your emergency alert has been sent to all school administrators. Help is on the way.',
        [{ text: 'OK', style: 'default' }]
      );

      setSendingSOSAlert(false);
    } catch (error) {
      console.error('[SOS] Error sending alert:', error);
      Alert.alert('Error', 'Failed to send SOS alert. Please try again.');
      setSendingSOSAlert(false);
    }
  };

  const handleSOSCancel = () => {
    setShowSOSModal(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#60A5FA" />
          <Text style={[styles.filterButtonText, { marginTop: 12 }]}>Loading...</Text>
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
            <Text style={styles.welcomeText}>Hi, {studentName}</Text>
            <Text style={styles.dateText}>{getCurrentDateTime()}</Text>
          </View>
          <TouchableOpacity
            style={[styles.sosButton, sendingSOSAlert && styles.sosButtonDisabled]}
            onPress={handleSOSPress}
            disabled={sendingSOSAlert}
          >
            <Text style={styles.sosText}>{sendingSOSAlert ? 'SENDING...' : 'SOS'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Announcements</Text>
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
              <View key={msg._id || index} style={styles.announcementCard}>
                <View style={[styles.announcementIcon, { backgroundColor: '#FECACA' }]}>
                  <Text style={styles.announcementIconText}>📢</Text>
                </View>
                <View style={styles.announcementContent}>
                  <Text style={styles.announcementTitle} numberOfLines={1}>{msg.subject || msg.title}</Text>
                  <Text style={styles.announcementText} numberOfLines={2}>{msg.message}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Result Analytics</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/results')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {results.length > 0 ? (
            <>
              {/* Overall Performance Circle */}
              <View style={styles.resultAnalyticsCard}>
                <Text style={styles.overallPerformanceTitle}>Overall Performance</Text>
                <View style={styles.performanceCircleContainer}>
                  <View style={styles.performanceCircle}>
                    <Text style={styles.performancePercentage}>
                      {(() => {
                        // Calculate average of all test percentages
                        const avgPercentage = results.reduce((sum, r) => sum + (r.overallPercentage || 0), 0) / results.length;
                        return avgPercentage.toFixed(1);
                      })()}%
                    </Text>
                  </View>
                </View>
                <Text style={styles.announcementText}>
                  Average across {results.length} test{results.length !== 1 ? 's' : ''}
                </Text>
              </View>

              <View style={styles.subjectScoresCard}>
                <Text style={styles.subjectScoresTitle}>Recent Test Results</Text>
                {results.slice(0, 5).map((result, index) => (
                  <View key={result._id || index} style={styles.testResultItem}>
                    <View style={styles.testResultHeader}>
                      <Text style={styles.testResultTitle}>{result.examType}</Text>
                      <Text style={styles.testResultScore}>
                        {result.overallPercentage?.toFixed(1)}% • {result.overallGrade || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.progressBarContainer}>
                      <View style={[
                        styles.progressBar,
                        {
                          width: `${Math.min(result.overallPercentage || 0, 100)}%`,
                          backgroundColor: result.overallPercentage >= 80 ? '#4ADE80' :
                            result.overallPercentage >= 60 ? '#60A5FA' : '#F87171'
                        }
                      ]} />
                    </View>
                    <View style={styles.subjectsPreview}>
                      <Text style={styles.subjectsPreviewText}>
                        {result.subjects.length} subject{result.subjects.length !== 1 ? 's' : ''}: {result.subjects.slice(0, 2).map((s: any) => s.subjectName).join(', ')}
                        {result.subjects.length > 2 ? ` +${result.subjects.length - 2} more` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.resultAnalyticsCard}>
              <Text style={styles.overallPerformanceTitle}>No Results Available</Text>
              <Text style={styles.announcementText}>Your test results will appear here once available</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Attendance</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/attendance')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.todayAttendanceCard}>
            <View style={styles.todayAttendanceHeader}>
              <Text style={styles.todayAttendanceTitle}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </Text>
            </View>
            {todayAttendance ? (
              <View style={styles.sessionsContainer}>
                <View style={styles.sessionItem}>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionLabel}>Morning</Text>
                    <Text style={styles.sessionTime}>8:00 AM - 12:00 PM</Text>
                  </View>
                  <View style={[styles.sessionDot, {
                    backgroundColor: todayAttendance?.sessions?.morning?.status === 'present' ? '#4ADE80' :
                      todayAttendance?.sessions?.morning?.status === 'absent' ? '#EF4444' : '#D1D5DB'
                  }]} />
                </View>
                <View style={styles.sessionItem}>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionLabel}>Afternoon</Text>
                    <Text style={styles.sessionTime}>1:00 PM - 4:00 PM</Text>
                  </View>
                  <View style={[styles.sessionDot, {
                    backgroundColor: todayAttendance?.sessions?.afternoon?.status === 'present' ? '#4ADE80' :
                      todayAttendance?.sessions?.afternoon?.status === 'absent' ? '#EF4444' : '#D1D5DB'
                  }]} />
                </View>
              </View>
            ) : (
              <View style={styles.noDataContainer}>
                <Text style={styles.noDataText}>No attendance marked for today</Text>
                <Text style={styles.noDataSubtext}>Attendance will appear here once marked by your teacher</Text>
              </View>
            )}
          </View>

          <View style={styles.attendanceCard}>
            <View style={styles.attendanceCircleContainer}>
              <View style={styles.attendanceCircle}>
                <View style={styles.circleInner}>
                  <Text style={styles.attendancePercentage}>
                    {Math.round(attendanceStats.attendancePercentage || 0)}%
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.attendanceStats}>
              <View style={styles.attendanceStat}>
                <View style={[styles.statusDot, { backgroundColor: '#4ADE80' }]} />
                <View>
                  <Text style={styles.attendanceStatLabel}>Overall Attendance</Text>
                  <Text style={styles.attendanceStatValue}>
                    {attendanceStats.presentDays || 0}/{attendanceStats.totalDays || 0} days
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* SOS Confirmation Modal */}
      <Modal
        visible={showSOSModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleSOSCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>🚨</Text>
              <Text style={styles.modalTitle}>Emergency SOS Alert</Text>
            </View>
            <Text style={styles.modalMessage}>
              SOS alert will be sent automatically in {sosCountdown} seconds.
              {' \n\n'}
              This will immediately notify all school administrators about your emergency.
              {' \n\n'}
              <Text style={styles.modalWarning}>Press CANCEL to stop the alert.</Text>
            </Text>

            {/* Countdown Timer */}
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>{sosCountdown}</Text>
              <Text style={styles.countdownLabel}>seconds remaining</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={handleSOSCancel}
              >
                <Text style={styles.modalButtonTextCancel}>CANCEL ALERT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleSOSConfirm}
                disabled={sendingSOSAlert}
              >
                <Text style={styles.modalButtonTextConfirm}>
                  {sendingSOSAlert ? 'Sending...' : 'SEND NOW'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    sosButton: {
      backgroundColor: '#EF4444',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      shadowColor: '#EF4444',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    sosButtonDisabled: {
      backgroundColor: '#9CA3AF',
      opacity: 0.6,
    },
    sosText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
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
    resultAnalyticsCard: {
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      borderRadius: 16,
      padding: 20,
      marginBottom: 12,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: isDark ? '#1F2937' : '#93C5FD',
    },
    overallPerformanceTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#E5E7EB' : '#1F2937',
      marginBottom: 16,
    },
    performanceCircleContainer: {
      alignItems: 'center',
    },
    performanceCircle: {
      width: Math.max(100, Math.min(SCREEN_WIDTH * 0.3, 140)),
      height: Math.max(100, Math.min(SCREEN_WIDTH * 0.3, 140)),
      borderRadius: Math.max(50, Math.min(SCREEN_WIDTH * 0.3, 140)) / 2,
      borderWidth: Math.max(8, Math.min(SCREEN_WIDTH * 0.025, 12)),
      borderColor: '#4ADE80',
      borderRightColor: '#EF4444',
      borderBottomColor: '#EF4444',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? '#111827' : '#FFFFFF',
    },
    performancePercentage: {
      fontSize: Math.max(16, Math.min(SCREEN_WIDTH * 0.055, 28)),
      fontWeight: '700',
      color: isDark ? '#E5E7EB' : '#1F2937',
      textAlign: 'center',
    },
    subjectScoresCard: {
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      borderWidth: 2,
      borderColor: isDark ? '#1F2937' : '#93C5FD',
    },
    subjectScoresTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#E5E7EB' : '#1F2937',
      marginBottom: 12,
    },
    testResultItem: {
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#1F2937' : '#E5E7EB',
    },
    testResultHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    progressBarContainer: {
      height: 8,
      backgroundColor: isDark ? '#374151' : '#E5E7EB',
      borderRadius: 4,
      marginBottom: 8,
    },
    progressBar: {
      height: 8,
      borderRadius: 4,
    },
    testResultInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    testResultTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: isDark ? '#E5E7EB' : '#1F2937',
    },
    testResultScore: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#93C5FD' : '#1E3A8A',
    },
    subjectsPreview: {
      marginTop: 4,
    },
    subjectsPreviewText: {
      fontSize: 11,
      color: isDark ? '#9CA3AF' : '#6B7280',
      lineHeight: 16,
    },
    todayAttendanceCard: {
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: isDark ? '#1F2937' : '#93C5FD',
    },
    todayAttendanceHeader: {
      marginBottom: 12,
    },
    todayAttendanceTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#E5E7EB' : '#1F2937',
    },
    sessionsContainer: {
      gap: 12,
    },
    sessionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sessionInfo: {
      flex: 1,
    },
    sessionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#E5E7EB' : '#1F2937',
    },
    sessionTime: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginTop: 2,
    },
    sessionDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    noDataContainer: {
      alignItems: 'center',
      paddingVertical: 20,
    },
    noDataText: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginBottom: 4,
    },
    noDataSubtext: {
      fontSize: 12,
      color: isDark ? '#6B7280' : '#9CA3AF',
      textAlign: 'center',
    },
    attendanceCard: {
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: isDark ? '#1F2937' : '#93C5FD',
    },
    attendanceCircleContainer: {
      marginRight: Math.max(12, SCREEN_WIDTH * 0.05),
    },
    attendanceCircle: {
      width: Math.max(100, Math.min(SCREEN_WIDTH * 0.3, 140)),
      height: Math.max(100, Math.min(SCREEN_WIDTH * 0.3, 140)),
      borderRadius: Math.max(50, Math.min(SCREEN_WIDTH * 0.3, 140)) / 2,
      borderWidth: Math.max(8, Math.min(SCREEN_WIDTH * 0.025, 12)),
      borderColor: '#4ADE80',
      borderRightColor: '#EF4444',
      borderBottomColor: '#EF4444',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? '#111827' : '#FFFFFF',
    },
    circleInner: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    attendancePercentage: {
      fontSize: Math.max(16, Math.min(SCREEN_WIDTH * 0.055, 28)),
      fontWeight: '700',
      color: isDark ? '#E5E7EB' : '#1F2937',
      textAlign: 'center',
    },
    attendanceStats: {
      flex: 1,
    },
    attendanceStat: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    },
    attendanceStatLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#E5E7EB' : '#1F2937',
    },
    attendanceStatValue: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginTop: 2,
    },
    filterButtonText: {
      fontSize: 14,
      color: isDark ? '#9CA3AF' : '#6B7280',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContainer: {
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      borderRadius: 24,
      padding: 32,
      width: '100%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 12,
      borderWidth: 2,
      borderColor: '#EF4444',
    },
    modalHeader: {
      alignItems: 'center',
      marginBottom: 20,
    },
    modalIcon: {
      fontSize: 64,
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: '#EF4444',
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    modalMessage: {
      fontSize: 17,
      color: isDark ? '#D1D5DB' : '#4B5563',
      textAlign: 'center',
      lineHeight: 26,
      marginBottom: 28,
      fontWeight: '500',
    },
    modalWarning: {
      fontWeight: '700',
      color: '#EF4444',
    },
    countdownContainer: {
      alignItems: 'center',
      marginVertical: 20,
      padding: 20,
      backgroundColor: '#FEE2E2',
      borderRadius: 16,
      borderWidth: 3,
      borderColor: '#EF4444',
    },
    countdownText: {
      fontSize: 56,
      fontWeight: '900',
      color: '#DC2626',
      textShadowColor: 'rgba(220, 38, 38, 0.3)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    countdownLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: '#991B1B',
      marginTop: 4,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 14,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    modalButtonCancel: {
      backgroundColor: isDark ? '#374151' : '#F3F4F6',
      borderWidth: 2,
      borderColor: isDark ? '#4B5563' : '#D1D5DB',
    },
    modalButtonConfirm: {
      backgroundColor: '#EF4444',
      borderWidth: 2,
      borderColor: '#DC2626',
    },
    modalButtonTextCancel: {
      color: isDark ? '#E5E7EB' : '#374151',
      fontSize: 17,
      fontWeight: '700',
    },
    modalButtonTextConfirm: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '700',
    },
  });
}
