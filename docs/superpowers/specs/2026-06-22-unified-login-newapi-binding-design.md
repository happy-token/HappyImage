# Unified Login and NewAPI Binding Design

Date: 2026-06-22

## Goal

HappyImage should join the server-side HappyServices platform with unified login and automatic NewAPI key binding.

The target user experience:

- Users sign in to HappyImage through Casdoor only.
- After login, HappyImage automatically ensures the user has a NewAPI default token.
- HappyImage uses that NewAPI token as the user's default model gateway configuration.
- HappyImage does not implement quota, billing, or usage accounting. NewAPI owns those concerns.
- Users can open an embedded NewAPI management page from HappyImage for advanced token management.

## Current Context

Local project structure:

- `happyimage-api/`: HappyImage backend for auth, users, image tasks, history, private images, settings, and API.
- `happyimage-web/`: HappyImage frontend, middleware, NewAPI proxy surface, and static gallery assets.
- `prompts/login.md`: Product request for unified login and API key auto-import.
- `arch.png`: Target platform architecture diagram.

Existing HappyImage auth already includes:

- OIDC login support in `happyimage-api/services/oidc_service.py`.
- OIDC-created local users in `happyimage-api/services/auth_service.py` using `auth_provider` and `auth_subject`.
- Frontend session storage in `happyimage-web/src/store/auth.ts`.
- User model provider fields in both backend and frontend.

Observed server platform under `/data/HappyServices` on `hk`:

- Top-level Docker Compose includes Caddy, Casdoor, NewAPI, PostgreSQL, Redis, sub2api, chatgpt2api, HappyImage, Umami, Mihomo, and related services.
- Caddy is the public entrypoint. The deployment README says child apps should avoid exposing their own ports and should go through Caddy.
- NewAPI is exposed at `gateway.happy-token.cn` and `gateway-b.happy-token.cn`.
- HappyImage is exposed at `image.happy-token.cn`.
- Casdoor is exposed at `auth.happy-token.cn`.
- NewAPI status reports `oidc_enabled=true`, `oidc_authorization_endpoint=https://auth.happy-token.cn/login/oauth/authorize`, and `server_address=https://gateway.happy-token.cn`.
- Casdoor discovery is available at `https://auth.happy-token.cn/.well-known/openid-configuration` and includes `openid`, `profile`, and `email` scopes.

External references checked:

- NewAPI project README: https://github.com/QuantumNous/new-api
- NewAPI API reference: https://docs.newapi.pro/en/docs/api
- NewAPI registration/login guide: https://docs.newapi.pro/en/docs/guide/feature-guide/user/auth
- NewAPI OIDC callback documentation: https://docs.newapi.pro/zh/docs/api/management/oauth/oauth-oidc-get
- NewAPI token management documentation: https://docs.newapi.pro/en/docs/api/management/token-management/token-post

Important implementation facts from NewAPI source and deployment:

- NewAPI session cookies are currently configured with `SameSite=Strict` in `main.go`.
- `image.happy-token.cn`, `gateway.happy-token.cn`, and `auth.happy-token.cn` are same-site subdomains under `happy-token.cn`, so `SameSite=Strict` does not automatically rule out iframe SSO.
- Current public response headers do not show `X-Frame-Options` or `Content-Security-Policy: frame-ancestors` blocking iframe embedding.

## Chosen Approach

Use same-site embedding for NewAPI management:

- Keep NewAPI's public API gateway at `https://gateway.happy-token.cn/v1/...`.
- Prefer opening the existing NewAPI management origin, `https://gateway.happy-token.cn`, inside HappyImage after validating iframe and cookie behavior in real browsers.
- Add a HappyImage route such as `/settings/newapi` to host the product frame, loading NewAPI in an iframe or opening it in a focused embedded page.
- Only introduce a reverse-proxied management path such as `https://image.happy-token.cn/newapi/...` if implementation verifies that NewAPI assets, API calls, redirects, OAuth callback, and session cookies all work correctly under that path.

This keeps the chosen "embedded management in HappyImage" experience while avoiding unnecessary path rewriting risk. Because all involved hosts are under `happy-token.cn`, direct same-site iframe embedding may be sufficient.

## Architecture

Casdoor is the only normal user login provider. HappyImage should remove local password login and user registration from the product UI. Casdoor becomes the source of identity for OIDC, Telegram, Discord, and future login methods.

NewAPI owns:

- Model gateway routing.
- User quotas and billing.
- API tokens.
- Token usage logs and audit.
- Advanced token management UI.

HappyImage owns:

- Image creation product experience.
- Local user profile needed for HappyImage.
- Image history, conversations, private image records, and product preferences.
- Automatic binding to NewAPI token configuration.

