import { Sprite } from 'pixi.js'
import { TILE_HEIGHT, TILE_WIDTH, TILE_WIDTH_HALF } from './tiles'
import { ASSETS } from './assets'
import { getWaterTextureFromPerlin, isTileWater } from './water'
import { getPerlinAroundCell } from '../lib/utils/perlinNoise'

type GroundSpriteData = {
	xPosTile: number
	yPosTile: number
	perlin: number[][]
	row: number
	col: number
}

const isAdjacentToWater = (perlin: number[][], row: number, col: number) => {
	const directions = [
		[-1, -1],
		[-1, 0],
		[-1, 1],
		[0, -1],
		[0, 1],
		[1, -1],
		[1, 0],
		[1, 1]
	]

	for (const [dRow, dCol] of directions) {
		const newRow = row + dRow
		const newCol = col + dCol

		if (newRow >= 0 && newRow < perlin.length && newCol >= 0 && newCol < perlin[0].length) {
			if (isTileWater(perlin[newRow][newCol])) {
				return true
			}
		}
	}

	return false
}

export const createGroundSprite = (data: GroundSpriteData) => {
	const { xPosTile, yPosTile, perlin, row, col } = data

	const x = xPosTile - TILE_WIDTH_HALF
	const y = yPosTile

	const sprite = new Sprite({
		width: TILE_WIDTH,
		height: TILE_HEIGHT * 2, // Dubble the height since we have walls on some block but this does not effect the position only the texture
		x: x,
		y: y,
		label: `${x}_${y}` // Adding the positino to the label so we can get tha same tile on the surface as well
	})

	if (ASSETS.BLOCKS) {
		sprite.texture = ASSETS.BLOCKS.animations['grass'][0]

		if (isTileWater(perlin[row][col])) {
			const perlinArea = getPerlinAroundCell(xPosTile, yPosTile)
			const { water, key } = getWaterTextureFromPerlin(perlinArea)

			// We have set the staged app background to the same color as the water so if the tile is the default water with no border then we can just skip rendering it and use the background instea insteadd
			if (key === 'water') {
				return null
			}

			sprite.texture = water
		} else if (isAdjacentToWater(perlin, row, col)) {
			sprite.texture = ASSETS.BLOCKS.animations['sand'][0]
		}
	}

	return sprite
}
