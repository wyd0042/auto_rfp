/**
 * CRITICAL: This file MUST be imported BEFORE any llamaindex imports
 * It configures the LlamaCloud API client with the correct baseUrl
 * and fixes a bug in the SDK where baseUrl is missing the https:// protocol
 */

import { client } from '@llamaindex/cloud/api';

const LLAMA_CLOUD_BASE_URL = process.env.LLAMA_CLOUD_BASE_URL || 'https://api.cloud.llamaindex.ai';
const LLAMA_CLOUD_API_KEY = process.env.LLAMA_CLOUD_API_KEY || process.env.LLAMACLOUD_API_KEY;

// Configure the client directly
client.setConfig({
  baseUrl: LLAMA_CLOUD_BASE_URL,
  throwOnError: true
});

// Add auth interceptor
if (LLAMA_CLOUD_API_KEY) {
  client.interceptors.request.use((request: Request) => {
    request.headers.set('Authorization', `Bearer ${LLAMA_CLOUD_API_KEY}`);
    return request;
  });
}

// WORKAROUND: The LlamaCloud SDK has a bug where initService() overwrites the client config
// with a baseUrl that's missing the https:// protocol. We wrap setConfig to automatically
// fix any baseUrl that's missing the protocol.
const originalSetConfig = client.setConfig.bind(client);

client.setConfig = (config: Parameters<typeof originalSetConfig>[0]) => {
  if (config.baseUrl && !config.baseUrl.startsWith('https://') && !config.baseUrl.startsWith('http://')) {
    config = { ...config, baseUrl: `https://${config.baseUrl}` };
  }
  return originalSetConfig(config);
};

export { client };
