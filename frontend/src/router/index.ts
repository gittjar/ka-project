import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';

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
    { path: '/admin', component: () => import('../views/AdminView.vue'), meta: { title: 'Admin', requiresAuth: true } },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title ?? 'Kanniaalio+'} — Kanniaalio+`;
  next();
});

export default router;
