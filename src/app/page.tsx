"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { ArrowRight, ImageIcon, LoaderCircle, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HeaderActions } from "@/components/header-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import webConfig from "@/constants/common-env";
import { fetchSeedGallery, fetchSeedGalleryFacets, fetchSeedGalleryItem, type SeedGalleryItem } from "@/lib/api";
import { compareGalleryCategoryEntries, formatGalleryCategory } from "@/lib/gallery-categories";
import { saveGalleryPromptIntent } from "@/lib/gallery-intent";
import { cn } from "@/lib/utils";
import { getStoredAuthSession, type StoredAuthSession } from "@/store/auth";

const builtInHomeGalleryCategories = [
  "portrait",
  "fashion-editorial",
  "product-photography",
  "social-thumbnail",
  "storyboard-sequence",
  "infographic-chart",
  "food-beverage",
  "ad-campaign",
  "ecommerce-main-image",
  "poster-design",
  "toy-3d",
  "ui-design",
  "abstract-texture",
  "external-inspiration",
  "landscape-nature",
  "brand-board",
  "anime-character",
  "interior-architecture",
  "illustration-art",
  "logo-typography",
  "game-visual",
  "sports-poster",
  "travel-poster",
  "animal-pet",
  "character-design",
  "movie-poster",
  "editing-workflow",
] as const;

const homeGallerySectionLimit = 16;
const homeGalleryCategoryFetchLimit = 16;
const homeGalleryItemsPerSection = 8;
const homeGalleryRotationItemLimit = 16;
const heroBackdropItemCount = 24;

