# SITEWARE API — Complete Reference Documentation

**Version:** v1.0.0 | **Spec:** OAS 3.0.0 | **Environment:** Staging
**Base URL:** `https://stagingapi.siteware.io`
**Date:** March 2026 | Confidential

---

## 1. Introduction

This document provides a complete reference for the Siteware API (v1.0.0). The API enables programmatic integration with the Siteware AI platform — including agent management, conversation history, AI completions, file handling, external widgets, and OAuth.

### 1.1 Base URL

```
https://stagingapi.siteware.io
```

Siteware Testumgebung (Staging). Production URL will differ.

### 1.2 Authentication

All requests require an `Authorization` header with a token from Client Settings in the Siteware Portal.

```
Authorization: <YOUR_SECRET_TOKEN>
```

Auth type: `authHeader` — include in every request header. Token is unique per account.

### 1.3 Client Libraries

Code examples available for: Shell, Ruby, Node.js (Fetch), PHP, Python.

### 1.4 API Sections

| Section         | Description                                                          |
| --------------- | -------------------------------------------------------------------- |
| Agents          | List and manage AI agents                                            |
| Agent History   | Conversation history per agent                                       |
| Completions     | AI completion requests (simple, unified agent, deprecated task/chat) |
| External Widget | Embeddable chat/task session initialization                          |
| Files           | File upload for use in completions                                   |
| OAuth           | OAuth request and application registration                           |
| Models          | Data model schemas                                                   |

### 1.5 Contact

Development team: develop@siteware.io

---

## 2. Agents

### 2.1 Get List

```
GET /v1/api/agents
```

Retrieves all agents belonging to the authenticated user (client).

**Responses:**

| Code | Description                       |
| ---- | --------------------------------- |
| 200  | Success — list of agents returned |
| 204  | No content — no agents available  |
| 400  | Error retrieving database entries |

**Response Schema (200):**

```json
[
  {
    "name": "Support Agent",
    "description": "Customer support chatbot for...",
    "type": "chat",
    "model": "gpt-4",
    "createdAt": "2026-03-02T14:42:29.378Z",
    "updatedAt": "2026-03-02T14:42:29.378Z"
  }
]
```

---

## 3. Agent History

Retrieve conversation histories for agents. Histories contain timestamped message logs with speaker attribution.

### 3.1 Get List

```
GET /v1/api/agent/{agentId}/history
```

Returns all stored conversation histories for the specified agent.

**Path Parameters:**

| Parameter | Type   | Required | Description                                           |
| --------- | ------ | -------- | ----------------------------------------------------- |
| `agentId` | string | ✅       | The ID of the agent whose history should be retrieved |

**Responses:**

| Code | Description                          |
| ---- | ------------------------------------ |
| 200  | Success — list of histories returned |
| 400  | Error retrieving database entries    |

**Response Schema (200):**

```json
[
  {
    "agentId": "string",
    "clientId": "string",
    "createdAt": "2026-03-02T14:42:29.378Z",
    "updatedAt": "2026-03-02T14:42:29.378Z",
    "log": [
      {
        "speaker": "user",
        "message": "string",
        "timestamp": "2026-03-02T14:42:29.378Z"
      }
    ]
  }
]
```

### 3.2 Get

```
GET /v1/api/agent/{agentId}/history/{historyId}
```

Retrieves a specific history record using agent ID and history ID. Requires the client ID in the request.

**Path Parameters:**

| Parameter   | Type   | Required | Description                                 |
| ----------- | ------ | -------- | ------------------------------------------- |
| `agentId`   | string | ✅       | The unique identifier of the agent          |
| `historyId` | string | ✅       | The unique identifier of the history record |

**Responses:**

| Code | Description                                       |
| ---- | ------------------------------------------------- |
| 200  | Returns the history record of the specified agent |
| 400  | Error retrieving database entries                 |

### 3.3 List by agent & referenceId

```
GET /v1/api/agent/{agentId}/history/reference/{referenceId}
```

Retrieves history entries for a specific agent filtered by referenceId. Both are required.

**Path Parameters:**

| Parameter     | Type   | Required | Description                              |
| ------------- | ------ | -------- | ---------------------------------------- |
| `agentId`     | string | ✅       | Agent whose history is being requested   |
| `referenceId` | string | ✅       | Reference used to filter history entries |

