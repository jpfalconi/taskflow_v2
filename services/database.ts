
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Task } from "../types";

const CONFIG_KEY = 'taskflow_supabase_config';

export interface SupabaseConfig {
  url: string;
  key: string;
  systemKey?: string;
}

let supabase: SupabaseClient | null = null;

const initSupabase = () => {
  // 1. Tenta Variáveis de Ambiente (Configuração Global/Servidor)
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  let url = envUrl || '';
  let key = envKey || '';

  // 2. Tenta Parâmetros da URL (Para sincronizar celular/outros PCs rapidamente)
  const params = new URLSearchParams(window.location.search);
  const urlParam = params.get('supa_url');
  const keyParam = params.get('supa_key');
  const pinParam = params.get('supa_pin');

  if (urlParam && keyParam) {
    url = urlParam;
    key = keyParam;
    // Salva localmente para não precisar do link toda vez
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ url, key, systemKey: pinParam || '' }));
    // Limpa a URL por segurança
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // 3. Tenta LocalStorage (Configuração Manual salva anteriormente)
  if (!url) {
    const savedConfig = localStorage.getItem(CONFIG_KEY);
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        url = parsed.url;
        key = parsed.key;
      } catch (e) { }
    }
  }

  if (url && key && url.startsWith('http')) {
    try {
      supabase = createClient(url, key);
      return true;
    } catch (e) {
      console.error("Erro Supabase:", e);
      return false;
    }
  }
  return false;
};

initSupabase();

export const db = {
  saveConfig(url: string, key: string, systemKey?: string) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ url, key, systemKey }));
    return initSupabase();
  },

  getConfig(): SupabaseConfig | null {
    if (import.meta.env.VITE_SUPABASE_URL) {
      return {
        url: import.meta.env.VITE_SUPABASE_URL,
        key: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        systemKey: import.meta.env.VITE_MASTER_KEY || ''
      };
    }
    const saved = localStorage.getItem(CONFIG_KEY);
    try { return saved ? JSON.parse(saved) : null; } catch { return null; }
  },

  getSyncLink(): string {
    const config = this.getConfig();
    if (!config || !config.url) return '';
    const base = window.location.origin + window.location.pathname;
    return `${base}?supa_url=${encodeURIComponent(config.url)}&supa_key=${encodeURIComponent(config.key)}&supa_pin=${encodeURIComponent(config.systemKey || '')}`;
  },

  isReady(): boolean {
    return !!supabase;
  },

  isGlobal(): boolean {
    return !!import.meta.env.VITE_SUPABASE_URL;
  },

  async getTasks(): Promise<Task[]> {
    if (!supabase) return this._getLocal();
    try {
      const { data, error } = await supabase.from('tasks').select('*').order('createdAt', { ascending: false });
      if (error) throw error;
      if (data) {
        localStorage.setItem('taskflow_cache', JSON.stringify(data));
        return data as Task[];
      }
      return [];
    } catch (error) {
      return this._getLocal();
    }
  },

  async saveTask(task: Task): Promise<void> {
    this._updateLocal(task);
    if (supabase) await supabase.from('tasks').upsert(task);
  },

  async saveTasks(tasks: Task[]): Promise<void> {
    const local = this._getLocal();
    const merged = [...tasks, ...local.filter(lt => !tasks.find(nt => nt.id === lt.id))];
    localStorage.setItem('taskflow_cache', JSON.stringify(merged));
    if (supabase) await supabase.from('tasks').upsert(tasks);
  },

  async deleteTask(id: string): Promise<void> {
    const local = this._getLocal().filter((t: any) => t.id !== id);
    localStorage.setItem('taskflow_cache', JSON.stringify(local));
    if (supabase) await supabase.from('tasks').delete().eq('id', id);
  },

  async updateStatus(id: string, status: any): Promise<void> {
    const local = this._getLocal().map((t: any) => t.id === id ? { ...t, status } : t);
    localStorage.setItem('taskflow_cache', JSON.stringify(local));
    if (supabase) await supabase.from('tasks').update({ status }).eq('id', id);
  },

  _getLocal() {
    const d = localStorage.getItem('taskflow_cache');
    return d ? JSON.parse(d) : [];
  },

  _updateLocal(task: Task) {
    const local = this._getLocal();
    const idx = local.findIndex((t: Task) => t.id === task.id);
    if (idx > -1) local[idx] = task; else local.unshift(task);
    localStorage.setItem('taskflow_cache', JSON.stringify(local));
  }
};
