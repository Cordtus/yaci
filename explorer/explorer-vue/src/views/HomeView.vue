<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <h1 class="text-2xl font-bold text-gray-900">{{ chainName }} Explorer</h1>
            <span class="ml-3 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
              Modern Vue 3
            </span>
          </div>
          <nav class="flex space-x-6">
            <router-link to="/" class="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium">Home</router-link>
            <router-link to="/blocks" class="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium">Blocks</router-link>
            <router-link to="/transactions" class="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium">Transactions</router-link>
          </nav>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">Latest Block</dt>
                <dd class="text-lg font-medium text-gray-900">
                  {{ latestBlock?.id || 'Loading...' }}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">Total Transactions</dt>
                <dd class="text-lg font-medium text-gray-900">
                  {{ transactions?.length || 'Loading...' }}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">Chain ID</dt>
                <dd class="text-lg font-medium text-gray-900">{{ chainId }}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- Data Tables -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Recent Blocks -->
        <div class="bg-white shadow rounded-lg">
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 class="text-lg font-medium text-gray-900">Recent Blocks</h3>
          </div>
          <div class="p-6">
            <div v-if="blocksLoading" class="flex justify-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
            <div v-else-if="blocksError" class="text-red-600 text-center py-8">
              Error: {{ blocksError.message }}
            </div>
            <div v-else class="space-y-4">
              <router-link 
                v-for="block in blocks?.slice(0, 5)" 
                :key="block.id"
                :to="`/block/${block.id}`"
                class="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-blue-50 hover:ring-2 hover:ring-blue-200 transition-all cursor-pointer"
              >
                <div>
                  <div class="font-semibold text-blue-600">Block #{{ block.id }}</div>
                  <div class="text-sm text-gray-600">
                    {{ formatTime(block.data?.header?.time) }}
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-sm text-gray-600">
                    {{ block.data?.header?.num_txs || 0 }} txs
                  </div>
                </div>
              </router-link>
            </div>
          </div>
        </div>

        <!-- Recent Transactions -->
        <div class="bg-white shadow rounded-lg">
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 class="text-lg font-medium text-gray-900">Recent Transactions</h3>
          </div>
          <div class="p-6">
            <div v-if="transactionsLoading" class="flex justify-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
            <div v-else-if="transactionsError" class="text-red-600 text-center py-8">
              Error: {{ transactionsError.message }}
            </div>
            <div v-else class="space-y-4">
              <router-link 
                v-for="tx in transactions?.slice(0, 5)" 
                :key="tx.id"
                :to="`/tx/${tx.id}`"
                class="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-green-50 hover:ring-2 hover:ring-green-200 transition-all cursor-pointer"
              >
                <div>
                  <div class="font-mono text-sm text-blue-600">{{ tx.id.substring(0, 12) }}...</div>
                  <div class="text-sm text-gray-600">Height: {{ tx.height }}</div>
                </div>
                <div class="text-right">
                  <div class="text-sm text-gray-600">
                    {{ formatTime(tx.timestamp) }}
                  </div>
                  <div v-if="tx.fee?.amount?.[0]" class="text-xs text-green-600">
                    Fee: {{ tx.fee.amount[0].amount }}
                  </div>
                </div>
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { api } from '../lib/api'

const chainName = import.meta.env.VITE_CHAIN_NAME || 'Blockchain'
const chainId = import.meta.env.VITE_CHAIN_ID || 'unknown'

// Fetch recent blocks with real-time updates
const { data: blocks, isLoading: blocksLoading, error: blocksError, refetch: refetchBlocks } = useQuery({
  queryKey: ['blocks'],
  queryFn: () => api.getBlocks(10),
  refetchInterval: 5000,
  retry: 3
})

// Fetch recent transactions with real-time updates  
const { data: transactions, isLoading: transactionsLoading, error: transactionsError, refetch: refetchTransactions } = useQuery({
  queryKey: ['transactions'],
  queryFn: () => api.getTransactions(10),
  refetchInterval: 5000,
  retry: 3
})

// Computed values
const latestBlock = computed(() => blocks.value?.[0])

// Utility functions
function formatTime(timestamp: string) {
  if (!timestamp) return 'Unknown'
  return new Date(timestamp).toLocaleTimeString()
}

// Auto-refresh interval
let refreshInterval: NodeJS.Timeout | null = null

onMounted(() => {
  // Additional manual refresh every 10 seconds
  refreshInterval = setInterval(() => {
    refetchBlocks()
    refetchTransactions()
  }, 10000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>
