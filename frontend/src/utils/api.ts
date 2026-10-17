const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const AUTH_TOKEN_KEY = 'transformhub_auth_token';

export type AuthUser = { id: string; name: string; email: string; role: string };
export type AuthSession = { access_token: string; token_type: string; user: AuthUser };
export const getAuthToken = () => typeof window === 'undefined' ? null : localStorage.getItem(AUTH_TOKEN_KEY);
export const saveAuthSession = (session: AuthSession) => {
  localStorage.setItem(AUTH_TOKEN_KEY, session.access_token);
  localStorage.setItem('transformhub_user', JSON.stringify({ name: session.user.name, email: session.user.email, role: session.user.role, organization: 'TransformHub Workspace', twoFactorEnabled: false }));
};
export const clearAuthSession = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem('transformhub_user');
  window.dispatchEvent(new Event('transformhub:logout'));
};

export type BackendTransformation = {
  id: string; title: string; summary: string | null; status: string;
  configuration: Record<string, unknown>; created_at: string;
};
export type IntegrationStatus = {
  generation: { provider: string; model: string; mode: string };
  embeddings: { provider: string; model: string; dimensions: number };
  configuration_source: string;
};
export const getIntegrationStatus = () => apiRequest<IntegrationStatus>('/api/integrations/status');
export type UploadResult = {
  file_id: string; transformation_id: string; filename: string; content_type: string;
  object_key: string; title: string; summary: string; text_length: number;
};
export type BatchUploadResult = {
  transformation_id: string; title: string; summary: string; file_count: number;
  total_size_bytes: number; total_text_length: number;
  files: { file_id: string; filename: string; content_type: string; object_key: string; size_bytes: number; text_length: number }[];
};
export type GeneratedOutput = {
  id: string; transformation_id: string; output_type: string; title: string;
  content: string; content_json: Record<string, any>; status: string;
  reviewer_comment?: string | null; created_at: string; updated_at: string;
};
export type GeneratedOutputFailure = {
  output_type: string; language: string; error: string;
};

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  if (!(options.body instanceof FormData) && options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('The request timed out. Check the backend or language model status, then retry.');
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The request was cancelled before the backend finished.');
    }
    throw new Error(`Cannot reach TransformHub API at ${API_URL}. Start the backend and check NEXT_PUBLIC_API_URL.`);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = typeof body.detail === 'string' ? body.detail : `API request failed (${response.status})`;
    if (response.status === 401 && token) clearAuthSession();
    throw new Error(detail);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const registerAccount = (payload: { name: string; email: string; password: string }) =>
  apiRequest<AuthSession>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
export const loginAccount = (payload: { email: string; password: string }) =>
  apiRequest<AuthSession>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
export const createGuestSession = () => apiRequest<AuthSession>('/api/auth/guest', { method: 'POST', body: JSON.stringify({}) });
export const getCurrentAccount = () => apiRequest<AuthUser>('/api/auth/me');

export const createTransformation = (payload: { title?: string; summary?: string; configuration?: Record<string, unknown> }) =>
  apiRequest<BackendTransformation>('/api/transformations', { method: 'POST', body: JSON.stringify(payload) });
export const updateTransformation = (id: string, payload: Record<string, unknown>) =>
  apiRequest<BackendTransformation>(`/api/transformations/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const listTransformations = () => apiRequest<BackendTransformation[]>('/api/transformations');
export const getTransformation = (id: string) => apiRequest<BackendTransformation>(`/api/transformations/${id}`);
export const uploadTransformationFiles = (transformationId: string, files: File[]) => {
  const form = new FormData(); form.append('transformation_id', transformationId);
  files.forEach((file) => form.append('files', file));
  return apiRequest<BatchUploadResult>('/api/uploads/batch', { method: 'POST', body: form });
};
export const uploadTextSource = (transformationId: string, filename: string, content: string) =>
  apiRequest<UploadResult>('/api/uploads/text', { method: 'POST', body: JSON.stringify({ transformation_id: transformationId, filename, content }) });
export const uploadUrlSource = (transformationId: string, url: string) =>
  apiRequest<UploadResult>('/api/uploads/url', { method: 'POST', body: JSON.stringify({ transformation_id: transformationId, url }) });
export const uploadRssSource = (transformationId: string, url: string) =>
  apiRequest<UploadResult>('/api/uploads/rss', { method: 'POST', body: JSON.stringify({ transformation_id: transformationId, url }) });

export const generateTransformationOutputs = (id: string, output_types: string[], languages: string[]) =>
  apiRequest<{
    transformation_id: string;
    status: string;
    outputs: GeneratedOutput[];
    failed_outputs: GeneratedOutputFailure[];
  }>(`/api/transformations/${id}/generate`, {
    method: 'POST',
    body: JSON.stringify({ output_types, languages }),
    signal: AbortSignal.timeout(195_000),
  });
export const listTransformationOutputs = (id: string) => apiRequest<GeneratedOutput[]>(`/api/transformations/${id}/outputs`);
export const reviewTransformationOutput = (id: string, outputId: string, payload: { decision: 'save' | 'approve' | 'reject'; comment?: string; edited_content?: string }) =>
  apiRequest<{ output: GeneratedOutput; transformation_status: string; next_step: string }>(`/api/transformations/${id}/outputs/${outputId}/review`, {
    method: 'POST', body: JSON.stringify(payload),
  });
export const getTransformationExportUrl = (id: string, outputId: string, format: ExportFormat = 'md') =>
  `${API_URL}/api/transformations/${id}/outputs/${outputId}/export?format=${format}`;
export const getTransformationReviewStatus = (id: string) =>
  apiRequest<{ transformation_id: string; status: string; total: number; needs_review: number; approved: number; rejected: number }>(`/api/transformations/${id}/review-status`);
export const getTransformationAuditLog = (id: string) =>
  apiRequest<{ id: string; action: string; output_id: string | null; details: Record<string, unknown>; created_at: string }[]>(`/api/transformations/${id}/audit-log`);
export const getCanonicalContent = (id: string) => apiRequest<{ transformation_id: string; canonical_content: Record<string, any> }>(`/api/transformations/${id}/canonical`);


export type ExportFormat = 'md' | 'txt' | 'json' | 'docx' | 'pdf' | 'pptx' | 'html';

export async function downloadTransformationExport(
  transformationId: string,
  outputId: string,
  format: ExportFormat,
): Promise<Blob> {
  const headers = new Headers();
  const token = getAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${getTransformationExportUrl(transformationId, outputId, format)}`, { headers });
  } catch {
    throw new Error(`Cannot reach TransformHub API at ${API_URL}. Start the backend and retry.`);
  }
  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    let message = `Export failed (${response.status}).`;
    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => ({}));
      if (typeof payload.detail === 'string') message = payload.detail;
    } else {
      const text = await response.text().catch(() => '');
      if (text) message = text.slice(0, 400);
    }
    throw new Error(message);
  }
  return response.blob();
}
