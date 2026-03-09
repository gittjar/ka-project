import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView, meta: { title: 'Etusivu' } },
    { path: '/jasenet', component: () => import('../views/MembersView.vue'), meta: { title: 'Jäsenet' } },
    { path: '/kuvat', component: () => import('../views/GalleryView.vue'), meta: { title: 'Kuvia' } },
    { path: '/tarinat', component: () => import('../views/StoriesView.vue'), meta: { title: 'Tarinoita' } },
    { path: '/historia', component: () => import('../views/HistoryView.vue'), meta: { title: 'Historiikki' } },
    { path: '/juomat', component: () => import('../views/DrinksView.vue'), meta: { title: 'Juomat' } },
    { path: '/hakemus', component: () => import('../views/ApplicationView.vue'), meta: { title: 'Hakemus' } },
    { path: '/login', component: () => import('../views/LoginView.vue'), meta: { title: 'Kirjaudu sisään', guestOnly: true } },
    { path: '/admin', component: () => import('../views/AdminView.vue'), meta: { title: 'Admin', requiresAdmin: true } },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title ?? 'Kanniaalio+'} — Kanniaalio+`;

  const auth = useAuthStore();

  // Kirjautunut käyttäjä yrittää päästä kirjautumissivulle → ohjataan adminiin
  if (to.meta.guestOnly && auth.isLoggedIn) {
    return next('/admin');
  }

  // Admin-sivu vaatii admin-roolin → ohjataan kirjautumaan
  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return next({ path: '/login', query: { redirect: to.fullPath } });
  }

  next();
});

export default router;