function formatStatCount(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

const heroGalleryIds = [
  "opennana-15839-spring-rural-girl-telephoto-photography",
  "opennana-15526-highly-realistic-summer-cinematic-portrait-pov",
  "opennana-15760-outdoor-summer-chinese-girl-fresh-atmosphere-portrait",
  "opennana-15847-soft-light-ccd-summer-energetic-first-love-photo",
  "opennana-15540-asian-woman-beach-yoga-sphinx-pose-portrait",
  "opennana-15557-high-end-fashion-magazine-portrait-generation",
  "opennana-15868-world-cup-soccer-girl-stadium-poster",
  "opennana-15875-sweet-cool-world-cup-soccer-babe-poster",
  "opennana-15846-cinematic-double-exposure-visual-poster",
  "poster-304-editorial-fashion-poster",
  "poster-251-glowing-sailboat-night-illustration",
  "ui-154-tokyo-pink-fashion-collage",
  "poster-285-floating-island-travel-poster",
  "poster-300-vintage-watercolor-travel-poster",
  "poster-302-blueberry-lavender-soda-scrapbook-poster",
  "poster-306-basketball-poster-design",
];

const heroRotationIds = [
  ...heroGalleryIds,
  "opennana-15866-world-cup-soccer-cheerleader-stadium-poster",
  "ad-creative-167-pastel-jellyfish-room-goods-poster",
  "poster-263-3d-liquid-art-poster",
  "comparison-79-cozy-scrapbook-mini-alter-egos",
  "comparison-84-donut-heist-storyboard-sheet",
  "poster-287-flat-vector-city-lifestyle-collage",
  "poster-292-9-frame-cinematic-storyboard-grid",
  "ui-146-graphic-design-portfolio-mockup",
  "comparison-83-interior-design-mood-board-generator",
  "portrait-198-fashion-blueprint-editorial-sheet",
  "comparison-89-solar-desert-worldbuilding-kit",
  "character-14-character-key-visual-poster-with-silhouette-collage",
  "poster-305-high-fashion-editorial-infographic-poster",
  "poster-257-japanese-fashion-collage-poster",
  "poster-266-vintage-paper-collage-set",
  "ui-145-landscape-architecture-board",
];

const homeGalleryCategoryConfigs: Record<
  string,
  {
    title: string;
    description: string;
    ids: string[];
  }
> = {
  "fashion-editorial": {
    title: "时尚大片",
    description: "杂志社论、街拍穿搭、造型大片和高级人物视觉，适合找氛围、姿态、服装与画面质感。",
    ids: [],
  },
  portrait: {
    title: "人像",
    description: "精选人像样张，固定展示挑选过的清新、真实、可复刻照片，适合头像、写真套图与社媒内容。",
    ids: [
      "opennana-15839-spring-rural-girl-telephoto-photography",
      "opennana-15526-highly-realistic-summer-cinematic-portrait-pov",
      "opennana-15760-outdoor-summer-chinese-girl-fresh-atmosphere-portrait",
      "opennana-15847-soft-light-ccd-summer-energetic-first-love-photo",
      "opennana-15540-asian-woman-beach-yoga-sphinx-pose-portrait",
      "opennana-15557-high-end-fashion-magazine-portrait-generation",
    ],
  },
  "social-thumbnail": {
    title: "社媒封面",
    description: "短视频封面、直播画面、YouTube 缩略图和平台化内容视觉，适合快速做传播入口。",
    ids: [],
  },
  "infographic-chart": {
    title: "信息图表",
    description: "流程图、知识卡片、地图、图解和高信息密度页面，适合内容解释与资料视觉化。",
    ids: [],
  },
  "product-photography": {
    title: "产品摄影",
    description: "棚拍、包装、材质、商业产品特写和品牌静物，适合商品展示和广告素材。",
    ids: [],
  },
  "ecommerce-main-image": {
    title: "电商主图",
    description: "商品主图、产品棚拍、卖点信息图和电商广告场景，适合商品详情与投放物料。",
    ids: [],
  },
  "food-beverage": {
    title: "美食饮品",
    description: "餐饮、咖啡、饮料、甜点和食品广告，适合店铺视觉、菜单和社媒种草。",
    ids: [],
  },
  "ad-campaign": {
    title: "广告营销",
    description: "商业广告、活动 KV、投放素材和品牌营销画面，适合找传播概念与画面结构。",
    ids: [],
  },
  "poster-design": {
    title: "海报设计",
    description: "活动海报、旅行插画、电影感视觉、信息图与竖版构图模板，适合快速找版式和氛围。",
    ids: [],
  },
  "movie-poster": {
    title: "电影海报",
    description: "电影感主视觉、剧场海报和叙事氛围图，适合短片、活动与主题内容包装。",
    ids: [],
  },
  "travel-poster": {
    title: "旅行海报",
    description: "城市、目的地、邮票和复古旅行视觉，适合旅游推广、城市内容与纪念海报。",
    ids: [],
  },
  "sports-poster": {
    title: "运动海报",
    description: "赛事、运动员、球队视觉和动作瞬间，适合热点传播、活动海报与运动品牌内容。",
    ids: [],
  },
  "storyboard-sequence": {
    title: "分镜叙事",
    description: "多格分镜、剧情流程、对比方案和连续场景，适合视频脚本、故事板和方案推演。",
    ids: [],
  },
  "editing-workflow": {
    title: "改图修图",
    description: "参考图改造、风格迁移、材质替换、物体移除、修复增强和一致性编辑流程。",
    ids: [],
  },
  "logo-typography": {
    title: "字体标志",
    description: "字标、标题字、字体海报和文字图形化，适合品牌识别和视觉标题探索。",
    ids: [],
  },
  "ui-design": {
    title: "界面设计",
    description: "界面稿、产品页、仪表盘、落地页和设计系统视觉，适合产品展示与提案。",
    ids: [],
  },
  "brand-board": {
    title: "品牌视觉板",
    description: "品牌指南、情绪板、视觉系统和素材规范，适合统一风格、色彩与物料方向。",
    ids: [],
  },
  "toy-3d": {
    title: "3D 手办",
    description: "3D 渲染、手办玩具、微缩场景和等距模型，适合趣味资产与产品化表达。",
    ids: [],
  },
  "anime-character": {
    title: "动漫角色",
    description: "动漫、漫画、VTuber、Q 版和二次元角色视觉，适合角色灵感与头像资产。",
    ids: [],
  },
  "character-design": {
    title: "角色设定",
    description: "角色设定、人物海报、世界观视觉和游戏概念图，适合 IP、叙事与角色资产。",
    ids: [],
  },
  "illustration-art": {
    title: "插画艺术",
    description: "漫画、水彩、线稿、绘本、复古和风格化插画，适合故事、封面与内容配图。",
    ids: [],
  },
  "interior-architecture": {
    title: "建筑空间",
    description: "室内、建筑、城市、家具和空间氛围，适合方案参考、场景设定与空间提案。",
    ids: [],
  },
  "landscape-nature": {
    title: "自然风景",
    description: "山海森林、旅行风景、自然景观和壁纸氛围，适合背景、海报与视觉灵感。",
    ids: [],
  },
  "abstract-texture": {
    title: "抽象纹理",
    description: "抽象图案、材质纹理、渐变背景、壁纸和无主体视觉，适合设计底图与品牌延展。",
    ids: [],
  },
  "game-visual": {
    title: "游戏视觉",
    description: "游戏 HUD、战斗画面、像素风、资产概念和娱乐视觉，适合玩法和角色世界观。",
    ids: [],
  },
  "external-inspiration": {
    title: "外部灵感",
    description: "来自外部素材库的精选案例，适合快速浏览不同风格、题材和提示词写法。",
    ids: [],
  },
  "animal-pet": {
    title: "动物宠物",
    description: "宠物、动物角色、拟人化生物和可爱视觉，适合头像、周边与轻内容传播。",
    ids: [],
  },
  poster: {
    title: "海报",
    description: "活动海报、旅行插画、电影感视觉、信息图与竖版构图模板，适合快速找版式和氛围。",
    ids: [
      "opennana-15868-world-cup-soccer-girl-stadium-poster",
      "opennana-15875-sweet-cool-world-cup-soccer-babe-poster",
      "opennana-15866-world-cup-soccer-cheerleader-stadium-poster",
      "opennana-15846-cinematic-double-exposure-visual-poster",
      "poster-304-editorial-fashion-poster",
      "poster-251-glowing-sailboat-night-illustration",
      "poster-285-floating-island-travel-poster",
      "poster-296-2x2-luxury-3d-sculptural-poster",
      "poster-300-vintage-watercolor-travel-poster",
      "poster-302-blueberry-lavender-soda-scrapbook-poster",
      "poster-306-basketball-poster-design",
      "poster-292-9-frame-cinematic-storyboard-grid",
      "poster-301-retro-cafe-scrapbook-poster",
      "poster-305-high-fashion-editorial-infographic-poster",
      "poster-263-3d-liquid-art-poster",
    ],
  },
  ui: {
    title: "UI",
    description: "界面稿、作品集、信息面板、社媒截图和内容排版，适合产品展示与设计提案。",
    ids: [
      "ui-154-tokyo-pink-fashion-collage",
      "ui-146-graphic-design-portfolio-mockup",
      "ui-145-landscape-architecture-board",
      "ui-159-rider-waite-tarot-card",
      "ui-124-12-panel-storyboard-poster",
      "ui-1-one-prompt-ui-design-generation",
      "ui-9-style-to-ui-design-system",
      "ui-25-museum-style-hanfu-breakdown-infographic",
    ],
  },
  comparison: {
    title: "对比改图",
    description: "多方案对照、分镜故事板、情绪板和改图测试，便于比较提示词和画面方向。",
    ids: [
      "comparison-83-interior-design-mood-board-generator",
      "comparison-86-storyboard-grid-template",
      "comparison-87-pancake-dad-storyboard",
      "comparison-84-donut-heist-storyboard-sheet",
      "comparison-79-cozy-scrapbook-mini-alter-egos",
      "comparison-89-solar-desert-worldbuilding-kit",
      "comparison-33-multi-concept-battle-poster-set",
      "comparison-10-gpt-image-2-detail-showcase",
    ],
  },
  "ad-creative": {
    title: "广告创意",
    description: "广告 KV、投放素材、品牌视觉和活动创意，覆盖增长、营销与内容运营。",
    ids: [
      "ad-creative-90-4-panel-japanese-digital-ad-banner-grid",
      "ad-creative-181-sticker-reality-product-collage",
      "ad-creative-174-luxury-fragrance-campaign-portrait",
      "ad-creative-177-matcha-granola-ad-poster",
      "ad-creative-167-pastel-jellyfish-room-goods-poster",
      "ad-creative-144-luxury-chronograph-watch-ad",
      "ad-creative-145-neon-nike-lumina-ad-poster",
      "ad-creative-170-urban-fruit-juice-ad-poster",
    ],
  },
  ecommerce: {
    title: "电商",
    description: "商品主图、产品棚拍、卖点信息图和电商广告场景，适合商品详情与投放物料。",
    ids: [
      "ecommerce-160-e-commerce-main-image-9-panel-product-tvc-storyboard",
      "ecommerce-113-e-commerce-main-image-luxury-amber-perfume-ad",
      "ecommerce-114-e-commerce-main-image-skincare-product-studio-shot",
      "ecommerce-117-e-commerce-main-image-luxury-fur-lined-loafer-lifestyle-photo",
      "ecommerce-151-e-commerce-main-image-miniature-diorama-skincare-advertisement",
      "ecommerce-155-e-commerce-main-image-earbuds-e-commerce-infographic",
      "ecommerce-161-premium-product-studio-shot-template",
      "ecommerce-162-premium-food-photography-template",
    ],
  },
  product: {
    title: "产品摄影",
    description: "商业产品摄影、包装特写、材质展示、广告棚拍和品牌视觉，适合商品与营销素材。",
    ids: [],
  },
  external: {
    title: "外部灵感",
    description: "来自外部素材库的精选案例，适合快速浏览不同风格、题材和提示词写法。",
    ids: [],
  },
  character: {
    title: "角色",
    description: "角色设定、人物海报、世界观视觉和游戏概念图，适合 IP、叙事与角色资产。",
    ids: [
      "character-14-character-key-visual-poster-with-silhouette-collage",
      "character-7-mecha-girl-sea-city-key-visual",
      "character-1-anime-snapshot-conversion",
      "character-2-persona5-character-reference-card",
      "character-3-gal-game-character-introduction-page",
      "character-5-official-character-sheet-jp",
      "character-9-chaos-notes-hidden-face-character-art",
      "character-13-eleanor-from-white-cat-project",
    ],
  },
  infographic: {
    title: "信息图",
    description: "流程图、地图、知识卡片、数据图表和高信息密度页面，适合内容传播与教育视觉。",
    ids: [],
  },
  "3d-render": {
    title: "3D",
    description: "3D 渲染、手办、玩具、微缩场景、材质实验和等距模型，适合产品与趣味内容。",
    ids: [],
  },
  architecture: {
    title: "建筑空间",
    description: "建筑、室内、城市景观、空间改造和场景设计，适合方案参考与视觉提案。",
    ids: [],
  },
  typography: {
    title: "字体标志",
    description: "Logo、字母造型、字体海报、品牌字标和文字创意，适合品牌与社媒设计。",
    ids: [],
  },
  illustration: {
    title: "插画",
    description: "漫画、水彩、线稿、绘本、复古和风格化插画，适合故事、封面与内容配图。",
    ids: [],
  },
  fashion: {
    title: "时尚穿搭",
    description: "时装大片、穿搭 Lookbook、街拍、杂志社论和服饰产品展示，适合内容种草与品牌视觉。",
    ids: [],
  },
  editing: {
    title: "改图修图",
    description: "参考图改造、风格迁移、材质替换、物体移除、修复增强和一致性编辑流程。",
    ids: [],
  },
  "social-media": {
    title: "社媒封面",
    description: "小红书、Instagram、YouTube、短视频封面和社媒贴图，适合快速做传播视觉。",
    ids: [],
  },
  landscape: {
    title: "自然风景",
    description: "山海森林、城市旅行、自然景观、壁纸和氛围场景，适合背景与视觉灵感。",
    ids: [],
  },
  abstract: {
    title: "抽象背景",
    description: "抽象图案、材质纹理、渐变背景、壁纸和无主体视觉，适合设计底图与品牌延展。",
    ids: [],
  },
  animal: {
    title: "动物宠物",
    description: "宠物、动物角色、拟人化生物和可爱视觉，适合头像、周边与轻内容传播。",
    ids: [],
  },
  food: {
    title: "美食饮品",
    description: "食品、饮料、咖啡、餐饮海报和菜单视觉，适合店铺、投放与社媒传播。",
    ids: [],
  },
  game: {
    title: "游戏",
    description: "游戏 HUD、战斗画面、像素风、资产概念和娱乐视觉，适合玩法和角色世界观。",
    ids: [],
  },
  sports: {
    title: "运动",
    description: "体育海报、赛事视觉、运动员写真和动作场景，适合热点传播与活动海报。",
    ids: [],
  },
};

type HomeGallerySection = {
  key: string;
  category: string;
  title: string;
  description: string;
  ids: string[];
  categories: string[];
  count: number;
  items: SeedGalleryItem[];
  rotationItems: SeedGalleryItem[];
};

type HeroMasonryTile = {
  item: SeedGalleryItem;
  tileIndex: number;
  aspectRatio: number;
};

type HeroMasonryColumn = {
  items: HeroMasonryTile[];
  height: number;
};

type HeroMasonrySize = {
  width: number;
  height: number;
};

const heroTileAnimationClasses = [
  "home-hero-tile-soft",
  "home-hero-tile-drift",
  "home-hero-tile-lift",
  "home-hero-tile-focus",
];

function buildAssetUrl(path: string) {
  const base = webConfig.apiUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function getPrimaryImageUrl(item: SeedGalleryItem) {
  const image = item.images[0];
  return image ? buildAssetUrl(image.url) : "";
}

function getPreviewImageUrl(item: SeedGalleryItem) {
  const image = item.images[0];
  if (!image) {
    return "";
  }
  return buildAssetUrl(image.thumbnail_url || image.url.replace("/api/seed-gallery/images/", "/api/seed-gallery/thumbnails/640/"));
}

function getImageAspectRatio(item: SeedGalleryItem) {
  const image = item.images[0];
  const width = Number(image?.width || 0);
  const height = Number(image?.height || 0);
  if (width > 0 && height > 0) {
    return `${width} / ${height}`;
  }
  return item.category === "poster-design" ? "3 / 4" : "4 / 5";
}

function getHeroMasonryAspectRatio(item: SeedGalleryItem) {
  const image = item.images[0];
  const width = Number(image?.width || 0);
  const height = Number(image?.height || 0);
  if (width > 0 && height > 0) {
    return Math.max(0.58, Math.min(1.72, width / height));
  }
  if (item.category === "poster-design" || item.category === "portrait") {
    return 0.74;
  }
  if (item.category === "ui-design" || item.category === "storyboard-sequence") {
    return 1.08;
  }
  return 0.88;
}

function getHeroImageObjectPosition(item: SeedGalleryItem) {
  const image = item.images[0];
  const width = Number(image?.width || 0);
  const height = Number(image?.height || 0);
  if (item.category === "portrait" || height > width * 1.15) {
    return "center 28%";
  }
  if (width > height * 1.45) {
    return "center center";
  }
  return "center 38%";
}

function formatCategory(value: string) {
  return formatGalleryCategory(value);
}

function getOrderedHomeGalleryCategories(categoryCounts: Record<string, number>) {
  const allowedCategories = new Set<string>(builtInHomeGalleryCategories);
  return Object.entries(categoryCounts)
    .filter(([category, count]) => allowedCategories.has(category) && count > 0)
    .sort(compareGalleryCategoryEntries)
    .map(([category]) => category);
}

function uniqueGalleryItems(items: SeedGalleryItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return item.images.length > 0;
  });
}

