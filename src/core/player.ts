import { Container, ContainerChild, Sprite, Ticker } from 'pixi.js'
import { ASSETS, AUDIO } from './assets'
import {
	getChunk,
	getChunkByGlobalPosition,
	getChunkByKey,
	getIsoCollisionSides,
	getIsometricTilePositions,
	getVisibleChunkKeys,
	getVisibleChunks,
	isoPosToWorldPos,
	TILE_HEIGHT,
	TILE_HEIGHT_HALF,
	TILE_WIDTH_HALF
} from './tiles'
import { Chunk } from '../types/tiles'
import { getVegetationFromGround, hasVegetationCollisions } from './vegetation'
import { generatePerlinNoise } from '../lib/utils/perlinNoise'
import { isTileWater } from './water'

export const PLAYER_WIDTH = 32
export const PLAYER_HEIGHT = 64
const PLAYER_FRAME_LENGTH = 3

const DEFAULT_SPEED = 1
export let PLAYER_SPEED = DEFAULT_SPEED
const WATER_SPEED_REDUCTION = 0.6
const SPRINT_MULTIPLIER = 5
let sprintHeld = false
const PLAYER_WATER_Y_POS_TOP = TILE_HEIGHT
const PLAYER_WATER_Y_POS_BOTTOM = TILE_HEIGHT_HALF
let playerIsInWater = false
const PLAYER_VOLUM = 0.4

const allowedKeys = ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const
type AllowedKeys = (typeof allowedKeys)[number]

const playerMovementKeys = new Set<string>([])

let animationTimer = 0
let currentFrame = 0
let animationKey = 'down-center'
const animationSpeed = 0.1

let playerChunkKey = ''

const normalizeKey = (key: string) => (key.length === 1 ? key.toLowerCase() : key)

const getVerticleDirection = (key: string) => {
	if (key === 'w' || key === 'ArrowUp') return 'up'
	if (key === 's' || key === 'ArrowDown') return 'down'
	return ''
}

const getHorizontalDirection = (key: string) => {
	if (key === 'a' || key === 'ArrowLeft') return 'left'
	if (key === 'd' || key === 'ArrowRight') return 'right'
	return ''
}

const getPlayerAnimationKey = (keys: Set<string>) => {
	if (keys.size === 0 && playerIsInWater) {
		return 'water-' + animationKey
	}

	if (keys.size > 2 || keys.size === 0) return animationKey

	const verticalKeys = ['w', 's', 'ArrowUp', 'ArrowDown']
	const horizontalKeys = ['a', 'd', 'ArrowLeft', 'ArrowRight']

	let vertical = ''
	let horizontal = ''

	for (const key of keys) {
		if (verticalKeys.includes(key)) {
			vertical = getVerticleDirection(key)
		} else if (horizontalKeys.includes(key)) {
			horizontal = getHorizontalDirection(key)
		}
	}

	let key = ''

	if (keys.size === 1) {
		if (vertical) key = `${vertical}-center`
		if (horizontal) key = `${horizontal}-${horizontal}`
	}

	if (vertical && horizontal) {
		key = `${vertical}-${horizontal}`
	}

	if (playerIsInWater) {
		key = 'water-' + key
	}

	return key
}

const centerPlayerToCenterTile = () => {
	const xPos = window.innerWidth / 2
	const yPos = window.innerHeight / 2
	const { x, y } = isoPosToWorldPos(xPos, yPos)

	const { yPosTile, xPosTile } = getIsometricTilePositions(y, x, TILE_WIDTH_HALF, TILE_HEIGHT_HALF)

	return {
		x: xPosTile - PLAYER_WIDTH / 2,
		y: yPosTile + PLAYER_HEIGHT / 2
	}
}

export const createPlayer = (world: Container) => {
	const { x, y } = centerPlayerToCenterTile()

	const player = new Sprite()
	player.anchor.set(0, 1)
	player.label = 'player'
	player.x = x
	player.y = y
	player.width = PLAYER_WIDTH
	player.height = PLAYER_HEIGHT

	handlePlayerInWater(player, world)
	animationKey = getPlayerAnimationKey(playerMovementKeys)

	if (ASSETS.PLAYER) {
		player.texture = ASSETS.PLAYER.animations[animationKey][currentFrame]
	}

	return player
}

const isAllowedKey = (key: string): key is AllowedKeys => {
	return allowedKeys.includes(key as AllowedKeys)
}

export const registerSprint = (key: string) => {
	if (key === 'Shift') sprintHeld = true
}

export const removeSprint = (key: string) => {
	if (key === 'Shift') sprintHeld = false
}

export const registerPlayerMovement = (key: string) => {
	const k = normalizeKey(key)
	if (isAllowedKey(k) && !playerMovementKeys.has(k)) {
		const opposites: Record<string, string> = {
			w: 's',
			s: 'w',
			a: 'd',
			d: 'a',
			ArrowUp: 'ArrowDown',
			ArrowDown: 'ArrowUp',
			ArrowLeft: 'ArrowRight',
			ArrowRight: 'ArrowLeft'
		}

		const opposite = opposites[k]
		if (opposite && playerMovementKeys.has(opposite)) {
			removePlayerMovement(opposite)
		}

		playerMovementKeys.add(k)
	}
}

