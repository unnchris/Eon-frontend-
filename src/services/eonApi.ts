import type {
  AdaptiveBlock,
  ApprovalRequest,
  AuthSession,
  BackendStatus,
  BrowserActivityLog,
  BrowserSessionState,
  ChatMessage,
  ConnectionConfig,
  EndpointCapability,
  EndpointState,
  EonUser,
  PlanStep,
  SuggestedAction,
  TaskRecord,
  TaskStatus,
} from '../types/eon';

const CONFIG_STORAGE_KEY = 'eon_connection_config_v3';
const AUTH_STORAGE_KEY = 'eon_auth_session_v1';
const LOCAL_HISTORY_KEY = 'eon_session_history_v2';

export const DEFAULT_BACKEND_URL = 'https://solid-zebra-5vpqp6jgjw4pc7gwr-8000.app.github.dev';
export const DEFAULT_API_PREFIX = '/api/v1';

interface OpenApiCache {
  baseUrl: string;
  paths: Record<string, Record<string, unknown>>;
  schemas: Record<string, unknown>;
}

let cachedOpenApi: OpenApiCache | null = null;
let refreshPromise: Promise<AuthSession | null> | null = null;

export function getEnvBackendUrl(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return (
    env.NEXT_PUBLIC_API_URL ||
    env.VITE_EON_API_URL ||
    env.VITE_API_URL ||
    env.VITE_BACKEND_URL ||
    ''
  ).trim();
}

export function loadAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (typeof parsed.accessToken === 'string' && parsed.accessToken.trim() && parsed.user) {
      return parsed as AuthSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession | null): void {
  try {
    if (!session) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadConnectionConfig(): ConnectionConfig {
  const envUrl = getEnvBackendUrl() || DEFAULT_BACKEND_URL;
  const auth = loadAuthSession();
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ConnectionConfig>;
      return {
        baseUrl:
          typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim()
            ? parsed.baseUrl.trim()
            : envUrl,
        apiPrefix: typeof parsed.apiPrefix === 'string' ? parsed.apiPrefix : DEFAULT_API_PREFIX,
        authToken:
          typeof parsed.authToken === 'string' && parsed.authToken.trim()
            ? parsed.authToken.trim()
            : auth?.accessToken || '',
        streamMode:
          parsed.streamMode === 'sse' || parsed.streamMode === 'poll' ? parsed.streamMode : 'auto',
      };
    }
  } catch {
    // Ignore storage read errors
  }

  return {
    baseUrl: envUrl,
    apiPrefix: DEFAULT_API_PREFIX,
    authToken: auth?.accessToken || '',
    streamMode: 'auto',
  };
}

export function saveConnectionConfig(config: ConnectionConfig): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage write errors
  }
}

export function loadLocalSessionHistory(): TaskRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TaskRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalSessionTask(task: TaskRecord): void {
  try {
    const current = loadLocalSessionHistory();
    const sanitized: TaskRecord = {
      ...task,
      pendingApproval: task.pendingApproval
        ? { ...task.pendingApproval, fields: undefined }
        : null,
    };
    const next = [sanitized, ...current.filter((t) => t.id !== sanitized.id)].slice(0, 40);
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage write errors
  }
}

export function removeLocalSessionTask(taskId: string): void {
  try {
    const current = loadLocalSessionHistory();
    localStorage.setItem(
      LOCAL_HISTORY_KEY,
      JSON.stringify(current.filter((t) => t.id !== taskId))
    );
  } catch {
    // Ignore
  }
}

export class ApiEndpointError extends Error {
  status: number;
  endpoint: string;
  state: EndpointState;
  tunnelAuthBlocked?: boolean;
  validationFields?: string[];

  constructor(
    message: string,
    status: number,
    endpoint: string,
    state: EndpointState,
    options?: { tunnelAuthBlocked?: boolean; validationFields?: string[] }
  ) {
    super(message);
    this.name = 'ApiEndpointError';
    this.status = status;
    this.endpoint = endpoint;
    this.state = state;
    this.tunnelAuthBlocked = options?.tunnelAuthBlocked;
    this.validationFields = options?.validationFields;
  }
}

