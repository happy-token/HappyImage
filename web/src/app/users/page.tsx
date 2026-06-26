"use client";

import { LoaderCircle, UsersRound } from "lucide-react";

import { useAuthGuard } from "@/lib/use-auth-guard";

import { UserKeysCard } from "../settings/components/user-keys-card";

function UsersPageContent() {
  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">Users</div>
          <h1 className="text-2xl font-semibold tracking-tight">用户管理</h1>
          <p className="text-sm text-zinc-500">为团队成员注册专用用户，并统一管理登录与启用状态。</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/80 px-4 py-3 text-sm text-zinc-600 shadow-sm">
          <UsersRound className="size-4 text-zinc-500" />
          用户仅可访问画图工作区，不能进入号池、日志和系统设置。
        </div>
      </div>

      <UserKeysCard standalone />
    </section>
  );
}

export default function UsersPage() {
  const { isCheckingAuth, session } = useAuthGuard(["admin"]);

  if (isCheckingAuth || !session || session.role !== "admin") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return <UsersPageContent />;
}
