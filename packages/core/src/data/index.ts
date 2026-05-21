import type { SkillDefinition } from '../types/skills'
import imageCards from './image-cards'
import xhsImages from './xhs-images'
import infographic from './infographic'
import coverImage from './cover-image'
import slideDeck from './slide-deck'
import comic from './comic'
import articleIllustrator from './article-illustrator'
import diagram from './diagram'

export const skills: SkillDefinition[] = [
  imageCards,
  xhsImages,
  infographic,
  coverImage,
  slideDeck,
  comic,
  articleIllustrator,
  diagram,
]

export function getSkill(id: string): SkillDefinition | undefined {
  return skills.find(s => s.id === id)
}

export { imageCards, infographic, coverImage, slideDeck, comic, articleIllustrator, diagram }
export * from './preference-schemas'
