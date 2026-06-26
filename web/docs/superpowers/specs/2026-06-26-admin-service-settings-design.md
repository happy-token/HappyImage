# Admin Service Settings And Gateway Cleanup Design

## Context

HappyImage currently splits service configuration across API environment variables,
`config.json`, the Web settings page, and Web middleware environment variables.
This creates several confusing overlaps:

- `HAPPYTOKEN_FRONTEND_BASE_URL`, `HAPPYTOKEN_API_BASE_URL`, and
  `HAPPYTOKEN_CORS_ORIGINS` all describe public application access in common
  same-origin deployments.
- `HAPPYTOKEN_NEWAPI_BASE_URL`, `HAPPYTOKEN_NEWAPI_MANAGEMENT_URL`, and
  `MODEL_BACKEND_URL` all sound like model gateway addresses, but they operate
  at different layers.
- Web and API still expose `/v1/*` compatibility routes even though the product
  image workspace should use HappyImage task APIs.
- OAuth/OIDC settings cannot move behind the admin settings page unless first
  setup can create an admin and configure login without already being logged in.

The goal is to make runtime service settings configurable by frontend admins,
store those settings in the existing storage backend, remove unnecessary
environment-variable configuration, and delete the unused `/v1/*` compatibility
path.

## Goals

- Admins can configure service runtime settings from the frontend.
- Admin-managed settings are saved through the existing storage backend. When
  the deployment uses database storage, settings are stored in the same
  database-backed storage system.
- OAuth/OIDC and model gateway configuration no longer depend on environment
  variables.
- First setup can create the first admin and configure login without a circular
  dependency on OAuth.
- Web image generation uses HappyImage product APIs only.
- `happyimage-web/README.md` documents the final environment variable list and
  the moved admin settings.

## Non-Goals

- Do not migrate existing `.env` values into settings automatically. Operators
  will configure values manually.
- Do not keep external OpenAI-compatible `/v1/*` support in this feature.
- Do not remove deployment/build variables that must exist before the app can
  read its settings.

## Configuration Model

Configuration is divided into two groups.

### Infrastructure Environment Variables

These remain in deployment configuration because the app needs them before it
can load admin settings:

- API storage: `STORAGE_BACKEND`, `DATABASE_URL`, Git storage variables when the
  Git backend is used.
- Web to API routing: `BACKEND_URL`.
- Deployment details: ports, image names, build variables, and Cloudflare/R2
  upload-script variables.

`BACKEND_URL` stays because the Web middleware must know where to send `/api/*`,
`/images/*`, `/image-thumbnails/*`, and `/health` before a user can log in.

### Admin Runtime Settings

These move into frontend-admin settings and are loaded from the existing backend
configuration storage:

- Site URLs:
  - `public_app_url`: the browser-facing HappyImage URL.
  - `api_public_url`: optional advanced value. Empty means use
    `public_app_url`, then request origin as fallback.
- Session:
  - `session_secret`, cookie name, cookie domain, max age.
- OAuth/OIDC:
  - enabled flag, issuer, client ID, client secret, scopes, allowed email
    domains.
- Model gateway:
  - `gateway_api_base_url`, usually `https://gateway.happy-token.cn/v1`.
  - `gateway_management_url`, optional. Empty means derive by removing trailing
    `/v1` from `gateway_api_base_url`.
  - NewAPI automatic binding method and credentials, such as SQL DSN or
    provisioning endpoint secret, plus default token name.
- Outbound proxy.
- Image task and retention settings.
- Image storage settings.
- Safety settings such as global prompt and sensitive words.
- Registration, local password login, and test account switches if they remain
  available.

Runtime config getters should stop reading `HAPPYTOKEN_*` and `HAPPYIMAGE_*`
environment variables for these admin settings. The settings API returns
redacted sensitive fields with `*_configured` indicators. Saving a blank secret
keeps the previous secret; clearing requires an explicit clear action.

## URL Simplification

Common same-origin deployments only need `public_app_url`.

Derived behavior:

- CORS allows `public_app_url` by default.
- OIDC callback uses `api_public_url || public_app_url || request_origin` plus
  `/api/auth/oidc/callback`.
- OIDC success redirects to `public_app_url`.
- Generated private image URLs use `api_public_url || public_app_url ||
  request_origin`.

This replaces the common need to configure all of
`HAPPYTOKEN_FRONTEND_BASE_URL`, `HAPPYTOKEN_API_BASE_URL`, and
`HAPPYTOKEN_CORS_ORIGINS`.

## Model Gateway Simplification

