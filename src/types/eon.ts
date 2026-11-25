export type TaskStatus =
  | 'idle'
  | 'planning'
  | 'running'
  | 'paused'
  | 'awaiting_approval'
  | 'awaiting_input'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface EonUser {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  user: EonUser;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SuggestedAction {
  action_id: string;
  label: string;
  kind: 'continue' | 'clarify' | 'open_workspace' | 'select_option' | 'dismiss';
}

export type ApprovalCategory =
  | 'password'
  | 'otp'
  | 'payment'
  | 'account_change'
  | 'external_action'
  | 'sensitive';

export interface ApprovalField {
  name: string;
  label: string;
  type: 'password' | 'otp' | 'text' | 'confirm';
  placeholder?: string;
  required?: boolean;
  sensitive?: boolean;
}

export interface ApprovalRequest {
  id: string;
  category: ApprovalCategory;
  title: string;
  description: string;
  target?: string;
  domain?: string;
  amount?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  confirmLabel?: string;
  cancelLabel?: string;
  actionPlanId?: string;
  browserTaskId?: string;
  fields?: ApprovalField[];
  requestedAt?: string;
  status?: 'pending' | 'approved' | 'denied';
}

export interface PlanStep {
  id: string;
  title: string;
  detail?: string;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'skipped';
  tool?: string;
  durationMs?: number;
}

export interface BrowserActivityLog {
  id: string;
  timestamp: string;
  eventType?: string;
  action: string;
  target?: string;
  url?: string;
  status?: 'ok' | 'running' | 'warning' | 'error';
}

export interface BrowserSessionState {
  active: boolean;
  sessionId?: string;
  taskId?: string;
  status: 'idle' | 'navigating' | 'interacting' | 'waiting' | 'paused' | 'completed' | 'error';
  currentUrl?: string;
  pageTitle?: string;
  currentAction?: string;
  screenshotUrl?: string;
  frameBase64?: string;
  authenticationState?: string;
  interventionRequired?: boolean;
  interventionReason?: string | null;
  logs: BrowserActivityLog[];
}

export interface CitationSource {
  id?: string;
  title: string;
  url: string;
  domain?: string;
  snippet?: string;
  publishedAt?: string;
}

export interface FormFieldSchema {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'checkbox' | 'password' | 'otp' | 'email' | 'url';
  placeholder?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  defaultValue?: string | number | boolean;
  sensitive?: boolean;
}

export interface TextBlock {
  id: string;
  type: 'text';
  title?: string;
  content: string;
}

export interface InformationCardBlock {
  id: string;
  type: 'information_card';
  eyebrow?: string | null;
  title: string;
  body: string;
  tone: 'neutral' | 'informative' | 'positive' | 'caution';
}

export interface CardCollectionBlock {
  id: string;
  type: 'card_collection';
  layout: 'list' | 'grid';
  cards: Array<{
    card_id: string;
    title: string;
    body: string;
    detail?: string | null;
  }>;
}

export interface InteractiveLessonBlock {
  id: string;
  type: 'interactive_lesson';
  title: string;
  objective: string;
  estimatedMinutes?: number | null;
  steps: Array<{
    step_id: string;
    title: string;
    content: string;
    response_mode: 'read' | 'free_text' | 'single_choice';
    prompt?: string | null;
    choices?: string[];
  }>;
}

export interface ChartBlock {
  id: string;
  type: 'chart';
  title: string;
  chartType: 'bar' | 'line' | 'donut';
  unit?: string | null;
  labels: string[];
  series: Array<{
    name: string;
    values: number[];
  }>;
}

export interface TaskWorkspaceBlock {
  id: string;
  type: 'task_workspace';
  title: string;
  summary?: string | null;
  tasks: Array<{
    task_id: string;
    title: string;
    description?: string | null;
    status: 'todo' | 'in_progress' | 'done';
  }>;
}

export interface TaskPlanBlock {
  id: string;
  type: 'task_plan';
  title: string;
  summary?: string;
  steps: PlanStep[];
  requiresConfirmation?: boolean;
  executionSupported?: boolean;
}

export interface TaskProgressBlock {
  id: string;
  type: 'task_progress';
  title: string;
  currentStep?: string;
  completedCount: number;
  totalCount: number;
  steps: PlanStep[];
  elapsedMs?: number;
}

export interface ResearchResultsBlock {
  id: string;
  type: 'research_results';
  title: string;
  summary: string;
  keyFindings: Array<{ heading: string; detail: string }>;
  sources: CitationSource[];
}

export interface SearchResultsBlock {
  id: string;
  type: 'search_results';
  query?: string;
  results: CitationSource[];
}

export interface WebsitePreviewBlock {
  id: string;
  type: 'website_preview';
  title: string;
  url: string;
  description?: string;
  embeddable?: boolean;
  screenshotUrl?: string;
}

export interface BrowserActivityBlock {
  id: string;
  type: 'browser_activity';
  session: BrowserSessionState;
}

export interface EditableDocumentBlock {
  id: string;
  type: 'editable_document';
  artifactId?: string;
  title: string;
  format?: 'markdown' | 'plain' | 'code';
  content: string;
  lastSavedAt?: string;
  readOnly?: boolean;
}

export interface GeneratedContentBlock {
  id: string;
  type: 'generated_content';
  title: string;
  contentType?: string;
  language?: string;
  content: string;
}

export interface ChecklistBlock {
  id: string;
  type: 'checklist';
  title: string;
  description?: string | null;
  items: Array<{
    id: string;
    label: string;
    checked: boolean;
    note?: string;
  }>;
}

export interface FormBlock {
  id: string;
  type: 'form';
  title: string;
  description?: string;
  submitLabel?: string;
  submitted?: boolean;
  fields: FormFieldSchema[];
}

export interface ComparisonBlock {
  id: string;
  type: 'comparison';
  title: string;
  question?: string;
  columns: string[];
  rows: Array<{
    criterion: string;
    values: string[];
  }>;
  options?: Array<{
    option_id: string;
    label: string;
    description: string;
    pros: string[];
    cons: string[];
  }>;
  selectedOptionId?: string | null;
  recommendation?: string;
}

export interface TableBlock {
  id: string;
  type: 'table';
  title: string;
  columns: Array<{ key: string; label: string; align?: 'left' | 'right' }>;
  rows: Array<Record<string, string | number | boolean | null>>;
}

export interface ReportBlock {
  id: string;
  type: 'report';
  title: string;
  executiveSummary: string;
  metrics?: Array<{ label: string; value: string; note?: string }>;
  sections: Array<{ heading: string; body: string }>;
  sources?: CitationSource[];
}

export interface ApprovalRequestBlock {
  id: string;
  type: 'approval_request';
  approval: ApprovalRequest;
}

export interface CompletedSummaryBlock {
  id: string;
  type: 'completed_summary';
  title: string;
  outcome: string;
  deliverables?: string[];
  elapsedMs?: number;
}

export interface ErrorRecoveryBlock {
  id: string;
  type: 'error_recovery';
  title: string;
  message: string;
  code?: string;
  endpoint?: string;
  recoverable?: boolean;
}

export type AdaptiveBlock =
  | TextBlock
  | InformationCardBlock
  | CardCollectionBlock
  | InteractiveLessonBlock
  | ChartBlock
  | TaskWorkspaceBlock
  | TaskPlanBlock
  | TaskProgressBlock
  | ResearchResultsBlock
  | SearchResultsBlock
  | WebsitePreviewBlock
  | BrowserActivityBlock
  | EditableDocumentBlock
  | GeneratedContentBlock
  | ChecklistBlock
  | FormBlock
  | ComparisonBlock
  | TableBlock
  | ReportBlock
  | ApprovalRequestBlock
  | CompletedSummaryBlock
  | ErrorRecoveryBlock;

export interface TaskRecord {
  id: string;
  prompt: string;
  title: string;
  status: TaskStatus;
  sourceType?: 'chat' | 'ui_compose' | 'browser_task' | 'action_plan' | 'event';
  createdAt: string;
  updatedAt: string;
  elapsedMs?: number;
  steps: PlanStep[];
  blocks: AdaptiveBlock[];
  suggestedActions?: SuggestedAction[];
  history?: ChatMessage[];
  browserTaskId?: string;
  browserSessionId?: string;
  actionPlanId?: string;
  browserSession?: BrowserSessionState;
  pendingApproval?: ApprovalRequest | null;
  error?: {
    message: string;
    code?: string;
    endpoint?: string;
  } | null;
}

export type EndpointState = 'unknown' | 'available' | 'missing' | 'unreachable' | 'unauthorized';

export interface EndpointCapability {
  name: string;
  method: string;
  path: string;
  state: EndpointState;
  detail?: string;
}

export interface BackendStatus {
  connected: boolean;
  checkedAt: string | null;
  baseUrl: string;
  latencyMs?: number;
  version?: string;
  error?: string;
  tunnelAuthBlocked?: boolean;
  authenticated?: boolean;
  openApiPaths?: string[];
  capabilities: {
    health: EndpointState;
    intelligenceChat: EndpointState;
    uiCompose: EndpointState;
    actionPlans: EndpointState;
    events: EndpointState;
    browserActivity: EndpointState;
    voice: EndpointState;
  };
  endpoints: EndpointCapability[];
}

export interface ConnectionConfig {
  baseUrl: string;
  apiPrefix: string;
  authToken: string;
  streamMode: 'auto' | 'sse' | 'poll';
}
