import env from '../config/env.js';
import HttpError from '../utils/http-error.js';

async function request(path, body) {
  let response;
  try {
    response = await fetch(`${env.analytics.baseUrl}/api/analytics/firehazr${path}`, {
      method: path === '' ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(path === '' ? {} : { body: JSON.stringify(body ?? null) }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new HttpError(503, 'FireHazR analytics is unavailable.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detailMessage = Array.isArray(data?.detail)
      ? data.detail
          .map((item) => {
            const loc = Array.isArray(item?.loc) ? item.loc.slice(1).join('.') : '';
            const msg = String(item?.msg || '').replace(/^Value error,\s*/i, '');
            return loc && msg ? `${loc}: ${msg}` : msg;
          })
          .filter(Boolean)
          .join(' ')
      : '';
    const message =
      typeof data?.detail === 'string'
        ? data.detail
        : detailMessage || 'Invalid FireHazR input conditions.';
    throw new HttpError(response.status >= 500 ? 502 : response.status, message,
      Array.isArray(data?.detail) ? { validation: data.detail } : undefined);
  }
  if (!data) throw new HttpError(502, 'FireHazR returned an invalid response.');
  return data;
}

export const firehazrMetadata = () => request('');
export const predictFirehazr = (conditions) => request('/predict', conditions);
