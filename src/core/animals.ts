// @ts-ignore
import { Noise } from 'noisejs'
import { Sprite } from 'pixi.js'
import { isoPosToWorldPos, TILE_HEIGHT, TILE_HEIGHT_HALF, TILE_WIDTH_HALF } from './tiles'
import { ASSETS } from './assets'
import { SEED } from '../lib/utils/perlinNoise'
import { isTileWater } from './water'
import { Chunk } from '../types/tiles'

type AnimalSpriteData = {
	xPosTile: number
	yPosTile: number
	perlin: number[][]
	row: number
	col: number
}

const ANIMAL_NOISE = {
	'sheepy.png': 0.05
} as const

const ANIMAL_DENSITY = 0.02

// Lista på djur som räknas som "collidable"
const collisions = ['sheepy.png']

export const hasAnimalCollisions = (animal: Sprite) => {
	return collisions.includes(animal.texture.label ?? '')
}

// Deterministisk hash för slump utan att bli helt random
const deterministicHash = (x: number, y: number, seed: number) => {
	const PRIME_X = 374761393
	const PRIME_Y = 668265263
	const PRIME_SEED = 982451653
	const MIXER = 1274126177

	let h = x * PRIME_X + y * PRIME_Y + seed * PRIME_SEED
	h = (h ^ (h >> 13)) * MIXER
	h = h ^ (h >> 16)

	return (h >>> 0) / 0xffffffff // normaliserat till [0,1)
}

// Enkel Perlin-baserad djurplacering
const generateAnimalNoise = (x: number, y: number) => {
	const noise = new Noise(SEED)
	return noise.perlin2(x * 0.05, y * 0.05)
}

// Bestäm vilken djurtextur som ska användas
const getTextureFromPerlin = (perlin: number, x: number, y: number) => {
	let textureKey = ''
	const shouldRender = deterministicHash(x, y, SEED)

	for (const [key, value] of Object.entries(ANIMAL_NOISE)) {
		if (perlin >= value && shouldRender < ANIMAL_DENSITY) {
			textureKey = key
		}
	}

	if (!textureKey || !ASSETS.ANIMALS) return null
	return ASSETS.ANIMALS.textures[textureKey] // Nu fungerar det direkt
}

// Konvertera positionskoordinater
export const convertAnimalPosToGround = (x: number, y: number) => {
	const newX = x - TILE_WIDTH_HALF
	const newY = y - TILE_HEIGHT * 0.75
	return { x: newX, y: newY }
}

// Skapar Pixi Sprite för djur
export const createAnimalSprite = (data: AnimalSpriteData) => {
	const { xPosTile, yPosTile, perlin, row, col } = data

	// Djur vill kanske inte stå på vatten
	if (isTileWater(perlin[row][col])) return null

	const x = xPosTile
	const y = yPosTile + TILE_HEIGHT * 0.75
	const worldPos = isoPosToWorldPos(xPosTile, yPosTile)

	const animalNoise = generateAnimalNoise(worldPos.x, worldPos.y)
	const textureData = getTextureFromPerlin(animalNoise, xPosTile, yPosTile)

	if (!textureData) return null

	const labelPos = convertAnimalPosToGround(x, y)

	const sprite = new Sprite({
		texture: textureData,
		width: textureData.width,
		height: textureData.height,
		x: x,
		y: y,
		anchor: { x: 0.5, y: 1 },
		label: `${labelPos.x}_${labelPos.y}`,
		zIndex: labelPos.y + TILE_HEIGHT_HALF
	})

	return sprite
}

// Hämta djur från ett Chunk
export const getAnimalFromGround = (chunk: Chunk, label: string) => {
	return chunk.surface?.getChildByLabel(label)
}
