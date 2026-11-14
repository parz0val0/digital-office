export interface Theme {
  floorCols: string[]
  floorLine: string
  pattern: 'planks' | 'tiles'
  wallBack: string
  wallLeft: string
  trimBack: string
  trimLeft: string
  baseboard: string
  rug: string
  rugInner: string
  chair: string
  accent: string
  slab: string
}

export const THEMES: Record<string, Theme> = {
  // 大厅：暖木地板 + 奶油/薄荷墙
  warm: {
    floorCols: ['#e2b57c', '#d9a96d', '#e8c08a', '#d4a063'], floorLine: 'rgba(120,70,30,0.35)', pattern: 'planks',
    wallBack: '#fbe3c6', wallLeft: '#d6ebe3', trimBack: '#f2c48d', trimLeft: '#a9d0c3', baseboard: '#fff6e8',
    rug: '#9ec9d9', rugInner: '#c8e3ec', chair: '#7fb5c9', accent: '#ff8a3d', slab: '#8b6a4f',
  },
  // 课程：浅色原木 + 薄荷绿
  mint: {
    floorCols: ['#efdcb5', '#e8d3a8', '#f2e2bf', '#e3cd9f'], floorLine: 'rgba(130,100,50,0.3)', pattern: 'planks',
    wallBack: '#e1f3da', wallLeft: '#fdf1c9', trimBack: '#a8d89a', trimLeft: '#f3d77c', baseboard: '#ffffff',
    rug: '#b9e3b0', rugInner: '#d9f2d3', chair: '#8cc98a', accent: '#40c057', slab: '#7a8a5c',
  },
  // 交易：深石板地砖 + 夜蓝墙
  night: {
    floorCols: ['#56627a', '#4c586f'], floorLine: 'rgba(20,25,40,0.5)', pattern: 'tiles',
    wallBack: '#c9d3ee', wallLeft: '#b4c0e0', trimBack: '#6c7fb8', trimLeft: '#566aa6', baseboard: '#e8edfb',
    rug: '#2f3b57', rugInner: '#3b4a6d', chair: '#4d6fbf', accent: '#3b82f6', slab: '#3a4358',
  },
  // 竞赛：暖红 + 金色
  sunset: {
    floorCols: ['#f0b9a4', '#ebae98', '#f4c4b0'], floorLine: 'rgba(150,60,40,0.3)', pattern: 'tiles',
    wallBack: '#ffd9cc', wallLeft: '#ffe9b8', trimBack: '#f08a6a', trimLeft: '#f0c24a', baseboard: '#fff5ee',
    rug: '#e8736b', rugInner: '#f29b92', chair: '#e8736b', accent: '#f03e3e', slab: '#9c5a48',
  },
}
export const THEME_ORDER = ['warm', 'mint', 'night', 'sunset']

export function themeFor(name: string | undefined, index: number): Theme {
  if (name && THEMES[name]) return THEMES[name]
  return THEMES[THEME_ORDER[index % THEME_ORDER.length]]
}