const qualityKeywords = [
  "luxury",
  "premium",
  "cinematic",
  "editorial",
  "commercial",
  "campaign",
  "advertisement",
  "photorealistic",
  "ultra-realistic",
  "high-end",
  "dramatic",
  "studio",
  "magazine",
  "poster",
  "blueprint",
  "infographic",
  "isometric",
  "diorama",
  "miniature",
  "3d",
  "fashion",
  "product",
  "黄金",
  "高级",
  "奢华",
  "电影",
  "商业",
  "海报",
  "时尚",
  "产品",
  "信息图",
  "微缩",
];

const lowSignalKeywords = [
  "test",
  "testing",
  "vs",
  "comparison",
  "same prompt",
  "promptshare",
  "trying",
  "generated through",
  "just leveled up",
  "测试",
  "对比",
];

const freshPortraitKeywords = [
  "fresh",
  "youth",
  "young",
  "summer",
  "sunny",
  "smile",
  "garden",
  "outdoor",
  "street",
  "ccd",
  "korean",
  "energetic",
  "first love",
  "flower",
  "swing",
  "tennis",
  "cafe",
  "selfie",
  "polaroid",
  "cottagecore",
  "botanical",
  "清新",
  "青春",
  "少女",
  "夏日",
  "阳光",
  "户外",
  "花园",
  "元气",
  "初恋",
  "韩系",
  "胶片",
  "街拍",
  "运动",
];