**Responses:**

| Code | Description                                   |
| ---- | --------------------------------------------- |
| 200  | An array of agent history entries             |
| 400  | Bad request — missing or incorrect parameters |

### 3.4 List by referenceId

```
GET /v1/api/agents/history
```

Returns all conversation histories for the authenticated client matching the specified referenceId.

**Query Parameters:**

| Parameter     | Type   | Required | Description                                                              |
| ------------- | ------ | -------- | ------------------------------------------------------------------------ |
| `referenceId` | string | ✅       | Must be the complete referenceId. Partial string search is not possible. |

**Responses:**

| Code | Description                                         |
| ---- | --------------------------------------------------- |
| 200  | Success — list of matching histories                |
| 400  | Bad request — referenceId missing or database error |

---

## 4. Completions

Execute AI completion requests against Siteware's multi-model infrastructure.

### 4.1 Simple Completion Request

```
POST /v1/api/completion
```

Initiates a completion using the provided `prompt` and `context` with a given language model, optionally utilizing web search. Ensures the client's budget is sufficient. **Can be executed without any relation to Siteware agents.**

**Request Body** (`application/json`):

| Parameter      | Type              | Required | Default | Description                                                                               |
| -------------- | ----------------- | -------- | ------- | ----------------------------------------------------------------------------------------- |
| `model`        | string            | ✅       | —       | The model to use. Must be a valid LLM model.                                              |
| `prompt`       | string            | ✅       | —       | The text prompt for the completion.                                                       |
| `context`      | ConversationLog[] | ❌       | —       | Optional chat context for conversation continuity. Every request returns the new context. |
| `fileIds`      | null              | ❌       | Empty   | Array of fileIds (uploaded via Files endpoint first).                                     |
| `useWebSearch` | boolean           | ❌       | `true`  | Whether web search can be used.                                                           |

**Example Request:**

```javascript
fetch("https://stagingapi.siteware.io/v1/api/completion", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "YOUR_SECRET_TOKEN",
  },
  body: JSON.stringify({
    context: [{ id: "", speaker: "system", timestamp: "", message: "" }],
    prompt: "",
    useWebSearch: true,
    model: "",
  }),
});
```

**Responses:**

| Code | Description                                        |
| ---- | -------------------------------------------------- |
| 200  | Successful completion response                     |
| 400  | Bad request — invalid model or insufficient budget |

**Response Schema (200):**

```json
{
  "answer": "string",
  "model": "string",
  "context": "string",
  "usage": {
    "completionTokens": 1,
    "promptTokens": 1,
    "overallTokens": 1,
    "costs": 1
  }
}
```

---

### 4.2 Execute Agent (Unified) ⭐ PRIMARY ENDPOINT

```
POST /v1/api/completion/{agentId}
```

Unified endpoint that automatically detects the agent type (chat or task) and executes accordingly. **This replaces the separate `/chat` and `/task` endpoints.**

**Behavior by agent type:**

- **Chat agents:** Provide `prompt` and optionally `context` or `historyId` to continue a conversation. File attachments via `fileIds`.
- **Task agents:** Provide `taskSettings` with input/option values on the first call. For file-type inputs, pass the `fileId` as the value — the file is automatically resolved. After initial execution, use the returned `historyId` with a `prompt` to continue chatting about the result.

**Streaming mode:** Set `stream: true` to receive Server-Sent Events (SSE) instead of JSON. Content-Type becomes `text/event-stream`.

**SSE Event Types:**

| Event                   | Description                             |
| ----------------------- | --------------------------------------- |
| `chunk`                 | Text delta                              |
| `reasoningDelta`        | Reasoning text                          |
| `reasoningFinished`     | Reasoning complete                      |
| `webSearchInProgress`   | Web search started                      |
| `webSearchCompleted`    | Web search done                         |
| `startImageGeneration`  | Image generation started                |
| `finishImageGeneration` | Image generation done                   |
| `startCodeGeneration`   | Code generation started                 |
| `finishCodeGeneration`  | Code generation done                    |
| `step`                  | Multi-step progress                     |
| `streamError`           | Error during streaming                  |
| `keepAlive`             | Periodic ping (every 20s)               |
| `end`                   | Final event with complete response data |

**Path Parameters:**

