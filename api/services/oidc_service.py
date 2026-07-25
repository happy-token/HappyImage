"""Generic OpenID Connect provider service for Happy Token user login.

Handles OIDC discovery, PKCE authorize URL construction, token exchange,
id_token claim validation, and userinfo retrieval. This service is for
Happy Token web user login — it is separate from the OpenAI account OAuth
import flow.
"""

from __future__ import annotations

import secrets
import threading
import time
import uuid
from typing import Any
from urllib.parse import urlencode

import jwt
from jwt import InvalidTokenError, PyJWK

from services.config import config


class OIDCError(Exception):
    """Expected error during OIDC login flow. Translated to 400 by the API layer."""


class OIDCService:
    """Manages OIDC login transactions and provider communication."""

    _TRANSACTION_TTL_SECONDS = 10 * 60  # user has 10 min to complete login
    _MAX_TRANSACTIONS = 128
    _DISCOVERY_CACHE_TTL_SECONDS = 3600  # cache discovery doc for 1 hour
    _JWKS_CACHE_TTL_SECONDS = 3600
    _ALLOWED_ID_TOKEN_ALGORITHMS = ("RS256",)

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._transactions: dict[str, dict[str, Any]] = {}
        self._discovery_cache: tuple[dict[str, Any], float] | None = None
        self._jwks_cache: tuple[dict[str, Any], float] | None = None

    # ------------------------------------------------------------------
    # Configuration helpers
    # ------------------------------------------------------------------

    @staticmethod
    def is_enabled() -> bool:
        settings = config.get_oidc_settings()
        return bool(settings.get("enabled"))

    @staticmethod
    def _oidc_settings() -> dict[str, object]:
        if not OIDCService.is_enabled():
            raise OIDCError("OIDC 登录尚未启用")
        settings = config.get_oidc_settings()
        issuer = str(settings.get("issuer") or "").strip()
        client_id = str(settings.get("client_id") or "").strip()
        client_secret = str(settings.get("client_secret") or "").strip()
        if not issuer or not client_id or not client_secret:
            raise OIDCError("OIDC 配置不完整，请检查 issuer、client_id、client_secret")
        return settings

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    def _fetch_discovery(self) -> dict[str, Any]:
        """Fetch and cache the OIDC discovery document."""
        settings = self._oidc_settings()
        issuer = str(settings.get("issuer") or "").strip()

        with self._lock:
            cached = self._discovery_cache
        if cached and (time.time() - cached[1]) < self._DISCOVERY_CACHE_TTL_SECONDS:
            return cached[0]

        from curl_cffi import requests
        from services.proxy_service import proxy_settings

        discovery_url = f"{issuer}/.well-known/openid-configuration"
        kwargs = proxy_settings.build_session_kwargs(impersonate="chrome", verify=True)
        session = requests.Session(**kwargs)
        try:
            resp = session.get(discovery_url, timeout=15)
            if resp.status_code != 200:
                raise OIDCError(
                    f"无法获取 OIDC 发现文档 (HTTP {resp.status_code}): {discovery_url}"
                )
            doc = resp.json()
            if not isinstance(doc, dict):
                raise OIDCError("OIDC 发现文档格式异常")
        except OIDCError:
            raise
        except Exception as exc:
            raise OIDCError(f"获取 OIDC 发现文档失败: {exc}") from exc
        finally:
            session.close()

        with self._lock:
            self._discovery_cache = (doc, time.time())
        return doc

    def _get_provider_endpoint(self, key: str) -> str:
        doc = self._fetch_discovery()
        url = str(doc.get(key) or "").strip()
        if not url:
            raise OIDCError(f"OIDC 提供方未声明 {key} 端点")
        return url

    def _get_optional_provider_endpoint(self, key: str) -> str:
        try:
            doc = self._fetch_discovery()
        except OIDCError:
            return ""
        return str(doc.get(key) or "").strip()

    # ------------------------------------------------------------------
    # PKCE helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _generate_pkce() -> tuple[str, str]:
        from utils.pkce import generate_pkce
        return generate_pkce()

    # ------------------------------------------------------------------
    # Transaction management
    # ------------------------------------------------------------------

    def _purge_expired_locked(self) -> None:
        now = time.time()
        expired = [
            tid for tid, txn in self._transactions.items()
            if now - txn["created_at"] > self._TRANSACTION_TTL_SECONDS
        ]
        for tid in expired:
            self._transactions.pop(tid, None)
        if len(self._transactions) > self._MAX_TRANSACTIONS:
            ordered = sorted(
                self._transactions.items(), key=lambda kv: kv[1]["created_at"]
            )
            for tid, _ in ordered[: len(self._transactions) - self._MAX_TRANSACTIONS]:
                self._transactions.pop(tid, None)

    # ------------------------------------------------------------------
    # Authorize URL
    # ------------------------------------------------------------------

    def build_authorize_url(self, next_path: str = "", api_base_url: str = "") -> dict[str, str]:
        """Create a PKCE login transaction and return the authorize URL.

        The frontend calls this to get a URL the user's browser should
        navigate to for OIDC authentication.
        """
        settings = self._oidc_settings()
        authorize_endpoint = self._get_provider_endpoint("authorization_endpoint")

        verifier, challenge = self._generate_pkce()
        nonce = secrets.token_urlsafe(32)
        transaction_id = uuid.uuid4().hex
        state = f"{transaction_id}.{secrets.token_urlsafe(16)}"

        scopes = str(settings.get("scopes") or "openid profile email").strip()
        client_id = str(settings.get("client_id") or "").strip()
        callback_url = self._make_callback_url(api_base_url)

        params = {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": callback_url,
            "scope": scopes,
            "state": state,
            "nonce": nonce,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }

        safe_next = str(next_path or "").strip()
        if safe_next and (not safe_next.startswith("/") or safe_next.startswith("//")):
            safe_next = ""

        authorize_url = f"{authorize_endpoint}?{urlencode(params)}"

        with self._lock:
            self._purge_expired_locked()
            self._transactions[transaction_id] = {
                "code_verifier": verifier,
                "state": state,
                "nonce": nonce,
                "next_path": safe_next,
                "callback_url": callback_url,
                "created_at": time.time(),
            }

        return {
            "authorize_url": authorize_url,
            "transaction_id": transaction_id,
            "expires_in": str(self._TRANSACTION_TTL_SECONDS),
        }

    def build_logout_url(self, post_logout_redirect_uri: str = "") -> str:
        """Return the provider logout URL when discovery exposes one."""
        if not self.is_enabled():
            return ""
        endpoint = self._get_optional_provider_endpoint("end_session_endpoint")
        if not endpoint:
            return ""
        settings = self._oidc_settings()
        redirect_uri = str(
            post_logout_redirect_uri
            or settings.get("post_logout_redirect_uri")
            or ""
        ).strip()
        params = {"client_id": str(settings.get("client_id") or "").strip()}
        if redirect_uri:
            params["post_logout_redirect_uri"] = redirect_uri
        return f"{endpoint}?{urlencode(params)}"

    @staticmethod
    def _make_callback_url(api_base_url: str = "") -> str:
        api_base = str(api_base_url or config.external_api_url or "").strip().rstrip("/")
        if api_base:
            return f"{api_base}/api/auth/oidc/callback"
        return "/api/auth/oidc/callback"

    # ------------------------------------------------------------------
    # Callback processing
    # ------------------------------------------------------------------

    def handle_callback(self, code: str, state: str) -> dict[str, Any]:
        """Process the OIDC callback: validate state, exchange code, extract claims."""
        if not code:
            raise OIDCError("缺少授权码 (code)")
        if not state:
            raise OIDCError("缺少 state 参数")

        transaction_id = state.split(".", 1)[0]
        transaction = self._pop_transaction(transaction_id)
        if transaction is None:
            raise OIDCError(
                "登录会话已过期或不存在，请重新开始登录"
            )

        if state != transaction["state"]:
            raise OIDCError(
                "state 不匹配，可能存在 CSRF 攻击，请重新开始登录"
            )

        settings = self._oidc_settings()
        token_endpoint = self._get_provider_endpoint("token_endpoint")
        callback_url = str(transaction.get("callback_url") or "").strip() or self._make_callback_url()

        token_response = self._exchange_code(
            token_endpoint=token_endpoint,
            code=code,
            code_verifier=transaction["code_verifier"],
            redirect_uri=callback_url,
            client_id=str(settings.get("client_id") or ""),
            client_secret=str(settings.get("client_secret") or ""),
        )

        id_token_raw = str(token_response.get("id_token") or "").strip()
        if not id_token_raw:
            raise OIDCError("OIDC 提供方未返回 id_token")

        claims = self._validate_id_token_claims(
            id_token_raw=id_token_raw,
            client_id=str(settings.get("client_id") or ""),
            issuer=str(settings.get("issuer") or ""),
            nonce=transaction["nonce"],
        )

        # Optionally fetch userinfo for additional claims
        userinfo_claims: dict[str, Any] = {}
        scopes = str(settings.get("scopes") or "")
        if "profile" in scopes or "email" in scopes:
            try:
                userinfo_claims = self._fetch_userinfo(
                    str(token_response.get("access_token") or ""),
                )
            except OIDCError:
                # userinfo is supplementary; don't fail login if it's unavailable
                pass

        token_subject = str(claims.get("sub") or "").strip()
        userinfo_subject = str(userinfo_claims.get("sub") or "").strip()
        if userinfo_subject and userinfo_subject != token_subject:
            raise OIDCError("userinfo 用户与 id_token 用户不一致")

        merged = {**claims, **userinfo_claims}

        # Enforce email domain allowlist
        self._enforce_email_domain(
            email=str(merged.get("email") or "").strip(),
            allowed_domains=str(settings.get("allowed_email_domains") or "").strip(),
        )

        return {
            "sub": str(merged.get("sub") or "").strip(),
            "email": str(merged.get("email") or "").strip(),
            "email_verified": bool(merged.get("email_verified")),
            "name": str(
                merged.get("name")
                or merged.get("preferred_username")
                or merged.get("nickname")
                or merged.get("email", "").split("@")[0]
                or ""
            ).strip(),
            "next_path": transaction.get("next_path", ""),
        }

    # ------------------------------------------------------------------
    # Transaction lifecycle
    # ------------------------------------------------------------------

    def _pop_transaction(self, transaction_id: str) -> dict[str, Any] | None:
        with self._lock:
            self._purge_expired_locked()
            return self._transactions.pop(transaction_id, None)

    # ------------------------------------------------------------------
    # Token exchange
    # ------------------------------------------------------------------

    @staticmethod
    def _exchange_code(
        *,
        token_endpoint: str,
        code: str,
        code_verifier: str,
        redirect_uri: str,
        client_id: str,
        client_secret: str,
    ) -> dict[str, Any]:
        from curl_cffi import requests
        from services.proxy_service import proxy_settings

        kwargs = proxy_settings.build_session_kwargs(impersonate="chrome", verify=True)
        session = requests.Session(**kwargs)
        try:
            resp = session.post(
                token_endpoint,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code_verifier": code_verifier,
                },
                headers={"Accept": "application/json"},
                timeout=30,
            )
        except Exception as exc:
            raise OIDCError(f"换 token 网络异常: {exc}") from exc
        finally:
            session.close()

        try:
            data = resp.json() if resp.text else {}
        except Exception:
            data = {}

        if resp.status_code != 200 or not isinstance(data, dict):
            detail = ""
            if isinstance(data, dict):
                detail = str(
                    data.get("error_description") or data.get("error") or ""
                )
            print(
                f"[oidc] token endpoint rejected: "
                f"status={resp.status_code} detail={detail!r}",
                flush=True,
            )
            raise OIDCError(
                f"OIDC 提供方拒绝换 token (HTTP {resp.status_code})"
                f"{': ' + detail if detail else ''}"
            )

        access_token = str(data.get("access_token") or "").strip()
        if not access_token:
            raise OIDCError("OIDC 提供方未返回 access_token")

        return data

    # ------------------------------------------------------------------
    # ID token signature and claim validation
    # ------------------------------------------------------------------

    def _fetch_jwks(self, *, force_refresh: bool = False) -> dict[str, Any]:
        with self._lock:
            cached = self._jwks_cache
        if (
            not force_refresh
            and cached
            and (time.time() - cached[1]) < self._JWKS_CACHE_TTL_SECONDS
        ):
            return cached[0]

        jwks_uri = self._get_provider_endpoint("jwks_uri")
        from curl_cffi import requests
        from services.proxy_service import proxy_settings

        kwargs = proxy_settings.build_session_kwargs(impersonate="chrome", verify=True)
        session = requests.Session(**kwargs)
        try:
            response = session.get(jwks_uri, timeout=15)
            if response.status_code != 200:
                raise OIDCError(
                    f"无法获取 OIDC 签名密钥 (HTTP {response.status_code})"
                )
            jwks = response.json()
            if not isinstance(jwks, dict) or not isinstance(jwks.get("keys"), list):
                raise OIDCError("OIDC 签名密钥格式异常")
        except OIDCError:
            raise
        except Exception as exc:
            raise OIDCError(f"获取 OIDC 签名密钥失败: {exc}") from exc
        finally:
            session.close()

        with self._lock:
            self._jwks_cache = (jwks, time.time())
        return jwks

    def _find_signing_key(self, *, key_id: str, algorithm: str) -> object:
        for force_refresh in (False, True):
            jwks = self._fetch_jwks(force_refresh=force_refresh)
            for candidate in jwks.get("keys", []):
                if not isinstance(candidate, dict):
                    continue
                if str(candidate.get("kid") or "") != key_id:
                    continue
                if str(candidate.get("kty") or "") != "RSA":
                    continue
                if str(candidate.get("use") or "sig") != "sig":
                    continue
                candidate_alg = str(candidate.get("alg") or algorithm)
                if candidate_alg != algorithm:
                    continue
                try:
                    return PyJWK.from_dict(candidate, algorithm=algorithm).key
                except Exception as exc:
                    raise OIDCError("OIDC 签名密钥无效") from exc
        raise OIDCError("id_token 使用了未知的签名密钥")

    def _validate_id_token_claims(
        self,
        *,
        id_token_raw: str,
        client_id: str,
        issuer: str,
        nonce: str,
    ) -> dict[str, Any]:
        """Verify the ID token signature and required OIDC claims."""
        try:
            header = jwt.get_unverified_header(id_token_raw)
        except InvalidTokenError as exc:
            raise OIDCError("id_token 格式无效") from exc

        algorithm = str(header.get("alg") or "")
        if algorithm not in self._ALLOWED_ID_TOKEN_ALGORITHMS:
            raise OIDCError("id_token 使用了不允许的签名算法")
        key_id = str(header.get("kid") or "").strip()
        if not key_id:
            raise OIDCError("id_token 缺少签名密钥标识")

        signing_key = self._find_signing_key(key_id=key_id, algorithm=algorithm)
        try:
            claims = jwt.decode(
                id_token_raw,
                key=signing_key,
                algorithms=list(self._ALLOWED_ID_TOKEN_ALGORITHMS),
                audience=client_id,
                issuer=issuer,
                leeway=30,
                options={
                    "require": ["aud", "exp", "iat", "iss", "sub"],
                },
            )
        except InvalidTokenError as exc:
            raise OIDCError("id_token 签名或声明验证失败") from exc
        if not isinstance(claims, dict):
            raise OIDCError("id_token payload 格式异常")

        token_nonce = str(claims.get("nonce") or "").strip()
        if not token_nonce or token_nonce != nonce:
            raise OIDCError("id_token nonce 不匹配")

        iat = claims.get("iat")
        if not isinstance(iat, (int, float)) or time.time() > iat + 600:
            raise OIDCError("id_token 签发时间过早")
        if not str(claims.get("sub") or "").strip():
            raise OIDCError("id_token 缺少用户标识")

        return claims

    # ------------------------------------------------------------------
    # Userinfo
    # ------------------------------------------------------------------

    def _fetch_userinfo(self, access_token: str) -> dict[str, Any]:
        if not access_token:
            return {}
        userinfo_endpoint = self._get_provider_endpoint("userinfo_endpoint")

        from curl_cffi import requests
        from services.proxy_service import proxy_settings

        kwargs = proxy_settings.build_session_kwargs(impersonate="chrome", verify=True)
        session = requests.Session(**kwargs)
        try:
            resp = session.get(
                userinfo_endpoint,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=15,
            )
            if resp.status_code != 200:
                raise OIDCError(f"userinfo 请求失败 (HTTP {resp.status_code})")
            data = resp.json()
            if not isinstance(data, dict):
                raise OIDCError("userinfo 响应格式异常")
            return data
        except OIDCError:
            raise
        except Exception as exc:
            raise OIDCError(f"获取 userinfo 失败: {exc}") from exc
        finally:
            session.close()

    # ------------------------------------------------------------------
    # Email domain enforcement
    # ------------------------------------------------------------------

    @staticmethod
    def _enforce_email_domain(*, email: str, allowed_domains: str) -> None:
        if not allowed_domains:
            return
        if not email:
            raise OIDCError(
                "OIDC 提供方未返回邮箱地址，但已配置允许的邮箱域名，登录被拒绝"
            )
        domain_part = email.split("@")[-1].strip().lower()
        allowed = [
            d.strip().lower()
            for d in allowed_domains.split(",")
            if d.strip()
        ]
        if domain_part not in allowed:
            raise OIDCError(
                f"邮箱域名 @{domain_part} 不在允许列表中，请使用允许的邮箱登录"
            )


oidc_service = OIDCService()