const heavyPortraitKeywords = [
  "dark",
  "noir",
  "luxury",
  "glam",
  "bedroom",
  "shower",
  "lingerie",
  "swimsuit",
  "bikini",
  "seductive",
  "mature",
  "cyberpunk",
  "goth",
  "暗黑",
  "奢华",
  "卧室",
  "内衣",
  "泳装",
  "性感",
  "成熟",
];

function getCategorySourceScore(item: SeedGalleryItem) {
  if (item.source_kind !== "candidate") {
    return 2;
  }
  const id = item.id;
  const category = item.category;
  if (id.startsWith("opennana-")) {
    return ["portrait", "poster-design", "fashion-editorial"].includes(category) ? 7 : 3;
  }
  if (id.startsWith("jau-trending-prompts-")) {
    return ["product-photography", "editing-workflow", "food-beverage", "poster-design", "fashion-editorial", "abstract-texture", "social-thumbnail"].includes(category) ? 7 : 4;
  }
  if (id.startsWith("youmind-") || id.startsWith("indream-")) {
    return ["ui-design", "infographic-chart", "logo-typography", "toy-3d", "anime-character", "character-design", "interior-architecture"].includes(category) ? 7 : 5;
  }
  if (id.startsWith("picotrex-") || id.startsWith("jimmylv-")) {
    return ["toy-3d", "anime-character", "character-design", "interior-architecture", "game-visual", "logo-typography", "infographic-chart"].includes(category) ? 7 : 4;
  }
  if (id.startsWith("imgedify-")) {
    return ["landscape-nature", "animal-pet", "product-photography", "abstract-texture", "food-beverage"].includes(category) ? 6 : 3;
  }
  return 3;
}

function scoreGalleryItem(item: SeedGalleryItem) {
  const text = `${item.title} ${item.prompt} ${item.tags.join(" ")}`.toLowerCase();
  const image = item.images[0];
  const pixelCount = (image?.width || 0) * (image?.height || 0);
  const dimensionScore = pixelCount > 1_200_000 ? 5 : pixelCount > 700_000 ? 4 : pixelCount > 300_000 ? 2 : 0;
  const keywordScore = qualityKeywords.reduce((score, keyword) => score + (text.includes(keyword.toLowerCase()) ? 1 : 0), 0);
  const lowSignalPenalty = lowSignalKeywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0);
  const portraitMoodScore =
    item.category === "portrait"
      ? freshPortraitKeywords.reduce((score, keyword) => score + (text.includes(keyword.toLowerCase()) ? 2 : 0), 0) -
        heavyPortraitKeywords.reduce((score, keyword) => score + (text.includes(keyword.toLowerCase()) ? 3 : 0), 0)
      : 0;
  const tagScore = item.tags.length > 0 ? Math.min(3, item.tags.length) : 0;
  const sourceScore = getCategorySourceScore(item);
  const titlePenalty = /^jau-trending-prompts prompt/i.test(item.title) ? 1 : 0;
  return sourceScore + dimensionScore + keywordScore + portraitMoodScore + tagScore - lowSignalPenalty - titlePenalty;
}

function sortGalleryItemsByQuality(items: SeedGalleryItem[]) {
  return [...items].sort((a, b) => {
    const scoreDelta = scoreGalleryItem(b) - scoreGalleryItem(a);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    const aPixels = (a.images[0]?.width || 0) * (a.images[0]?.height || 0);
    const bPixels = (b.images[0]?.width || 0) * (b.images[0]?.height || 0);
    return bPixels - aPixels;
  });
}

function selectGalleryItems(
  items: SeedGalleryItem[],
  preferredIds: string[],
  limit: number,
  fallbackCategories: string[] = [],
) {
  const preferred = preferredIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is SeedGalleryItem => Boolean(item));
  const preferredIdsSet = new Set(preferred.map((item) => item.id));
  const fallback = items.filter((item) => {
    if (preferredIdsSet.has(item.id)) {
      return false;
    }
    return fallbackCategories.length === 0 || fallbackCategories.includes(item.category);
  });
  return uniqueGalleryItems([...preferred, ...sortGalleryItemsByQuality(fallback)]).slice(0, limit);
}

function shuffleGalleryItems(items: SeedGalleryItem[]) {
  return [...items]
    .map((item) => ({ item, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ item }) => item);
}