export const removePlayerMovement = (key: string) => {
	const k = normalizeKey(key)
	if (isAllowedKey(k) && playerMovementKeys.has(k)) {
		playerMovementKeys.delete(k)
	}
}

export const isPlayerMoving = () => {
	return playerMovementKeys.size !== 0
}

export const isPlayerStopping = () => {
	return playerMovementKeys.size === 0 && currentFrame !== 0
}

const handlePlayerAnimation = (player: Sprite) => {
	if (animationTimer >= animationSpeed && playerMovementKeys.size > 0) {
		animationTimer = 0
		currentFrame = (currentFrame + 1) % PLAYER_FRAME_LENGTH
		animationKey = getPlayerAnimationKey(playerMovementKeys)
		if (ASSETS.PLAYER) {
			player.texture = ASSETS.PLAYER.animations[animationKey][currentFrame]
		}

		const isStepFrame = currentFrame === 1 || currentFrame === 3

		if (isStepFrame && !playerIsInWater && AUDIO.WALK) {
			const sound = AUDIO.WALK[Math.floor(Math.random() * AUDIO.WALK.length)]
			sound.currentTime = 0
			sound.volume = PLAYER_VOLUM
			sound.play()
		} else if (currentFrame === 1 && playerIsInWater && AUDIO.SWIM) {
			const sound = AUDIO.SWIM[Math.floor(Math.random() * AUDIO.SWIM.length)]
			if (sound.paused) {
				sound.currentTime = 0
				sound.volume = PLAYER_VOLUM
				sound.play()
			}
		}
	}
}

export const setPlayerAnimation = (
	player: Sprite,
	key: string | null = animationKey,
	frame: number | null = currentFrame
) => {
	animationTimer = 0
	currentFrame = frame ?? currentFrame
	animationKey = key ?? animationKey
	if (ASSETS.PLAYER) {
		player.texture = ASSETS.PLAYER.animations[animationKey][currentFrame]
	}
}

const getAllActivePlayerTiles = (chunk: Chunk, player: Sprite) => {
	const ground = chunk.ground?.children ?? []
	const tiles: ContainerChild[] = []

	for (const tile of ground) {
		const cx = tile.x + TILE_WIDTH_HALF
		const cy = tile.y + TILE_HEIGHT_HALF

		const dx = Math.abs(player.x - cx) / TILE_WIDTH_HALF
		const dy = Math.abs(player.y - cy) / TILE_HEIGHT_HALF

		const isInIsometricTile = dx + dy <= 1

		if (isInIsometricTile) {
			tiles.push(tile)
		}
	}

	return tiles
}

const isPlayerBehindItem = (item: ContainerChild, groundTile: ContainerChild, player: Sprite) => {
	const itemLeft = item.x - item.width / 2
	const itemRight = item.x + item.width / 2
	const itemTop = item.y - item.height

	const playerRight = player.x + player.width
	const playerTop = player.y - player.height

	const isRight = player.x < itemRight && player.x > itemLeft
	const isLeft = playerRight > itemLeft && playerRight < itemRight
	const isTop = player.y > itemTop && player.y < item.y
	const isBottom = playerTop < item.y && playerTop > itemTop
	const isAboveGroundTile = player.y < groundTile.y + TILE_HEIGHT_HALF

	return isAboveGroundTile && (isRight || isLeft) && (isTop || isBottom)
}

export const putPlayerInChunk = (player: Sprite) => {
	const { row, col } = getChunkByGlobalPosition(player.x, player.y)

	const newChunk = getChunk(row, col)
	const oldChunk = getChunkByKey(playerChunkKey)
	if (!newChunk || !newChunk.surface) return
	const newKey = newChunk.surface.label

	if (newKey === oldChunk?.surface?.label) return

	if (oldChunk?.surface) {
		oldChunk.surface.removeChild(player)
	}

	newChunk.surface?.addChild(player)
	playerChunkKey = newKey
}

