"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, RefreshCw, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchUserKeys, fetchUserQuotaLogs, type UserKey, type UserQuotaLog } from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";

import { UserKeysCard } from "../settings/components/user-keys-card";

function actionLabel(action?: string) {
  switch (action) {
    case "admin_enable":
    case "enable":
      return "启用";
    case "admin_disable":
    case "disable":
      return "禁用";
    case "admin_delete":
    case "delete":
      return "删除";
    case "admin_recharge":
    case "recharge":
      return "充值";
    case "consume":
      return "消费";
    case "refund":
      return "返还";
    case "admin_create":
    case "create":
      return "创建";
    case "admin_update":
    case "adjust":
      return "调整";
    default:
      return "变更";
  }
}

function amountLabel(log: UserQuotaLog) {
  const amount = log.detail?.amount;
  if (typeof amount !== "number") {
    return "—";
  }
  return amount > 0 ? `+${amount}` : String(amount);
}

function UsersPageContent() {
  const [logs, setLogs] = useState<UserQuotaLog[]>([]);
  const [users, setUsers] = useState<UserKey[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  const loadQuotaLogs = async (userId = selectedUserId) => {
    setIsLoadingLogs(true);
    try {
      const [usersData, logsData] = await Promise.all([
        fetchUserKeys(),
        fetchUserQuotaLogs({ user_id: userId === "all" ? "" : userId, limit: 100 }),
      ]);
      setUsers(usersData.items);
      setLogs(logsData.items);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    void loadQuotaLogs(selectedUserId);
  }, [selectedUserId]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">Users</div>
          <h1 className="text-2xl font-semibold tracking-tight">用户管理</h1>
          <p className="text-sm text-stone-500">
            为团队成员注册专用用户，分配或充值图片额度，并统一管理启用状态。
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm text-stone-600 shadow-sm">
          <UsersRound className="size-4 text-stone-500" />
          用户仅可访问画图工作区，不能进入号池、日志和系统设置。
        </div>
      </div>

      <UserKeysCard standalone />

      <Card className="overflow-hidden rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardContent className="space-y-5 p-0">
          <div className="flex flex-col gap-3 border-b border-stone-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">额度明细</h2>
              <p className="text-sm text-stone-500">查看用户的创建、充值、消费和失败返还记录。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="h-10 w-[220px] rounded-xl border-stone-200 bg-white">
                  <SelectValue placeholder="筛选用户" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部用户</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="h-10 rounded-xl border-stone-200 bg-white px-4 text-stone-700"
                onClick={() => void loadQuotaLogs(selectedUserId)}
                disabled={isLoadingLogs}
              >
                <RefreshCw className={`size-4 ${isLoadingLogs ? "animate-spin" : ""}`} />
                刷新
              </Button>
            </div>
          </div>

          {isLoadingLogs ? (
            <div className="flex items-center justify-center py-12">
              <LoaderCircle className="size-5 animate-spin text-stone-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-stone-500">还没有额度动态。</div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[880px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>动作</TableHead>
                    <TableHead>变动</TableHead>
                    <TableHead>变动前</TableHead>
                    <TableHead>变动后</TableHead>
                    <TableHead>操作人</TableHead>
                    <TableHead>说明</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="text-stone-600">
                      <TableCell className="whitespace-nowrap">{log.time}</TableCell>
                      <TableCell>{log.detail?.user_name || "—"}</TableCell>
                      <TableCell>{actionLabel(log.detail?.action)}</TableCell>
                      <TableCell>{amountLabel(log)}</TableCell>
                      <TableCell>{typeof log.detail?.before_quota === "number" ? log.detail.before_quota : "—"}</TableCell>
                      <TableCell>{typeof log.detail?.after_quota === "number" ? log.detail.after_quota : "—"}</TableCell>
                      <TableCell>{log.detail?.operator_name || "系统"}</TableCell>
                      <TableCell>{log.summary || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export default function UsersPage() {
  const { isCheckingAuth, session } = useAuthGuard(["admin"]);

  if (isCheckingAuth || !session || session.role !== "admin") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return <UsersPageContent />;
}