function interleaveHeroMasonryItems(items: SeedGalleryItem[]) {
  const tall: SeedGalleryItem[] = [];
  const balanced: SeedGalleryItem[] = [];
  const wide: SeedGalleryItem[] = [];

  items.forEach((item) => {
    const aspectRatio = getHeroMasonryAspectRatio(item);
    if (aspectRatio < 0.82) {
      tall.push(item);
    } else if (aspectRatio > 1.18) {
      wide.push(item);
    } else {
      balanced.push(item);
    }
  });

  const buckets = [tall, balanced, wide, balanced];
  const cursors = new Map<SeedGalleryItem[], number>();
  const ordered: SeedGalleryItem[] = [];

  while (ordered.length < items.length) {
    let addedInRound = false;
    for (const bucket of buckets) {
      const cursor = cursors.get(bucket) || 0;
      const item = bucket[cursor];
      if (item) {
        ordered.push(item);
        cursors.set(bucket, cursor + 1);
        addedInRound = true;
      }
    }
    if (!addedInRound) {
      break;
    }
  }

  return uniqueGalleryItems(ordered);
}

function getHeroMasonryColumnCount(width: number) {
  if (width >= 1280) {
    return 6;
  }
  if (width >= 1024) {
    return 5;
  }
  if (width >= 700) {
    return 4;
  }
  return 3;
}

function buildHeroMasonryColumns(items: SeedGalleryItem[], size: HeroMasonrySize): HeroMasonryColumn[] {
  const width = size.width || 1120;
  const height = size.height || 660;
  const columnCount = getHeroMasonryColumnCount(width);
  const gap = width >= 640 ? 8 : 6;
  const columnWidth = Math.max(120, (width - gap * (columnCount - 1)) / columnCount);
  const targetHeight = Math.max(420, height) + gap * 2;
  const columns = Array.from({ length: columnCount }, () => ({ items: [] as HeroMasonryTile[], height: 0 }));
  const uniqueItems = interleaveHeroMasonryItems(uniqueGalleryItems(items)).slice(0, heroBackdropItemCount);
  const maxUniqueTiles = Math.min(uniqueItems.length, columnCount * 7);
  let tileIndex = 0;

  const addItem = (item: SeedGalleryItem) => {
    const shortestColumn = columns.reduce((shortest, column) => (column.height < shortest.height ? column : shortest), columns[0]);
    const aspectRatio = getHeroMasonryAspectRatio(item);
    shortestColumn.items.push({ item, tileIndex, aspectRatio });
    shortestColumn.height += columnWidth / aspectRatio + gap;
    tileIndex += 1;
  };

  for (const item of uniqueItems.slice(0, maxUniqueTiles)) {
    addItem(item);
    if (columns.every((column) => column.height >= targetHeight)) {
      return columns;
    }
  }

  let cursor = 0;
  while (uniqueItems.length > 0 && columns.some((column) => column.height < targetHeight) && tileIndex < columnCount * 8) {
    addItem(uniqueItems[cursor % uniqueItems.length]);
    cursor += 1;
  }

  return columns;
}

function shouldRunAmbientAnimation() {
  if (typeof window === "undefined") {
    return false;
  }
  if (document.visibilityState !== "visible") {
    return false;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }
  const connection = (window.navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (connection?.saveData) {
    return false;
  }
  return !["slow-2g", "2g"].includes(connection?.effectiveType || "");
}

function getNextHeroDelay() {
  return 4000 + Math.round(Math.random() * 3000);
}

function buildNextHeroItems(
  currentItems: SeedGalleryItem[],
  primaryItems: SeedGalleryItem[],
  poolItems: SeedGalleryItem[],
) {
  const baseItems =
    currentItems.length >= heroBackdropItemCount
      ? currentItems.slice(0, heroBackdropItemCount)
      : primaryItems.slice(0, heroBackdropItemCount);
  const currentIds = new Set(baseItems.map((item) => item.id));
  const candidates = shuffleGalleryItems(poolItems).filter((item) => !currentIds.has(item.id));
  if (baseItems.length === 0 || candidates.length === 0) {
    return baseItems;
  }

  const replacementSeed = Math.random();
  const replacementCount = replacementSeed > 0.78 ? 8 : replacementSeed > 0.38 ? 6 : 4;
  const replaceableIndexes = shuffleGalleryItems(baseItems)
    .map((item) => baseItems.findIndex((candidate) => candidate.id === item.id))
    .filter((index) => index >= 0)
    .slice(0, replacementCount);

  const nextItems = [...baseItems];
  replaceableIndexes.forEach((index, candidateIndex) => {
    const replacement = candidates[candidateIndex];
    if (replacement) {
      nextItems[index] = replacement;
    }
  });

  return nextItems;
}

function buildNextGallerySections(sections: HomeGallerySection[], sectionCursor: number) {
  if (sections.length === 0) {
    return sections;
  }
  const sectionIndex = sectionCursor % sections.length;
  const section = sections[sectionIndex];
  if (section.items.length === 0) {
    return sections;
  }
  const lockedIds = new Set(section.ids);
  const currentIds = new Set(section.items.map((item) => item.id));
  const nextCandidate = shuffleGalleryItems(section.rotationItems).find((item) => !currentIds.has(item.id));
  if (!nextCandidate) {
    return sections;
  }
  const replaceableIndexes = section.items
    .map((item, index) => (lockedIds.has(item.id) ? -1 : index))
    .filter((index) => index >= 0);
  if (replaceableIndexes.length === 0) {
    return sections;
  }
  const replaceIndex = replaceableIndexes[Math.floor(Math.random() * replaceableIndexes.length)];
  const nextSections = [...sections];
  const nextItems = [...section.items];
  nextItems[replaceIndex] = nextCandidate;
  nextSections[sectionIndex] = {
    ...section,
    items: nextItems,
  };
  return nextSections;
}

function GalleryPreviewCard({
  item,
  priority = false,
  onUsePrompt,
}: {
  item: SeedGalleryItem;
  priority?: boolean;
  onUsePrompt: (item: SeedGalleryItem) => void;
}) {
  const image = item.images[0];
  const imageUrl = getPreviewImageUrl(item);
  const aspectRatio = image?.width && image?.height ? `${image.width} / ${image.height}` : "4 / 5";

  return (
    <article className="group relative overflow-hidden rounded-lg border border-white/75 bg-white/78 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-stone-950/70">
      <Link
        href={`/gallery/${encodeURIComponent(item.id)}`}
        className="block overflow-hidden bg-stone-100 dark:bg-stone-900"
        style={{ aspectRatio }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.title}
            loading={priority ? "eager" : "lazy"}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone-400">
            <ImageIcon className="size-8" />
          </div>
        )}
      </Link>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className="rounded-md px-2 py-0.5">
            {formatCategory(item.category)}
          </Badge>
          <span className="text-[11px] text-stone-400">
            {item.source_kind === "candidate" ? "暂借" : `#${item.case_no || "seed"}`}
          </span>
        </div>
        <Link
          href={`/gallery/${encodeURIComponent(item.id)}`}
          className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-stone-950 hover:text-stone-700 dark:text-stone-50 dark:hover:text-stone-200"
        >
          {item.title}
        </Link>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-stone-950 px-2.5 text-xs font-medium text-white transition hover:bg-stone-800 dark:bg-white dark:text-stone-950 dark:hover:bg-stone-200"
          onClick={() => onUsePrompt(item)}
        >
          生成同款
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </article>
  );
}

