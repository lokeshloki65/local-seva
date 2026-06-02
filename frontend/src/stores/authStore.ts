import { create } from 'zustand';
import { UserProfile } from '../types';
import apiClient from '../services/api';
import { socketService } from '../services/socket';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (uid: string, email: string, token: string, role: string, profile: UserProfile) => void;
  logout: () => void;
  updateUser: (updatedFields: Partial<UserProfile>) => void;
  setError: (msg: string | null) => void;
  setLoading: (isLoading: boolean) => void;
  syncProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('auth_token'),
  isAuthenticated: !!localStorage.getItem('auth_token'),
  isLoading: false,
  error: null,

  login: (uid, email, token, role, profile) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_uid', uid);
    
    // Connect Socket.io client immediately on authentication success
    socketService.connect(uid);

    set({
      user: profile,
      token,
      isAuthenticated: true,
      isLoading: false,
      error: null
    });
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_uid');
    
    // Disconnect Socket.io
    socketService.disconnect();

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    });
  },

  updateUser: (updatedFields) => {
    const currentUser = get().user;
    if (currentUser) {
      set({
        user: { ...currentUser, ...updatedFields }
      });
    }
  },

  setError: (msg) => set({ error: msg }),
  
  setLoading: (isLoading) => set({ isLoading }),

  syncProfile: async () => {
    const token = get().token;
    if (!token) return;

    set({ isLoading: true });
    try {
      // Pull fresh data from FastAPI '/users/me'
      const response = await apiClient.get('/users/me');
      if (response.status === 200) {
        const profile = response.data;
        
        // Connect socket if disconnected
        if (profile.uid) {
          socketService.connect(profile.uid);
        }

        set({
          user: profile,
          isAuthenticated: true,
          isLoading: false
        });
      }
    } catch (err: any) {
      console.error('[AUTH STORE] Failed to sync user profile:', err);
      // If unauthorized, clear session
      if (err.response?.status === 401) {
        get().logout();
      }
      set({ isLoading: false });
    }
  }
}));
