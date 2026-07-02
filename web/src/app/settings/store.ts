"use client";

import { create } from "zustand";
import { toast } from "sonner";

import {
  fetchSettingsConfig,
  syncImageStorage,
  testImageStorageConnection,
  updateSettingsConfig,
  type ImageStorageMode,
  type ImageStorageSettings,
  type ModelGatewaySettings,
  type OIDCSettings,
  type SettingsConfig,
} from "@/lib/api";

function defaultImageStorage(): ImageStorageSettings {
  return {
    enabled: false,
    mode: "local",
    webdav_url: "",
    webdav_username: "",
    webdav_password: "",
    webdav_root_path: "happytoken/images",
    public_base_url: "",
  };
}

function defaultOIDC(): OIDCSettings {
  return {
    enabled: false,
    issuer: "",
    client_id: "",
    client_secret: "",
    client_secret_configured: false,
    scopes: "openid profile email",
    allowed_email_domains: "",
    post_logout_redirect_uri: "",
  };
}

function defaultModelGateway(): ModelGatewaySettings {
  return {
    gateway_api_base_url: "https://gateway.happy-token.cn/v1",
    gateway_management_url: "https://gateway.happy-token.cn",
    provision_url: "",
    provision_secret: "",
    provision_secret_configured: false,
    sql_dsn: "",
    sql_dsn_configured: false,
    token_name: "HappyImage Default",
    image_group: "image",
    image_models: ["gpt-image-2", "codex-gpt-image-2"],
    image_model_prices: {
      "gpt-image-2": 0.007,
      "codex-gpt-image-2": 0.0139,
    },
    image_model_billing_types: {
      "gpt-image-2": "per_request",
      "codex-gpt-image-2": "per_request",
    },
    enabled: false,
  };
}

function normalizeConfig(config: SettingsConfig): SettingsConfig {
  const imageStorage =
    typeof config.image_storage === "object" && config.image_storage
      ? (config.image_storage as ImageStorageSettings)
      : defaultImageStorage();
  const imageStorageMode: ImageStorageMode =
    imageStorage.enabled && imageStorage.mode === "both"
      ? "both"
      : imageStorage.enabled && imageStorage.mode === "webdav"
      ? "webdav"
      : "local";
  const oidc =
    typeof config.oidc === "object" && config.oidc
      ? (config.oidc as OIDCSettings)
      : defaultOIDC();
  const modelGateway =
    typeof config.model_gateway === "object" && config.model_gateway
      ? (config.model_gateway as ModelGatewaySettings)
      : defaultModelGateway();

  return {
    ...config,
    public_app_url: String(
      config.public_app_url || config.frontend_base_url || ""
    ),
    api_public_url: String(config.api_public_url || config.api_base_url || ""),
    external_api_url: String(config.external_api_url || ""),
    image_retention_days: Number(config.image_retention_days || 30),
    image_poll_timeout_secs: Number(config.image_poll_timeout_secs || 120),
    image_settle_enabled: Boolean(config.image_settle_enabled !== false),
    image_settle_secs: Number(config.image_settle_secs || 2.0),
    global_system_prompt: String(config.global_system_prompt || ""),
    sensitive_words: Array.isArray(config.sensitive_words)
      ? config.sensitive_words
      : [],
    image_storage: {
      enabled: Boolean(imageStorage.enabled),
      mode: imageStorageMode,
      webdav_url: String(imageStorage.webdav_url || ""),
      webdav_username: String(imageStorage.webdav_username || ""),
      webdav_password: String(imageStorage.webdav_password || ""),
      webdav_root_path: String(
        imageStorage.webdav_root_path || "happytoken/images"
      ),
      public_base_url: String(imageStorage.public_base_url || ""),
    },
    oidc: {
      enabled: Boolean(oidc.enabled),
      issuer: String(oidc.issuer || ""),
      client_id: String(oidc.client_id || ""),
      client_secret: String(oidc.client_secret || ""),
      client_secret_configured: Boolean(oidc.client_secret_configured),
      scopes: String(oidc.scopes || "openid profile email"),
      allowed_email_domains: String(oidc.allowed_email_domains || ""),
    },
    model_gateway: {
      ...defaultModelGateway(),
      ...modelGateway,
      gateway_api_base_url: String(
        modelGateway.gateway_api_base_url || "https://gateway.happy-token.cn/v1"
      ),
      gateway_management_url: String(
        modelGateway.gateway_management_url || "https://gateway.happy-token.cn"
      ),
      provision_url: String(modelGateway.provision_url || ""),
      provision_secret: String(modelGateway.provision_secret || ""),
      provision_secret_configured: Boolean(
        modelGateway.provision_secret_configured
      ),
      sql_dsn: String(modelGateway.sql_dsn || ""),
      sql_dsn_configured: Boolean(modelGateway.sql_dsn_configured),
      token_name: String(modelGateway.token_name || "HappyImage Default"),
      image_group: String(modelGateway.image_group || "image"),
      image_models: Array.isArray(modelGateway.image_models)
        ? modelGateway.image_models.map((model) => String(model).trim()).filter(Boolean)
        : ["gpt-image-2", "codex-gpt-image-2"],
      image_model_prices:
        typeof modelGateway.image_model_prices === "object" &&
        modelGateway.image_model_prices
          ? modelGateway.image_model_prices
          : {
              "gpt-image-2": 0.007,
              "codex-gpt-image-2": 0.0139,
            },
      image_model_billing_types:
        typeof modelGateway.image_model_billing_types === "object" &&
        modelGateway.image_model_billing_types
          ? modelGateway.image_model_billing_types
          : {
              "gpt-image-2": "per_request",
              "codex-gpt-image-2": "per_request",
            },
      enabled: Boolean(modelGateway.enabled),
    },
  };
}