The product model flow becomes:

```text
Browser -> /api/image-tasks/* -> HappyImage API -> configured gateway -> NewAPI
```

The Web app no longer proxies or calls `/v1/*`.

Remove routine configuration for:

- `MODEL_BACKEND_URL`
- `MODEL_BACKEND_API_KEY`
- `NEXT_PUBLIC_MODEL_API_BASE_URL`
- `HAPPYTOKEN_NEWAPI_BASE_URL`
- `HAPPYTOKEN_NEWAPI_MANAGEMENT_URL`

The NewAPI gateway is represented by admin settings:

- `gateway_api_base_url`
- `gateway_management_url`

Automatic NewAPI binding credentials remain separate fields because they are not
gateway addresses.

## First Setup Flow

Add a setup flow to avoid a circular dependency where admins need OAuth to enter
settings but OAuth is configured in settings.

- If no admin exists, `/setup` is available.
- `/setup` creates the first admin credential and saves minimal runtime
  settings.
- Minimal setup fields:
  - admin name and initial key/password
  - `public_app_url`
  - `session_secret`
  - OIDC/OAuth settings
  - model gateway API and optional management URL
  - NewAPI automatic binding settings if the operator wants OIDC users to get a
    default provider immediately
- Once an admin exists, `/setup` is disabled and redirects to login or settings.
- After setup, `/settings` remains admin-only.
- Keep an admin key login recovery path so a bad OIDC configuration does not
  permanently lock operators out.

## Remove `/v1/*`

Delete HappyImage's external OpenAI-compatible surface for this feature:

- Remove Web middleware routing for `/v1/*`.
- Remove frontend API helpers that call `/v1/models`, `/v1/images/generations`,
  and `/v1/images/edits`.
- Remove backend `/v1/models`, `/v1/images/generations`, and `/v1/images/edits`
  routes.
- Remove tests and docs that describe Web `/v1/*` proxy behavior.
- Update the image workspace to use `/api/image-tasks/*` and a product API for
  any model list it needs.

The model list for the product UI should come from a HappyImage product API or a
configured default list, not from `/v1/models`.

## Settings UI

The existing `/settings` page should remain admin-only and gain focused sections:

- Site and callback URLs.
- Login authorization.
- Model gateway and automatic NewAPI binding.
- Session and cookies.
- Outbound proxy.
- Image task/storage settings.
- Safety settings.

The UI should make common cases obvious:

- `public_app_url` is the primary URL field.
- `api_public_url` is advanced and optional.
- `gateway_management_url` is optional and derivable.
- Sensitive values are displayed as configured/not configured.

## README Update

`happyimage-web/README.md` must be updated with:

- The final required Web environment variables.
- A clear note that `BACKEND_URL` is the Web-to-API internal routing target.
- The removed `MODEL_BACKEND_*` and `/v1/*` proxy behavior.
- The admin settings now used for site URL, OAuth/OIDC, model gateway, session,
  proxy, and storage.
- A short table separating retained deployment variables, admin runtime
  settings, and removed legacy variables.

## Error Handling

- Missing `BACKEND_URL` in production still returns a Web middleware 502 for API
  proxy requests.
- Missing `session_secret` blocks session creation with an operator-facing setup
  error.
- Missing OIDC settings disables OIDC login rather than partially starting it.
- Missing model gateway settings prevents image generation with a clear message
  to configure the gateway/provider.
- Invalid URLs fail validation during setup/settings save.

## Testing

- Config storage tests for saving and redacting admin runtime settings.
- Setup tests:
  - setup available when no admin exists
  - setup disabled after first admin exists
  - setup creates admin and settings
- Auth tests for admin key recovery and OIDC disabled/misconfigured states.
- Web middleware tests proving `/v1/*` is no longer proxied.
- Frontend tests or type checks for settings store/API type changes.
- Existing image task tests should continue to prove generation uses
  `/api/image-tasks/*`.

## Acceptance Criteria

- Operators can start the app with only infrastructure variables and complete
  first setup from the browser.
- Admin settings are stored through the existing storage backend.
- OIDC/OAuth, session, site URL, proxy, image storage, and model gateway runtime
  settings no longer require `HAPPYTOKEN_*` environment variables.
- Web no longer documents or depends on `MODEL_BACKEND_URL`,
  `MODEL_BACKEND_API_KEY`, or `/v1/*` middleware proxying.
- The image workspace works through `/api/image-tasks/*`.
- `happyimage-web/README.md` contains the cleaned environment variable list and
  explains which settings are configured in the admin UI.