function GalleryMasonryGrid({
  items,
  onUsePrompt,
}: {
  items: SeedGalleryItem[];
  onUsePrompt: (item: SeedGalleryItem) => void;
}) {
  return (
    <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5">
      {items.map((item) => (
        <div key={item.id} className="mb-3 break-inside-avoid home-gallery-card-in">
          <GalleryPreviewCard item={item} onUsePrompt={onUsePrompt} />
        </div>
      ))}
    </div>
  );
}

function FloatingGalleryNav({
  sections,
  activeKey,
  visible,
  onNavigate,
}: {
  sections: HomeGallerySection[];
  activeKey: string;
  visible: boolean;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, sectionKey: string) => void;
}) {
  if (sections.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="首页图库分类"
      className={cn("home-floating-gallery-nav", visible && "home-floating-gallery-nav-visible")}
    >
      <a
        href="#home"
        title="首页"
        onClick={(event) => onNavigate(event, "home")}
        className={cn("home-floating-gallery-link", activeKey === "home" && "home-floating-gallery-link-active")}
      >
        <span className="home-floating-gallery-dot" />
        <span className="home-floating-gallery-label">首页</span>
      </a>
      {sections.map((section, index) => {
        const active = activeKey === section.key || (!activeKey && index === 0);
        return (
          <a
            key={section.key}
            href={`#gallery-${section.key}`}
            title={section.title}
            onClick={(event) => onNavigate(event, section.key)}
            className={cn("home-floating-gallery-link", active && "home-floating-gallery-link-active")}
          >
            <span className="home-floating-gallery-dot" />
            <span className="home-floating-gallery-label">{section.title}</span>
          </a>
        );
      })}
    </nav>
  );
}