| Parameter | Type   | Required | Description                                                        |
| --------- | ------ | -------- | ------------------------------------------------------------------ |
| `agentId` | string | ✅       | Unique identifier of the agent. Type (chat/task) is auto-detected. |

**Request Body** (`application/json`):

| Parameter      | Type              | Required                                     | Default | Description                                                                                                                                        |
| -------------- | ----------------- | -------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`       | string            | Required for chat agents and task follow-ups | —       | The prompt message. Ignored on initial task execution (built from taskSettings).                                                                   |
| `context`      | ConversationLog[] | ❌                                           | —       | Optional chat context. **Must not be used together with `historyId`.**                                                                             |
| `historyId`    | string            | ❌                                           | —       | Continue a previous conversation. Works for both chat and task agents. For task agents: enables follow-up chat (requires prompt, no taskSettings). |
| `referenceId`  | string            | ❌                                           | —       | Optional reference identifier to link to history.                                                                                                  |
| `fileIds`      | string[]          | ❌                                           | —       | Array of fileIds (uploaded via POST /files). For chat: attached globally. For task follow-ups: attached to the follow-up message.                  |
| `taskSettings` | object[]          | Required for first task call                 | —       | Settings for task execution. Structure depends on agent's taskSettings config. For file inputs, pass fileId as value.                              |
| `stream`       | boolean           | ❌                                           | `false` | Set to `true` for SSE streaming response.                                                                                                          |

**taskSettings child attributes:**

| Field   | Type   | Description                                           |
| ------- | ------ | ----------------------------------------------------- |
| `name`  | string | Setting name (matches agent's task configuration)     |
| `value` | string | Setting value. For file-type inputs, pass the fileId. |

**Example Request:**

```javascript
fetch("https://stagingapi.siteware.io/v1/api/completion/{agentId}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "YOUR_SECRET_TOKEN",
  },
  body: JSON.stringify({
    prompt: "",
    context: [{ id: "", speaker: "system", timestamp: "", message: "" }],
    historyId: "",
    referenceId: "",
    fileIds: ["6916e53dbe433559c1499b73", "6916e53bbe433559c1499b6f"],
    taskSettings: [{ name: "", value: "" }],
    stream: false,
  }),
});
```

**Responses:**

| Code | Description                                                                                                                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 200  | Successful completion. JSON when `stream: false`, SSE when `stream: true`. The SSE `end` event contains the same data structure as JSON. |
| 400  | Bad request                                                                                                                              |

**Response Schema (200):**

```json
{
  "answer": "string",
  "model": "string",
  "agentId": "string",
  "historyId": "string",
  "context": [
    {
      "speaker": "string",
      "message": "string",
      "timestamp": "2026-03-02T14:42:29.378Z"
    }
  ],
  "usage": {
    "promptTokens": 1,
    "completionTokens": 1,
    "overallTokens": 1,
    "costs": 1
  }
}
```

---

### 4.3 Execute Task Agent (⚠️ DEPRECATED)

```
POST /v1/api/completion/{agentId}/task
```

**Deprecated.** Use `POST /v1/api/completion/{agentId}` (Execute Agent Unified) instead, which auto-detects the agent type.

Executes a specific task using the selected agent and returns the completion result.

**Path Parameters:**

| Parameter | Type   | Required | Description                               |
| --------- | ------ | -------- | ----------------------------------------- |
| `agentId` | string | ✅       | Unique identifier of the agent to execute |

**Request Body** (`application/json`):

| Parameter      | Type     | Required | Description                                                                    |
| -------------- | -------- | -------- | ------------------------------------------------------------------------------ |
| `taskSettings` | object[] | ✅       | Settings for task execution. Structure depends on agent's taskSettings config. |
| `fileIds`      | string[] | ❌       | Array of fileIds uploaded via POST /files.                                     |
| `referenceId`  | string   | ❌       | Identifier for tracking and linking to task history.                           |

**Responses:**

| Code | Description                                             |
| ---- | ------------------------------------------------------- |
| 200  | Successful completion of the task with results          |
| 400  | Invalid request due to client error or agent constraint |

**Response Schema (200):** Same as Execute Agent (Unified) — see section 4.2.

---

### 4.4 Execute Chat Agent (⚠️ DEPRECATED)

```
POST /v1/api/completion/{agentId}/task
```

**Deprecated.** Use `POST /v1/api/completion/{agentId}` (Execute Agent Unified) instead.

Same path and structure as Execute Task Agent but for chat-type agents. Auto-detection in the unified endpoint makes this unnecessary.

**Responses:** Same as section 4.3.

---

## 5. External Widget (Chat or Task)

### 5.1 Init Session

```
POST /v1/api/agent/{agentId}/external/init
```

Initiates an external session with the specified agent if eligible, returning a unique URL for accessing the chat or task session. The URL can be opened in a browser or iFrame — everything is handled by Siteware. No need to develop or integrate the chat yourself. Only Task-Agents or Chat-Agents are eligible.

**Path Parameters:**

| Parameter | Type   | Required | Description                        |
| --------- | ------ | -------- | ---------------------------------- |
| `agentId` | string | ✅       | The unique identifier of the agent |

**Request Body** (`application/json`):

| Parameter              | Type    | Required | Default   | Description                                                                                                                                                                                |
| ---------------------- | ------- | -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `expiresIn`            | integer | ❌       | `15`      | Time in minutes until the chat token expires. Max 15 minutes. Ignored if `singleUseOnly` is true.                                                                                          |
| `fileIds`              | null    | ❌       | Empty     | Array of fileIds to attach initially when chat starts. Only for Chat-Agents.                                                                                                               |
| `initialText`          | string  | ❌       | Empty     | Optional text to prefill in the chat interface. Only for Chat-Agents.                                                                                                                      |
| `referenceId`          | string  | ❌       | Empty     | Optional reference ID for linking. Also used to show chat history for the agent.                                                                                                           |
| `referenceSearchRegEx` | string  | ❌       | No Filter | Regex to filter chat history by referenceId. Applied to both request referenceId and stored history referenceId. First matching result is used. If no regex, referenceId must fully match. |
| `singleUseOnly`        | boolean | ❌       | `true`    | Whether the chat URL is single-use only.                                                                                                                                                   |
| `settings`             | object  | ❌       | —         | Session settings (see below).                                                                                                                                                              |

**Settings child attributes:**

| Field              | Type    | Description                                               |
| ------------------ | ------- | --------------------------------------------------------- |
| `showHeader`       | boolean | Show header in the widget                                 |
| `showHistory`      | boolean | Show conversation history                                 |
| `autoSubmit`       | boolean | Auto-submit on load                                       |
| `taskAgent.inputs` | object  | Predefined field values for task agents (key-value pairs) |

**Example Request:**

```javascript
fetch("https://stagingapi.siteware.io/v1/api/agent/{agentId}/external/init", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "YOUR_SECRET_TOKEN",
  },
  body: JSON.stringify({
    referenceId: "PM-2025",
    referenceSearchRegEx: "/^[^/]+//s",
    initialText: "Empty",
    singleUseOnly: true,
    expiresIn: 15,
    fileIds: ["6916e53dbe433559c1499b73", "6916e53bbe433559c1499b6f"],
    settings: {
      showHeader: true,
      showHistory: true,
      autoSubmit: false,
      taskAgent: {
        inputs: {
          fieldName1: "Predefined Value 01",
          fieldName2: "Predefined Value 02",
        },
      },
    },
  }),
});
```

**Responses:**

| Code | Description                                        |
| ---- | -------------------------------------------------- |
| 200  | Success — returns URL for the external session     |
| 400  | Bad request — invalid input parameters             |
| 401  | Unauthorized — invalid permissions or agent status |

**Response Schema (200):**

```json
{
  "url": "string"
}
```

---

## 6. Files

### 6.1 Upload Files

```
POST /v1/api/files
```

Upload one or more files for an agent. All uploaded files are stored temporarily, and the API returns metadata for each file including an `id`. This `id` must be provided in the corresponding chat or task request to make the file available. **Each uploaded file can be used only once per request; after it has been used, it is automatically deleted.**

**Supported file types:** txt, md, pdf, doc, docx, ppt, pptx, xls, xlsx, csv, json, html, htm, png, jpg, jpeg, gif, webp, log

**Max file size:** 10 MB per file.

**Request Body** (`multipart/form-data`):

| Parameter | Type     | Required | Description                 |
| --------- | -------- | -------- | --------------------------- |
| `files`   | string[] | ✅       | One or more files to upload |

**Example Request:**

```javascript
const formData = new FormData();
formData.append("files", "");

