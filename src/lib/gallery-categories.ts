export const galleryCategoryLabels: Record<string, string> = {
  "3d-render": "3D",
  abstract: "抽象背景",
  "abstract-texture": "抽象纹理",
  "ad-campaign": "广告营销",
  "ad-creative": "广告创意",
  animal: "动物宠物",
  "animal-pet": "动物宠物",
  "anime-character": "动漫角色",
  architecture: "建筑空间",
  "beauty-portrait": "美妆人像",
  "brand-board": "品牌视觉板",
  character: "角色",
  "character-design": "角色设定",
  "cinematic-portrait": "电影感写真",
  comparison: "对比改图",
  "couple-portrait": "情侣照",
  editing: "改图修图",
  "editing-workflow": "改图修图",
  ecommerce: "电商",
  "ecommerce-main-image": "电商主图",
  external: "外部灵感",
  "external-inspiration": "外部灵感",
  fashion: "时尚穿搭",
  "fashion-editorial": "时尚大片",
  food: "美食饮品",
  "food-beverage": "美食饮品",
  game: "游戏",
  "game-visual": "游戏视觉",
  "id-photo": "证件照",
  illustration: "插画",
  "illustration-art": "插画艺术",
  infographic: "信息图",
  "infographic-chart": "信息图表",
  landscape: "自然风景",
  "landscape-nature": "自然风景",
  "lifestyle-portrait": "生活方式人像",
  "logo-typography": "字体标志",
  "movie-poster": "电影海报",
  portrait: "人像",
  "portrait-style-transfer": "写真风格迁移",
  poster: "海报",
  "poster-design": "海报设计",
  product: "产品摄影",
  "product-photography": "产品摄影",
  "professional-headshot": "职业头像",
  "retro-portrait": "复古写真",
  "social-media": "社媒封面",
  "social-thumbnail": "社媒封面",
  sports: "运动",
  "sports-poster": "运动海报",
  "storyboard-sequence": "分镜叙事",
  "toy-3d": "3D 手办",
  "travel-portrait": "旅行照",
  "travel-poster": "旅行海报",
  typography: "字体标志",
  ui: "UI",
  "ui-design": "界面设计",
};

export const galleryCategoryOrder = [
  "portrait",
  "fashion-editorial",
  "product-photography",
  "ecommerce-main-image",
  "ad-campaign",
  "poster-design",
  "social-thumbnail",
  "infographic-chart",
  "ui-design",
  "brand-board",
  "logo-typography",
  "food-beverage",
  "storyboard-sequence",
  "editing-workflow",
  "anime-character",
  "character-design",
  "toy-3d",
  "illustration-art",
  "interior-architecture",
  "landscape-nature",
  "abstract-texture",
  "game-visual",
  "animal-pet",
  "external-inspiration",
  "fashion",
  "poster",
  "social-media",
  "infographic",
  "ui",
  "character",
  "3d-render",
  "illustration",
  "architecture",
  "landscape",
  "abstract",
  "game",
  "animal",
  "external",
] as const;

export function formatGalleryCategory(value: string) {
  return galleryCategoryLabels[value] || value || "未分类";
}

export function compareGalleryCategories(a: string, b: string) {
  const aIndex = galleryCategoryOrder.indexOf(a as (typeof galleryCategoryOrder)[number]);
  const bIndex = galleryCategoryOrder.indexOf(b as (typeof galleryCategoryOrder)[number]);
  const aRank = aIndex === -1 ? galleryCategoryOrder.length : aIndex;
  const bRank = bIndex === -1 ? galleryCategoryOrder.length : bIndex;
  if (aRank !== bRank) {
    return aRank - bRank;
  }
  return formatGalleryCategory(a).localeCompare(formatGalleryCategory(b), "zh-Hans-CN");
}

export function compareGalleryCategoryEntries(a: [string, number], b: [string, number]) {
  if (a[0] === "portrait" || b[0] === "portrait") {
    return a[0] === b[0] ? 0 : a[0] === "portrait" ? -1 : 1;
  }
  const countDelta = b[1] - a[1];
  if (countDelta !== 0) {
    return countDelta;
  }
  return compareGalleryCategories(a[0], b[0]);
}
