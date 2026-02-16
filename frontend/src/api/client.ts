import axios from 'axios';
import type { AuthTokens, LoginCredentials, Membership, RegisterData, User } from '../types';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Authorization Bearer token from localStorage
api.interceptors.request.use(
  (config) => {
    const tokensRaw = localStorage.getItem('tokens');
    if (tokensRaw) {
      try {
        const tokens: AuthTokens = JSON.parse(tokensRaw);
        if (tokens.access) {
          config.headers.Authorization = `Bearer ${tokens.access}`;
        }
      } catch {
        // Invalid JSON in localStorage, ignore
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: on 401, try refreshing the token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 403 Forbidden - show access denied, don't redirect to login
    if (error.response?.status === 403) {
      return Promise.reject(error);
    }

    // If the error is not 401 or the request has already been retried, reject
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't try to refresh if the failing request was the refresh endpoint itself
    if (originalRequest.url?.includes('/auth/token/refresh/')) {
      localStorage.removeItem('tokens');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const tokensRaw = localStorage.getItem('tokens');
      if (!tokensRaw) {
        throw new Error('No tokens available');
      }

      const tokens: AuthTokens = JSON.parse(tokensRaw);
      const response = await axios.post(
        `${api.defaults.baseURL}/auth/token/refresh/`,
        { refresh: tokens.refresh }
      );

      const newTokens: AuthTokens = {
        access: response.data.access,
        refresh: tokens.refresh,
      };
      localStorage.setItem('tokens', JSON.stringify(newTokens));

      processQueue(null, newTokens.access);

      originalRequest.headers.Authorization = `Bearer ${newTokens.access}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      localStorage.removeItem('tokens');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// API response types
export interface LoginResponse {
  user: User;
  memberships: Membership[];
  tokens: AuthTokens;
}

export interface RegisterResponse {
  user: User;
  organization: { id: string; name: string; slug: string } | null;
  tokens: AuthTokens;
}

export interface MeResponse {
  user: User;
  memberships: Membership[];
}

// Helper functions
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/login/', credentials);
  return response.data;
}

export async function register(data: RegisterData): Promise<RegisterResponse> {
  const response = await api.post<RegisterResponse>('/auth/register/', data);
  return response.data;
}

export async function refreshToken(refresh: string): Promise<{ access: string }> {
  const response = await api.post<{ access: string }>('/auth/token/refresh/', {
    refresh,
  });
  return response.data;
}

export async function getMe(): Promise<MeResponse> {
  const response = await api.get<MeResponse>('/auth/me/');
  return response.data;
}

export default api;