PostgreSQL remains the shared platform database layer in HappyServices. Redis and object storage stay platform infrastructure concerns and are not required for the first HappyImage login/key-binding spec.

## Components

### Casdoor-Only Login

HappyImage frontend should show one primary login action: "Use Happy Token Login" or equivalent.

Local password login and local registration should not be visible to normal users. Backend routes can be disabled by configuration where possible. Any emergency admin access should be documented as an operational path, not presented in the public login UI.

HappyImage should use Casdoor `sub` as the stable identity key:

- `auth_provider`: `casdoor`
- `auth_subject`: Casdoor `sub`
- `email`: copied from OIDC claims when present
- `name`: copied from display name, preferred username, or email prefix

### NewAPI Binding Service

Add a backend service responsible for idempotent NewAPI binding.

The service should:

- Accept a HappyImage user identity after OIDC login.
- Use Casdoor `sub` as the cross-system user key.
- Ensure a matching NewAPI user exists.
- Ensure a default NewAPI token exists for HappyImage.
- Store the NewAPI gateway base URL and token into HappyImage's selected `model_providers`.
- Return a public status to the frontend without exposing secrets unnecessarily.

Suggested default provider record:

```json
{
  "id": "newapi-default",
  "type": "newapi",
  "base_url": "https://gateway.happy-token.cn",
  "api_key": "<newapi-user-token>",
  "selected": true
}
```

The token display name in NewAPI should be stable, for example `HappyImage Default`, so repeated login does not create duplicate tokens.

### NewAPI Management Page

HappyImage should add an advanced configuration entry that opens the same-site NewAPI management surface.

Preferred HappyImage product route:

```text
https://image.happy-token.cn/settings/newapi
```

That route should embed or launch the NewAPI management UI from:

```text
https://gateway.happy-token.cn
```

The model API base URL remains:

```text
https://gateway.happy-token.cn/v1
```

The embedded management page should be treated as a full NewAPI experience, not a reimplementation. HappyImage should not rebuild quota, billing, usage, or token CRUD UI unless a small fallback page is needed for errors.

If direct iframe embedding fails during verification, the fallback design is a Caddy-managed reverse proxy path. That fallback must explicitly solve NewAPI's OAuth callback and session-cookie host/path behavior before it is accepted.

## Data Flow

### Login

1. User opens HappyImage.
2. User clicks Casdoor login.
3. HappyImage starts OIDC and redirects to Casdoor.
4. Casdoor authenticates the user.
5. Casdoor redirects back to HappyImage.
6. HappyImage validates OIDC and reads `sub`, `email`, and `name`.
7. HappyImage creates or updates its local user by `auth_provider=casdoor` and `auth_subject=<sub>`.
8. HappyImage runs NewAPI binding ensure.
9. HappyImage returns a session with NewAPI provider status.
10. User enters the image workspace without manually configuring an API key.

### NewAPI Binding Ensure

1. Locate the NewAPI user mapped to Casdoor `sub`.
2. If the NewAPI user does not exist, create or trigger creation of that NewAPI user.
3. Look for a token named `HappyImage Default` owned by that NewAPI user.
4. If the token does not exist, create it.
5. Write the token and gateway URL into HappyImage's selected model provider config.
6. Mark the user session as `model_gateway_enabled=true` and `model_api_key_configured=true`.

Open implementation question:

NewAPI public docs show token creation under user permission. If there is no official admin "create token for user" API, implementation must choose one of these safe paths:

- Use NewAPI's OIDC/session path so the token is created as the user.
- Add a small internal NewAPI-side sync endpoint protected by an internal secret and Caddy/network policy.
- As a last resort, use a direct database integration only after confirming NewAPI schema stability and migration risk.

The design preference is an API/session-based path over direct database writes.

### Advanced Management

1. User opens HappyImage account/settings.
2. User clicks NewAPI management.
3. HappyImage loads `https://gateway.happy-token.cn` in the NewAPI management frame, or opens the same page in a focused embedded browser view.
4. NewAPI uses Casdoor/OIDC session to show the user's own token management page.
5. If direct embedding fails, HappyImage falls back to a new-window NewAPI link while implementation evaluates a full reverse-proxy route.

If the embedded page cannot load, HappyImage should show an error state with a fallback link to open NewAPI in a new tab.

## Error Handling

If Casdoor OIDC returns no `sub`, login fails. The user should see a configuration error because `sub` is the required stable identity key.

If Casdoor/NewAPI userinfo returns no `email`, NewAPI OIDC may fail because current NewAPI OIDC source requires both `sub` and `email`. This must be validated during deployment setup.

If NewAPI binding fails after HappyImage login succeeds:

