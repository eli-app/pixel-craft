import { Sprite } from 'pixi.js'
import { ASSETS } from './assets'
import { isoPosToWorldPos, TILE_HEIGHT, TILE_HEIGHT_HALF } from './tiles'

// Mapping: logiskt namn → frame-name i spritesheet
const ANIMAL_FRAMES: Record<string, string> = {
	sheep: 'sheepy.png'
}

// Om du vill kan du ha densitet för att inte alla spawnar
const ANIMAL_DENSITY: Record<string, number> = {
	sheep: 0.05
}

export type AnimalSpriteData = {
	xTile: number
	yTile: number
	seed: number
}

// Funktion för att deterministiskt bestämma spawn
const deterministicHash = (x: number, y: number, seed: number) => {
	const PRIME_X = 374761393
	const PRIME_Y = 668265263
	const PRIME_SEED = 982451653
	const MIXER = 1274126177

	let h = x * PRIME_X + y * PRIME_Y + seed * PRIME_SEED
	h = (h ^ (h >> 13)) * MIXER
	h = h ^ (h >> 16)

	return (h >>> 0) / 0xffffffff
}

// Skapa sprite
export const createAnimalSprite = (
	data: AnimalSpriteData,
	animalType: keyof typeof ANIMAL_FRAMES
) => {
	const { xTile, yTile, seed } = data
	const shouldRender = deterministicHash(xTile, yTile, seed)

	if (shouldRender >= ANIMAL_DENSITY[animalType]) return null

	const frameName = ANIMAL_FRAMES[animalType]
	const texture = ASSETS.ANIMALS?.textures[frameName]
	if (!texture) return null

	const worldPos = isoPosToWorldPos(xTile, yTile)

	const sprite = new Sprite({
		texture,
		x: worldPos.x,
		y: worldPos.y + TILE_HEIGHT * 0.75,
		anchor: { x: 0.5, y: 1 },
		zIndex: worldPos.y + TILE_HEIGHT_HALF
	})

	return sprite
}
