// Environment Configuration
// IMPORTANT: When running the app, replace the API_BASE_URL with your actual backend URL
// For local development on same machine: http://localhost:5050/api
// For mobile device testing: http://<YOUR_IP_ADDRESS>:5050/api (e.g., http://192.168.1.100:5050/api)
// For Replit deployment: Use your Replit backend URL

import { Platform } from 'react-native';

// Prefer runtime override when provided
const RUNTIME_BASE_URL = (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) || '';

// Sensible defaults per platform
const DEFAULT_BASE_URL = 'https://goodsync.onrender.com/api';

export const ENV = {
  // Final API base URL: env override > platform default
  API_BASE_URL: RUNTIME_BASE_URL || (DEFAULT_BASE_URL as string),

  // API Endpoints (used by the student service)
  ENDPOINTS: {
    LOGIN: '/auth/school-login',
    STUDENT_ASSIGNMENTS: '/assignments',
    STUDENT_ATTENDANCE: '/attendance/student-report',
    STUDENT_RESULTS: '/results/student',
    MESSAGES: '/messages',
  },
};

export default ENV;

