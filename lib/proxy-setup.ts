// Setup global proxy for all HTTP/HTTPS requests using undici
import { ProxyAgent, setGlobalDispatcher } from 'undici';

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

if (proxyUrl) {
  console.log('Setting up global proxy agent with undici...');
  const proxyAgent = new ProxyAgent(proxyUrl);
  setGlobalDispatcher(proxyAgent);
  console.log('Global proxy configured:', proxyUrl.replace(/:[^:@]+@/, ':****@'));
}
