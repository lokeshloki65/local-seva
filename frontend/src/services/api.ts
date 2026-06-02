import axios from 'axios';

// Pull Base URL from environment or default
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach bearer token dynamically on every request
apiClient.interceptors.request.use(
  async (config) => {
    // Check if token exists in session/localStorage
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle global errors / token expiry redirects
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle Token Expiry
    if (error.response?.status === 418 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Attempt session refresh trigger (handled on app.tsx or auth hook level)
        // Here we clear local items and prompt user to login if critical failure occurs
        logger_warn("Session token expired (FastAPI returned status code 418).");
      } catch (err) {
        localStorage.removeItem('auth_token');
      }
    }
    return Promise.reject(error);
  }
);

function logger_warn(msg: string) {
  console.warn(`[API INTERCEPTOR] ${msg}`);
}

export default apiClient;
