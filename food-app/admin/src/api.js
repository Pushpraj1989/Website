// Every call goes to the same origin. Errors come back as { error: { code, message } } and are shown as text.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body, headers = {}) {
  const options = { method, credentials: 'same-origin', headers: { ...headers } };
  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(path, options);
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) throw new ApiError(json.error?.message ?? 'Something went wrong.', response.status);
  return json;
}

export const api = {
  signIn: (password) => request('POST', '/v1/admin/session', { password }),
  brand: () => request('GET', '/v1/brand'),
  settings: () => request('GET', '/v1/admin/restaurant'),
  saveSettings: (body) => request('PUT', '/v1/admin/restaurant', body),
  uploadLogo: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('POST', '/v1/admin/restaurant/logo', form);
  },
  removeLogo: () => request('DELETE', '/v1/admin/restaurant/logo'),
  catalog: () => request('GET', '/v1/admin/catalog'),
  createCategory: (body) => request('POST', '/v1/admin/categories', body),
  updateCategory: (id, body) => request('PATCH', `/v1/admin/categories/${id}`, body),
  createProduct: (body) => request('POST', '/v1/admin/products', body),
  updateProduct: (id, body) => request('PATCH', `/v1/admin/products/${id}`, body),
  deleteProduct: (id) => request('DELETE', `/v1/admin/products/${id}`),
  gallery: (id) => request('GET', `/v1/admin/products/${id}/media`),
  uploadMedia: (id, file, altEn, altAr) => {
    const form = new FormData();
    form.append('file', file);
    form.append('altEn', altEn ?? '');
    form.append('altAr', altAr ?? '');
    return request('POST', `/v1/admin/products/${id}/media`, form);
  },
  arrangeMedia: (id, order, primary) => request('PATCH', `/v1/admin/products/${id}/media`, { order, primary }),
  removeMedia: (id, mediaId) => request('DELETE', `/v1/admin/products/${id}/media/${mediaId}`),
  orders: () => request('GET', '/v1/admin/orders'),
  acceptOrder: (id, etaMinutes) => request('POST', `/v1/admin/orders/${id}/accept`, { etaMinutes }),
  setOrderStatus: (id, to) => request('POST', `/v1/admin/orders/${id}/status`, { to }),
  zones: () => request('GET', '/v1/admin/zones'),
  createZone: (body) => request('POST', '/v1/admin/zones', body),
  updateZone: (id, body) => request('PATCH', `/v1/admin/zones/${id}`, body),
  campaigns: () => request('GET', '/v1/admin/campaigns'),
  campaign: (id) => request('GET', `/v1/admin/campaigns/${id}`),
  createCampaign: (body) => request('POST', '/v1/admin/campaigns', body),
  updateCampaign: (id, body) => request('PATCH', `/v1/admin/campaigns/${id}`, body),
  campaignAction: (id, action) => request('POST', `/v1/admin/campaigns/${id}/transition`, { action }),
  addCampaignRule: (id, body) => request('POST', `/v1/admin/campaigns/${id}/offers`, body),
  createPool: (campaignId, body) => request('POST', `/v1/admin/campaigns/${campaignId}/pools`, body),
  pool: (id) => request('GET', `/v1/admin/voucher-pools/${id}`),
  runBatch: (id) => request('POST', `/v1/admin/voucher-batches/${id}/run`),
  // Printed sheets and code exports are files: fetched with the staff session, then saved by the browser.
  downloadPool: async (poolId, path, fallbackName) => {
    const response = await fetch(`/v1/admin/voucher-pools/${poolId}/${path}`, { credentials: 'same-origin' });
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      throw new ApiError(json.error?.message ?? 'The file could not be made.', response.status);
    }
    const disposition = response.headers.get('content-disposition') ?? '';
    const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  addManualCode: (poolId, body) => request('POST', `/v1/admin/voucher-pools/${poolId}/codes`, body),
  createBatch: (poolId, body, idempotencyKey) => request('POST', `/v1/admin/voucher-pools/${poolId}/batches`, body, { 'Idempotency-Key': idempotencyKey }),
  templates: () => request('GET', '/v1/admin/voucher-templates'),
  template: (id) => request('GET', `/v1/admin/voucher-templates/${id}`),
  createTemplate: (body) => request('POST', '/v1/admin/voucher-templates', body),
  saveTemplate: (id, body) => request('PATCH', `/v1/admin/voucher-templates/${id}`, body),
  templateBackground: (id, file) => {
    const form = new FormData();
    form.append('file', file);
    return request('POST', `/v1/admin/voucher-templates/${id}/background`, form);
  },
  publishTemplate: (id) => request('POST', `/v1/admin/voucher-templates/${id}/publish`),
  archiveTemplate: (id) => request('POST', `/v1/admin/voucher-templates/${id}/archive`),
  duplicateTemplate: (id) => request('POST', `/v1/admin/voucher-templates/${id}/duplicate`),
  templatePreview: (id, which = 'draft') => request('GET', `/v1/admin/voucher-templates/${id}/preview?which=${which}`),
  promotionReport: () => request('GET', '/v1/admin/reports/promotions'),
  downloadPromotionCsv: async () => {
    const response = await fetch('/v1/admin/reports/promotions.csv', { credentials: 'same-origin' });
    if (!response.ok) throw new ApiError('The report could not be made.', response.status);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'promotion-campaigns.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  revokeVoucher: (id, reason) => request('POST', `/v1/admin/vouchers/${id}/revoke`, { reason }),
  campaignAudit: (id) => request('GET', `/v1/admin/campaigns/${id}/audit`),
  partners: () => request('GET', '/v1/admin/partner-clients'),
  createPartner: (body) => request('POST', '/v1/admin/partner-clients', body),
  rotatePartnerKey: (id) => request('POST', `/v1/admin/partner-clients/${id}/rotate`),
  revokePartner: (id) => request('POST', `/v1/admin/partner-clients/${id}/revoke`),
  promotions: () => request('GET', '/v1/admin/promotions'),
  uploadPromotionMedia: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('POST', '/v1/admin/promotions/media', form);
  },
  createPromotion: (body) => request('POST', '/v1/admin/promotions', body),
  updatePromotion: (id, body) => request('PUT', `/v1/admin/promotions/${id}`, body),
  deletePromotion: (id) => request('DELETE', `/v1/admin/promotions/${id}`),
  aiSettings: () => request('GET', '/v1/admin/ai'),
  saveAiSettings: (body) => request('PUT', '/v1/admin/ai', body),
  aiModels: (provider, apiKey) => request('POST', '/v1/admin/ai/models', { provider, apiKey }),
  createOffer: (body) => request('POST', '/v1/admin/offers', body),
  updateOffer: (id, body) => request('PATCH', `/v1/admin/offers/${id}`, body),
  deleteOffer: (id) => request('DELETE', `/v1/admin/offers/${id}`),
};
