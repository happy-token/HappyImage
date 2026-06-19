"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { HeaderActions } from "@/components/header-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { loginWithAccessKey, loginWithPassword, registerWithPassword, startOIDCLogin, type LoginResponse } from "@/lib/api";
import { useRedirectIfAuthenticated } from "@/lib/use-auth-guard";
import { cn } from "@/lib/utils";
import {
  getDefaultRouteForRole,
  normalizePostAuthRedirectPath,
  setStoredAuthSession,
  type StoredAuthSession,
} from "@/store/auth";

type LoginMode = "password" | "register" | "access_key";

function getNextPathFromLocation() {
  if (typeof window === "undefined") {
    return "";
  }
  return normalizePostAuthRedirectPath(new URLSearchParams(window.location.search).get("next"));
}

function buildStoredSession(response: LoginResponse, fallbackKey: string): StoredAuthSession {
  return {
    key: "",
    role: response.user?.role || response.role,
    subjectId: response.user?.id || response.subject_id,
    name: response.user?.name || response.name,
    imageQuota: response.user?.image_quota ?? response.image_quota ?? null,
  };
}

function LoginFieldIcon({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-stone-400">
      {children}
    </span>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("admin");
  const [password, setPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [authKey, setAuthKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isCheckingAuth } = useRedirectIfAuthenticated();

  const title = useMemo(() => {
    if (mode === "register") {
      return "注册 HappyImage";
    }
    return mode === "password" ? "登录 HappyImage" : "使用访问密钥登录";
  }, [mode]);

  const description = useMemo(() => {
    if (mode === "register") {
      return "创建普通用户账号，注册完成后可直接进入创作工作区。";
    }
    return mode === "password"
      ? "使用 HappyImage 账户进入 Studio，管理创作、图库和历史会话。"
      : "使用服务访问密钥进入工作区，兼容当前部署方式。";
  }, [mode]);

  const finishLogin = async (data: LoginResponse, fallbackKey: string) => {
    const session = buildStoredSession(data, fallbackKey);
    await setStoredAuthSession(session);
    router.replace(getNextPathFromLocation() || getDefaultRouteForRole(session.role));
  };

  const handlePasswordLogin = async () => {
    const normalizedEmail = email.trim();
    const normalizedPassword = password.trim();
    if (!normalizedEmail || !normalizedPassword) {
      toast.error("请输入账号和密码");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await loginWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      });
      await finishLogin(data, data.access_token || normalizedPassword);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccessKeyLogin = async () => {
    const normalizedAuthKey = authKey.trim();
    if (!normalizedAuthKey) {
      toast.error("请输入访问密钥");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await loginWithAccessKey(normalizedAuthKey);
      await finishLogin(data, data.access_token || normalizedAuthKey);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    const normalizedName = registerName.trim();
    const normalizedPassword = registerPassword.trim();
    const normalizedConfirmPassword = registerConfirmPassword.trim();
    if (!normalizedName || !normalizedPassword || !normalizedConfirmPassword) {
      toast.error("请输入账号名称和密码");
      return;
    }
    if (normalizedPassword !== normalizedConfirmPassword) {
      toast.error("两次输入的密码不一致");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await registerWithPassword({
        name: normalizedName,
        password: normalizedPassword,
        confirmPassword: normalizedConfirmPassword,
      });
      await finishLogin(data, data.access_token || normalizedPassword);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "注册失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOIDCLogin = async () => {
    setIsSubmitting(true);
    try {
      const nextPath = getNextPathFromLocation();
      const data = await startOIDCLogin(nextPath || undefined);
      // Navigate the browser to the OIDC provider's authorize URL
      window.location.href = data.authorize_url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "启动 OIDC 登录失败");
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (mode === "password") {
      void handlePasswordLogin();
      return;
    }
    if (mode === "register") {
      void handleRegister();
      return;
    }
    void handleAccessKeyLogin();
  };

  if (isCheckingAuth) {
    return (
      <div className="grid min-h-[calc(100vh-1rem)] w-full place-items-center px-4 py-6">
        <LoaderCircle className="size-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="grid min-h-[calc(100vh-1rem)] w-full place-items-center px-4 py-6">
      <HeaderActions className="fixed top-4 right-4 z-10" />
      <Card className="w-full max-w-[520px] rounded-[28px] border-white/80 bg-white/95 shadow-[0_28px_90px_rgba(28,25,23,0.10)]">
        <CardContent className="space-y-7 p-6 sm:p-8">
          <div className="space-y-4 text-center">
            <div className="mx-auto inline-flex size-14 items-center justify-center rounded-[18px] bg-stone-950 text-white shadow-sm">
              <LockKeyhole className="size-5" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-normal text-stone-950">{title}</h1>
              <p className="mx-auto max-w-sm text-sm leading-6 text-stone-500">{description}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-lg bg-stone-100 p-1">
            {[
              { value: "password" as const, label: "账号密码" },
              { value: "register" as const, label: "注册账号" },
              { value: "access_key" as const, label: "访问密钥" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                className={cn(
                  "h-9 rounded-md text-sm font-medium transition",
                  mode === item.value
                    ? "bg-white text-stone-950 shadow-sm"
                    : "text-stone-500 hover:text-stone-800",
                )}
                onClick={() => setMode(item.value)}
                disabled={isSubmitting}
              >
                {item.label}
              </button>
            ))}
          </div>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmit();
            }}
          >
            {mode === "password" ? (
              <>
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-stone-700">
                    账号名称
                  </label>
                  <div className="relative">
                    <LoginFieldIcon>
                      <Mail className="size-4" />
                    </LoginFieldIcon>
                    <Input
                      id="email"
                      type="text"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="username"
                      placeholder="请输入账号名称"
                      className="h-12 rounded-lg border-stone-200 bg-white pl-10"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-medium text-stone-700">
                    密码
                  </label>
                  <div className="relative">
                    <LoginFieldIcon>
                      <LockKeyhole className="size-4" />
                    </LoginFieldIcon>
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      placeholder="请输入密码"
                      className="h-12 rounded-lg border-stone-200 bg-white pr-11 pl-10"
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-stone-400 transition hover:text-stone-700"
                      onClick={() => setShowPassword((value) => !value)}
                      disabled={isSubmitting}
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : mode === "register" ? (
              <>
                <div className="space-y-2">
                  <label htmlFor="register-name" className="block text-sm font-medium text-stone-700">
                    账号名称
                  </label>
                  <div className="relative">
                    <LoginFieldIcon>
                      <UserPlus className="size-4" />
                    </LoginFieldIcon>
                    <Input
                      id="register-name"
                      type="text"
                      value={registerName}
                      onChange={(event) => setRegisterName(event.target.value)}
                      autoComplete="username"
                      placeholder="设置账号名称"
                      className="h-12 rounded-lg border-stone-200 bg-white pl-10"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="register-password" className="block text-sm font-medium text-stone-700">
                    密码
                  </label>
                  <div className="relative">
                    <LoginFieldIcon>
                      <LockKeyhole className="size-4" />
                    </LoginFieldIcon>
                    <Input
                      id="register-password"
                      type={showRegisterPassword ? "text" : "password"}
                      value={registerPassword}
                      onChange={(event) => setRegisterPassword(event.target.value)}
                      autoComplete="new-password"
                      placeholder="至少 6 个字符"
                      className="h-12 rounded-lg border-stone-200 bg-white pr-11 pl-10"
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-stone-400 transition hover:text-stone-700"
                      onClick={() => setShowRegisterPassword((value) => !value)}
                      disabled={isSubmitting}
                      aria-label={showRegisterPassword ? "隐藏密码" : "显示密码"}
                    >
                      {showRegisterPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="register-confirm-password" className="block text-sm font-medium text-stone-700">
                    确认密码
                  </label>
                  <div className="relative">
                    <LoginFieldIcon>
                      <LockKeyhole className="size-4" />
                    </LoginFieldIcon>
                    <Input
                      id="register-confirm-password"
                      type={showRegisterPassword ? "text" : "password"}
                      value={registerConfirmPassword}
                      onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      placeholder="再次输入密码"
                      className="h-12 rounded-lg border-stone-200 bg-white pl-10"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label htmlFor="auth-key" className="block text-sm font-medium text-stone-700">
                  访问密钥
                </label>
                <div className="relative">
                  <LoginFieldIcon>
                    <KeyRound className="size-4" />
                  </LoginFieldIcon>
                  <Input
                    id="auth-key"
                    type="password"
                    value={authKey}
                    onChange={(event) => setAuthKey(event.target.value)}
                    autoComplete="current-password"
                    placeholder="请输入访问密钥"
                    className="h-12 rounded-lg border-stone-200 bg-white pl-10"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="h-12 w-full rounded-lg bg-stone-950 text-white hover:bg-stone-800"
              disabled={isSubmitting}
            >
              {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {mode === "register" ? "注册并进入" : "登录"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-stone-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-stone-400">或</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-lg border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
              disabled={isSubmitting}
              onClick={() => void handleOIDCLogin()}
            >
              <svg className="mr-2 size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              通过 OIDC 单点登录
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