const handlePlayerBounds = (player: Sprite) => {
	let allowedDirection = [...allowedKeys]
	const { row, col } = getChunkByGlobalPosition(player.x, player.y)
	const keys = getVisibleChunkKeys(row, col)
	const chunks = getVisibleChunks(keys)

	const activeChunk = chunks.get(`${col}_${row}`)!
	const currentTiles = getAllActivePlayerTiles(activeChunk, player)

	for (const [_, chunk] of chunks) {
		if (!chunk.ground) continue

		const ground = chunk.ground.children
		for (let i = ground.length - 1; i >= 0; i--) {
			const tile = ground[i]
			const currentVegetation = getVegetationFromGround(chunk, tile.label)
			const hasCollisions = currentVegetation
				? hasVegetationCollisions(currentVegetation as Sprite)
				: false

			if (!hasCollisions) continue

			if (currentVegetation && isPlayerBehindItem(currentVegetation, tile, player)) {
				currentVegetation.alpha = 0.4
			} else if (currentVegetation) {
				currentVegetation.alpha = 1
			}

			if (currentVegetation && currentTiles.includes(tile)) {
				const collidedSides = getIsoCollisionSides(tile, player)

				if (collidedSides['top-left']) {
					allowedDirection = ['w', 'a', 'ArrowUp', 'ArrowLeft']
					break
				}
				if (collidedSides['top-right']) {
					allowedDirection = ['w', 'd', 'ArrowUp', 'ArrowRight']
					break
				}
				if (collidedSides['bottom-left']) {
					allowedDirection = ['s', 'a', 'ArrowDown', 'ArrowLeft']
					break
				}
				if (collidedSides['bottom-right']) {
					allowedDirection = ['s', 'd', 'ArrowDown', 'ArrowRight']
					break
				}
				if (collidedSides['top']) {
					allowedDirection = ['w', 'a', 'd', 'ArrowUp', 'ArrowLeft', 'ArrowRight']
					break
				}
				if (collidedSides['bottom']) {
					allowedDirection = ['s', 'a', 'd', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
					break
				}
			}
		}
	}

	return allowedDirection
}

export const movePlayerTo = (x: number, y: number, world: Container, player: Sprite) => {
	const xDiff = world.x - x
	const yDiff = world.y - y

	world.y += yDiff
	world.x += xDiff

	player.y -= yDiff
	player.x -= xDiff
}

const isPlayerInWater = (player: Sprite) => {
	let isWater: Record<string, any> = {}

	const topLineYPos = playerIsInWater
		? player.y - PLAYER_WATER_Y_POS_TOP
		: player.y - PLAYER_WATER_Y_POS_BOTTOM

	const positions = {
		'top-left': isoPosToWorldPos(player.x, topLineYPos),
		'top-right': isoPosToWorldPos(player.x + player.width, topLineYPos),
		'bottom-left': isoPosToWorldPos(player.x, player.y),
		'bottom-right': isoPosToWorldPos(player.x + player.width, player.y)
	}

	for (const [key, pos] of Object.entries(positions)) {
		const noise = generatePerlinNoise(pos.x, pos.y)

		const [line] = key.split('-')
		isWater[line] = isTileWater(noise)
	}

	return isWater
}

export const handlePlayerInWater = (player: Sprite, world: Container) => {
	const { top, bottom } = isPlayerInWater(player)

	if (top && !playerIsInWater) {
		playerIsInWater = true
		PLAYER_SPEED = WATER_SPEED_REDUCTION
		movePlayerTo(world.x, world.y - PLAYER_WATER_Y_POS_BOTTOM, world, player)
	} else if (!bottom && playerIsInWater) {
		playerIsInWater = false
		PLAYER_SPEED = DEFAULT_SPEED
		movePlayerTo(world.x, world.y + PLAYER_WATER_Y_POS_BOTTOM, world, player)
	} else if (bottom && !playerIsInWater) {
		playerIsInWater = true
		PLAYER_SPEED = WATER_SPEED_REDUCTION
		movePlayerTo(world.x, world.y + PLAYER_WATER_Y_POS_TOP, world, player)
	} else if (!top && playerIsInWater) {
		playerIsInWater = false
		PLAYER_SPEED = DEFAULT_SPEED
		movePlayerTo(world.x, world.y - PLAYER_WATER_Y_POS_TOP, world, player)
	}
}

export const movePlayerPosition = (player: Sprite, world: Container, ticker: Ticker) => {
	putPlayerInChunk(player)
	const allowedDirection = handlePlayerBounds(player)
	const boost = sprintHeld && !playerIsInWater ? SPRINT_MULTIPLIER : 1
	const distance = ticker.deltaTime * PLAYER_SPEED * boost

	if (
		(playerMovementKeys.has('w') || playerMovementKeys.has('ArrowUp')) &&
		allowedDirection.includes('w')
	) {
		world.y += distance
		player.y -= distance
	}

	if (
		(playerMovementKeys.has('a') || playerMovementKeys.has('ArrowLeft')) &&
		allowedDirection.includes('a')
	) {
		world.x += distance * 2
		player.x -= distance * 2
	}

	if (
		(playerMovementKeys.has('s') || playerMovementKeys.has('ArrowDown')) &&
		allowedDirection.includes('s')
	) {
		world.y -= distance
		player.y += distance
	}

	if (
		(playerMovementKeys.has('d') || playerMovementKeys.has('ArrowRight')) &&
		allowedDirection.includes('d')
	) {
		world.x -= distance * 2
		player.x += distance * 2
	}

	handlePlayerInWater(player, world)

	player.zIndex = player.y

	animationTimer += ticker.deltaTime / 60
	handlePlayerAnimation(player)
}
