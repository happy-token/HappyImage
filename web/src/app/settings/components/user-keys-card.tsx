"use client";

import { useEffect, useRef, useState } from "react";
import { Ban, CheckCircle2, Copy, KeyRound, LoaderCircle, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createUserKeyWithOptions, deleteUserKey, fetchUserKeys, updateUserKey, type UserKey } from "@/lib/api";

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

type UserKeysCardProps = {
  standalone?: boolean;
};

export function UserKeysCard({ standalone = false }: UserKeysCardProps) {
  const didLoadRef = useRef(false);
  const [items, setItems] = useState<UserKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [revealedKey, setRevealedKey] = useState("");
  const [deletingItem, setDeletingItem] = useState<UserKey | null>(null);
  const [editingItem, setEditingItem] = useState<UserKey | null>(null);
  const [editName, setEditName] = useState("");
  const [editKey, setEditKey] = useState("");

  const totalUsers = items.length;
  const enabledUsers = items.filter((item) => item.enabled).length;

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUserKeys();
      setItems(data.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载用户失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (didLoadRef.current) {
      return;
    }
    didLoadRef.current = true;
    void load();
  }, []);

  const setItemPending = (id: string, isPending: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (isPending) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const data = await createUserKeyWithOptions({
        name: name.trim(),
        key: customKey.trim(),
      });
      setItems(data.items);
      setRevealedKey(data.key);
      setName("");
      setCustomKey("");
      setIsDialogOpen(false);
      toast.success("用户已创建");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建用户失败");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (item: UserKey) => {
    setItemPending(item.id, true);
    try {
      const data = await updateUserKey(item.id, { enabled: !item.enabled });
      setItems(data.items);
      toast.success(item.enabled ? "用户已禁用" : "用户已启用");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新用户失败");
    } finally {
      setItemPending(item.id, false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) {
      return;
    }
    const item = deletingItem;
    setItemPending(item.id, true);
    try {
      const data = await deleteUserKey(item.id);
      setItems(data.items);
      setDeletingItem(null);
      toast.success("用户已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除用户失败");
    } finally {
      setItemPending(item.id, false);
    }
  };

  const openEditDialog = (item: UserKey) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditKey("");
  };

  const handleEdit = async () => {
    if (!editingItem) {
      return;
    }
    const item = editingItem;
    const trimmedName = editName.trim();
    const trimmedKey = editKey.trim();
    if (trimmedName === item.name && !trimmedKey) {
      setEditingItem(null);
      return;
    }
    setItemPending(item.id, true);
    try {
      const data = await updateUserKey(item.id, {
        ...(trimmedName !== item.name ? { name: trimmedName } : {}),
        ...(trimmedKey ? { key: trimmedKey } : {}),
      });
      setItems(data.items);
      setEditingItem(null);
      setEditKey("");
      toast.success("用户信息已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新用户失败");
    } finally {
      setItemPending(item.id, false);
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  return (
    <>
      <Card className="overflow-hidden rounded-xl border-white/80 bg-white/90 shadow-sm">
        <CardContent className="space-y-6 p-6">
          {standalone ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
                  <UsersRound className="size-3.5" />
                  Users
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900">{totalUsers}</div>
                <div className="mt-1 text-sm text-zinc-500">已注册普通用户</div>
              </div>
              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
                  <CheckCircle2 className="size-3.5" />
                  Active
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900">{enabledUsers}</div>
                <div className="mt-1 text-sm text-zinc-500">当前可用账号</div>
              </div>
            </div>
          ) : null}

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-zinc-100">
                <KeyRound className="size-5 text-zinc-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">用户管理</h2>
                <p className="text-sm text-zinc-500">创建普通用户、设置登录密钥，并统一管理启用状态。</p>
              </div>
            </div>
            <Button className="h-9 rounded-xl bg-zinc-950 px-4 text-white hover:bg-zinc-800" onClick={() => setIsDialogOpen(true)}>
              <Plus className="size-4" />
              新建用户
            </Button>
          </div>

          {revealedKey ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
              <div className="font-medium">登录密钥仅展示一次，请立即保存：</div>
              <div className="mt-3 flex flex-col gap-3 rounded-lg border border-emerald-200 bg-white/80 p-3 md:flex-row md:items-center md:justify-between">
                <code className="break-all font-mono text-[13px]">{revealedKey}</code>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl border-emerald-200 bg-white px-4 text-emerald-700"
                  onClick={() => void handleCopy(revealedKey)}
                >
                  <Copy className="size-4" />
                  复制
                </Button>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <LoaderCircle className="size-5 animate-spin text-zinc-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl bg-zinc-50 px-6 py-10 text-center text-sm text-zinc-500">
              暂无普通用户。点击右上角按钮后即可创建账号。
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const isPending = pendingIds.has(item.id);
                return (
                  <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-medium text-zinc-800">{item.name}</div>
                        <Badge variant={item.enabled ? "success" : "secondary"} className="rounded-md">
                          {item.enabled ? "已启用" : "已禁用"}
                        </Badge>
                        <Badge variant={item.watermark_unlocked ? "success" : "secondary"} className="rounded-md">
                          {item.watermark_unlocked ? "无水印已解锁" : "下载需水印"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                        <span>登录账号 {item.name}</span>
                        <span>创建时间 {formatDateTime(item.created_at)}</span>
                        <span>最近使用 {formatDateTime(item.last_used_at)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-xl border-zinc-200 bg-white px-4 text-zinc-700"
                        onClick={() => openEditDialog(item)}
                        disabled={isPending}
                      >
                        {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Pencil className="size-4" />}
                        编辑
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-xl border-zinc-200 bg-white px-4 text-zinc-700"
                        onClick={() => void handleToggle(item)}
                        disabled={isPending}
                      >
                        {isPending ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : item.enabled ? (
                          <Ban className="size-4" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        {item.enabled ? "禁用" : "启用"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-xl border-rose-200 bg-white px-4 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => setDeletingItem(item)}
                        disabled={isPending}
                      >
                        {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                        删除
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-xl p-6">
          <DialogHeader className="gap-2">
            <DialogTitle>创建用户</DialogTitle>
            <DialogDescription className="text-sm leading-6">
              填写用户名称。若不手填登录密钥，系统会自动生成一条只能查看一次的密钥。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">用户名称</label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：设计同学 A、运营临时账号"
                className="h-11 rounded-xl border-zinc-200 bg-white"
              />
              <p className="text-xs leading-5 text-zinc-500">用户可使用这个名称作为登录账号。</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">登录密钥（可选）</label>
              <Input
                value={customKey}
                onChange={(event) => setCustomKey(event.target.value)}
                placeholder="留空则自动生成，例如：sk-your-custom-user-key"
                className="h-11 rounded-xl border-zinc-200 bg-white font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-xl bg-zinc-100 px-5 text-zinc-700 hover:bg-zinc-200"
              onClick={() => {
                setIsDialogOpen(false);
                setCustomKey("");
              }}
              disabled={isCreating}
            >
              取消
            </Button>
            <Button
              type="button"
              className="h-10 rounded-xl bg-zinc-950 px-5 text-white hover:bg-zinc-800"
              onClick={() => void handleCreate()}
              disabled={isCreating}
            >
              {isCreating ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
              创建用户
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingItem)} onOpenChange={(open) => (!open ? setDeletingItem(null) : null)}>
        <DialogContent className="rounded-xl p-6">
          <DialogHeader className="gap-2">
            <DialogTitle>删除用户</DialogTitle>
            <DialogDescription className="text-sm leading-6">
              确认删除用户「{deletingItem?.name}」吗？删除后该账号将无法继续登录和调用接口。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-xl bg-zinc-100 px-5 text-zinc-700 hover:bg-zinc-200"
              onClick={() => setDeletingItem(null)}
              disabled={deletingItem ? pendingIds.has(deletingItem.id) : false}
            >
              取消
            </Button>
            <Button
              type="button"
              className="h-10 rounded-xl bg-rose-600 px-5 text-white hover:bg-rose-700"
              onClick={() => void handleDelete()}
              disabled={deletingItem ? pendingIds.has(deletingItem.id) : false}
            >
              {deletingItem && pendingIds.has(deletingItem.id) ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null);
            setEditKey("");
          }
        }}
      >
        <DialogContent className="rounded-xl p-6">
          <DialogHeader className="gap-2">
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription className="text-sm leading-6">
              可以修改用户名称和登录密钥。登录密钥留空则保持不变。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">名称</label>
              <Input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder="例如：设计同学 A、运营临时账号"
                className="h-11 rounded-xl border-zinc-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">新的登录密钥（可选）</label>
              <Input
                value={editKey}
                onChange={(event) => setEditKey(event.target.value)}
                placeholder="例如：sk-your-custom-user-key"
                className="h-11 rounded-xl border-zinc-200 bg-white font-mono"
              />
              <p className="text-xs leading-5 text-zinc-500">
                保存后旧密钥会立即失效，新密钥生效。系统仍只保存哈希，不会回显当前密钥。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-xl bg-zinc-100 px-5 text-zinc-700 hover:bg-zinc-200"
              onClick={() => {
                setEditingItem(null);
                setEditKey("");
              }}
              disabled={editingItem ? pendingIds.has(editingItem.id) : false}
            >
              取消
            </Button>
            <Button
              type="button"
              className="h-10 rounded-xl bg-zinc-950 px-5 text-white hover:bg-zinc-800"
              onClick={() => void handleEdit()}
              disabled={editingItem ? pendingIds.has(editingItem.id) : false}
            >
              {editingItem && pendingIds.has(editingItem.id) ? <LoaderCircle className="size-4 animate-spin" /> : <Pencil className="size-4" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