fetch("https://stagingapi.siteware.io/v1/api/files", {
  method: "POST",
  headers: {
    "Content-Type": "multipart/form-data",
  },
  body: formData,
});
```

**Responses:**

| Code | Description                         |
| ---- | ----------------------------------- |
| 200  | Files successfully uploaded         |
| 400  | Bad request (e.g. no file provided) |

**Response Schema (200):**

```json
[
  {
    "id": "665f0f9a6fa0c4e8f5b3e2a1",
    "contentType": "application/pdf",
    "fileName": "offer.pdf",
    "size": 123456,
    "validUntil": "2025-11-21T10:15:30.000Z"
  }
]
```

---

## 7. OAuth

### 7.1 Create an OAuth Request

```
POST /v1/api/oauth
```

Initiates an OAuth request for a registered application with an optional expiration time and metadata. Generates a URL to track the OAuth request. The application must be active and properly registered. Open the URL in a browser window to complete the OAuth process. Once completed, you receive the auth token via the provided `callbackUrl`.

**Request Body** (`application/json`):

| Parameter       | Type          | Required | Default | Description                                                                |
| --------------- | ------------- | -------- | ------- | -------------------------------------------------------------------------- |
| `appId`         | string        | ✅       | —       | The unique identifier of the application                                   |
| `callbackUrl`   | string        | ✅       | —       | URL to redirect to once OAuth is completed                                 |
| `authorization` | string        | ❌       | Empty   | Optional authorization header for the callback request                     |
| `expiresIn`     | integer       | ❌       | `10`    | Minutes until the OAuth request expires. Maximum 10 minutes.               |
| `metaData`      | object        | ❌       | —       | Optional metadata included in the OAuth request. Returned in the callback. |
| `method`        | string (enum) | ❌       | `POST`  | HTTP method for the callback. Options: `POST`, `PUT`                       |

**Example Callback Response:**

```json
{
  "checksum": "1234567890",
  "createdDate": "2025-10-01T12:00:00.000Z",
  "metaData": { "key1": "value1", "key2": "value2" },
  "token": "eyJhbGciOi..."
}
```

**Example Request:**

```javascript
fetch("https://stagingapi.siteware.io/v1/api/oauth", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "YOUR_SECRET_TOKEN",
  },
  body: JSON.stringify({
    appId: "60f6bafd826e4c3bd1f4cffa",
    callbackUrl: "https://example.com/callback",
    method: "POST",
    authorization: "Bearer 1234567890",
    metaData: { key1: "value1", key2: "value2" },
    expiresIn: 10,
  }),
});
```

**Responses:**

| Code | Description                                        |
| ---- | -------------------------------------------------- |
| 200  | Successfully created OAuth request                 |
| 400  | Bad request — missing data or inactive application |

**Response Schema (200):**

```json
{
  "url": "https://www.siteware.io/oauth/60f6bafd826e4c3bd1f4cffe"
}
```

---

### 7.2 Create OAuth Application

```
POST /v1/api/oauth/app
```

Creates a new OAuth application. Before you can use the OAuth endpoint to obtain a login URL, the application must be registered with Siteware. After registration, you receive an email with instructions to approve the application and verify the contact email. Once approved, you receive the final `appId` and can create OAuth requests. **This is a one-time registration to become a certified partner.**

**Request Body** (`application/json`):

| Parameter     | Type   | Required | Description                                                  |
| ------------- | ------ | -------- | ------------------------------------------------------------ |
| `name`        | string | ✅       | Name of the OAuth application                                |
| `website`     | string | ✅       | Official website of the application                          |
| `contactMail` | string | ✅       | Contact email for the application                            |
| `description` | string | ❌       | Description of how the application will use the Siteware API |
| `logoUrl`     | string | ❌       | URL to a logo for the OAuth approval page                    |

**Example Request:**

```javascript
fetch("https://stagingapi.siteware.io/v1/api/oauth/app", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "Example App",
    website: "https://example.com",
    contactMail: "contact@example.com",
    logoUrl: "https://example.com/logo.png",
    description: "This is a sample OAuth application",
  }),
});
```

**Responses:**

| Code | Description                                        |
| ---- | -------------------------------------------------- |
| 200  | Successful creation of the OAuth application       |
| 400  | Bad request — invalid parameters or database error |

**Response Schema (200):**

```json
{
  "appId": "507f191e810c19729de860ea",
  "info": "Your request will be approved by siteware sales team. You will be notified by..."
}
```

---

## 8. Data Models

### 8.1 ErrorItem

| Field          | Type   | Description   |
| -------------- | ------ | ------------- |
| `data`         | object | Error data    |
| `errorCode`    | number | Error code    |
| `errorMessage` | string | Error message |

### 8.2 AgentHistoryItem

| Field       | Type               | Description                       |
| ----------- | ------------------ | --------------------------------- |
| `agentId`   | string             | Agent identifier                  |
| `clientId`  | string             | Client identifier                 |
| `createdAt` | string (date-time) | RFC 3339 timestamp                |
| `updatedAt` | string (date-time) | RFC 3339 timestamp                |
| `log`       | object[]           | Array of conversation log entries |

### 8.3 AgentCompletionResponse

| Field       | Type                | Description               |
| ----------- | ------------------- | ------------------------- |
| `agentId`   | string              | Agent identifier          |
| `answer`    | string              | AI-generated response     |
| `context`   | CompletionMessage[] | Conversation context      |
| `historyId` | string              | History record identifier |
| `model`     | string              | Model used                |
| `usage`     | object              | Token usage and costs     |

### 8.4 AgentCallback

Agent callback body sent to the callback URL. Success callback is always sent with type `call_finished`.

| Field  | Type          | Required | Description                   |
| ------ | ------------- | -------- | ----------------------------- |
| `type` | string (enum) | ✅       | `call_finished` or `approved` |
| `data` | object        | —        | Callback data                 |

### 8.5 CompletionMessage

| Field       | Type               | Description        |
| ----------- | ------------------ | ------------------ |
| `message`   | string             | Message content    |
| `speaker`   | string             | Speaker identifier |
| `timestamp` | string (date-time) | RFC 3339 timestamp |

### 8.6 Usage

| Field              | Type   | Description              |
| ------------------ | ------ | ------------------------ |
| `completionTokens` | number | Tokens in the completion |
| `costs`            | number | Cost of the request      |
| `overallTokens`    | number | Total tokens used        |
| `promptTokens`     | number | Tokens in the prompt     |

### 8.7 ConversationLog

| Field       | Type               | Required | Description        |
| ----------- | ------------------ | -------- | ------------------ |
| `id`        | string             | ✅       | Entry identifier   |
| `message`   | string             | ✅       | Message content    |
| `speaker`   | string (enum)      | ✅       | `system` or `user` |
| `timestamp` | string (date-time) | ✅       | RFC 3339 timestamp |

---

## Quick Reference — All Endpoints

| Method     | Path                                                      | Section     | Description                   |
| ---------- | --------------------------------------------------------- | ----------- | ----------------------------- |
| `GET`      | `/v1/api/agents`                                          | Agents      | List all agents               |
| `GET`      | `/v1/api/agent/{agentId}/history`                         | History     | List histories for agent      |
| `GET`      | `/v1/api/agent/{agentId}/history/{historyId}`             | History     | Get specific history          |
| `GET`      | `/v1/api/agent/{agentId}/history/reference/{referenceId}` | History     | Filter by agent + referenceId |
| `GET`      | `/v1/api/agents/history?referenceId=...`                  | History     | Filter all by referenceId     |
| `POST`     | `/v1/api/completion`                                      | Completions | Simple completion (no agent)  |
| `POST`     | `/v1/api/completion/{agentId}`                            | Completions | ⭐ Execute Agent (Unified)    |
| ~~`POST`~~ | ~~`/v1/api/completion/{agentId}/task`~~                   | Completions | ⚠️ Deprecated task agent      |
| ~~`POST`~~ | ~~`/v1/api/completion/{agentId}/task`~~                   | Completions | ⚠️ Deprecated chat agent      |
| `POST`     | `/v1/api/agent/{agentId}/external/init`                   | Widget      | Init external session         |
| `POST`     | `/v1/api/files`                                           | Files       | Upload files                  |
| `POST`     | `/v1/api/oauth`                                           | OAuth       | Create OAuth request          |
| `POST`     | `/v1/api/oauth/app`                                       | OAuth       | Register OAuth application    |

---

_— End of Siteware API Reference —_
