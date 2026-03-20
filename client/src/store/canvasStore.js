import { create } from 'zustand';

export const useCanvasStore = create((set) => ({
  tool: 'select',
  color: '#6366f1',
  strokeColor: '#ffffff',
  strokeWidth: 2,
  fontSize: 16,
  zoom: 1,
  stagePos: { x: 0, y: 0 },
  selectedIds: [],

  setTool: (tool) => set({ tool, selectedIds: [] }),
  setColor: (color) => set({ color }),
  setStrokeColor: (strokeColor) => set({ strokeColor }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setFontSize: (fontSize) => set({ fontSize }),
  setZoom: (zoom) => set({ zoom }),
  setStagePos: (stagePos) => set({ stagePos }),
  setSelectedIds: (selectedIds) => set({ selectedIds }),
}));
