import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: Function; reject: Function }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post('/auth/refresh', {});
        localStorage.setItem('access_token', data.accessToken);
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('access_token');
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export default api;

// ─── Auth ───
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  refresh: () => api.post('/auth/refresh'),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// ─── Users ───
export const usersApi = {
  list: (params?: any) => api.get('/users', { params }),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.patch(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  resetPassword: (id: string, password: string) =>
    api.post(`/users/${id}/reset-password`, { password }),
  setPermissions: (id: string, trackId: string, permissions: string[]) =>
    api.post(`/users/${id}/permissions`, { trackId, permissions }),
};

// ─── Tracks ───
export const tracksApi = {
  list: () => api.get('/tracks'),
  get: (id: string) => api.get(`/tracks/${id}`),
  create: (data: any) => api.post('/tracks', data),
  update: (id: string, data: any) => api.patch(`/tracks/${id}`, data),
  delete: (id: string) => api.delete(`/tracks/${id}`),
};

// ─── Records ───
export const recordsApi = {
  listByTrack: (trackId: string, params?: any) =>
    api.get(`/records/track/${trackId}`, { params }),
  stats: (trackId: string) => api.get(`/records/track/${trackId}/stats`),
  get: (id: string) => api.get(`/records/${id}`),
  create: (data: any) => api.post('/records', data),
  update: (id: string, data: any) => api.patch(`/records/${id}`, data),
  delete: (id: string) => api.delete(`/records/${id}`),
};

// ─── Audit ───
export const auditApi = {
  list: (params?: any) => api.get('/audit', { params }),
};
