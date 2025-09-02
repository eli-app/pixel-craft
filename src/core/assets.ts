import { Assets, Spritesheet, Texture } from 'pixi.js'

export type AssetsKeys = 'BLOCKS' | 'PLAYER' | 'VEGETATION' | 'ANIMALS'

type TexturesMap = Record<string, Texture>

export type AnimalAssets = {
	textures: TexturesMap
}

export const ASSETS: Partial<Record<AssetsKeys, Spritesheet | AnimalAssets>> = {}

export type AudioKeys = 'WALK' | 'SWIM'
export const AUDIO: Partial<Record<AudioKeys, HTMLAudioElement[]>> = {}

export const loadAllinitialAssets = async () => {
	// Ladda standard spritesheets
	ASSETS.BLOCKS = await Assets.load('/game/blocks.json')
	ASSETS.VEGETATION = await Assets.load('/game/vegetation.json')
	ASSETS.PLAYER = await Assets.load('/game/character/player.json')
	ASSETS.ANIMALS = await Assets.load('/game/animals/sheep.json')

	// Ladda ljud
	AUDIO.WALK = [
		new Audio('/sound/step-1.mp3'),
		new Audio('/sound/step-2.mp3'),
		new Audio('/sound/step-3.mp3')
	]
	AUDIO.SWIM = [new Audio('/sound/swim-1.mp3'), new Audio('/sound/swim-2.mp3')]
}
