import axios from 'axios';
import { onRequestStart, onRequestDone } from '../composables/backendStatus';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kk_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  onRequestStart();
  return config;
});

// Ohjaa kirjautumissivulle kun token on vanhentunut tai virheellinen
api.interceptors.response.use(
  (res) => {
    onRequestDone(true);
    return res;
  },
  (err) => {
    // err.response defined = backend replied with an HTTP error (it IS up)
    onRequestDone(!!err.response);

    if (err.response?.status === 401) {
      const hadToken = !!localStorage.getItem('kk_token');
      // Siivoa kirjautumistiedot
      localStorage.removeItem('kk_token');
      localStorage.removeItem('kk_username');
      localStorage.removeItem('kk_role');
      // Merkitään syy toast-viestiä varten
      if (hadToken) {
        sessionStorage.setItem('kk_session_expired', '1');
      }
      // Ohjaus — ei redirect jos jo login-sivulla
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      }
    }
    return Promise.reject(err);
  },
);

export default api;