type SettingsStore = {
  config: SettingsConfig | null;
  isLoadingConfig: boolean;
  isSavingConfig: boolean;
  isTestingImageStorage: boolean;
  isSyncingImageStorage: boolean;
  initialize: () => Promise<void>;
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<boolean>;
  setImageRetentionDays: (value: string) => void;
  setImagePollTimeoutSecs: (value: string) => void;
  setImageSettleEnabled: (value: boolean) => void;
  setImageSettleSecs: (value: string) => void;
  setGlobalSystemPrompt: (value: string) => void;
  setSensitiveWordsText: (value: string) => void;
  setConfigField: (
    key: keyof SettingsConfig,
    value: string | boolean | number
  ) => void;
  setImageStorageField: (
    key: keyof ImageStorageSettings,
    value: string | boolean
  ) => void;
  setOIDCField: (
    key: keyof OIDCSettings,
    value: string | boolean | number
  ) => void;
  setModelGatewayField: (
    key: keyof ModelGatewaySettings,
    value: string | boolean | string[] | Record<string, number | string>
  ) => void;
  testImageStorage: () => Promise<void>;
  syncImagesToWebDAV: () => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  config: null,
  isLoadingConfig: true,
  isSavingConfig: false,
  isTestingImageStorage: false,
  isSyncingImageStorage: false,

  initialize: async () => {
    await get().loadConfig();
  },

  loadConfig: async () => {
    set({ isLoadingConfig: true });
    try {
      const data = await fetchSettingsConfig();
      set({ config: normalizeConfig(data.config) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载系统配置失败");
    } finally {
      set({ isLoadingConfig: false });
    }
  },

  saveConfig: async () => {
    const { config } = get();
    if (!config) {
      return false;
    }

    set({ isSavingConfig: true });
    try {
      const data = await updateSettingsConfig({
        ...config,
        public_app_url: String(config.public_app_url || "")
          .trim()
          .replace(/\/+$/, ""),
        api_public_url: String(config.api_public_url || "")
          .trim()
          .replace(/\/+$/, ""),
        image_retention_days: Math.max(
          1,
          Number(config.image_retention_days) || 30
        ),
        image_poll_timeout_secs: Math.max(
          1,
          Number(config.image_poll_timeout_secs) || 120
        ),
        image_settle_enabled: Boolean(config.image_settle_enabled !== false),
        image_settle_secs: Math.max(
          0.5,
          Number(config.image_settle_secs) || 2.0
        ),
        global_system_prompt: String(config.global_system_prompt || "").trim(),
        sensitive_words: (config.sensitive_words || [])
          .map((item) => String(item).trim())
          .filter(Boolean),
        image_storage: {
          enabled: Boolean(config.image_storage?.enabled),
          mode:
            config.image_storage?.enabled &&
            ["webdav", "both"].includes(String(config.image_storage?.mode))
              ? config.image_storage.mode
              : "local",
          webdav_url: String(config.image_storage?.webdav_url || "").trim(),
          webdav_username: String(
            config.image_storage?.webdav_username || ""
          ).trim(),
          webdav_password: String(
            config.image_storage?.webdav_password || ""
          ).trim(),
          webdav_root_path: String(
            config.image_storage?.webdav_root_path || "happytoken/images"
          ).trim(),
          public_base_url: String(
            config.image_storage?.public_base_url || ""
          ).trim(),
        },
        oidc: {
          ...(config.oidc || defaultOIDC()),
          issuer: String(config.oidc?.issuer || "").trim(),
          client_id: String(config.oidc?.client_id || "").trim(),
          client_secret: String(config.oidc?.client_secret || "").trim(),
          scopes: String(config.oidc?.scopes || "openid profile email").trim(),
          allowed_email_domains: String(
            config.oidc?.allowed_email_domains || ""
          ).trim(),
        },
        model_gateway: {
          gateway_api_base_url: String(
            config.model_gateway?.gateway_api_base_url ||
              "https://gateway.happy-token.cn/v1"
          )
            .trim()
            .replace(/\/+$/, ""),
          gateway_management_url: String(
            config.model_gateway?.gateway_management_url ||
              "https://gateway.happy-token.cn"
          )
            .trim()
            .replace(/\/+$/, ""),
          provision_url: String(config.model_gateway?.provision_url || "")
            .trim()
            .replace(/\/+$/, ""),
          provision_secret: String(
            config.model_gateway?.provision_secret || ""
          ).trim(),
          sql_dsn: String(config.model_gateway?.sql_dsn || "").trim(),
          token_name: String(
            config.model_gateway?.token_name || "HappyImage Default"
          ).trim(),
          image_group: String(config.model_gateway?.image_group || "image").trim(),
          image_models: (config.model_gateway?.image_models || [])
            .map((model) => String(model).trim())
            .filter(Boolean),
          image_model_prices: config.model_gateway?.image_model_prices || {},
          image_model_billing_types:
            config.model_gateway?.image_model_billing_types || {},
        },
      });
      set({ config: normalizeConfig(data.config) });
      toast.success("配置已保存");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存系统配置失败");
      return false;
    } finally {
      set({ isSavingConfig: false });
    }
  },

  setImageRetentionDays: (value) => {
    set((state) =>
      state.config
        ? { config: { ...state.config, image_retention_days: value } }
        : {}
    );
  },

  setImagePollTimeoutSecs: (value) => {
    set((state) =>
      state.config
        ? { config: { ...state.config, image_poll_timeout_secs: value } }
        : {}
    );
  },

  setImageSettleEnabled: (value) => {
    set((state) =>
      state.config
        ? { config: { ...state.config, image_settle_enabled: value } }
        : {}
    );
  },

  setImageSettleSecs: (value) => {
    set((state) =>
      state.config
        ? { config: { ...state.config, image_settle_secs: value } }
        : {}
    );
  },

  setGlobalSystemPrompt: (value) => {
    set((state) =>
      state.config
        ? { config: { ...state.config, global_system_prompt: value } }
        : {}
    );
  },

  setSensitiveWordsText: (value) => {
    set((state) =>
      state.config
        ? { config: { ...state.config, sensitive_words: value.split("\n") } }
        : {}
    );
  },

  setConfigField: (key, value) => {
    set((state) =>
      state.config ? { config: { ...state.config, [key]: value } } : {}
    );
  },

  setImageStorageField: (key, value) => {
    set((state) => {
      if (!state.config?.image_storage) {
        return {};
      }
      const next = { ...state.config.image_storage, [key]: value };
      if (key === "enabled" && !value) {
        next.mode = "local";
      }
      if (key === "enabled" && value && next.mode === "local") {
        next.mode = "webdav";
      }
      return { config: { ...state.config, image_storage: next } };
    });
  },

  setOIDCField: (key, value) => {
    set((state) =>
      state.config
        ? {
            config: {
              ...state.config,
              oidc: {
                ...(state.config.oidc || defaultOIDC()),
                [key]: value,
              },
            },
          }
        : {}
    );
  },

  setModelGatewayField: (key, value) => {
    set((state) =>
      state.config
        ? {
            config: {
              ...state.config,
              model_gateway: {
                ...(state.config.model_gateway || defaultModelGateway()),
                [key]: value,
              },
            },
          }
        : {}
    );
  },

  testImageStorage: async () => {
    set({ isTestingImageStorage: true });
    try {
      const saved = await get().saveConfig();
      if (!saved) {
        return;
      }
      const data = await testImageStorageConnection();
      if (data.result.ok) {
        toast.success(`WebDAV 连接可用：HTTP ${data.result.status}`);
      } else {
        toast.error(
          `WebDAV 连接失败：${
            data.result.error ?? `HTTP ${data.result.status}`
          }`
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "测试 WebDAV 失败");
    } finally {
      set({ isTestingImageStorage: false });
    }
  },

  syncImagesToWebDAV: async () => {
    set({ isSyncingImageStorage: true });
    try {
      const saved = await get().saveConfig();
      if (!saved) {
        return;
      }
      const data = await syncImageStorage();
      toast.success(
        `同步完成：上传 ${data.result.uploaded}，跳过 ${data.result.skipped}，失败 ${data.result.failed}`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "同步图片失败");
    } finally {
      set({ isSyncingImageStorage: false });
    }
  },
}));