function shouldUseSameOriginProxy(baseUrl: string): boolean {
  if (typeof window === 'undefined') return false;
  const trimmed = baseUrl.trim();
  if (!trimmed || trimmed.startsWith('/')) return false;
  try {
    const target = new URL(trimmed);
    return target.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function resolveFetchTarget(
  config: ConnectionConfig,
  rawPath: string,
  useApiPrefix: boolean
): { url: string; displayUrl: string; proxyTarget?: string } {
  const base = config.baseUrl.trim().replace(/\/+$/, '');
  const prefix =
    useApiPrefix && config.apiPrefix.trim()
      ? '/' + config.apiPrefix.replace(/^\/+|\/+$/g, '')
      : '';
  const cleanPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const fullPath = `${prefix}${cleanPath}`;
  const displayUrl = base ? `${base}${fullPath}` : fullPath;

  if (shouldUseSameOriginProxy(base)) {
    return {
      url: `/eon-proxy${fullPath}`,
      displayUrl,
      proxyTarget: base,
    };
  }

  return {
    url: displayUrl,
    displayUrl,
  };
}

function getEffectiveToken(config: ConnectionConfig): string {
  const fromConfig = config.authToken.trim();
  if (fromConfig) return fromConfig;
  return loadAuthSession()?.accessToken || '';
}

function buildHeaders(
  config: ConnectionConfig,
  hasJsonBody = false,
  proxyTarget?: string
): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (hasJsonBody) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getEffectiveToken(config);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (proxyTarget) {
    headers['X-EON-Target-URL'] = proxyTarget;
  }
  return headers;
}

function unwrapApiData<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

async function rawRequestJson<T>(
  config: ConnectionConfig,
  rawPath: string,
  options: {
    useApiPrefix?: boolean;
    init?: RequestInit;
    timeoutMs?: number;
    allowRefreshRetry?: boolean;
  } = {}
): Promise<T> {
  const { useApiPrefix = true, init = {}, timeoutMs = 30000, allowRefreshRetry = true } = options;
  const target = resolveFetchTarget(config, rawPath, useApiPrefix);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const hasJsonBody = Boolean(init.body && !(init.body instanceof FormData));
    const response = await fetch(target.url, {
      ...init,
      credentials: 'include',
      headers: {
        ...buildHeaders(config, hasJsonBody, target.proxyTarget),
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });

    if (
      response.type === 'opaqueredirect' ||
      (response.redirected && response.url.includes('github.dev/pf-signin'))
    ) {
      throw new ApiEndpointError(
        'Server access is restricted behind tunnel sign-in. Set port 8000 visibility to Public.',
        401,
        target.displayUrl,
        'unauthorized',
        { tunnelAuthBlocked: true }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const isGithubTunnel = target.displayUrl.includes('.app.github.dev');
      throw new ApiEndpointError(
        isGithubTunnel
          ? 'The server returned a sign-in page instead of JSON. Check that port 8000 is Public.'
          : `Endpoint ${target.displayUrl} returned HTML instead of JSON.`,
        response.status || 404,
        target.displayUrl,
        'missing',
        { tunnelAuthBlocked: isGithubTunnel }
      );
    }

    if (response.status === 401 || response.status === 403) {
      if (allowRefreshRetry && !rawPath.includes('/auth/')) {
        const refreshed = await refreshAuthSession(config);
        if (refreshed?.accessToken) {
          return rawRequestJson<T>(
            { ...config, authToken: refreshed.accessToken },
            rawPath,
            { useApiPrefix, init, timeoutMs, allowRefreshRetry: false }
          );
        }
      }

      let authDetail = 'Please sign in to continue.';
      try {
        const body = (await response.json()) as Record<string, unknown>;
        if (typeof body.detail === 'string') authDetail = body.detail;
        else if (body.error && typeof (body.error as Record<string, unknown>).message === 'string') {
          authDetail = String((body.error as Record<string, unknown>).message);
        }
      } catch {
        // Ignore parse error
      }

      throw new ApiEndpointError(
        authDetail,
        response.status,
        target.displayUrl,
        'unauthorized'
      );
    }

    if (response.status === 404 || response.status === 405 || response.status === 501) {
      throw new ApiEndpointError(
        `Endpoint not available (${response.status}) at ${target.displayUrl}.`,
        response.status,
        target.displayUrl,
        'missing'
      );
    }

    if (!response.ok) {
      let detail = response.statusText || `HTTP ${response.status}`;
      const validationFields: string[] = [];
      let tunnelAuthBlocked = false;

      try {
        const errBody = (await response.json()) as Record<string, unknown>;
        if (errBody.error === 'tunnel_auth_required') {
          tunnelAuthBlocked = true;
        }
        if (typeof errBody.message === 'string') detail = errBody.message;
        else if (
          errBody.error &&
          typeof errBody.error === 'object' &&
          typeof (errBody.error as Record<string, unknown>).message === 'string'
        ) {
          detail = String((errBody.error as Record<string, unknown>).message);
        } else if (typeof errBody.error === 'string') detail = errBody.error;
        else if (typeof errBody.detail === 'string') detail = errBody.detail;
        else if (Array.isArray(errBody.detail)) {
          detail = errBody.detail
            .map((d) => {
              if (d && typeof d === 'object') {
                const item = d as Record<string, unknown>;
                const loc = Array.isArray(item.loc) ? item.loc.map(String) : [];
                if (loc.length > 0) validationFields.push(loc[loc.length - 1]);
                return `${loc.join('.')}: ${String(item.msg || 'invalid')}`;
              }
              return String(d);
            })
            .join('; ');
        }
      } catch {
        // Ignore non-JSON error body
      }

      throw new ApiEndpointError(detail, response.status, target.displayUrl, 'unreachable', {
        tunnelAuthBlocked,
        validationFields: validationFields.length ? validationFields : undefined,
      });
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof ApiEndpointError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiEndpointError(
        `Request timed out after ${Math.round(timeoutMs / 1000)}s.`,
        408,
        target.displayUrl,
        'unreachable'
      );
    }
    const msg = err instanceof Error ? err.message : `Unable to reach ${target.displayUrl}.`;
    throw new ApiEndpointError(msg, 0, target.displayUrl, 'unreachable');
  } finally {
    clearTimeout(timer);
  }
}

/* ============================================================================
 * Authentication & User Account (/api/v1/auth/*, /api/v1/users/me)
 * ========================================================================== */

interface RawAuthData {
  access_token: string;
  token_type?: string;
  expires_in: number;
  user: EonUser;
}

export async function registerAccount(
  config: ConnectionConfig,
  params: { email: string; password: string; displayName: string }
): Promise<AuthSession> {
  const raw = await rawRequestJson<unknown>(config, '/auth/register', {
    init: {
      method: 'POST',
      body: JSON.stringify({
        email: params.email.trim(),
        password: params.password,
        display_name: params.displayName.trim(),
      }),
    },
    allowRefreshRetry: false,
  });

  const data = unwrapApiData<RawAuthData>(raw);
  const session: AuthSession = {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    user: data.user,
  };
  saveAuthSession(session);
  saveConnectionConfig({ ...config, authToken: session.accessToken });
  return session;
}

export async function loginAccount(
  config: ConnectionConfig,
  params: { email: string; password: string }
): Promise<AuthSession> {
  const raw = await rawRequestJson<unknown>(config, '/auth/login', {
    init: {
      method: 'POST',
      body: JSON.stringify({
        email: params.email.trim(),
        password: params.password,
      }),
    },
    allowRefreshRetry: false,
  });

  const data = unwrapApiData<RawAuthData>(raw);
  const session: AuthSession = {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    user: data.user,
  };
  saveAuthSession(session);
  saveConnectionConfig({ ...config, authToken: session.accessToken });
  return session;
}

export async function startGuestSession(config: ConnectionConfig): Promise<AuthSession> {
  const randomBytes = new Uint8Array(12);
  crypto.getRandomValues(randomBytes);
  const hex = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const guestEmail = `guest-${hex.slice(0, 12)}@example.com`;
  const guestPassword = `Eon!${hex}`;
  return registerAccount(config, {
    email: guestEmail,
    password: guestPassword,
    displayName: 'Guest',
  });
}

export async function refreshAuthSession(config: ConnectionConfig): Promise<AuthSession | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const raw = await rawRequestJson<unknown>(config, '/auth/refresh', {
        init: { method: 'POST' },
        timeoutMs: 8000,
        allowRefreshRetry: false,
      });
      const data = unwrapApiData<RawAuthData>(raw);
      if (data?.access_token && data?.user) {
        const session: AuthSession = {
          accessToken: data.access_token,
          expiresIn: data.expires_in,
          user: data.user,
        };
        saveAuthSession(session);
        saveConnectionConfig({ ...config, authToken: session.accessToken });
        return session;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function fetchCurrentUser(config: ConnectionConfig): Promise<EonUser | null> {
  const token = getEffectiveToken(config);
  if (!token) return null;
  try {
    const raw = await rawRequestJson<unknown>(config, '/users/me', {
      init: { method: 'GET' },
      timeoutMs: 8000,
    });
    const user = unwrapApiData<EonUser>(raw);
    const existing = loadAuthSession();
    if (user?.id) {
      saveAuthSession({
        accessToken: token,
        expiresIn: existing?.expiresIn || 3600,
        user,
      });
      return user;
    }
    return null;
  } catch (err) {
    if (err instanceof ApiEndpointError && err.state === 'unauthorized') {
      saveAuthSession(null);
      return null;
    }
    return loadAuthSession()?.user || null;
  }
}

export async function logoutAccount(config: ConnectionConfig): Promise<void> {
  try {
    await rawRequestJson<unknown>(config, '/auth/logout', {
      init: { method: 'POST' },
      timeoutMs: 6000,
      allowRefreshRetry: false,
    });
  } catch {
    // Clear local session regardless
  }
  saveAuthSession(null);
  saveConnectionConfig({ ...config, authToken: '' });
}

/* ============================================================================
 * Backend Discovery & Health Probe (/openapi.json, /api/v1/health/ready)
 * ========================================================================== */

export async function probeBackend(config: ConnectionConfig): Promise<BackendStatus> {
  const started = performance.now();
  const checkedAt = new Date().toISOString();
  const endpoints: EndpointCapability[] = [];

  let connected = false;
  let version: string | undefined;
  let rootError: string | undefined;
  let tunnelAuthBlocked = false;
  let openApiPaths: string[] | undefined;

  // 1. Inspect OpenAPI schema
  try {
    const spec = await rawRequestJson<Record<string, unknown>>(config, '/openapi.json', {
      useApiPrefix: false,
      init: { method: 'GET' },
      timeoutMs: 8000,
      allowRefreshRetry: false,
    });
    if (spec && typeof spec.paths === 'object' && spec.paths !== null) {
      connected = true;
      const pathsObj = spec.paths as Record<string, Record<string, unknown>>;
      const components = (spec.components as Record<string, unknown> | undefined) || {};
      const schemas = (components.schemas as Record<string, unknown> | undefined) || {};
      cachedOpenApi = { baseUrl: config.baseUrl, paths: pathsObj, schemas };
      openApiPaths = Object.keys(pathsObj);
      const info = spec.info as Record<string, unknown> | undefined;
      if (typeof info?.version === 'string') version = info.version;
      endpoints.push({
        name: 'API Schema',
        method: 'GET',
        path: '/openapi.json',
        state: 'available',
        detail: `${openApiPaths.length} routes discovered`,
      });
    }
  } catch (err) {
    const apiErr = err instanceof ApiEndpointError ? err : null;
    if (apiErr?.tunnelAuthBlocked) tunnelAuthBlocked = true;
    endpoints.push({
      name: 'API Schema',
      method: 'GET',
      path: '/openapi.json',
      state: apiErr?.state || 'missing',
      detail: apiErr?.message,
    });
  }

  // 2. Check /api/v1/health/ready
  let healthState: EndpointState = 'unreachable';
  try {
    const rawHealth = await rawRequestJson<unknown>(config, '/health/ready', {
      init: { method: 'GET' },
      timeoutMs: 8000,
      allowRefreshRetry: false,
    });
    const health = unwrapApiData<Record<string, unknown>>(rawHealth);
    connected = true;
    healthState = health?.status === 'ok' || !health?.status ? 'available' : 'unreachable';
    endpoints.push({
      name: 'Health Ready',
      method: 'GET',
      path: '/api/v1/health/ready',
      state: healthState,
      detail: typeof health?.status === 'string' ? health.status : 'ok',
    });
  } catch (err) {
    const apiErr = err instanceof ApiEndpointError ? err : null;
    if (apiErr?.tunnelAuthBlocked) tunnelAuthBlocked = true;
    rootError = apiErr?.message || 'Health check failed';
    healthState = apiErr?.state || 'unreachable';
    endpoints.push({
      name: 'Health Ready',
      method: 'GET',
      path: '/api/v1/health/ready',
      state: healthState,
      detail: rootError,
    });
  }

  const hasOpenApi = Array.isArray(openApiPaths);
  const pathExists = (exactOrPartial: string): EndpointState => {
    if (!hasOpenApi) return connected ? 'unknown' : 'unreachable';
    return openApiPaths!.some((p) => p.includes(exactOrPartial)) ? 'available' : 'missing';
  };

  const hasAuth = Boolean(getEffectiveToken(config));

  const capabilities = {
    health: healthState,
    intelligenceChat: pathExists('/intelligence/chat'),
    uiCompose: pathExists('/intelligence/ui/compose'),
    actionPlans: pathExists('/intelligence/actions/plans'),
    events: pathExists('/intelligence/events'),
    browserActivity: pathExists('/browser/tasks'),
    voice: pathExists('/voice/transcribe') === 'available' ? 'available' : pathExists('/audio'),
  };

  endpoints.push(
    { name: 'Intelligence Chat', method: 'POST', path: '/api/v1/intelligence/chat', state: capabilities.intelligenceChat },
    { name: 'Generative UI Compose', method: 'POST', path: '/api/v1/intelligence/ui/compose', state: capabilities.uiCompose },
    { name: 'Action Plans', method: 'GET/POST', path: '/api/v1/intelligence/actions/plans', state: capabilities.actionPlans },
    { name: 'Events History', method: 'GET/POST', path: '/api/v1/intelligence/events', state: capabilities.events },
    { name: 'Browser Execution', method: 'POST/GET', path: '/api/v1/browser/tasks', state: capabilities.browserActivity }
  );

  return {
    connected,
    checkedAt,
    baseUrl: config.baseUrl || '(same origin)',
    latencyMs: Math.round(performance.now() - started),
    version,
    error: connected ? undefined : rootError,
    tunnelAuthBlocked,
    authenticated: hasAuth,
    openApiPaths,
    capabilities,
    endpoints,
  };
}

/* ============================================================================
 * Generative UI Composer + Intelligence Chat Normalization
 * ========================================================================== */

type ComposeIntent = 'general' | 'visual_explanation' | 'interactive' | 'decision' | 'task' | 'confirmation';

function inferComposeIntent(prompt: string, mode?: string): ComposeIntent {
  if (mode === 'research') return 'visual_explanation';
  if (mode === 'draft') return 'interactive';
  if (mode === 'browser') return 'task';

  const lower = prompt.toLowerCase();
  if (/\b(compare|vs\.?|versus|choose|which option|pros and cons|decide)\b/.test(lower)) {
    return 'decision';
  }
  if (/\b(checklist|steps|plan|itinerary|roadmap|break down|schedule|todo)\b/.test(lower)) {
    return 'task';
  }
  if (/\b(chart|trend|graph|breakdown|numbers|budget|metrics|stats)\b/.test(lower)) {
    return 'visual_explanation';
  }
  if (/\b(teach|learn|quiz|lesson|practice|walk me through)\b/.test(lower)) {
    return 'interactive';
  }
  return 'general';
}

interface RawComposeData {
  response_type?: string;
  message?: string;
  suggested_actions?: SuggestedAction[];
  selection_basis?: string;
  requires_confirmation?: boolean;
  ui_type?: string;
  ui_payload?: Record<string, unknown>;
}

function mapComposedUiToBlocks(
  composed: RawComposeData | null,
  fallbackIdPrefix = 'ui'
): {
  blocks: AdaptiveBlock[];
  approval: ApprovalRequest | null;
  steps: PlanStep[];
  suggestedActions: SuggestedAction[];
} {
  if (!composed || !composed.ui_type || !composed.ui_payload) {
    return { blocks: [], approval: null, steps: [], suggestedActions: [] };
  }

  const uiType = composed.ui_type;
  const p = composed.ui_payload;
  const blocks: AdaptiveBlock[] = [];
  let approval: ApprovalRequest | null = null;
  const steps: PlanStep[] = [];
  const suggestedActions = Array.isArray(composed.suggested_actions)
    ? composed.suggested_actions
    : [];

  if (uiType === 'information_card' && typeof p.body === 'string') {
    blocks.push({
      id: `${fallbackIdPrefix}-info`,
      type: 'information_card',
      eyebrow: typeof p.eyebrow === 'string' ? p.eyebrow : null,
      title: String(p.title || 'Summary'),
      body: p.body,
      tone: (p.tone as 'neutral' | 'informative' | 'positive' | 'caution') || 'informative',
    });
  } else if (uiType === 'card_collection' && Array.isArray(p.cards)) {
    blocks.push({
      id: `${fallbackIdPrefix}-cards`,
      type: 'card_collection',
      layout: p.layout === 'list' ? 'list' : 'grid',
      cards: p.cards.map((c, idx) => {
        const card = (c || {}) as Record<string, unknown>;
        return {
          card_id: String(card.card_id || `card_${idx}`),
          title: String(card.title || `Item ${idx + 1}`),
          body: String(card.body || ''),
          detail: typeof card.detail === 'string' ? card.detail : null,
        };
      }),
    });
  } else if (uiType === 'checklist' && Array.isArray(p.items)) {
    blocks.push({
      id: `${fallbackIdPrefix}-checklist`,
      type: 'checklist',
      title: String(p.title || 'Checklist'),
      description: typeof p.description === 'string' ? p.description : null,
      items: p.items.map((it, idx) => {
        const item = (it || {}) as Record<string, unknown>;
        return {
          id: String(item.item_id || `item_${idx}`),
          label: String(item.text || ''),
          checked: Boolean(item.checked),
        };
      }),
    });
  } else if (uiType === 'interactive_lesson' && Array.isArray(p.steps)) {
    blocks.push({
      id: `${fallbackIdPrefix}-lesson`,
      type: 'interactive_lesson',
      title: String(p.title || 'Interactive Guide'),
      objective: String(p.objective || ''),
      estimatedMinutes: typeof p.estimated_minutes === 'number' ? p.estimated_minutes : null,
      steps: p.steps.map((s, idx) => {
        const st = (s || {}) as Record<string, unknown>;
        return {
          step_id: String(st.step_id || `step_${idx}`),
          title: String(st.title || `Step ${idx + 1}`),
          content: String(st.content || ''),
          response_mode:
            (st.response_mode as 'read' | 'free_text' | 'single_choice') || 'read',
          prompt: typeof st.prompt === 'string' ? st.prompt : null,
          choices: Array.isArray(st.choices) ? st.choices.map(String) : undefined,
        };
      }),
    });
  } else if (uiType === 'decision_comparison' && Array.isArray(p.options)) {
    const options = p.options.map((o, idx) => {
      const opt = (o || {}) as Record<string, unknown>;
      return {
        option_id: String(opt.option_id || `opt_${idx}`),
        label: String(opt.label || `Option ${idx + 1}`),
        description: String(opt.description || ''),
        pros: Array.isArray(opt.pros) ? opt.pros.map(String) : [],
        cons: Array.isArray(opt.cons) ? opt.cons.map(String) : [],
      };
    });
    blocks.push({
      id: `${fallbackIdPrefix}-decision`,
      type: 'comparison',
      title: String(p.title || 'Comparison'),
      question: typeof p.question === 'string' ? p.question : undefined,
      columns: options.map((o) => o.label),
      rows: [
        { criterion: 'Overview', values: options.map((o) => o.description) },
        { criterion: 'Strengths', values: options.map((o) => o.pros.join(', ') || '—') },
        { criterion: 'Trade-offs', values: options.map((o) => o.cons.join(', ') || '—') },
      ],
      options,
      selectedOptionId:
        typeof p.selected_option_id === 'string' ? p.selected_option_id : null,
    });
  } else if (uiType === 'chart' && Array.isArray(p.labels) && Array.isArray(p.series)) {
    blocks.push({
      id: `${fallbackIdPrefix}-chart`,
      type: 'chart',
      title: String(p.title || 'Overview'),
      chartType: (p.chart_type as 'bar' | 'line' | 'donut') || 'bar',
      unit: typeof p.unit === 'string' ? p.unit : null,
      labels: p.labels.map(String),
      series: p.series.map((s, idx) => {
        const ser = (s || {}) as Record<string, unknown>;
        return {
          name: String(ser.name || `Series ${idx + 1}`),
          values: Array.isArray(ser.values) ? ser.values.map(Number) : [],
        };
      }),
    });
  } else if (uiType === 'task_workspace' && Array.isArray(p.tasks)) {
    const workspaceTasks = p.tasks.map((t, idx) => {
      const wt = (t || {}) as Record<string, unknown>;
      const status = (wt.status as 'todo' | 'in_progress' | 'done') || 'todo';
      steps.push({
        id: String(wt.task_id || `task_${idx}`),
        title: String(wt.title || `Step ${idx + 1}`),
        detail: typeof wt.description === 'string' ? wt.description : undefined,
        status: status === 'done' ? 'completed' : status === 'in_progress' ? 'active' : 'pending',
      });
      return {
        task_id: String(wt.task_id || `task_${idx}`),
        title: String(wt.title || `Task ${idx + 1}`),
        description: typeof wt.description === 'string' ? wt.description : null,
        status,
      };
    });

    blocks.push({
      id: `${fallbackIdPrefix}-workspace`,
      type: 'task_workspace',
      title: String(p.title || 'Action Plan'),
      summary: typeof p.summary === 'string' ? p.summary : null,
      tasks: workspaceTasks,
    });
  } else if (uiType === 'confirmation_interface') {
    const impact = (p.impact as 'low' | 'medium' | 'high') || 'medium';
    approval = {
      id: `${fallbackIdPrefix}-confirm`,
      category: 'external_action',
      title: String(p.title || 'Confirm Action'),
      description: String(p.action_description || composed.message || 'Confirm before continuing.'),
      riskLevel: impact,
      confirmLabel: typeof p.confirm_label === 'string' ? p.confirm_label : 'Confirm',
      cancelLabel: typeof p.cancel_label === 'string' ? p.cancel_label : 'Cancel',
      status: 'pending',
    };
    blocks.push({
      id: `${fallbackIdPrefix}-approval`,
      type: 'approval_request',
      approval,
    });
  } else if (uiType === 'text_response' && typeof p.text === 'string') {
    blocks.push({
      id: `${fallbackIdPrefix}-composed-text`,
      type: 'text',
      content: p.text,
    });
  }

  return { blocks, approval, steps, suggestedActions };
}

export async function runIntelligenceRequest(
  config: ConnectionConfig,
  prompt: string,
  options?: {
    mode?: string;
    history?: ChatMessage[];
    attachments?: Array<{ name: string; type: string; size: number; textPreview?: string }>;
    existingTask?: TaskRecord;
  }
): Promise<TaskRecord> {
  const started = performance.now();

  const attachmentText = options?.attachments?.length
    ? `\n\n[Attached files:\n${options.attachments
        .map((a) => `- ${a.name}${a.textPreview ? `\n${a.textPreview}` : ''}`)
        .join('\n')}]`
    : '';
  const strictMessage = `${prompt}${attachmentText}`.slice(0, 4000);
  const trimmedHistory = (options?.history || []).slice(-20);

  // Strict ChatRequest schema: { message, history? } (additionalProperties: false)
  const chatBody: { message: string; history?: ChatMessage[] } = {
    message: strictMessage,
  };
  if (trimmedHistory.length > 0) {
    chatBody.history = trimmedHistory;
  }

  // Run /intelligence/chat (Groq LLM response)
  const chatRaw = await rawRequestJson<unknown>(config, '/intelligence/chat', {
    init: {
      method: 'POST',
      body: JSON.stringify(chatBody),
    },
    timeoutMs: 40000,
  });

  const chatData = unwrapApiData<{ response?: string }>(chatRaw);
  const replyText = typeof chatData?.response === 'string' ? chatData.response.trim() : '';

  // Compose adaptive UI layer around the request/response using /intelligence/ui/compose
  let composedData: RawComposeData | null = null;
  try {
    const composePayload = {
      message: replyText ? `${prompt}\n\n${replyText}`.slice(0, 10000) : strictMessage,
      intent: inferComposeIntent(prompt, options?.mode),
      interaction_mode: 'direct',
    };
    const rawCompose = await rawRequestJson<unknown>(config, '/intelligence/ui/compose', {
      init: {
        method: 'POST',
        body: JSON.stringify(composePayload),
      },
      timeoutMs: 12000,
    });
    composedData = unwrapApiData<RawComposeData>(rawCompose);
  } catch {
    // Graceful degradation: primary chat answer still renders cleanly
  }

  const now = new Date().toISOString();
  const nextHistory: ChatMessage[] = [
    ...trimmedHistory,
    { role: 'user' as const, content: prompt },
    ...(replyText ? [{ role: 'assistant' as const, content: replyText }] : []),
  ].slice(-20);

  const mapped = mapComposedUiToBlocks(
    composedData,
    `turn-${nextHistory.length}-${Date.now()}`
  );

  const newBlocks: AdaptiveBlock[] = [];
  if (replyText) {
    newBlocks.push({
      id: `reply-${Date.now()}`,
      type: 'text',
      content: replyText,
    });
  }

  // Append structured UI blocks from /ui/compose (skip redundant plain text block if identical)
  for (const b of mapped.blocks) {
    if (b.type === 'text' && replyText) continue;
    newBlocks.push(b);
  }

  const taskId = options?.existingTask?.id || `chat-${Date.now()}`;
  const existingBlocks = options?.existingTask?.blocks || [];
  const mergedBlocks = options?.existingTask ? [...existingBlocks, ...newBlocks] : newBlocks;

  const task: TaskRecord = {
    id: taskId,
    prompt: options?.existingTask?.prompt || prompt,
    title: options?.existingTask?.title || prompt.slice(0, 72),
    status: mapped.approval ? 'awaiting_approval' : 'completed',
    sourceType: 'chat',
    createdAt: options?.existingTask?.createdAt || now,
    updatedAt: now,
    elapsedMs: Math.round(performance.now() - started),
    steps: mapped.steps.length > 0 ? mapped.steps : options?.existingTask?.steps || [],
    blocks: mergedBlocks,
    suggestedActions: mapped.suggestedActions,
    history: nextHistory,
    pendingApproval: mapped.approval,
    error: null,
  };

  saveLocalSessionTask(task);
  return task;
}

/* ============================================================================
 * Real Browser Automation (/api/v1/browser/*)
 * ========================================================================== */

interface RawBrowserTaskData {
  id: string;
  objective: string;
  status: string;
  intervention_reason: string | null;
  result: Record<string, unknown> | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface RawBrowserSessionData {
  id: string;
  task_id: string;
  status: string;
  visible: boolean;
  active_page_id: string | null;
  active_url: string | null;
  active_title: string | null;
  authentication_state: string;
  intervention_required: boolean;
  intervention_reason: string | null;
  created_at: string;
  last_activity_at: string;
}

interface RawBrowserActivityItem {
  id: string;
  event_type: string;
  message: string;
  event_metadata?: Record<string, unknown> | null;
  created_at: string;
}

function mapBrowserTaskStatus(rawStatus: string, interventionRequired?: boolean): TaskStatus {
  const s = rawStatus.toLowerCase();
  if (interventionRequired || s.includes('intervention') || s.includes('approval')) {
    return 'awaiting_approval';
  }
  if (s === 'paused') return 'paused';
  if (s === 'completed' || s === 'succeeded' || s === 'done') return 'completed';
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  if (s === 'pending' || s === 'queued' || s === 'created') return 'planning';
  return 'running';
}

function mapBrowserSessionStatus(
  sessionStatus: string,
  taskStatus: string
): BrowserSessionState['status'] {
  const s = `${sessionStatus} ${taskStatus}`.toLowerCase();
  if (s.includes('pause')) return 'paused';
  if (s.includes('error') || s.includes('fail')) return 'error';
  if (s.includes('complete') || s.includes('done') || s.includes('closed')) return 'completed';
  if (s.includes('wait') || s.includes('intervention') || s.includes('takeover')) return 'waiting';
  if (s.includes('navigat')) return 'navigating';
  if (s.includes('active') || s.includes('run') || s.includes('open')) return 'interacting';
  return 'idle';
}

function buildTaskFromBrowser(
  browserTask: RawBrowserTaskData,
  session?: RawBrowserSessionData | null,
  activities: RawBrowserActivityItem[] = [],
  screenshot?: { frameBase64?: string; screenshotUrl?: string }
): TaskRecord {
  const mappedStatus = mapBrowserTaskStatus(browserTask.status, session?.intervention_required);
  const logs: BrowserActivityLog[] = activities.map((a) => ({
    id: a.id,
    timestamp: a.created_at,
    eventType: a.event_type,
    action: a.message,
    target:
      a.event_metadata && typeof a.event_metadata.target === 'string'
        ? a.event_metadata.target
        : undefined,
    url:
      a.event_metadata && typeof a.event_metadata.url === 'string'
        ? a.event_metadata.url
        : undefined,
    status: a.event_type.includes('error') || a.event_type.includes('fail') ? 'error' : 'ok',
  }));

  const browserSession: BrowserSessionState = {
    active: mappedStatus === 'running' || mappedStatus === 'planning' || mappedStatus === 'awaiting_approval',
    sessionId: session?.id,
    taskId: browserTask.id,
    status: mapBrowserSessionStatus(session?.status || '', browserTask.status),
    currentUrl: session?.active_url || undefined,
    pageTitle: session?.active_title || undefined,
    currentAction: logs[logs.length - 1]?.action,
    frameBase64: screenshot?.frameBase64,
    screenshotUrl: screenshot?.screenshotUrl,
    authenticationState: session?.authentication_state,
    interventionRequired: session?.intervention_required,
    interventionReason: session?.intervention_reason || browserTask.intervention_reason,
    logs,
  };

  const blocks: AdaptiveBlock[] = [
    {
      id: `browser-${browserTask.id}`,
      type: 'browser_activity',
      session: browserSession,
    },
  ];

  const pendingApproval: ApprovalRequest | null =
    session?.intervention_required || browserTask.intervention_reason
      ? {
          id: `intervention-${browserTask.id}`,
          category: 'sensitive',
          title: 'Browser control needed',
          description:
            session?.intervention_reason ||
            browserTask.intervention_reason ||
            'Please review this webpage step or take over the session before continuing.',
          domain: session?.active_url || undefined,
          browserTaskId: browserTask.id,
          riskLevel: 'high',
          confirmLabel: 'Continue Task',
          cancelLabel: 'Cancel Task',
          status: 'pending',
        }
      : null;

  if (pendingApproval) {
    blocks.unshift({
      id: `approval-${browserTask.id}`,
      type: 'approval_request',
      approval: pendingApproval,
    });
  }

  if (browserTask.result && Object.keys(browserTask.result).length > 0) {
    const resultText =
      typeof browserTask.result.summary === 'string'
        ? browserTask.result.summary
        : JSON.stringify(browserTask.result, null, 2);
    blocks.push({
      id: `browser-result-${browserTask.id}`,
      type: 'completed_summary',
      title: 'Web task finished',
      outcome: resultText,
    });
  }

  return {
    id: browserTask.id,
    prompt: browserTask.objective,
    title: browserTask.objective.slice(0, 72),
    status: mappedStatus,
    sourceType: 'browser_task',
    createdAt: browserTask.created_at,
    updatedAt: browserTask.updated_at,
    steps: [],
    blocks,
    browserTaskId: browserTask.id,
    browserSessionId: session?.id,
    browserSession,
    pendingApproval,
    error: browserTask.error_code ? { message: `Error: ${browserTask.error_code}`, code: browserTask.error_code } : null,
  };
}

export async function startBrowserExecution(
  config: ConnectionConfig,
  objective: string,
  options?: { initialUrl?: string; plan?: string[] }
): Promise<TaskRecord> {
  const rawTask = await rawRequestJson<unknown>(config, '/browser/tasks', {
    init: {
      method: 'POST',
      body: JSON.stringify({
        objective: objective.slice(0, 2000),
        ...(options?.plan?.length ? { plan: options.plan.slice(0, 100) } : {}),
      }),
    },
  });
  const browserTask = unwrapApiData<RawBrowserTaskData>(rawTask);

  let session: RawBrowserSessionData | null = null;
  try {
    const rawSession = await rawRequestJson<unknown>(config, '/browser/sessions', {
      init: {
        method: 'POST',
        body: JSON.stringify({
          task_id: browserTask.id,
          objective: objective.slice(0, 2000),
          visible: true,
          ...(options?.initialUrl ? { initial_url: options.initialUrl } : {}),
        }),
      },
    });
    session = unwrapApiData<RawBrowserSessionData>(rawSession);
  } catch {
    // Session creation may be asynchronous or deferred
  }

  const record = buildTaskFromBrowser(browserTask, session, []);
  saveLocalSessionTask(record);
  return record;
}

export async function refreshBrowserTaskState(
  config: ConnectionConfig,
  taskId: string,
  sessionId?: string
): Promise<TaskRecord | null> {
  const activities = unwrapApiData<RawBrowserActivityItem[]>(
    await rawRequestJson<unknown>(config, `/browser/tasks/${encodeURIComponent(taskId)}/activity`, {
      init: { method: 'GET' },
      timeoutMs: 8000,
    }).catch(() => [])
  );

  if (sessionId) {
    const rawState = await rawRequestJson<unknown>(
      config,
      `/browser/sessions/${encodeURIComponent(sessionId)}/state`,
      { init: { method: 'GET' }, timeoutMs: 8000 }
    );
    const state = unwrapApiData<{
      session: RawBrowserSessionData;
      task: RawBrowserTaskData;
    }>(rawState);

    let screenshot: { frameBase64?: string; screenshotUrl?: string } | undefined;
    try {
      const rawShot = await rawRequestJson<Record<string, unknown>>(
        config,
        `/browser/sessions/${encodeURIComponent(sessionId)}/screenshot`,
        { init: { method: 'GET' }, timeoutMs: 6000 }
      );
      const unwrapped = unwrapApiData<Record<string, unknown>>(rawShot);
      if (typeof unwrapped?.image_base64 === 'string') {
        screenshot = { frameBase64: unwrapped.image_base64 };
      } else if (typeof unwrapped?.screenshot === 'string') {
        screenshot = { frameBase64: unwrapped.screenshot };
      } else if (typeof unwrapped?.url === 'string') {
        screenshot = { screenshotUrl: unwrapped.url };
      }
    } catch {
      // Screenshot optional if page has not rendered yet
    }

    const record = buildTaskFromBrowser(state.task, state.session, activities || [], screenshot);
    saveLocalSessionTask(record);
    return record;
  }

  return null;
}

export async function controlBrowserTask(
  config: ConnectionConfig,
  taskId: string,
  action: 'pause' | 'resume' | 'cancel' | 'continue-after-intervention',
  sessionId?: string
): Promise<TaskRecord> {
  const raw = await rawRequestJson<unknown>(
    config,
    `/browser/tasks/${encodeURIComponent(taskId)}/${action}`,
    { init: { method: 'POST' } }
  );
  const browserTask = unwrapApiData<RawBrowserTaskData>(raw);
  const refreshed = sessionId
    ? await refreshBrowserTaskState(config, taskId, sessionId).catch(() => null)
    : null;
  const result = refreshed || buildTaskFromBrowser(browserTask, null, []);
  saveLocalSessionTask(result);
  return result;
}

export async function toggleBrowserTakeover(
  config: ConnectionConfig,
  sessionId: string,
  taskId: string,
  mode: 'takeover' | 'return-control'
): Promise<TaskRecord | null> {
  await rawRequestJson<unknown>(
    config,
    `/browser/sessions/${encodeURIComponent(sessionId)}/${mode}`,
    { init: { method: 'POST' } }
  );
  return refreshBrowserTaskState(config, taskId, sessionId);
}

/* ============================================================================
 * Action Plans (/api/v1/intelligence/actions/plans)
 * ========================================================================== */

interface RawActionPlanData {
  id: string;
  title: string;
  objective: string;
  steps: string[];
  consequential: boolean;
  status: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  execution_supported?: boolean;
}

function mapActionPlanToTask(plan: RawActionPlanData): TaskRecord {
  const s = plan.status.toLowerCase();
  const status: TaskStatus =
    s === 'awaiting_confirmation'
      ? 'awaiting_approval'
      : s === 'in_progress'
      ? 'running'
      : s === 'completed'
      ? 'completed'
      : s === 'cancelled'
      ? 'cancelled'
      : 'planning';

  const steps: PlanStep[] = (plan.steps || []).map((stepText, idx) => ({
    id: `${plan.id}-step-${idx + 1}`,
    title: stepText,
    status: s === 'completed' ? 'completed' : idx === 0 && s === 'in_progress' ? 'active' : 'pending',
  }));

  const blocks: AdaptiveBlock[] = [
    {
      id: `plan-${plan.id}`,
      type: 'task_plan',
      title: plan.title,
      summary: plan.objective,
      steps,
      requiresConfirmation: s === 'draft' || s === 'awaiting_confirmation',
      executionSupported: Boolean(plan.execution_supported),
    },
  ];

  return {
    id: plan.id,
    prompt: plan.objective,
    title: plan.title,
    status,
    sourceType: 'action_plan',
    actionPlanId: plan.id,
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
    steps,
    blocks,
    error: null,
  };
}

export async function controlActionPlan(
  config: ConnectionConfig,
  planId: string,
  action: 'confirm' | 'start' | 'cancel'
): Promise<TaskRecord> {
  const raw = await rawRequestJson<unknown>(
    config,
    `/intelligence/actions/plans/${encodeURIComponent(planId)}/${action}`,
    { init: { method: 'POST' } }
  );
  return mapActionPlanToTask(unwrapApiData<RawActionPlanData>(raw));
}

/* ============================================================================
 * Unified Task Creation, History (/events + /plans + local), Controls
 * ========================================================================== */

interface RawIntelligenceEventData {
  id: string;
  channel: string;
  event_type: string;
  source: string;
  payload: Record<string, unknown>;
  reason: string;
  status: string;
  completed_at: string | null;
  error_code: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function mapEventToTask(ev: RawIntelligenceEventData): TaskRecord {
  const st = ev.status.toLowerCase();
  const status: TaskStatus =
    st === 'completed'
      ? 'completed'
      : st === 'failed'
      ? 'failed'
      : st === 'processing'
      ? 'running'
      : 'planning';

  const payloadSummary =
    typeof ev.payload?.goal === 'string'
      ? ev.payload.goal
      : typeof ev.payload?.statement === 'string'
      ? ev.payload.statement
      : typeof ev.payload?.task === 'string'
      ? ev.payload.task
      : typeof ev.payload?.description === 'string'
      ? ev.payload.description
      : ev.reason || ev.event_type;

  const blocks: AdaptiveBlock[] = [];
  if (ev.result && Object.keys(ev.result).length > 0) {
    const resultText =
      typeof ev.result.summary === 'string'
        ? ev.result.summary
        : typeof ev.result.response === 'string'
        ? ev.result.response
        : JSON.stringify(ev.result, null, 2);
    blocks.push({
      id: `event-result-${ev.id}`,
      type: 'text',
      content: resultText,
    });
  }

  return {
    id: ev.id,
    prompt: payloadSummary,
    title: payloadSummary.slice(0, 72),
    status,
    sourceType: 'event',
    createdAt: ev.created_at,
    updatedAt: ev.updated_at,
    steps: [],
    blocks,
    error: ev.error_code ? { message: ev.error_code, code: ev.error_code } : null,
  };
}

export async function createTask(
  config: ConnectionConfig,
  prompt: string,
  options?: {
    mode?: string;
    attachments?: Array<{ name: string; type: string; size: number; textPreview?: string }>;
  }
): Promise<TaskRecord> {
  if (options?.mode === 'browser') {
    return startBrowserExecution(config, prompt);
  }
  return runIntelligenceRequest(config, prompt, {
    mode: options?.mode,
    attachments: options?.attachments,
  });
}

export async function submitFollowUp(
  config: ConnectionConfig,
  task: TaskRecord,
  text: string
): Promise<TaskRecord> {
  if (task.sourceType === 'browser_task' && task.browserTaskId) {
    return startBrowserExecution(config, text);
  }
  return runIntelligenceRequest(config, text, {
    history: task.history || [],
    existingTask: task,
  });
}

export async function getTask(config: ConnectionConfig, task: TaskRecord): Promise<TaskRecord> {
  if (task.sourceType === 'browser_task' && task.browserTaskId) {
    const fresh = await refreshBrowserTaskState(config, task.browserTaskId, task.browserSessionId);
    if (fresh) return fresh;
  }
  if (task.sourceType === 'event') {
    const raw = await rawRequestJson<unknown>(
      config,
      `/intelligence/events/${encodeURIComponent(task.id)}`,
      { init: { method: 'GET' }, timeoutMs: 8000 }
    );
    const detail = unwrapApiData<{ event: RawIntelligenceEventData }>(raw);
    if (detail?.event) return mapEventToTask(detail.event);
  }
  return task;
}

export async function listTasks(
  config: ConnectionConfig,
  params?: { limit?: number }
): Promise<{ tasks: TaskRecord[]; source: 'backend' | 'local_session' }> {
  const local = loadLocalSessionHistory();
  if (!getEffectiveToken(config)) {
    return { tasks: local, source: 'local_session' };
  }

  const limit = params?.limit || 50;
  try {
    const [eventsRes, plansRes] = await Promise.allSettled([
      rawRequestJson<unknown>(config, `/intelligence/events?limit=${limit}&offset=0`, {
        init: { method: 'GET' },
        timeoutMs: 8000,
      }),
      rawRequestJson<unknown>(config, '/intelligence/actions/plans', {
        init: { method: 'GET' },
        timeoutMs: 8000,
      }),
    ]);

    const remoteTasks: TaskRecord[] = [];
    if (eventsRes.status === 'fulfilled') {
      const data = unwrapApiData<{ items?: RawIntelligenceEventData[] }>(eventsRes.value);
      for (const ev of data?.items || []) {
        remoteTasks.push(mapEventToTask(ev));
      }
    }
    if (plansRes.status === 'fulfilled') {
      const plans = unwrapApiData<RawActionPlanData[]>(plansRes.value);
      if (Array.isArray(plans)) {
        for (const plan of plans) {
          remoteTasks.push(mapActionPlanToTask(plan));
        }
      }
    }

    const combined = [...local];
    for (const rt of remoteTasks) {
      if (!combined.some((t) => t.id === rt.id)) {
        combined.push(rt);
      }
    }
    combined.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return { tasks: combined, source: remoteTasks.length > 0 ? 'backend' : 'local_session' };
  } catch (err) {
    if (err instanceof ApiEndpointError && err.state === 'unauthorized') {
      return { tasks: local, source: 'local_session' };
    }
    throw err;
  }
}

export async function deleteTask(config: ConnectionConfig, task: TaskRecord): Promise<void> {
  removeLocalSessionTask(task.id);
  if (task.sourceType === 'event' && getEffectiveToken(config)) {
    try {
      await rawRequestJson<unknown>(
        config,
        `/intelligence/events/${encodeURIComponent(task.id)}`,
        { init: { method: 'DELETE' } }
      );
    } catch (err) {
      if (err instanceof ApiEndpointError && err.state === 'missing') return;
      throw err;
    }
  }
}

export async function retryBackendTask(config: ConnectionConfig, task: TaskRecord): Promise<TaskRecord> {
  if (task.sourceType === 'event') {
    const raw = await rawRequestJson<unknown>(
      config,
      `/intelligence/events/${encodeURIComponent(task.id)}/retry`,
      { init: { method: 'POST' } }
    );
    return mapEventToTask(unwrapApiData<RawIntelligenceEventData>(raw));
  }
  return runIntelligenceRequest(config, task.prompt || task.title, { existingTask: undefined });
}

export async function transcribeAudioWithBackend(
  config: ConnectionConfig,
  audioBlob: Blob
): Promise<string> {
  const form = new FormData();
  form.append('audio', audioBlob, 'recording.webm');
  const data = await rawRequestJson<Record<string, unknown>>(config, '/voice/transcribe', {
    init: { method: 'POST', body: form },
  });
  if (typeof data.transcript === 'string') return data.transcript;
  if (typeof data.text === 'string') return data.text;
  throw new Error('Backend transcription response did not include text.');
}
