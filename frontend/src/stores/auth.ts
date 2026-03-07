import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../api';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('kk_token'));
  const username = ref<string | null>(localStorage.getItem('kk_username'));
  const role = ref<string | null>(localStorage.getItem('kk_role'));

  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => role.value === 'admin');

  function setAuth(data: { token: string; username: string; role: string }) {
    token.value = data.token;
    username.value = data.username;
    role.value = data.role;
    localStorage.setItem('kk_token', data.token);
    localStorage.setItem('kk_username', data.username);
    localStorage.setItem('kk_role', data.role);
  }

  function logout() {
    token.value = null;
    username.value = null;
    role.value = null;
    localStorage.removeItem('kk_token');
    localStorage.removeItem('kk_username');
    localStorage.removeItem('kk_role');
  }

  async function login(usr: string, pwd: string) {
    const { data } = await api.post('/auth/login', { username: usr, password: pwd });
    setAuth(data);
  }

  async function register(usr: string, pwd: string) {
    const { data } = await api.post('/auth/register', { username: usr, password: pwd });
    setAuth(data);
  }

  return { token, username, role, isLoggedIn, isAdmin, login, register, logout };
});
