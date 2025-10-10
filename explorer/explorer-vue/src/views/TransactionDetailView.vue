<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <button @click="$router.go(-1)" class="mr-4 p-2 text-gray-600 hover:text-gray-900">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
              </svg>
            </button>
            <h1 class="text-2xl font-bold text-gray-900">Transaction Details</h1>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div v-if="isLoading" class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>

      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 class="text-lg font-medium text-red-800 mb-2">Error Loading Transaction</h3>
        <p class="text-red-600">{{ error.message }}</p>
      </div>

      <div v-else-if="transaction" class="space-y-6">
        <!-- Transaction Summary -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Transaction Summary</h2>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt class="text-sm font-medium text-gray-500">Hash</dt>
              <dd class="text-sm font-mono bg-gray-100 p-2 rounded border break-all">{{ transaction.id }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">Block Height</dt>
              <dd class="text-lg font-semibold text-gray-900">
                <router-link :to="`/block/${transactionMain?.height}`" class="text-blue-600 hover:text-blue-800">
                  {{ transactionMain?.height }}
                </router-link>
              </dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">Timestamp</dt>
              <dd class="text-lg font-semibold text-gray-900">{{ formatFullTime(transactionMain?.timestamp) }}</dd>
            </div>
            <div v-if="transactionMain?.fee">
              <dt class="text-sm font-medium text-gray-500">Fee</dt>
              <dd class="text-lg font-semibold text-gray-900">
                {{ transactionMain.fee.amount?.[0]?.amount || 0 }} {{ transactionMain.fee.amount?.[0]?.denom || 'umfx' }}
              </dd>
            </div>
            <div v-if="transactionMain?.memo" class="sm:col-span-2">
              <dt class="text-sm font-medium text-gray-500">Memo</dt>
              <dd class="text-sm bg-gray-100 p-2 rounded border">{{ transactionMain.memo }}</dd>
            </div>
            <div v-if="transactionMain?.error" class="sm:col-span-2">
              <dt class="text-sm font-medium text-red-500">Error</dt>
              <dd class="text-sm text-red-600 bg-red-50 p-2 rounded border">{{ transactionMain.error }}</dd>
            </div>
          </dl>
        </div>

        <!-- Messages -->
        <div v-if="messages && messages.length > 0" class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-xl font-semibold text-gray-900">Messages ({{ messages.length }})</h2>
          </div>
          <div class="divide-y divide-gray-200">
            <div v-for="(message, index) in messages" :key="index" class="p-6">
              <div class="flex justify-between items-start mb-3">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {{ message.type || 'Unknown Type' }}
                </span>
                <span class="text-sm text-gray-500">Index: {{ message.message_index }}</span>
              </div>
              <div v-if="message.sender" class="mb-3">
                <dt class="text-sm font-medium text-gray-500">Sender</dt>
                <dd class="text-sm font-mono bg-gray-100 p-2 rounded border break-all">{{ message.sender }}</dd>
              </div>
              <div v-if="message.metadata" class="mb-3">
                <dt class="text-sm font-medium text-gray-500">Metadata</dt>
                <dd class="text-xs bg-gray-100 p-2 rounded border overflow-x-auto">
                  <pre>{{ JSON.stringify(message.metadata, null, 2) }}</pre>
                </dd>
              </div>
            </div>
          </div>
        </div>

        <!-- Raw Transaction Data -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Raw Transaction Data</h2>
          <pre class="bg-gray-100 p-4 rounded-lg text-xs overflow-x-auto">{{ JSON.stringify(transaction.data, null, 2) }}</pre>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { api } from '../lib/api'

const props = defineProps<{
  id: string
}>()

// Fetch transaction raw data
const { data: transactionData, isLoading, error } = useQuery({
  queryKey: ['transaction-raw', props.id],
  queryFn: () => api.getTransactionById(props.id),
  retry: 3
})

// Fetch transaction metadata
const { data: transactionMainData } = useQuery({
  queryKey: ['transaction-main', props.id],
  queryFn: () => api.fetchAPI('/transactions_main', { id: `eq.${props.id}` }),
  retry: 3
})

// Fetch messages for this transaction
const { data: messagesData } = useQuery({
  queryKey: ['transaction-messages', props.id],
  queryFn: () => api.fetchAPI('/messages_main', { id: `eq.${props.id}` }),
  retry: 3
})

const transaction = computed(() => transactionData.value?.[0])
const transactionMain = computed(() => transactionMainData.value?.[0])
const messages = computed(() => messagesData.value || [])

function formatFullTime(timestamp: string) {
  if (!timestamp) return 'Unknown'
  return new Date(timestamp).toLocaleString()
}
</script>