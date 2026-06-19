// BrightData Proxy Configuration — credentials loaded from .env
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

const BRIGHTDATA_HOST = process.env.BRIGHTDATA_HOST ?? 'brd.superproxy.io';
const BRIGHTDATA_PORT = process.env.BRIGHTDATA_PORT ?? '33335';
const BRIGHTDATA_USERNAME = process.env.BRIGHTDATA_USERNAME ?? '';
const BRIGHTDATA_PASSWORD = process.env.BRIGHTDATA_PASSWORD ?? '';

export interface GeoProxyConfig {
  country: string;
  countryCode: string;
  proxyServer: string;
  proxyUsername: string;
  proxyPassword: string;
}

function buildProxyConfig(countryCode: string, countryName: string): GeoProxyConfig {
  return {
    country: countryName,
    countryCode,
    proxyServer: `http://${BRIGHTDATA_HOST}:${BRIGHTDATA_PORT}`,
    proxyUsername: `${BRIGHTDATA_USERNAME}-country-${countryCode}`,
    proxyPassword: BRIGHTDATA_PASSWORD,
  };
}

export const GEO_PROXIES: Record<string, GeoProxyConfig> = {
  india: buildProxyConfig('in', 'India'),
  indonesia: buildProxyConfig('id', 'Indonesia'),
  canada: buildProxyConfig('ca', 'Canada'),
  colombia: buildProxyConfig('co', 'Colombia'),
  brazil: buildProxyConfig('br', 'Brazil'),
};
