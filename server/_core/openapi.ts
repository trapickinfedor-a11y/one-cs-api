/**
 * OpenAPI 3.0.3 specification for the ONE CS REST API (v1).
 *
 * Tags:
 *   - public    : endpoints with no auth (GET /api/v1/health)
 *   - requests  : job creation (single / bulk / VIP)
 *   - jobs      : job status & event retrieval
 *   - imported-data : lead import preview & safe batch
 *   - usage     : API usage summary
 */
const spec = {
  openapi: "3.0.3",
  info: {
    title: "ONE CS Platform REST API",
    version: "1.0.0",
    description:
      "External REST API for the ONE CS browser-automation / credit-score platform. " +
      "All authenticated endpoints require a `Bearer <token>` in the `Authorization` header. " +
      "Rate limits depend on the API key scope (single / bulk / vip / admin).",
    contact: {
      name: "ONE CS Platform Team",
    },
  },
  servers: [
    {
      url: "/api/v1",
      description: "Current API version",
    },
  ],
  tags: [
    { name: "public", description: "Public endpoints (no authentication required)" },
    { name: "requests", description: "Job creation requests" },
    { name: "jobs", description: "Job status and event retrieval" },
    { name: "imported-data", description: "Imported lead text parsing and safe batch ingestion" },
    { name: "usage", description: "API usage and billing summary" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["public"],
        operationId: "getHealth",
        summary: "Service health check",
        description: "Returns the overall health status, DB connectivity, and proxy status. No authentication required.",
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
                example: {
                  ok: true,
                  requestId: "req_123456_abc",
                  data: {
                    status: "healthy",
                    db: "connected",
                    proxy: { evomi: { ok: true, latencyMs: 42 } },
                    version: "1.0.0",
                  },
                  meta: { public: true },
                },
              },
            },
          },
          "503": {
            description: "Service is degraded",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
        },
      },
    },
    "/requests/single": {
      post: {
        tags: ["requests"],
        operationId: "createSingleRequest",
        summary: "Submit a single credit-score request",
        description:
          "Accepts a single lead payload and queues a job for processing. " +
          "Requires a `single`, `bulk`, `vip`, or `admin` scope API key.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SingleRequestBody" },
              example: {
                requestMode: "single",
                targetLabel: "lead-001",
                queueName: "default",
                priority: 100,
                payload: {
                  firstName: "John",
                  lastName: "Doe",
                  address: "123 Main St, New York, NY 10001",
                  phone: "+12025551234",
                  email: "john.doe@example.com",
                  dob: "1985-06-15",
                  ssn: "123-45-6789",
                  creditScore: 720,
                },
                proxy: {
                  country: "US",
                  protocol: "http",
                  sessionMode: "rotating",
                },
                safeTestMode: false,
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Request accepted and job queued",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SingleResponse" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
          "403": {
            description: "Forbidden — API key scope too restrictive",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
          "429": {
            description: "Rate limit exceeded",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
                example: {
                  ok: false,
                  requestId: "req_abc",
                  error: {
                    code: "RATE_LIMITED",
                    message: "Rate limit exceeded for this API key.",
                    retryable: true,
                    details: { rpm: 60, currentHits: 61 },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/requests/bulk": {
      post: {
        tags: ["requests"],
        operationId: "createBulkRequest",
        summary: "Submit a bulk batch of credit-score requests",
        description:
          "Accepts up to 1,000 lead items in a single request and creates a batch. " +
          "Each item becomes an individual job. Requires a `bulk`, `vip`, or `admin` scope API key.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BulkRequestBody" },
              example: {
                queueName: "bulk",
                priority: 120,
                items: [
                  { externalId: "ext-001", payload: { firstName: "Alice", lastName: "Smith", creditScore: 680 } },
                  { externalId: "ext-002", payload: { firstName: "Bob", lastName: "Jones", creditScore: 550 } },
                ],
                proxy: { country: "US" },
                safeTestMode: true,
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Bulk batch accepted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BulkResponse" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "403": { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "429": { description: "Rate limit exceeded", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
        },
      },
    },
    "/requests/vip": {
      post: {
        tags: ["requests"],
        operationId: "createVipRequest",
        summary: "Submit a VIP-priority single request",
        description:
          "Same as `/requests/single` but with VIP priority and a higher rate limit. " +
          "Requires a `vip` or `admin` scope API key.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SingleRequestBody" },
              example: {
                requestMode: "vip",
                queueName: "vip",
                priority: 900,
                payload: { firstName: "Alice", lastName: "Smith", creditScore: 800 },
                safeTestMode: false,
              },
            },
          },
        },
        responses: {
          "200": {
            description: "VIP request accepted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VipResponse" },
              },
            },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "403": { description: "Forbidden — VIP scope required", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "429": { description: "Rate limit exceeded", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
        },
      },
    },
    "/imported-data/preview": {
      post: {
        tags: ["imported-data"],
        operationId: "previewImportedData",
        summary: "Preview parsed imported lead text",
        description:
          "Parses raw multi-block lead text input and returns a completeness summary with PII redacted. " +
          "No external calls are made.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ImportedDataBody" },
              example: {
                inputText:
                  "John Doe\n123 Main St, Austin, TX 78701\n+1 512-555-0101\njohndoe@email.com\nDOB: 1985-03-22\nScore: 700",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Preview parsed successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ImportedDataPreviewResponse" },
              },
            },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
        },
      },
    },
    "/imported-data/safe-batch": {
      post: {
        tags: ["imported-data"],
        operationId: "createSafeImportedBatch",
        summary: "Create a safe-test batch from imported lead text",
        description:
          "Parses raw lead text and creates a batch of jobs in safe-test mode (no external calls). " +
          "PII is redacted from stored payloads. " +
          "Requires `bulk`, `vip`, or `admin` scope API key.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ImportedDataBody" },
            },
          },
        },
        responses: {
          "200": {
            description: "Safe batch created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SafeBatchResponse" },
              },
            },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "403": { description: "Forbidden — bulk/VIP/admin scope required", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "429": { description: "Rate limit exceeded", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
        },
      },
    },
    "/jobs/{publicId}": {
      get: {
        tags: ["jobs"],
        operationId: "getJobDetails",
        summary: "Get job details by public ID",
        description: "Returns the full job record including status, result, and proxy details.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "publicId",
            in: "path",
            required: true,
            description: "The public job identifier (format: job_<hex>)",
            schema: { type: "string", example: "job_a1b2c3d4e5f6" },
          },
        ],
        responses: {
          "200": {
            description: "Job found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/JobDetailsResponse" },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "404": {
            description: "Job not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
                example: {
                  ok: false,
                  requestId: "req_xyz",
                  error: { code: "NOT_FOUND", message: "Job not found.", retryable: false },
                },
              },
            },
          },
        },
      },
    },
    "/jobs/{publicId}/events": {
      get: {
        tags: ["jobs"],
        operationId: "getJobEvents",
        summary: "Get job execution events",
        description: "Returns the chronological list of events (lifecycle, errors, retries) for a job.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "publicId",
            in: "path",
            required: true,
            description: "The public job identifier",
            schema: { type: "string", example: "job_a1b2c3d4e5f6" },
          },
        ],
        responses: {
          "200": {
            description: "Job events returned",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/JobEventsResponse" },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "404": { description: "Job not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
        },
      },
    },
    "/usage/summary": {
      get: {
        tags: ["usage"],
        operationId: "getUsageSummary",
        summary: "Get API usage summary for the current period",
        description:
          "Returns aggregated usage metrics (requests, browser runs, proxy traffic, revenue, COGS) " +
          "for the current billing period, segmented by API key.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Usage summary",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UsageSummaryResponse" },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API Key",
        description:
          "Pass your API key as `Bearer <token>` in the Authorization header. " +
          "Keys are created via the dashboard (Billing > API Keys). " +
          "Scopes: `single` (60 rpm), `bulk` (120 rpm), `vip` (300 rpm), `admin` (600 rpm).",
      },
    },
    schemas: {
      // ─── Common ────────────────────────────────────────────────────────────

      ApiError: {
        type: "object",
        description: "Standard API error response",
        required: ["ok", "requestId", "error"],
        properties: {
          ok: { type: "boolean", enum: [false], description: "Always `false` for error responses" },
          requestId: { type: "string", description: "Unique request identifier (format: req_<ts>_<random>)" },
          error: {
            type: "object",
            required: ["code", "message", "retryable"],
            properties: {
              code: {
                type: "string",
                enum: ["UNAUTHORIZED", "FORBIDDEN", "VALIDATION_ERROR", "RATE_LIMITED", "NOT_FOUND", "INTERNAL_ERROR"],
                description: "Machine-readable error code",
              },
              message: { type: "string", description: "Human-readable error description" },
              retryable: { type: "boolean", description: "Whether the request can be retried without modification" },
              details: {
                type: "object",
                description: "Additional context (present for VALIDATION_ERROR and RATE_LIMITED)",
                additionalProperties: true,
              },
            },
          },
        },
      },

      BaseJob: {
        type: "object",
        description: "Core job record fields shared across endpoints",
        properties: {
          id: { type: "integer", description: "Internal DB ID" },
          publicId: { type: "string", description: "Public job identifier (format: job_<hex>)" },
          userId: { type: ["integer", "null"], description: "Owner user ID" },
          source: { type: "string", enum: ["dashboard", "api", "telegram", "system", "testbench"], description: "Submission source" },
          requestMode: { type: "string", enum: ["single", "bulk", "vip"], description: "Processing mode" },
          status: { type: "string", enum: ["queued", "running", "succeeded", "failed", "canceled", "waiting_retry"], description: "Current job status" },
          queueName: { type: "string", description: "Queue name (e.g. default, bulk, vip)" },
          priority: { type: "integer", description: "Queue priority (1-1000, higher = more urgent)" },
          targetLabel: { type: ["string", "null"], description: "Optional human-readable label" },
          attemptCount: { type: "integer", description: "Number of execution attempts" },
          maxAttempts: { type: "integer", description: "Maximum allowed attempts" },
          errorCode: { type: ["string", "null"], description: "Error code if status is failed" },
          errorMessage: { type: ["string", "null"], description: "Error message if status is failed" },
          createdAt: { type: "string", format: "date-time" },
          startedAt: { type: ["string", "null"], format: "date-time" },
          completedAt: { type: ["string", "null"], format: "date-time" },
          costEstimateUsd: { type: "string", description: "Estimated cost in USD (string to preserve precision)" },
          cogsUsd: { type: "string", description: "Cost of goods sold in USD" },
          resultJson: {
            type: "object",
            description: "Result payload containing ONE CS scoring output",
            additionalProperties: true,
          },
        },
      },

      // ─── Request bodies ─────────────────────────────────────────────────────

      ProxyConfig: {
        type: "object",
        description: "Optional proxy configuration for a job",
        properties: {
          country: { type: "string", maxLength: 8, description: "ISO country code (e.g. US, CA)", example: "US" },
          state: { type: "string", maxLength: 64, description: "State/region hint" },
          city: { type: "string", maxLength: 128, description: "City hint" },
          protocol: { type: "string", enum: ["http", "socks5"], default: "http" },
          sessionMode: { type: "string", enum: ["rotating", "sticky", "hard_sticky"], default: "rotating" },
          stickyTtlMinutes: { type: "integer", minimum: 1, maximum: 1440 },
          providerHint: { type: "string", maxLength: 64, description: "Preferred proxy provider code" },
          costCeilingUsd: { type: "number", minimum: 0 },
          maxTransportRetries: { type: "integer", minimum: 0, maximum: 10, default: 2 },
          maxProviderSwitches: { type: "integer", minimum: 0, maximum: 10, default: 1 },
        },
      },

      SingleRequestBody: {
        type: "object",
        required: ["requestMode", "payload"],
        properties: {
          requestMode: {
            type: "string",
            enum: ["single", "bulk", "vip"],
            description: "Request mode (ignored for /requests/vip — it is forced internally)",
          },
          targetLabel: { type: "string", maxLength: 191, description: "Human-readable job label" },
          queueName: { type: "string", maxLength: 64, default: "default" },
          priority: { type: "integer", minimum: 1, maximum: 1000, default: 100 },
          payload: {
            type: "object",
            description: "Lead data payload. Common fields: firstName, lastName, address, phone, email, dob, ssn, creditScore",
            additionalProperties: true,
          },
          proxy: { $ref: "#/components/schemas/ProxyConfig" },
          profilePolicy: { type: "string", maxLength: 128, description: "Browser fingerprinting profile name" },
          fingerprintProfile: { type: "string", maxLength: 128, description: "Explicit fingerprint profile override" },
          safeTestMode: { type: "boolean", default: false, description: "If true, executes in safe-test bench (no external calls)" },
        },
      },

      BulkRequestBody: {
        type: "object",
        required: ["items"],
        properties: {
          queueName: { type: "string", maxLength: 64, default: "bulk" },
          priority: { type: "integer", minimum: 1, maximum: 1000, default: 120 },
          items: {
            type: "array",
            minItems: 1,
            maxItems: 1000,
            description: "Bulk items (max 1,000). Each item becomes a separate job.",
            items: {
              type: "object",
              properties: {
                externalId: { type: "string", maxLength: 128, description: "External reference ID for this item" },
                payload: {
                  type: "object",
                  additionalProperties: true,
                  description: "Lead data payload for this item",
                },
              },
            },
          },
          proxy: { $ref: "#/components/schemas/ProxyConfig" },
          safeTestMode: { type: "boolean", default: false },
        },
      },

      ImportedDataBody: {
        type: "object",
        required: ["inputText"],
        properties: {
          inputText: {
            type: "string",
            maxLength: 200000,
            description:
              "Raw multi-block lead text. Each block represents one record. " +
              "Supported fields: Name, Address, Phone, Email, DOB, SSN, Credit Score. " +
              "PII is redacted in responses.",
            example:
              "John Doe\n123 Main St, Austin, TX 78701\n+1 512-555-0101\njohndoe@email.com\nDOB: 1985-03-22\nScore: 700\n\nJane Smith\n456 Elm St, Austin, TX 78702\n+1 512-555-0202\njanesmith@email.com\nDOB: 1990-07-10\nScore: 650",
          },
        },
      },

      // ─── Responses ───────────────────────────────────────────────────────────

      HealthResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          requestId: { type: "string" },
          data: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["healthy", "degraded"] },
              db: { type: "string", enum: ["connected", "disconnected"] },
              proxy: { type: "object", additionalProperties: true },
              version: { type: "string" },
            },
          },
          meta: { type: "object", properties: { public: { type: "boolean" } } },
        },
      },

      SingleResponse: {
        type: "object",
        description: "Response for a single job creation request",
        properties: {
          ok: { type: "boolean", enum: [true] },
          requestId: { type: "string" },
          data: {
            type: "object",
            properties: {
              job: { $ref: "#/components/schemas/BaseJob" },
              events: { type: "array", items: { $ref: "#/components/schemas/JobEvent" } },
            },
          },
          meta: {
            type: "object",
            properties: {
              safeTestMode: { type: "boolean" },
              persisted: { type: "boolean" },
              executionMode: { type: "string", enum: ["safe_test", "queued_runtime"] },
            },
          },
        },
      },

      BulkResponse: {
        type: "object",
        description: "Response for a bulk batch creation request",
        properties: {
          ok: { type: "boolean", enum: [true] },
          requestId: { type: "string" },
          data: {
            type: "object",
            properties: {
              batchId: { type: "string", description: "Batch identifier (format: batch_<hex>)" },
              itemCount: { type: "integer", description: "Number of items in the batch" },
              jobs: { type: "array", items: { $ref: "#/components/schemas/BaseJob" } },
            },
          },
          meta: {
            type: "object",
            properties: {
              safeTestMode: { type: "boolean" },
              queueName: { type: "string" },
            },
          },
        },
      },

      VipResponse: {
        type: "object",
        description: "Response for a VIP-priority single request",
        properties: {
          ok: { type: "boolean", enum: [true] },
          requestId: { type: "string" },
          data: {
            type: "object",
            properties: {
              job: { $ref: "#/components/schemas/BaseJob" },
              events: { type: "array", items: { $ref: "#/components/schemas/JobEvent" } },
            },
          },
          meta: {
            type: "object",
            properties: {
              safeTestMode: { type: "boolean" },
              persisted: { type: "boolean" },
              executionMode: { type: "string" },
              vip: { type: "boolean" },
            },
          },
        },
      },

      ImportedDataPreviewResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", enum: [true] },
          requestId: { type: "string" },
          data: {
            type: "object",
            properties: {
              totalRecords: { type: "integer", description: "Total parsed records" },
              sourceLabels: { type: "array", items: { type: "string" } },
              stateBreakdown: { type: "object", additionalProperties: { type: "integer" } },
              withPhone: { type: "integer", description: "Records with a phone number" },
              withEmailDomain: { type: "integer", description: "Records with an email domain" },
              withDob: { type: "integer", description: "Records with a date of birth" },
              withSsnMarker: { type: "integer", description: "Records with an SSN marker" },
              averageCompletenessScore: { type: "number", description: "Average completeness score (0-1)" },
              sampleRecords: { type: "array", items: { type: "object", additionalProperties: true } },
              safePayloads: { type: "array", items: { type: "object", additionalProperties: true } },
            },
          },
          meta: {
            type: "object",
            properties: {
              piiRedacted: { type: "boolean" },
              safePreview: { type: "boolean" },
            },
          },
        },
      },

      SafeBatchResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", enum: [true] },
          requestId: { type: "string" },
          data: {
            type: "object",
            properties: {
              batchId: { type: "string" },
              itemCount: { type: "integer" },
              jobs: { type: "array", items: { $ref: "#/components/schemas/BaseJob" } },
            },
          },
          meta: {
            type: "object",
            properties: {
              piiRedacted: { type: "boolean" },
              importedFormat: { type: "boolean" },
              safeTestMode: { type: "boolean" },
            },
          },
        },
      },

      JobEvent: {
        type: "object",
        description: "A single job lifecycle event",
        properties: {
          id: { type: "integer" },
          jobId: { type: "integer" },
          type: { type: "string", description: "Event type (e.g. job.created, worker.completed)" },
          severity: { type: "string", enum: ["info", "warn", "error"] },
          message: { type: "string" },
          details: { type: "object", additionalProperties: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },

      JobDetailsResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", enum: [true] },
          requestId: { type: "string" },
          data: { $ref: "#/components/schemas/BaseJob" },
          meta: {
            type: "object",
            properties: {
              eventCount: { type: "integer", description: "Total number of events for this job" },
            },
          },
        },
      },

      JobEventsResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", enum: [true] },
          requestId: { type: "string" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/JobEvent" },
          },
          meta: {
            type: "object",
            properties: {
              publicId: { type: "string" },
            },
          },
        },
      },

      UsageSummaryResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", enum: [true] },
          requestId: { type: "string" },
          data: {
            type: "object",
            properties: {
              apiKeys: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "integer" },
                    label: { type: "string" },
                    scope: { type: "string" },
                    status: { type: "string" },
                    rpmLimit: { type: "integer" },
                    dailyLimit: { type: "integer" },
                    createdAt: { type: "string", format: "date-time" },
                  },
                },
              },
              usageSummary: {
                type: "object",
                properties: {
                  currentPeriod: { type: "string" },
                  requests: { type: "integer" },
                  browserRuns: { type: "integer" },
                  proxyTrafficGb: { type: "number" },
                  cogsUsd: { type: "number" },
                  revenueUsd: { type: "number" },
                  marginUsd: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
  },
};

export default spec;