function HeroTile({
  item,
  index,
  animationClass,
}: {
  item: SeedGalleryItem;
  index: number;
  animationClass: string;
}) {
  const [displayedItem, setDisplayedItem] = useState(item);
  const [incomingItem, setIncomingItem] = useState<SeedGalleryItem | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const displayedImageUrl = getPreviewImageUrl(displayedItem);
  const incomingImageUrl = incomingItem ? getPreviewImageUrl(incomingItem) : "";
  const displayedObjectPosition = getHeroImageObjectPosition(displayedItem);
  const incomingObjectPosition = incomingItem ? getHeroImageObjectPosition(incomingItem) : displayedObjectPosition;

  useEffect(() => {
    if (displayedItem.id === item.id) {
      return;
    }

    let cancelled = false;
    const nextImageUrl = getPreviewImageUrl(item);

    const startTransition = () => {
      if (cancelled) {
        return;
      }
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      setIncomingItem(item);
      timeoutRef.current = window.setTimeout(() => {
        if (cancelled) {
          return;
        }
        setDisplayedItem(item);
        setIncomingItem(null);
        timeoutRef.current = null;
      }, 2600);
    };

    if (nextImageUrl) {
      const image = new window.Image();
      image.onload = startTransition;
      image.onerror = startTransition;
      image.src = nextImageUrl;
    } else {
      startTransition();
    }

    return () => {
      cancelled = true;
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [displayedItem.id, item]);

  return (
    <>
      {displayedImageUrl ? (
        <img
          src={displayedImageUrl}
          alt={displayedItem.title}
          loading={index < 4 ? "eager" : "lazy"}
          className="home-hero-image-base h-full w-full object-cover"
          style={{ objectPosition: displayedObjectPosition }}
        />
      ) : null}
      {incomingItem && incomingImageUrl ? (
        <img
          key={incomingItem.id}
          src={incomingImageUrl}
          alt={incomingItem.title}
          loading="lazy"
          className={[
            "home-hero-image-next absolute inset-0 h-full w-full object-cover",
            animationClass,
          ].join(" ")}
          style={{ animationDelay: `${(index % 3) * 90}ms`, objectPosition: incomingObjectPosition }}
        />
      ) : null}
    </>
  );
}

function HeroBackdrop({ items, slideKey }: { items: SeedGalleryItem[]; slideKey: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [masonrySize, setMasonrySize] = useState<HeroMasonrySize>({ width: 0, height: 0 });
  const uniqueItems = useMemo(() => uniqueGalleryItems(items).slice(0, heroBackdropItemCount), [items]);
  const columns = useMemo(() => buildHeroMasonryColumns(uniqueItems, masonrySize), [masonrySize, uniqueItems]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setMasonrySize((currentSize) => {
        const nextSize = {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
        if (currentSize.width === nextSize.width && currentSize.height === nextSize.height) {
          return currentSize;
        }
        return nextSize;
      });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(element);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  if (uniqueItems.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-stone-100 text-stone-400 dark:bg-stone-900">
        <ImageIcon className="size-10" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="home-hero-mosaic absolute inset-0 overflow-hidden opacity-95"
      style={{ gridTemplateColumns: `repeat(${columns.length || 1}, minmax(0, 1fr))` }}
    >
      {columns.map((column, columnIndex) => (
        <div key={columnIndex} className="home-hero-masonry-column">
          {column.items.map(({ item, tileIndex, aspectRatio }) => (
            <div
              key={`${item.id}-${tileIndex}`}
              className="home-hero-wall-card relative overflow-hidden"
              style={{ aspectRatio, animationDelay: `${(tileIndex % 10) * 34}ms` }}
            >
              <HeroTile
                item={item}
                index={tileIndex}
                animationClass={heroTileAnimationClasses[(slideKey + tileIndex) % heroTileAnimationClasses.length]}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [items, setItems] = useState<SeedGalleryItem[]>([]);
  const [heroItems, setHeroItems] = useState<SeedGalleryItem[]>([]);
  const [heroSlideItems, setHeroSlideItems] = useState<SeedGalleryItem[]>([]);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [gallerySections, setGallerySections] = useState<HomeGallerySection[]>([]);
  const [total, setTotal] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<StoredAuthSession | null>(null);
  const [activeGalleryKey, setActiveGalleryKey] = useState("home");
  const [isGalleryNavVisible, setIsGalleryNavVisible] = useState(false);
  const galleryNavHideTimeoutRef = useRef<number | null>(null);
  const lastGalleryNavIntentRef = useRef(0);
  const initialHomeScrollResetRef = useRef(false);

  useEffect(() => {
    if (initialHomeScrollResetRef.current) {
      return;
    }
    initialHomeScrollResetRef.current = true;

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    if (!window.location.hash) {
      window.scrollTo(0, 0);
    }

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getStoredAuthSession().then((storedSession) => {
      if (!cancelled) {
        setSession(storedSession);
      }
    });

    const loadHomeGallery = async () => {
      try {
        const facetsData = await fetchSeedGalleryFacets();
        const orderedCategories = getOrderedHomeGalleryCategories(facetsData.categories || {});
        const visibleCategories = orderedCategories.slice(0, homeGallerySectionLimit);
        const visibleCuratedIds = Array.from(
          new Set([
            ...heroGalleryIds,
            ...visibleCategories.flatMap((category) => homeGalleryCategoryConfigs[category]?.ids || []),
          ]),
        );
        const curatedResults = await Promise.all(
          visibleCuratedIds.map((id) =>
            fetchSeedGalleryItem(id)
              .then((result) => result.item)
              .catch(() => null),
          ),
        );
        if (cancelled) {
          return;
        }
        const curatedItems = uniqueGalleryItems(curatedResults.filter((item): item is SeedGalleryItem => Boolean(item)));
        const curatedHeroItems = selectGalleryItems(curatedItems, heroGalleryIds, heroBackdropItemCount, [
          "portrait",
          "poster-design",
          "ui-design",
          "ad-campaign",
          "storyboard-sequence",
          "anime-character",
          "character-design",
        ]);
        const shuffledHeroItems = shuffleGalleryItems(curatedHeroItems);
        setItems(curatedItems);
        setHeroItems(shuffledHeroItems);
        setHeroSlideItems(shuffledHeroItems);
        setTotal(facetsData.total || curatedItems.length);
        setCategoryCount(Object.keys(facetsData.categories || {}).length);
        setIsLoading(false);

        const galleryResults = await Promise.all(
          visibleCategories.map((category) => fetchSeedGallery({ category, limit: homeGalleryCategoryFetchLimit })),
        );
        if (cancelled) {
          return;
        }
        const allItems = uniqueGalleryItems([
          ...curatedItems,
          ...galleryResults.flatMap((result) => result.items),
        ]);
        const categoryOrderIndex = new Map(visibleCategories.map((category, index) => [category, index]));
        const curatedSections = visibleCategories.map((category) => {
          const config = homeGalleryCategoryConfigs[category];
          const rotationItems = selectGalleryItems(allItems, config.ids, homeGalleryRotationItemLimit, [category]);
          return {
            key: category,
            category,
            ...config,
            categories: [category],
            count: facetsData.categories?.[category] || rotationItems.length,
            rotationItems,
            items: rotationItems.slice(0, homeGalleryItemsPerSection),
          };
        });
        setItems(allItems);
        setGallerySections(
          curatedSections.sort(
            (a, b) => (categoryOrderIndex.get(a.key) ?? 999) - (categoryOrderIndex.get(b.key) ?? 999),
          ),
        );
      } catch {
        if (!cancelled) {
          setItems([]);
          setHeroItems([]);
          setGallerySections([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadHomeGallery();
    return () => {
      cancelled = true;
    };
  }, []);

  const heroRotationPool = useMemo(
    () => selectGalleryItems(items, heroRotationIds, heroBackdropItemCount * 2, [
      "portrait",
      "poster-design",
      "ui-design",
      "ad-campaign",
      "storyboard-sequence",
      "anime-character",
      "character-design",
    ]),
    [items],
  );

  useEffect(() => {
    if (heroItems.length === 0 || heroRotationPool.length === 0) {
      return;
    }
    let cancelled = false;
    let timeoutId: number | null = null;
    const scheduleNextSwap = () => {
      timeoutId = window.setTimeout(() => {
        if (cancelled) {
          return;
        }
        if (!shouldRunAmbientAnimation()) {
          scheduleNextSwap();
          return;
        }
        setHeroSlideItems((currentItems) => buildNextHeroItems(currentItems, heroItems, heroRotationPool));
        setHeroSlideIndex((value) => value + 1);
        scheduleNextSwap();
      }, getNextHeroDelay());
    };
    scheduleNextSwap();
    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [heroItems, heroRotationPool]);

  useEffect(() => {
    if (gallerySections.length === 0) {
      return;
    }
    let sectionCursor = 0;
    const rotateOneGalleryCard = () => {
      if (!shouldRunAmbientAnimation()) {
        return;
      }
      setGallerySections((currentSections) => buildNextGallerySections(currentSections, sectionCursor));
      sectionCursor = (sectionCursor + 1) % gallerySections.length;
    };
    const firstTimeout = window.setTimeout(rotateOneGalleryCard, 6800);
    const interval = window.setInterval(rotateOneGalleryCard, 18000);
    return () => {
      window.clearTimeout(firstTimeout);
      window.clearInterval(interval);
    };
  }, [gallerySections.length]);

  useEffect(() => {
    if (gallerySections.length === 0) {
      return;
    }

    let ticking = false;
    const showGalleryNavTemporarily = () => {
      setIsGalleryNavVisible(true);
      if (galleryNavHideTimeoutRef.current !== null) {
        window.clearTimeout(galleryNavHideTimeoutRef.current);
      }
      galleryNavHideTimeoutRef.current = window.setTimeout(() => {
        setIsGalleryNavVisible(false);
        galleryNavHideTimeoutRef.current = null;
      }, 2200);
    };

    const updateGalleryNavState = () => {
      ticking = false;
      const recentUserIntent = Date.now() - lastGalleryNavIntentRef.current < 700;
      if (window.scrollY > 180 && recentUserIntent) {
        showGalleryNavTemporarily();
      } else {
        setIsGalleryNavVisible(false);
        if (galleryNavHideTimeoutRef.current !== null) {
          window.clearTimeout(galleryNavHideTimeoutRef.current);
          galleryNavHideTimeoutRef.current = null;
        }
      }

      const viewportAnchor = Math.min(220, window.innerHeight * 0.32);
      let nextActiveKey = "home";
      for (const section of gallerySections) {
        const element = document.getElementById(`gallery-${section.key}`);
        if (!element) {
          continue;
        }
        if (element.getBoundingClientRect().top <= viewportAnchor) {
          nextActiveKey = section.key;
        }
      }
      setActiveGalleryKey((currentKey) => (currentKey === nextActiveKey ? currentKey : nextActiveKey));
    };

    const markGalleryNavIntent = () => {
      lastGalleryNavIntentRef.current = Date.now();
      if (window.scrollY > 180) {
        showGalleryNavTemporarily();
      }
    };

    const requestUpdate = () => {
      if (ticking) {
        return;
      }
      ticking = true;
      window.requestAnimationFrame(updateGalleryNavState);
    };

    updateGalleryNavState();
    window.addEventListener("wheel", markGalleryNavIntent, { passive: true });
    window.addEventListener("touchmove", markGalleryNavIntent, { passive: true });
    window.addEventListener("keydown", markGalleryNavIntent);
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      if (galleryNavHideTimeoutRef.current !== null) {
        window.clearTimeout(galleryNavHideTimeoutRef.current);
        galleryNavHideTimeoutRef.current = null;
      }
      window.removeEventListener("wheel", markGalleryNavIntent);
      window.removeEventListener("touchmove", markGalleryNavIntent);
      window.removeEventListener("keydown", markGalleryNavIntent);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [gallerySections]);

  const featuredCount = useMemo(
    () => gallerySections.reduce((count, section) => count + section.items.length, 0),
    [gallerySections],
  );

  const handleUsePrompt = useCallback(
    (item: SeedGalleryItem) => {
      saveGalleryPromptIntent({
        prompt: item.prompt,
        sourceGalleryId: item.id,
        sourceKind: "seed",
        title: item.title,
        imageUrl: getPrimaryImageUrl(item) || undefined,
      });
      router.push(session ? "/image" : "/login?next=%2Fimage%2F");
    },
    [router, session],
  );

  const handleGalleryNav = useCallback((event: MouseEvent<HTMLAnchorElement>, sectionKey: string) => {
    event.preventDefault();
    const target = sectionKey === "home" ? document.getElementById("home") : document.getElementById(`gallery-${sectionKey}`);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", sectionKey === "home" ? "#home" : `#gallery-${sectionKey}`);
  }, []);

  const activeHeroItems = heroSlideItems.length > 0 ? heroSlideItems : heroItems;

  return (
    <section id="home" className="mx-auto flex w-full max-w-[1380px] flex-1 flex-col gap-5 pb-8 scroll-mt-4">
      <header className="flex min-h-12 items-center justify-between px-1 py-2 sm:px-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-base font-bold tracking-tight text-stone-950 transition hover:text-stone-700 dark:text-stone-50 dark:hover:text-white"
        >
          <Image
            src="/happyimage-logo.svg"
            alt="HappyImage"
            width={30}
            height={30}
            priority
            className="size-7 rounded-md shadow-[0_8px_20px_-14px_rgba(161,98,7,0.8)] sm:size-[30px]"
          />
          <span>HappyImage</span>
        </Link>
        <div className="flex items-center gap-2">
          <HeaderActions />
        </div>
      </header>

      <FloatingGalleryNav
        sections={gallerySections}
        activeKey={activeGalleryKey}
        visible={isGalleryNavVisible}
        onNavigate={handleGalleryNav}
      />

      <div className="relative min-h-[min(680px,calc(100dvh-8rem))] overflow-hidden px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-100/70 dark:bg-stone-900/70">
            <LoaderCircle className="size-5 animate-spin text-stone-400" />
          </div>
        ) : (
          <HeroBackdrop items={activeHeroItems} slideKey={heroSlideIndex} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/74 via-black/28 to-black/8" />
        <div className="relative z-10 flex min-h-[min(630px,calc(100dvh-11rem))] flex-col justify-end gap-6 pb-6 sm:pb-8">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/92 px-3 py-1.5 text-xs font-medium text-stone-800 shadow-sm">
            <Sparkles className="size-3.5" />
            官方灵感图库 · 公开预览
          </div>
          <div className="max-w-4xl space-y-4 text-white">
            <h1 className="text-5xl font-bold tracking-normal sm:text-6xl lg:text-7xl">
              HappyImage Studio
            </h1>
            <p className="max-w-2xl text-base leading-8 text-white/86 sm:text-lg">
              从好看的图开始生成。先浏览图片和提示词，选中灵感后继续创作。
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2 text-white">
              {[
                [total ? formatStatCount(total) : "--", "已接入素材"],
                [`${categoryCount || "--"}`, "创作分类"],
                [`${featuredCount || "--"}`, "首页精选"],
              ].map(([value, label]) => (
                <div key={label} className="min-w-24 border-l border-white/38 pl-3">
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="text-xs text-white/70">{label}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="h-11 rounded-lg bg-white px-5 text-stone-950 hover:bg-stone-200"
                onClick={() => (activeHeroItems[0] ? handleUsePrompt(activeHeroItems[0]) : router.push(session ? "/image" : "/login?next=%2Fimage%2F"))}
              >
                开始生成
                <ArrowRight className="size-4" />
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-lg border-white/70 bg-white/12 px-5 text-white hover:bg-white/22">
                <Link href="/gallery">浏览全部图库</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-1 sm:px-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase dark:text-stone-400">
              Inspiration
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-normal text-stone-950 dark:text-stone-50">精选图库</h2>
          </div>
          <Link href="/gallery" className="text-sm font-medium text-stone-500 transition hover:text-stone-950 dark:text-stone-400 dark:hover:text-white">
            查看全部
          </Link>
        </div>
        {featuredCount === 0 && !isLoading ? (
          <div className="flex min-h-48 items-center justify-center text-sm text-stone-500 dark:text-stone-400">
            官方图库暂时不可用
          </div>
        ) : (
          <div className="space-y-8">
            {gallerySections.map((section) => (
              <section id={`gallery-${section.key}`} key={section.key} className="scroll-mt-20 space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold tracking-normal text-stone-950 dark:text-stone-50">
                      {section.title}
                    </h3>
                    <p className="max-w-2xl text-sm leading-6 text-stone-500 dark:text-stone-400">
                      {section.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {section.categories.slice(0, 3).map((category) => (
                      <Badge key={category} variant="secondary" className="rounded-md px-2 py-0.5">
                        {formatCategory(category)}
                      </Badge>
                    ))}
                  </div>
                </div>
                <GalleryMasonryGrid items={section.items} onUsePrompt={handleUsePrompt} />
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
