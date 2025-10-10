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
            <h1 class="text-2xl font-bold text-gray-900">Block #{{ id }}</h1>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div v-if="isLoading" class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>

      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 class="text-lg font-medium text-red-800 mb-2">Error Loading Block</h3>
        <p class="text-red-600">{{ error.message }}</p>
      </div>

      <div v-else-if="block" class="space-y-6">
        <!-- Block Summary -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Block Summary</h2>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt class="text-sm font-medium text-gray-500">Height</dt>
              <dd class="text-lg font-semibold text-gray-900">{{ block.data?.header?.height }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">Chain ID</dt>
              <dd class="text-lg font-semibold text-gray-900">{{ block.data?.header?.chainId }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">Timestamp</dt>
              <dd class="text-lg font-semibold text-gray-900">{{ formatFullTime(block.data?.header?.time) }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">Transactions</dt>
              <dd class="text-lg font-semibold text-gray-900">{{ block.data?.header?.num_txs || 0 }}</dd>
            </div>
          </dl>
        </div>

        <!-- Block Hash Info -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Block Hashes</h2>
          <dl class="space-y-3">
            <div>
              <dt class="text-sm font-medium text-gray-500">Block Hash</dt>
              <dd class="text-sm font-mono bg-gray-100 p-2 rounded border break-all">{{ block.blockId?.hash }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">App Hash</dt>
              <dd class="text-sm font-mono bg-gray-100 p-2 rounded border break-all">{{ block.data?.header?.appHash }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">Data Hash</dt>
              <dd class="text-sm font-mono bg-gray-100 p-2 rounded border break-all">{{ block.data?.header?.dataHash }}</dd>
            </div>
          </dl>
        </div>

        <!-- Raw JSON Data -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Raw Block Data</h2>
          <pre class="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto">{{ JSON.stringify(block.data, null, 2) }}</pre>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { api } from '../lib/api'

const props = defineProps<{
  id: string
}>()

const { data: blockData, isLoading, error } = useQuery({
  queryKey: ['block', props.id],
  queryFn: () => api.getBlockById(parseInt(props.id)),
  retry: 3
})

const block = computed(() => blockData.value?.[0])

function formatFullTime(timestamp: string) {
  if (!timestamp) return 'Unknown'
  return new Date(timestamp).toLocaleString()
}
</script>