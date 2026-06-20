"use client";

import { useEffect, useRef, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Copy,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  Sparkles,
  TicketPlus,
  Trash2,
  UsersRound,
} from "lucide-react";
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

function formatQuota(value?: number | null) {
  if (typeof value !== "number") {
    return "不限";
  }
  return `${Math.max(0, value)} 次`;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "—";
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

function parseQuotaInput(value: string, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, Math.floor(numeric));
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
  const [createQuota, setCreateQuota] = useState("20");
  const [isCreating, setIsCreating] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [revealedKey, setRevealedKey] = useState("");
  const [deletingItem, setDeletingItem] = useState<UserKey | null>(null);
  const [editingItem, setEditingItem] = useState<UserKey | null>(null);
  const [editName, setEditName] = useState("");
  const [editKey, setEditKey] = useState("");
  const [editQuota, setEditQuota] = useState("0");
  const [rechargeItem, setRechargeItem] = useState<UserKey | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState("10");

  const totalUsers = items.length;
  const enabledUsers = items.filter((item) => item.enabled).length;
  const totalQuota = items.reduce((sum, item) => sum + Math.max(0, Number(item.image_quota || 0)), 0);

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
        image_quota: parseQuotaInput(createQuota),
      });
      setItems(data.items);
      setRevealedKey(data.key);
      setName("");
      setCustomKey("");
      setCreateQuota("20");
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
    setEditQuota(String(Math.max(0, Number(item.image_quota || 0))));
  };

  const handleEdit = async () => {
    if (!editingItem) {
      return;
    }
    const item = editingItem;
    const trimmedName = editName.trim();
    const trimmedKey = editKey.trim();
    const currentQuota = Math.max(0, Number(item.image_quota || 0));
    const nextQuota = parseQuotaInput(editQuota, currentQuota);
    if (trimmedName === item.name && !trimmedKey && nextQuota === currentQuota) {
      setEditingItem(null);
      return;
    }
    setItemPending(item.id, true);
    try {
      const data = await updateUserKey(item.id, {
        ...(trimmedName !== item.name ? { name: trimmedName } : {}),
        ...(trimmedKey ? { key: trimmedKey } : {}),
        ...(nextQuota !== currentQuota ? { image_quota: nextQuota } : {}),
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

  const handleRecharge = async () => {
    if (!rechargeItem) {
      return;
    }
    const amount = parseQuotaInput(rechargeAmount);
    if (amount <= 0) {
      toast.error("请输入大于 0 的充值额度");
      return;
    }
    const item = rechargeItem;
    const currentQuota = Math.max(0, Number(item.image_quota || 0));
    setItemPending(item.id, true);
    try {
      const data = await updateUserKey(item.id, { image_quota: currentQuota + amount });
      setItems(data.items);
      setRechargeItem(null);
      setRechargeAmount("10");
      toast.success(`已为 ${item.name} 充值 ${amount} 次，已解锁无水印下载`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "充值失败");
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
      <Card className="overflow-hidden rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardContent className="space-y-6 p-6">
          {standalone ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-stone-200/80 bg-stone-50/80 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">
                  <UsersRound className="size-3.5" />
                  Users
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">{totalUsers}</div>
                <div className="mt-1 text-sm text-stone-500">已注册普通用户</div>
              </div>
              <div className="rounded-2xl border border-stone-200/80 bg-stone-50/80 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">
                  <CheckCircle2 className="size-3.5" />
                  Active
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">{enabledUsers}</div>
                <div className="mt-1 text-sm text-stone-500">当前可用账号</div>
              </div>
              <div className="rounded-2xl border border-stone-200/80 bg-stone-50/80 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">
                  <Sparkles className="size-3.5" />
                  Quota
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">{totalQuota}</div>
                <div className="mt-1 text-sm text-stone-500">剩余图片额度总数</div>
              </div>
            </div>
          ) : null}

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-stone-100">
                <KeyRound className="size-5 text-stone-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">用户管理</h2>
                <p className="text-sm text-stone-500">创建普通用户、设置登录密钥，并按需充值图片生成额度。</p>
              </div>
            </div>
            <Button className="h-9 rounded-xl bg-stone-950 px-4 text-white hover:bg-stone-800" onClick={() => setIsDialogOpen(true)}>
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
              <LoaderCircle className="size-5 animate-spin text-stone-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl bg-stone-50 px-6 py-10 text-center text-sm text-stone-500">
              暂无普通用户。点击右上角按钮后即可创建账号并分配图片额度。
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const isPending = pendingIds.has(item.id);
                return (
                  <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white px-4 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-medium text-stone-800">{item.name}</div>
                        <Badge variant={item.enabled ? "success" : "secondary"} className="rounded-md">
                          {item.enabled ? "已启用" : "已禁用"}
                        </Badge>
                        <Badge variant="secondary" className="rounded-md">
                          剩余额度 {formatQuota(item.image_quota)}
                        </Badge>
                        <Badge variant={item.watermark_unlocked ? "success" : "secondary"} className="rounded-md">
                          {item.watermark_unlocked ? "无水印已解锁" : "下载需水印"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                        <span>登录账号 {item.name}</span>
                        <span>创建时间 {formatDateTime(item.created_at)}</span>
                        <span>最近使用 {formatDateTime(item.last_used_at)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-xl border-emerald-200 bg-white px-4 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => {
                          setRechargeItem(item);
                          setRechargeAmount("10");
                        }}
                        disabled={isPending}
                      >
                        {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <TicketPlus className="size-4" />}
                        充值额度
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-xl border-stone-200 bg-white px-4 text-stone-700"
                        onClick={() => openEditDialog(item)}
                        disabled={isPending}
                      >
                        {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Pencil className="size-4" />}
                        编辑
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-xl border-stone-200 bg-white px-4 text-stone-700"
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
        <DialogContent className="rounded-2xl p-6">
          <DialogHeader className="gap-2">
            <DialogTitle>创建用户</DialogTitle>
            <DialogDescription className="text-sm leading-6">
              填写用户名称和初始图片额度。若不手填登录密钥，系统会自动生成一条只能查看一次的密钥。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">用户名称</label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：设计同学 A、运营临时账号"
                className="h-11 rounded-xl border-stone-200 bg-white"
              />
              <p className="text-xs leading-5 text-stone-500">用户可使用这个名称作为登录账号。</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">登录密钥（可选）</label>
              <Input
                value={customKey}
                onChange={(event) => setCustomKey(event.target.value)}
                placeholder="留空则自动生成，例如：sk-your-custom-user-key"
                className="h-11 rounded-xl border-stone-200 bg-white font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">初始图片额度</label>
              <Input
                value={createQuota}
                onChange={(event) => setCreateQuota(event.target.value)}
                inputMode="numeric"
                placeholder="20"
                className="h-11 rounded-xl border-stone-200 bg-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-xl bg-stone-100 px-5 text-stone-700 hover:bg-stone-200"
              onClick={() => {
                setIsDialogOpen(false);
                setCustomKey("");
                setCreateQuota("20");
              }}
              disabled={isCreating}
            >
              取消
            </Button>
            <Button
              type="button"
              className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800"
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
        <DialogContent className="rounded-2xl p-6">
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
              className="h-10 rounded-xl bg-stone-100 px-5 text-stone-700 hover:bg-stone-200"
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
        <DialogContent className="rounded-2xl p-6">
          <DialogHeader className="gap-2">
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription className="text-sm leading-6">
              可以修改用户名称、登录密钥和当前剩余额度。登录密钥留空则保持不变。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">名称</label>
              <Input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder="例如：设计同学 A、运营临时账号"
                className="h-11 rounded-xl border-stone-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">当前剩余额度</label>
              <Input
                value={editQuota}
                onChange={(event) => setEditQuota(event.target.value)}
                inputMode="numeric"
                placeholder="0"
                className="h-11 rounded-xl border-stone-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">新的登录密钥（可选）</label>
              <Input
                value={editKey}
                onChange={(event) => setEditKey(event.target.value)}
                placeholder="例如：sk-your-custom-user-key"
                className="h-11 rounded-xl border-stone-200 bg-white font-mono"
              />
              <p className="text-xs leading-5 text-stone-500">
                保存后旧密钥会立即失效，新密钥生效。系统仍只保存哈希，不会回显当前密钥。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-xl bg-stone-100 px-5 text-stone-700 hover:bg-stone-200"
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
              className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800"
              onClick={() => void handleEdit()}
              disabled={editingItem ? pendingIds.has(editingItem.id) : false}
            >
              {editingItem && pendingIds.has(editingItem.id) ? <LoaderCircle className="size-4 animate-spin" /> : <Pencil className="size-4" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(rechargeItem)}
        onOpenChange={(open) => {
          if (!open) {
            setRechargeItem(null);
            setRechargeAmount("10");
          }
        }}
      >
        <DialogContent className="rounded-2xl p-6">
          <DialogHeader className="gap-2">
            <DialogTitle>充值图片额度</DialogTitle>
            <DialogDescription className="text-sm leading-6">
              为用户「{rechargeItem?.name}」增加图片生成次数。当前剩余额度为 {formatQuota(rechargeItem?.image_quota)}。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">充值次数</label>
              <Input
                value={rechargeAmount}
                onChange={(event) => setRechargeAmount(event.target.value)}
                inputMode="numeric"
                placeholder="10"
                className="h-11 rounded-xl border-stone-200 bg-white"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[10, 20, 50, 100].map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl border-stone-200 bg-white px-4 text-stone-700"
                  onClick={() => setRechargeAmount(String(amount))}
                >
                  +{amount}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-xl bg-stone-100 px-5 text-stone-700 hover:bg-stone-200"
              onClick={() => {
                setRechargeItem(null);
                setRechargeAmount("10");
              }}
              disabled={rechargeItem ? pendingIds.has(rechargeItem.id) : false}
            >
              取消
            </Button>
            <Button
              type="button"
              className="h-10 rounded-xl bg-emerald-600 px-5 text-white hover:bg-emerald-700"
              onClick={() => void handleRecharge()}
              disabled={rechargeItem ? pendingIds.has(rechargeItem.id) : false}
            >
              {rechargeItem && pendingIds.has(rechargeItem.id) ? <LoaderCircle className="size-4 animate-spin" /> : <TicketPlus className="size-4" />}
              确认充值
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