- Do not block login.
- Mark binding status as failed or pending.
- Do not attempt image generation with an empty key.
- Show a clear workspace message: "NewAPI default token was not created. Retry or open NewAPI management."
- Log the backend failure with redacted secrets.

If NewAPI management embedding fails:

- Show a local HappyImage error state.
- Provide an "Open NewAPI in a new window" fallback.
- Keep the user's HappyImage session intact.

No NewAPI management keys, user tokens, OIDC secrets, or session cookies should be written to frontend logs or backend plain logs.

## Deployment Configuration

HappyServices should document the actual running services and target relationships.

Required configuration checks:

- Casdoor issuer: `https://auth.happy-token.cn`
- Casdoor discovery: `https://auth.happy-token.cn/.well-known/openid-configuration`
- Required scopes: `openid profile email`
- NewAPI server address: `https://gateway.happy-token.cn`
- NewAPI OIDC callback: `https://gateway.happy-token.cn/oauth/oidc`
- HappyImage public base URL: `https://image.happy-token.cn`
- HappyImage OIDC callback: `https://image.happy-token.cn/api/auth/oidc/callback`
- HappyImage NewAPI management route: `https://image.happy-token.cn/settings/newapi`
- NewAPI management origin: `https://gateway.happy-token.cn`

Caddy should continue to be the public routing point. Child services should not expose public ports directly.

## Documentation Deliverables

Add or update project documentation with:

- HappyServices server architecture overview.
- Service table for Caddy, Casdoor, NewAPI, HappyImage API/Web, PostgreSQL, Redis, sub2api, chatgpt2api, Umami, and Mihomo.
- Public domains and internal Docker service names.
- Request boundary:
  - `image.happy-token.cn/api/*` and `/images/*` -> HappyImage API.
  - `image.happy-token.cn/settings/newapi` -> HappyImage-hosted NewAPI management container.
  - `gateway.happy-token.cn/v1/*` -> NewAPI model gateway.
  - `gateway.happy-token.cn/*` -> NewAPI management UI and APIs.
  - `auth.happy-token.cn/*` -> Casdoor.
- Login and token binding sequence.
- Operational checks and known risks.

## Testing

Backend tests should cover:

- OIDC user creation by Casdoor `sub`.
- Existing OIDC user reuse.
- NewAPI binding idempotency.
- Existing default token reuse.
- Binding failure does not destroy login.
- Public session response reports configured provider without leaking the token.

Frontend tests should cover:

- Login page only shows Casdoor login.
- Local registration/password login is not shown.
- Post-login session stores the NewAPI provider.
- Image workspace refuses generation when binding is pending or failed.
- NewAPI management entry renders and has a fallback error state.

Deployment verification should cover:

- Casdoor discovery and claims include `sub` and `email`.
- NewAPI `/api/status` shows OIDC enabled and expected server address.
- NewAPI OIDC callback works.
- Same-site NewAPI management frame loads.
- NewAPI session survives iframe navigation in Chrome and Safari.
- Browser cookie/frame behavior works in Chrome and Safari.
- Image generation uses the per-user NewAPI token, not a shared HappyImage token.

## Out of Scope

- HappyImage billing or quota accounting.
- Reimplementing NewAPI's token management UI.
- Replacing NewAPI channel/model management.
- Redis or object storage changes unless required by deployment.
- Supporting local HappyImage password registration for normal users.

## Risks

NewAPI token creation for another user may not be available through a stable public admin API. This must be verified before implementation. If unavailable, the implementation should prefer an internal NewAPI extension or session-based user token creation over direct database writes.

NewAPI's current `SameSite=Strict` session cookie must be tested in the embedded management flow. The current domain layout is same-site under `happy-token.cn`, so it may work directly, but browser validation is still required.

Reverse-proxying a full frontend app under a subpath may require path rewriting for assets, API calls, redirects, OAuth callback URLs, and cookie host/path behavior. Do not choose `/newapi` proxying unless those are proven in implementation.

Casdoor and NewAPI must agree on OIDC claims. NewAPI requires `sub` and `email` from userinfo; Casdoor configuration must ensure both are returned.

## Approval Record

User choices during brainstorming:

- HappyImage should fully switch to Casdoor login for normal users.
- Use one NewAPI default token per Casdoor user.
- HappyImage should not do billing or quota accounting.
- Use Casdoor `sub` as the stable cross-system user ID.
- Embed NewAPI management UI in HappyImage.
- Require no-touch SSO for the embedded NewAPI management page.
- Choose same-site embedding for NewAPI management, with direct `gateway.happy-token.cn` embedding preferred after validation and `/newapi` proxying only as a verified fallback.
