import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/blocks',
      name: 'blocks',
      component: () => import('../views/BlocksView.vue'),
    },
    {
      path: '/block/:id',
      name: 'block-detail',
      component: () => import('../views/BlockDetailView.vue'),
      props: true,
    },
    {
      path: '/transactions',
      name: 'transactions', 
      component: () => import('../views/TransactionsView.vue'),
    },
    {
      path: '/tx/:id',
      name: 'transaction-detail',
      component: () => import('../views/TransactionDetailView.vue'),
      props: true,
    },
  ],
})

export default router
