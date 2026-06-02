import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Alert, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/contexts/ThemeContext';
import { getClassAttendance, getClasses, getStudentsByClassSection, markSessionAttendance } from '@/src/services/teacher';

export default function TeacherAttendanceScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(isDark);

  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [classes, setClasses] = useState<any[]>([]);
  const [showMarkAttendance, setShowMarkAttendance] = useState<boolean>(false);
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<{[key: string]: 'present' | 'absent'}>({});
  const [selectedSession, setSelectedSession] = useState<'morning' | 'afternoon'>('morning');
  const [attendanceDate, setAttendanceDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [lockedStudents, setLockedStudents] = useState<Set<string>>(new Set());
  const [showClassDropdown, setShowClassDropdown] = useState<boolean>(false);
  const [showSectionDropdown, setShowSectionDropdown] = useState<boolean>(false);
  const [isViewingPastAttendance, setIsViewingPastAttendance] = useState<boolean>(false);

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      const classData = await getClasses();
      setClasses(classData);
      
      // Set default class if available
      if (classData.length > 0 && !selectedClass) {
        setSelectedClass(classData[0].className);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendanceClick = async () => {
    if (!selectedClass || !selectedSection) {
      Alert.alert('Selection Required', 'Please select both class and section');
      return;
    }

    try {
      console.log('[ATTENDANCE] Fetching students for class:', selectedClass, 'section:', selectedSection);
      const studentsData = await getStudentsByClassSection(selectedClass, selectedSection);
      console.log('[ATTENDANCE] Loaded students:', studentsData.length);
      
      if (studentsData.length === 0) {
        Alert.alert('No Students', 'No students found in this class/section');
        return;
      }
      
      setStudents(studentsData);
      
      // Check existing attendance with the fresh student data
      await checkExistingAttendance(studentsData);
      
      setShowMarkAttendance(true);
    } catch (error) {
      console.error('[ATTENDANCE] Error loading students:', error);
      Alert.alert('Error', 'Failed to load students. Please try again.');
    }
  };

  const checkExistingAttendance = async (studentsList?: any[]) => {
    try {
      // Use provided students list or fall back to state
      const studentsToCheck = studentsList || students;
      
      // Check if this is a past date (not today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDateOnly = new Date(attendanceDate);
      selectedDateOnly.setHours(0, 0, 0, 0);
      const isPastDate = selectedDateOnly < today;
      
      // Fetch existing attendance for selected date
      const dateStr = attendanceDate.toISOString().split('T')[0];
      console.log('[ATTENDANCE] Checking for existing attendance on:', dateStr, 'session:', selectedSession, 'isPastDate:', isPastDate);
      console.log('[ATTENDANCE] Total students in class:', studentsToCheck.length);
      
      const existingRecords = await getClassAttendance(selectedClass, selectedSection, dateStr);
      console.log('[ATTENDANCE] Found', existingRecords.length, 'attendance records');
      
      // Find the record for the selected session
      const todayRecord = existingRecords.find((r: any) => {
        const recordDate = r.date?.split('T')[0] || r.dateString;
        const matchesDate = recordDate === dateStr;
        const matchesSession = r.session === selectedSession || r._id?.includes(`_${selectedSession}`);
        console.log('[ATTENDANCE] Checking record:', r._id, 'Date match:', matchesDate, 'Session match:', matchesSession);
        return matchesDate && matchesSession;
      });
      
      if (todayRecord) {
        console.log('[ATTENDANCE] Found existing attendance:', todayRecord);
        
        // The attendance record IS the session data (not nested under sessions)
        // Check if this record matches the selected session
        const isCorrectSession = todayRecord.session === selectedSession || 
                                 todayRecord._id?.includes(`_${selectedSession}`);
        
        console.log('[ATTENDANCE] Record session:', todayRecord.session, 'Selected:', selectedSession, 'Match:', isCorrectSession);
        console.log('[ATTENDANCE] Has students array?', todayRecord.students ? 'YES' : 'NO');
        
        // Check which students already have attendance marked
        const locked = new Set<string>();
        const prefilledData: {[key: string]: 'present' | 'absent'} = {};
        
        if (isCorrectSession && todayRecord.students && Array.isArray(todayRecord.students)) {
          console.log('[ATTENDANCE] Processing', todayRecord.students.length, 'students from attendance record');
          todayRecord.students.forEach((s: any) => {
            const studentId = s.studentId || s.userId;
            locked.add(studentId);
            prefilledData[studentId] = s.status;
          });
          
          console.log('[ATTENDANCE] Marked students:', locked.size, 'Total students:', studentsToCheck.length);
          
          // Check if ALL students have attendance (session is complete)
          const allStudentsMarked = locked.size === studentsToCheck.length && locked.size > 0;
          
          // If it's a past date OR session is fully marked, lock everything
          if (isPastDate && locked.size > 0) {
            setIsViewingPastAttendance(true);
            Alert.alert(
              '🔒 Viewing Past Attendance',
              `This attendance was marked on ${dateStr}. All students are locked and cannot be edited.`,
              [{ text: 'OK' }]
            );
          } else if (allStudentsMarked) {
            // Session is fully marked - lock it
            setIsViewingPastAttendance(true);
            console.log('[ATTENDANCE] 🔒 SESSION LOCKED - All students marked');
            Alert.alert(
              '🔒 Session Locked',
              `${selectedSession.charAt(0).toUpperCase() + selectedSession.slice(1)} session attendance is already marked for all ${studentsToCheck.length} students. It cannot be edited.`,
              [{ text: 'OK' }]
            );
          } else if (locked.size > 0) {
            // Partial attendance - lock only marked students
            setIsViewingPastAttendance(false);
            console.log('[ATTENDANCE] Partial attendance -', locked.size, 'marked,', (studentsToCheck.length - locked.size), 'remaining');
            Alert.alert(
              'Partial Attendance Found',
              `${locked.size} student(s) already have attendance marked for this session and will be locked. You can mark the remaining ${studentsToCheck.length - locked.size} students.`,
              [{ text: 'Continue' }]
            );
          }
        } else {
          // No session data or no students in session data
          console.log('[ATTENDANCE] No session data or no students array found');
          if (isPastDate) {
            // Past date but no attendance marked - still lock it
            setIsViewingPastAttendance(true);
            Alert.alert(
              '🔒 Past Date Selected',
              `You selected ${dateStr} which is in the past. Attendance cannot be marked for past dates without existing records.`,
              [{ text: 'OK' }]
            );
          } else {
            // Today but no session data - allow marking
            setIsViewingPastAttendance(false);
          }
        }
        
        setLockedStudents(locked);
        setAttendanceData(prefilledData);
      } else {
        // No existing record found
        if (isPastDate) {
          // Past date with no attendance - lock everything
          setIsViewingPastAttendance(true);
          setLockedStudents(new Set());
          setAttendanceData({});
          Alert.alert(
            '🔒 Past Date Selected',
            `You selected ${dateStr} which is in the past. No attendance was marked for this date. You cannot mark attendance for past dates.`,
            [{ text: 'OK' }]
          );
        } else {
          // Today or future - allow marking
          setLockedStudents(new Set());
          setAttendanceData({});
          setIsViewingPastAttendance(false);
        }
      }
    } catch (error) {
      console.log('[ATTENDANCE] Error checking attendance:', error);
      
      // Check if it's a past date even on error
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDateOnly = new Date(attendanceDate);
      selectedDateOnly.setHours(0, 0, 0, 0);
      const isPastDate = selectedDateOnly < today;
      
      if (isPastDate) {
        setIsViewingPastAttendance(true);
        setLockedStudents(new Set());
        setAttendanceData({});
      } else {
        setLockedStudents(new Set());
        setAttendanceData({});
        setIsViewingPastAttendance(false);
      }
    }
  };

  // Re-check attendance when date or session changes
  useEffect(() => {
    if (showMarkAttendance && students.length > 0) {
      checkExistingAttendance();
    }
  }, [attendanceDate, selectedSession]);

  // Debug: Log date picker state changes
  useEffect(() => {
    console.log('[DATE PICKER] showDatePicker state changed to:', showDatePicker);
  }, [showDatePicker]);

  const handleSaveAttendance = async () => {
    // Prevent saving if viewing past attendance
    if (isViewingPastAttendance) {
      Alert.alert('Cannot Edit', 'Past attendance is locked and cannot be modified.');
      return;
    }

    try {
      const dateStr = attendanceDate.toISOString().split('T')[0];
      
      // Only include students that are not locked
      const studentsArray = students
        .filter(student => !lockedStudents.has(student.userId))
        .map(student => ({
          studentId: student.userId,
          userId: student.userId,
          status: attendanceData[student.userId] || 'absent'
        }));
      
      if (studentsArray.length === 0) {
        Alert.alert('No Changes', 'All students already have attendance marked for this session.');
        return;
      }
      
      console.log('[ATTENDANCE] Marking attendance:', {
        date: dateStr,
        class: selectedClass,
        section: selectedSection,
        session: selectedSession,
        studentsCount: studentsArray.length
      });
      
      const success = await markSessionAttendance({
        date: dateStr,
        class: selectedClass,
        section: selectedSection,
        session: selectedSession,
        students: studentsArray
      });
      
      if (success) {
        Alert.alert('Success', `${selectedSession.charAt(0).toUpperCase() + selectedSession.slice(1)} attendance marked successfully for ${studentsArray.length} students`);
        setShowMarkAttendance(false);
        setAttendanceData({});
        setLockedStudents(new Set());
      } else {
        Alert.alert('Error', 'Failed to mark attendance. Please try again.');
      }
    } catch (error: any) {
      console.error('[ATTENDANCE] Error marking attendance:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to mark attendance. Please check your connection and try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    console.log('[DATE PICKER] Event:', event.type, 'Selected Date:', selectedDate);
    
    // Close picker on Android after selection
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (selectedDate && event.type !== 'dismissed') {
      console.log('[DATE PICKER] Setting new date:', selectedDate);
      setAttendanceDate(selectedDate);
      // Date will be checked in useEffect
    } else {
      console.log('[DATE PICKER] Date selection cancelled or dismissed');
      if (Platform.OS === 'ios') {
        setShowDatePicker(false);
      }
    }
  };

  const getAvailableSections = () => {
    const classItem = classes.find(c => c.className === selectedClass);
    if (!classItem) return [];
    return classItem.sections.map((s: any) => s.sectionName);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#60A5FA" />
          <Text style={[styles.headerSubtitle, { marginTop: 12 }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mark Attendance</Text>
          <Text style={styles.headerSubtitle}>Select class and section to mark attendance</Text>
        </View>

        {/* Class Selection Dropdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Class</Text>
          <View style={styles.dropdownContainer}>
            <Picker
              selectedValue={selectedClass}
              onValueChange={(itemValue) => {
                setSelectedClass(itemValue);
                setSelectedSection(''); // Reset section when class changes
              }}
              style={styles.picker}
              dropdownIconColor={isDark ? '#93C5FD' : '#1E3A8A'}
            >
              <Picker.Item label="-- Select Class --" value="" />
              {classes.map((classItem) => (
                <Picker.Item
                  key={classItem.classId}
                  label={classItem.className}
                  value={classItem.className}
                />
              ))}
            </Picker>
          </View>
        </View>

        {/* Section Selection Dropdown */}
        {selectedClass && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Section</Text>
            <View style={styles.dropdownContainer}>
              <Picker
                selectedValue={selectedSection}
                onValueChange={(itemValue) => setSelectedSection(itemValue)}
                style={styles.picker}
                dropdownIconColor={isDark ? '#93C5FD' : '#1E3A8A'}
              >
                <Picker.Item label="-- Select Section --" value="" />
                {getAvailableSections().map((section: string) => (
                  <Picker.Item
                    key={section}
                    label={section}
                    value={section}
                  />
                ))}
              </Picker>
            </View>
          </View>
        )}

        {/* Mark Attendance Button */}
        {selectedClass && selectedSection && (
          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.markAttendanceButton}
              onPress={handleMarkAttendanceClick}
            >
              <Text style={styles.markAttendanceButtonText}>Mark Attendance</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Attendance Marking Modal */}
      <Modal visible={showMarkAttendance} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <SafeAreaView style={styles.modalContent} edges={['top', 'bottom']}>
            {/* Header - Fixed */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={styles.modalTitle}>Mark Attendance</Text>
                {isViewingPastAttendance && (
                  <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                    <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '600' }}>🔒 Locked</Text>
                  </View>
                )}
              </View>
              <Text style={styles.modalSubtitle}>
                {selectedClass} - {selectedSection}
              </Text>
            </View>

            {/* Scrollable Content */}
            <ScrollView 
              style={styles.modalScrollContent}
              contentContainerStyle={{ paddingBottom: 16 }}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {/* Day Selector - Similar to Website */}
              <View style={styles.daySelectorContainer}>
                <Text style={styles.daySelectorLabel}>Select Day</Text>
                <View style={styles.dayPickerWrapper}>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={attendanceDate.toISOString().split('T')[0]}
                    onChange={(e) => {
                      const newDate = new Date(e.target.value);
                      console.log('[DATE PICKER] Web date changed:', newDate);
                      setAttendanceDate(newDate);
                    }}
                    max={new Date().toISOString().split('T')[0]}
                    min={new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      fontSize: '16px',
                      fontWeight: '600',
                      color: isDark ? '#E5E7EB' : '#1F2937',
                      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                      border: 'none',
                      borderRadius: '10px',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  />
                ) : (
                  <TouchableOpacity 
                    style={styles.dayPickerButton}
                    onPress={() => {
                      console.log('[DATE PICKER] Button clicked, opening date picker');
                      setShowDatePicker(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dayPickerText}>
                      📅 {attendanceDate.toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Session Selection */}
            <View style={styles.sessionSelectorContainer}>
              <Text style={styles.sessionSelectorLabel}>Session</Text>
              <View style={styles.sessionToggleButtons}>
                <TouchableOpacity
                  style={[
                    styles.sessionToggleButton,
                    selectedSession === 'morning' && styles.sessionToggleButtonActive
                  ]}
                  onPress={() => {
                    console.log('[ATTENDANCE] Switching to morning session');
                    setSelectedSession('morning');
                  }}
                >
                  <Text 
                    style={[
                      styles.sessionToggleText,
                      selectedSession === 'morning' && styles.sessionToggleTextActive
                    ]}
                    numberOfLines={1}
                  >🌅 Morning</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.sessionToggleButton,
                    selectedSession === 'afternoon' && styles.sessionToggleButtonActive
                  ]}
                  onPress={() => {
                    console.log('[ATTENDANCE] Switching to afternoon session');
                    setSelectedSession('afternoon');
                  }}
                >
                  <Text 
                    style={[
                      styles.sessionToggleText,
                      selectedSession === 'afternoon' && styles.sessionToggleTextActive
                    ]}
                    numberOfLines={1}
                  >🌇 Afternoon</Text>
                </TouchableOpacity>
              </View>
            </View>

              {/* Divider */}
              <View style={styles.modalDivider} />
              
              {/* Student List */}
              <View style={styles.studentsList}>
                {students.length === 0 ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={styles.modalSubtitle}>No students found in this class/section</Text>
                  </View>
                ) : (
                  students.map((student) => {
                    const isLocked = lockedStudents.has(student.userId);
                    return (
                      <View key={student.userId} style={styles.studentRow}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={styles.studentName}>
                            {student.name?.displayName || `${student.name?.firstName || ''} ${student.name?.lastName || ''}`.trim() || student.userId}
                          </Text>
                          {isLocked && (
                            <View style={styles.lockedBadge}>
                              <Text style={styles.lockedBadgeText}>🔒 Marked</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.attendanceButtons}>
                          {['present', 'absent'].map((status) => {
                            const isSelected = attendanceData[student.userId] === status;
                            return (
                              <TouchableOpacity
                                key={status}
                                style={[
                                  styles.attendanceButton,
                                  status === 'present' ? styles.presentButton : styles.absentButton,
                                  isSelected && (status === 'present' ? styles.presentButtonSelected : styles.absentButtonSelected),
                                  (isLocked || isViewingPastAttendance) && { opacity: 0.4 }
                                ]}
                                onPress={() => {
                                  if (!isLocked && !isViewingPastAttendance) {
                                    setAttendanceData(prev => ({
                                      ...prev,
                                      [student.userId]: status as 'present' | 'absent'
                                    }));
                                  }
                                }}
                                disabled={isLocked || isViewingPastAttendance}
                              >
                                <Text style={[
                                  styles.attendanceButtonText,
                                  status === 'present' ? styles.presentText : styles.absentText,
                                  isSelected && styles.selectedText
                                ]}>
                                  {status === 'present' ? 'P' : 'A'}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>
            
            {/* Fixed Footer with Action Buttons */}
            <View style={styles.modalFooter}>
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.cancelButton, isViewingPastAttendance && { flex: 1 }]}
                  onPress={() => setShowMarkAttendance(false)}
                >
                  <Text style={styles.cancelButtonText}>{isViewingPastAttendance ? 'Close' : 'Cancel'}</Text>
                </TouchableOpacity>
                {!isViewingPastAttendance && (
                  <TouchableOpacity 
                    style={styles.saveButton}
                    onPress={handleSaveAttendance}
                  >
                    <Text style={styles.saveButtonText}>Save Attendance</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Date Picker - Only for mobile (iOS/Android) */}
      {Platform.OS !== 'web' && showDatePicker && (
        <>
          {console.log('[DATE PICKER] Rendering DateTimePicker component')}
          <DateTimePicker
            value={attendanceDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            maximumDate={new Date()}
            minimumDate={new Date(new Date().setFullYear(new Date().getFullYear() - 1))}
          />
        </>
      )}
    </SafeAreaView>
  );
}

function getStyles(isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#0B0F14' : '#E0F2FE' },
    scrollView: { flex: 1 },
    header: { padding: 20, paddingTop: 10, alignItems: 'center' },
    headerTitle: { fontSize: 24, fontWeight: '700', color: isDark ? '#93C5FD' : '#1E3A8A' },
    headerSubtitle: { fontSize: 14, color: isDark ? '#9CA3AF' : '#1E3A8A', marginTop: 4 },
    section: { paddingHorizontal: 20, marginBottom: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: isDark ? '#93C5FD' : '#1E3A8A', marginBottom: 12 },
    dropdownContainer: {
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      borderRadius: 12,
      borderWidth: 2,
      borderColor: isDark ? '#374151' : '#DBEAFE',
      overflow: 'hidden',
      minHeight: 56,
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    picker: {
      color: isDark ? '#E5E7EB' : '#1F2937',
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      height: 56,
    },
    filterScroll: { marginTop: 8 },
    filterChip: {
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginRight: 8,
      borderWidth: 2,
      borderColor: isDark ? '#374151' : '#DBEAFE',
    },
    filterChipActive: {
      backgroundColor: isDark ? '#1E40AF' : '#3B82F6',
      borderColor: isDark ? '#1E40AF' : '#3B82F6',
    },
    filterChipText: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#E5E7EB' : '#1F2937',
    },
    filterChipTextActive: {
      color: '#FFFFFF',
    },
    markAttendanceButton: { 
      backgroundColor: isDark ? '#1E40AF' : '#3B82F6', 
      borderRadius: 12, 
      padding: 16, 
      alignItems: 'center' 
    },
    markAttendanceButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    // Modal styles
    modalContainer: { 
      flex: 1, 
      backgroundColor: 'rgba(0, 0, 0, 0.5)', 
      justifyContent: 'center', 
      alignItems: 'center', 
      padding: 20 
    },
    modalContent: { 
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF', 
      borderRadius: 16, 
      width: '100%',
      maxWidth: 500,
      maxHeight: '90%',
      flex: 1,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    },
    modalScrollContent: {
      flex: 1,
      minHeight: 0,
    },
    modalHeader: { marginBottom: 12, paddingHorizontal: 20, paddingTop: 20 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: isDark ? '#E5E7EB' : '#1F2937', marginBottom: 4 },
    modalSubtitle: { fontSize: 14, color: isDark ? '#9CA3AF' : '#6B7280' },
    studentsList: { 
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    studentRow: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      paddingVertical: 14, 
      paddingHorizontal: 4,
      borderBottomWidth: 1, 
      borderBottomColor: isDark ? '#374151' : '#E5E7EB',
      minHeight: 60,
    },
    studentName: { fontSize: 14, fontWeight: '500', color: isDark ? '#E5E7EB' : '#1F2937' },
    lockedBadge: { 
      backgroundColor: isDark ? '#7F1D1D' : '#FEE2E2', 
      paddingHorizontal: 8, 
      paddingVertical: 4, 
      borderRadius: 8, 
      marginLeft: 8 
    },
    lockedBadgeText: { fontSize: 10, fontWeight: '600', color: isDark ? '#FCA5A5' : '#DC2626' },
    attendanceButtons: { flexDirection: 'row', gap: 12 },
    attendanceButton: { 
      width: 44, 
      height: 44, 
      borderRadius: 22, 
      justifyContent: 'center', 
      alignItems: 'center', 
      borderWidth: 2,
    },
    presentButton: { 
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ECFDF5',
      borderColor: '#10B981',
    },
    presentButtonSelected: { 
      backgroundColor: '#10B981',
      borderColor: '#10B981',
      // Shadow for attractive look
      shadowColor: '#10B981',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 6,
    },
    absentButton: { 
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
      borderColor: '#EF4444',
    },
    absentButtonSelected: { 
      backgroundColor: '#EF4444',
      borderColor: '#EF4444',
      // Shadow for attractive look
      shadowColor: '#EF4444',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 6,
    },
    attendanceButtonText: { 
      fontSize: 18, 
      fontWeight: '800', 
    },
    presentText: {
      color: '#10B981',
    },
    absentText: {
      color: '#EF4444',
    },
    selectedText: {
      color: '#FFFFFF',
    },
    modalFooter: {
      borderTopWidth: 2,
      borderTopColor: isDark ? '#374151' : '#E5E7EB',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: isDark ? '#111827' : '#F9FAFB',
    },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    cancelButton: { flex: 1, backgroundColor: isDark ? '#374151' : '#F3F4F6', borderRadius: 8, padding: 14, alignItems: 'center' },
    cancelButtonText: { fontSize: 15, fontWeight: '600', color: isDark ? '#9CA3AF' : '#6B7280' },
    saveButton: { flex: 1, backgroundColor: '#3B82F6', borderRadius: 8, padding: 14, alignItems: 'center' },
    saveButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
    // Day Selector styles (Website-like)
    daySelectorContainer: { 
      paddingHorizontal: 20, 
      paddingVertical: 16,
      backgroundColor: isDark ? '#111827' : '#F9FAFB',
      borderRadius: 12,
      marginHorizontal: 20,
      marginTop: 16,
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#E5E7EB',
    },
    daySelectorLabel: { 
      fontSize: 14, 
      fontWeight: '700', 
      color: isDark ? '#93C5FD' : '#1E3A8A', 
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    dayPickerWrapper: { 
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      borderRadius: 10,
      borderWidth: 2,
      borderColor: isDark ? '#374151' : '#DBEAFE',
      overflow: 'hidden',
    },
    dayPickerButton: { 
      paddingVertical: 14,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    dayPickerText: { 
      fontSize: 16, 
      fontWeight: '600', 
      color: isDark ? '#E5E7EB' : '#1F2937',
    },
    // Session Selector styles
    sessionSelectorContainer: { 
      paddingHorizontal: 20, 
      paddingVertical: 16,
      backgroundColor: isDark ? '#111827' : '#F9FAFB',
      borderRadius: 12,
      marginHorizontal: 20,
      marginTop: 12,
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#E5E7EB',
    },
    sessionSelectorLabel: { 
      fontSize: 14, 
      fontWeight: '700', 
      color: isDark ? '#93C5FD' : '#1E3A8A', 
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sessionToggleButtons: { 
      flexDirection: 'row', 
      gap: 12,
    },
    sessionToggleButton: { 
      flex: 1, 
      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
      borderRadius: 10,
      paddingVertical: 14,
      paddingHorizontal: 16,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: isDark ? '#374151' : '#DBEAFE',
    },
    sessionToggleButtonActive: { 
      backgroundColor: isDark ? '#1E40AF' : '#3B82F6',
      borderColor: isDark ? '#1E40AF' : '#3B82F6',
    },
    sessionToggleText: { 
      fontSize: 15, 
      fontWeight: '600', 
      color: isDark ? '#9CA3AF' : '#6B7280',
      flexShrink: 0,
    },
    sessionToggleTextActive: { 
      color: '#FFFFFF',
    },
    modalDivider: {
      height: 1,
      backgroundColor: isDark ? '#374151' : '#E5E7EB',
      marginVertical: 16,
      marginHorizontal: 20,
    },
    // Old attendance controls styles (kept for compatibility)
    attendanceControls: { marginTop: 16, gap: 12 },
    controlGroup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    controlLabel: { fontSize: 14, fontWeight: '600', color: isDark ? '#E5E7EB' : '#1F2937', flex: 1 },
    dateButton: { backgroundColor: isDark ? '#374151' : '#F3F4F6', borderRadius: 8, padding: 8, flex: 2 },
    dateButtonText: { fontSize: 14, color: isDark ? '#E5E7EB' : '#1F2937', textAlign: 'center' },
    sessionButtons: { flexDirection: 'row', gap: 8, flex: 2 },
    sessionButton: { flex: 1, backgroundColor: isDark ? '#374151' : '#F3F4F6', borderRadius: 8, padding: 8, alignItems: 'center' },
    sessionButtonActive: { backgroundColor: '#3B82F6' },
    sessionButtonText: { fontSize: 12, fontWeight: '600', color: isDark ? '#9CA3AF' : '#6B7280' },
    sessionButtonTextActive: { color: '#FFFFFF' },
  });
}
