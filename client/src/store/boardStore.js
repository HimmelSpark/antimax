import { create } from 'zustand';
import api from '../api/client';

export const useBoardStore = create((set) => ({
  boards: [],
  currentBoard: null,
  loading: false,

  fetchBoards: async () => {
    set({ loading: true });
    const { data } = await api.get('/boards');
    set({ boards: data, loading: false });
  },

  createBoard: async (title) => {
    const { data } = await api.post('/boards', { title });
    set((state) => ({ boards: [data, ...state.boards] }));
    return data;
  },

  deleteBoard: async (id) => {
    await api.delete(`/boards/${id}`);
    set((state) => ({ boards: state.boards.filter((b) => b.id !== id) }));
  },

  fetchBoard: async (id) => {
    const { data } = await api.get(`/boards/${id}`);
    set({ currentBoard: data });
    return data;
  },

  getInvite: async (id) => {
    const { data } = await api.get(`/boards/${id}/invite`);
    return data;
  },

  joinByCode: async (code) => {
    const { data } = await api.post(`/boards/join/${code}`);
    return data;
  },
}));
