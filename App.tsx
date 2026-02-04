
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Task, TaskStatus, ViewType, RecurrenceType, Subtask } from './types';
import TaskCard from './components/TaskCard';
import AiAssistant from './components/AiAssistant';
import Dashboard from './components/Dashboard';
import { db } from './services/database';

const DEFAULT_CATEGORIES = ['Pessoal', 'Trabalho', 'Saúde', 'Financeiro'];
const GLOBAL_PIN = import.meta.env.VITE_MASTER_KEY || "Mudar@180684";

const getTodayStr = () => new Date().toISOString().split('T')[0];
const isLate = (dateStr?: string) => dateStr && dateStr < getTodayStr();
const isSoon = (dateStr?: string) => {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 3;
};

const calculateNextOccurrence = (currentDateStr: string, type: RecurrenceType): string => {
  const date = new Date(currentDateStr + 'T12:00:00');
  switch (type) {
    case 'DAILY': date.setDate(date.getDate() + 1); break;
    case 'WEEKLY': date.setDate(date.getDate() + 7); break;
    case 'MONTHLY': date.setMonth(date.getMonth() + 1); break;
    case 'YEARLY': date.setFullYear(date.getFullYear() + 1); break;
    default: return currentDateStr;
  }
  return date.toISOString().split('T')[0];
};

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<ViewType>('QUADRO');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set<string>());
  const [sortMode, setSortMode] = useState<'DATE' | 'TITLE'>('DATE');



  const [isAuthorized, setIsAuthorized] = useState(() => localStorage.getItem('taskflow_auth') === 'true');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Subtasks State
  const [subtaskInput, setSubtaskInput] = useState('');
  const [currentSubtasks, setCurrentSubtasks] = useState<Subtask[]>([]);

  const loadData = async (cat?: string) => {
    setIsLoading(true);
    const data = await db.getTasks();
    setTasks(data);
    if (cat) { setSelectedCategories([cat]); setView('LISTA'); }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isAuthorized) loadData();
  }, [isAuthorized]);

  useEffect(() => {
    if (view !== 'LISTA') setSelectedIds(new Set<string>());
  }, [view]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const activePin = db.getConfig()?.systemKey || GLOBAL_PIN;
    if (pinInput === activePin) {
      setIsAuthorized(true);
      localStorage.setItem('taskflow_auth', 'true');
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 500);
    }
  };


  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleSelectAll = () => {
    const visibleIds = sortedAndFilteredTasks.map(t => t.id);
    if (selectedIds.size === visibleIds.length && visibleIds.length > 0) {
      setSelectedIds(new Set<string>());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  };

  const handleBulkDelete = async () => {
    if (confirm(`Excluir ${selectedIds.size} tarefas permanentemente?`)) {
      const idsToRemove = [...selectedIds];
      setTasks((prev: Task[]) => prev.filter((t: Task) => !selectedIds.has(t.id)));
      setSelectedIds(new Set<string>());
      for (const id of idsToRemove) { await db.deleteTask(id); }
    }
  };

  const handleBulkComplete = async () => {
    if (confirm(`Finalizar as ${selectedIds.size} tarefas selecionadas?`)) {
      const idsToUpdate = [...selectedIds];
      setTasks((prev: Task[]) => prev.map((t: Task) => selectedIds.has(t.id) ? { ...t, status: TaskStatus.DONE } : t));
      setSelectedIds(new Set<string>());
      for (const id of idsToUpdate) { await db.updateStatus(id, TaskStatus.DONE); }
    }
  };

  const handleBulkEdit = async () => {
    const newCat = prompt("Digite a nova categoria para as tarefas selecionadas:");
    if (newCat) {
      const cat = newCat.trim();
      const idsToUpdate = [...selectedIds];
      setTasks((prev: Task[]) => prev.map((t: Task) => selectedIds.has(t.id) ? { ...t, category: cat } : t));
      setSelectedIds(new Set<string>());
      for (const id of idsToUpdate) {
        const task = tasks.find(t => t.id === id);
        if (task) await db.saveTask({ ...task, category: cat });
      }
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as any;

    // Base object
    const baseTask: Partial<Task> = {
      title: form.title.value,
      description: form.description.value,
      category: form.category.value || 'Geral',
      dueDate: form.dueDate.value,
      recurrence: form.recurrence.value,
      subtasks: currentSubtasks // Include subtasks
    };

    let finalTask: Task;

    if (editingTask) {
      finalTask = { ...editingTask, ...baseTask } as Task;
    } else {
      finalTask = {
        id: Math.random().toString(36).substr(2, 9),
        status: TaskStatus.TODO,
        createdAt: new Date().toISOString(),
        tags: [],
        ...baseTask
      } as Task;
    }

    setTasks(prev => editingTask ? prev.map(t => t.id === editingTask.id ? finalTask : t) : [finalTask, ...prev]);
    await db.saveTask(finalTask);

    setIsModalOpen(false);
    setEditingTask(null);
    setCurrentSubtasks([]); // Reset
  };

  const openModal = (task?: Task | null) => {
    setEditingTask(task || null);
    setCurrentSubtasks(task?.subtasks || []);
    setIsModalOpen(true);
  };

  const addSubtask = () => {
    if (!subtaskInput.trim()) return;
    const newSub: Subtask = {
      id: Math.random().toString(36).substr(2, 9),
      title: subtaskInput,
      completed: false
    };
    setCurrentSubtasks([...currentSubtasks, newSub]);
    setSubtaskInput('');
  };

  const toggleSubtask = (id: string) => {
    setCurrentSubtasks(prev => prev.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };

  const removeSubtask = (id: string) => {
    setCurrentSubtasks(prev => prev.filter(s => s.id !== id));
  };

  const handleStatusChange = useCallback(async (id: string, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        if (newStatus === TaskStatus.DONE && t.recurrence && t.recurrence !== 'NONE' && t.dueDate) {
          const next = calculateNextOccurrence(t.dueDate, t.recurrence);
          const updated = { ...t, status: TaskStatus.TODO, dueDate: next };
          db.saveTask(updated);
          return updated;
        }
        db.updateStatus(id, newStatus);
        return { ...t, status: newStatus };
      }
      return t;
    }));
  }, [tasks]);

  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    let updatedTask = { ...task };
    const today = getTodayStr();

    if (columnId === 'DONE') {
      updatedTask.status = TaskStatus.DONE;
    } else {
      updatedTask.status = TaskStatus.TODO;
      if (columnId === 'PROXIMAS') {
        updatedTask.dueDate = today;
      } else if (columnId === 'FUTURAS') {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        updatedTask.dueDate = nextWeek.toISOString().split('T')[0];
      } else if (columnId === 'VENCIDAS') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        updatedTask.dueDate = yesterday.toISOString().split('T')[0];
      }
    }

    setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
    await db.saveTask(updatedTask);
  };

  const sortedAndFilteredTasks = useMemo(() => {
    return tasks
      .filter(t => {
        const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchCat = selectedCategories.length === 0 || selectedCategories.includes(t.category);
        return matchSearch && matchCat;
      })
      .sort((a, b) => {
        if (sortMode === 'DATE') {
          const dateA = a.dueDate || '9999-12-31';
          const dateB = b.dueDate || '9999-12-31';
          if (dateA !== dateB) return dateA.localeCompare(dateB);
          return a.title.localeCompare(b.title);
        }
        return a.title.localeCompare(b.title);
      });
  }, [tasks, selectedCategories, searchQuery, sortMode]);

  const columns = useMemo(() => {
    const active = sortedAndFilteredTasks.filter(t => t.status !== TaskStatus.DONE);
    return [
      { id: 'VENCIDAS', label: '🚨 Atrasadas', tasks: active.filter(t => isLate(t.dueDate)), color: 'text-zentask-red', bg: 'bg-zentask-red/5' },
      { id: 'PROXIMAS', label: '⭐ Foco', tasks: active.filter(t => isSoon(t.dueDate)), color: 'text-zentask-blue', bg: 'bg-zentask-blue/5' },
      { id: 'FUTURAS', label: '📅 Futuro', tasks: active.filter(t => !isLate(t.dueDate) && !isSoon(t.dueDate)), color: 'text-zentask-primary', bg: 'bg-white' },
      { id: 'DONE', label: '✅ Feitas', tasks: sortedAndFilteredTasks.filter(t => t.status === TaskStatus.DONE), color: 'text-slate-400', bg: 'bg-slate-50' }
    ];
  }, [sortedAndFilteredTasks]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    tasks.forEach(t => { if (t.category) cats.add(t.category); });
    return Array.from(cats).sort();
  }, [tasks]);

  if (!isAuthorized) {
    return (
      <div className="h-[100dvh] bg-zentask-black flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-4xl font-black text-white uppercase tracking-tighter mb-10 italic">TaskFlow</h1>
        <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4">
          <input type="password" autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="DIGITE O PIN" className={`w-full bg-white/5 border-2 ${pinError ? 'border-zentask-red animate-shake' : 'border-white/10'} rounded-2xl px-6 py-5 text-center text-white text-xl font-black outline-none focus:border-zentask-secondary transition-all`} />
          <button type="submit" className="w-full bg-zentask-secondary text-black font-black py-5 rounded-2xl uppercase tracking-widest hover:scale-105 transition-all">Desbloquear</button>
        </form>
      </div>
    );
  }

  const navigateTo = (v: ViewType) => {
    setView(v);
    setIsMenuOpen(false);
  };

  return (
    <div className="h-[100dvh] flex flex-col lg:flex-row bg-zentask-bg overflow-hidden animate-in fade-in duration-700">
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] lg:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 lg:static lg:block w-72 bg-zentask-black text-white flex flex-col shrink-0 z-[100] shadow-2xl transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tighter text-zentask-secondary italic">TaskFlow</h1>
          <button title="Sair do sistema" onClick={() => { localStorage.removeItem('taskflow_auth'); setIsAuthorized(false); }} className="p-2 text-white/20 hover:text-zentask-red transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
        </div>
        <nav className="flex-1 py-8 px-5 space-y-2">
          <button title="Visão de Quadro Kanban" onClick={() => navigateTo('QUADRO')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${view === 'QUADRO' ? 'bg-zentask-primary text-white shadow-lg' : 'text-white/60 hover:text-white'}`}><span className="font-bold text-xs uppercase tracking-widest">Painel</span></button>
          <button title="Visão de Lista Detalhada" onClick={() => navigateTo('LISTA')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${view === 'LISTA' ? 'bg-zentask-primary text-white shadow-lg' : 'text-white/60 hover:text-white'}`}><span className="font-bold text-xs uppercase tracking-widest">Lista</span></button>
          <button title="Métricas e Configurações" onClick={() => navigateTo('DASHBOARD')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${view === 'DASHBOARD' ? 'bg-zentask-primary text-white shadow-lg' : 'text-white/60 hover:text-white'}`}><span className="font-bold text-xs uppercase tracking-widest">Métricas</span></button>
        </nav>

      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="px-6 md:px-10 py-6 md:py-8 flex flex-col gap-6 bg-white/80 border-b border-black/5 shrink-0 backdrop-blur-xl z-20">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMenuOpen(true)}
                className="lg:hidden p-3 bg-black/5 text-black hover:bg-black/10 rounded-2xl transition-all flex items-center justify-center shrink-0"
                title="Menu"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div className="flex flex-col">
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-black">
                  {view === 'QUADRO' ? 'Fluxo de Trabalho' : view === 'LISTA' ? 'Minha Lista' : 'Estatísticas'}
                </h2>
                <div className="flex items-center gap-2 md:gap-4 mt-2 flex-wrap">
                  <button title="Mudar ordem" onClick={() => setSortMode(prev => prev === 'DATE' ? 'TITLE' : 'DATE')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${sortMode === 'DATE' ? 'bg-black text-white border-black' : 'bg-white text-black border-black/20 hover:border-black'}`}>
                    {sortMode === 'DATE' ? '📅 Por Prazo' : '🔠 Por Nome'}
                  </button>

                  <div className="flex bg-black/5 p-1 rounded-xl lg:hidden">
                    <button onClick={() => setView('QUADRO')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${view === 'QUADRO' ? 'bg-black text-white shadow-md' : 'text-black/40'}`}>Painel</button>
                    <button onClick={() => setView('LISTA')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${view === 'LISTA' ? 'bg-black text-white shadow-md' : 'text-black/40'}`}>Lista</button>
                  </div>

                  {view === 'LISTA' && (
                    <button title="Selecionar tudo" onClick={handleSelectAll} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${selectedIds.size === sortedAndFilteredTasks.length && sortedAndFilteredTasks.length > 0 ? 'bg-zentask-primary text-white border-zentask-primary' : 'bg-white text-slate-400 border-black/10 hover:border-black'}`}>
                      {selectedIds.size === sortedAndFilteredTasks.length && sortedAndFilteredTasks.length > 0 ? 'Desmarcar' : 'Tudo'}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <button title="Nova Tarefa" onClick={() => openModal(null)} className="bg-black text-white px-5 md:px-8 py-4 rounded-2xl font-black text-[9px] md:text-xs uppercase tracking-[0.2em] hover:bg-zentask-primary transition-all shadow-2xl shrink-0">NOVA TAREFA</button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button title="Tudo" onClick={() => setSelectedCategories([])} className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0 border transition-all ${selectedCategories.length === 0 ? 'bg-zentask-primary text-white border-zentask-primary shadow-md' : 'bg-white border-black/5 text-slate-400 hover:border-black/20'}`}>Tudo</button>
            {availableCategories.map(cat => (
              <button key={cat} onClick={() => toggleCategory(cat)} className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0 border transition-all ${selectedCategories.includes(cat) ? 'bg-zentask-primary text-white border-zentask-primary shadow-lg' : 'bg-white border-black/5 text-slate-400 hover:border-black/20'}`}>{cat}</button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          {isLoading ? (
            <div className="h-full flex items-center justify-center"><div className="w-12 h-12 border-4 border-zentask-primary border-t-transparent rounded-full animate-spin"></div></div>
          ) : view === 'QUADRO' ? (
            <div className="absolute inset-0 overflow-x-auto flex gap-4 p-4 md:p-6 scrollbar-hide">
              {columns.map(col => (
                <div key={col.id} className="w-[85vw] md:w-[300px] flex flex-col h-full shrink-0">
                  <div className="flex items-center justify-between mb-3 px-3">
                    <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${col.color}`}>{col.label}</span>
                    <span className="bg-white px-2 py-0.5 rounded-full text-[9px] font-black border border-black/5 shadow-sm">{col.tasks.length}</span>
                  </div>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, col.id)}
                    className={`flex-1 rounded-[32px] p-4 ${col.bg} border-2 border-dashed border-black/5 space-y-3 overflow-y-auto scrollbar-hide shadow-inner transition-colors duration-200`}
                  >
                    {col.tasks.map(t => <TaskCard key={t.id} task={t} view={view} isSelected={selectedIds.has(t.id)} onSelect={toggleSelect} onEdit={openModal} onDelete={async (id) => { if (confirm('Remover tarefa?')) { setTasks(p => p.filter(x => x.id !== id)); await db.deleteTask(id); } }} onStatusChange={handleStatusChange} onDragStart={(e, id) => e.dataTransfer.setData('taskId', id)} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : view === 'LISTA' ? (
            <div className="h-full overflow-y-auto p-4 md:p-10 max-w-5xl mx-auto space-y-12 pb-60 scrollbar-hide">
              {columns.map(col => col.tasks.length > 0 && (
                <div key={col.id} className="space-y-4">
                  <h3 className={`text-[12px] font-black uppercase tracking-[0.2em] px-4 ${col.color}`}>{col.label}</h3>
                  <div className="bg-white rounded-[32px] border border-black/5 shadow-xl divide-y divide-black/5 overflow-hidden">
                    {col.tasks.map(t => (
                      <div key={t.id} className={`py-2 px-4 flex items-center justify-between gap-3 transition-all group hover:bg-slate-50`}>
                        <div className="flex items-center gap-3 flex-1">
                          <button
                            title="Concluir"
                            onClick={() => handleStatusChange(t.id, t.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE)}
                            className={`w-6 h-6 rounded-full border-[1.5px] flex items-center justify-center transition-all shrink-0 ${t.status === TaskStatus.DONE ? 'bg-zentask-secondary border-black' : 'border-slate-300 hover:border-zentask-secondary'}`}
                          >
                            {t.status === TaskStatus.DONE && <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                          </button>

                          <div title="Editar" className="flex flex-col cursor-pointer flex-1" onClick={() => openModal(t)}>
                            <span className={`font-bold text-xs md:text-sm ${t.status === TaskStatus.DONE ? 'line-through opacity-60 text-slate-500' : 'text-black'}`}>{t.title}</span>
                            <span className="text-[8px] md:text-[9px] text-slate-400 font-bold uppercase tracking-widest">{t.category || 'Geral'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`text-[9px] font-bold uppercase tracking-widest ${isLate(t.dueDate) ? 'text-zentask-red' : 'text-slate-400'}`}>
                            {t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'SEM PRAZO'}
                          </span>

                          <div
                            title="Selecionar"
                            onClick={() => toggleSelect(t.id)}
                            className={`w-8 h-8 rounded-lg border-[1.5px] cursor-pointer flex items-center justify-center transition-all ${selectedIds.has(t.id) ? 'bg-black border-black scale-105 shadow-md' : 'border-slate-200 bg-white hover:border-black'}`}
                          >
                            {selectedIds.has(t.id) && <svg className="w-4 h-4 text-zentask-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Dashboard tasks={tasks} onImportComplete={(cat) => loadData(cat)} />
          )}
        </div>

        {selectedIds.size > 0 && view === 'LISTA' && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-black text-white px-6 md:px-10 py-6 rounded-[50px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex items-center gap-6 md:gap-10 z-[9999] animate-in slide-in-from-bottom-20 border border-white/20 backdrop-blur-3xl w-[90vw] md:w-auto">
            <div className="flex flex-col min-w-[100px] md:min-w-[140px]">
              <span className="text-[12px] md:text-[14px] font-black uppercase tracking-widest text-zentask-secondary">{selectedIds.size} Selecionados</span>
              <button title="Cancelar" onClick={() => setSelectedIds(new Set<string>())} className="text-[9px] md:text-[10px] font-black text-white/40 uppercase text-left hover:text-white transition-colors underline decoration-zentask-secondary decoration-2 underline-offset-4">Cancelar</button>
            </div>
            <div className="h-12 w-px bg-white/10 hidden md:block"></div>
            <div className="flex gap-2 md:gap-4 flex-1 justify-end">
              <button title="Editar" onClick={handleBulkEdit} className="flex items-center justify-center px-4 md:px-6 py-4 bg-white/10 text-white hover:bg-white/20 rounded-2xl transition-all text-[9px] md:text-[11px] font-black uppercase tracking-widest border border-white/10 active:scale-95 shrink-0">
                EDITAR
              </button>
              <button title="Finalizar" onClick={handleBulkComplete} className="flex items-center justify-center px-4 md:px-8 py-4 bg-zentask-secondary text-black rounded-2xl transition-all text-[9px] md:text-[11px] font-black uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 shrink-0">
                FINALIZAR
              </button>
              <button title="Excluir" onClick={handleBulkDelete} className="flex items-center justify-center px-4 md:px-8 py-4 bg-zentask-red/20 text-zentask-red border border-zentask-red/30 hover:bg-zentask-red hover:text-white rounded-2xl transition-all text-[9px] md:text-[11px] font-black uppercase tracking-widest active:scale-95 shrink-0">
                EXCLUIR
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL NOVA TAREFA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xl p-0 sm:p-4">
          <form onSubmit={handleCreateOrUpdate} className="bg-white w-full max-w-lg rounded-t-[40px] sm:rounded-[40px] p-6 sm:p-8 shadow-[0_50px_100px_rgba(0,0,0,0.3)] space-y-6 max-h-[95dvh] overflow-y-auto scrollbar-hide">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-2xl font-black uppercase tracking-tighter">Planejar Tarefa</h3>
              <button title="Fechar" type="button" onClick={() => setIsModalOpen(false)} className="text-slate-200 hover:text-black p-2 transition-colors"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Título</label>
                <input name="title" required defaultValue={editingTask?.title} className="w-full bg-slate-50 border border-slate-100 p-3 rounded-2xl font-black text-base outline-none focus:ring-4 focus:ring-zentask-secondary/20 transition-all" placeholder="O que faremos?" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Descrição</label>
                <textarea name="description" defaultValue={editingTask?.description} className="w-full bg-slate-50 border border-slate-100 p-3 rounded-2xl font-bold outline-none text-xs h-20 scrollbar-hide" placeholder="Detalhes..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Prazo</label>
                  <input name="dueDate" type="date" defaultValue={editingTask?.dueDate} className="w-full bg-slate-50 border border-slate-100 p-3 rounded-2xl font-black text-xs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Recorrência</label>
                  <select name="recurrence" defaultValue={editingTask?.recurrence || 'NONE'} className="w-full bg-slate-50 border border-slate-100 p-3 rounded-2xl font-black text-xs uppercase tracking-widest">
                    <option value="NONE">Única Vez</option>
                    <option value="DAILY">Diário</option><option value="WEEKLY">Semanal</option><option value="MONTHLY">Mensal</option><option value="YEARLY">Anual</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Categoria</label>
                <input name="category" list="cat-list" defaultValue={editingTask?.category} className="w-full bg-slate-50 border border-slate-100 p-3 rounded-2xl font-black outline-none tracking-widest uppercase text-xs" placeholder="EX: TRABALHO..." />
                <datalist id="cat-list">{availableCategories.map(c => <option key={c} value={c} />)}</datalist>
              </div>

              {/* CHECKLIST / SUBTASKS UI */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <div className="flex justify-between items-end">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Checklist</label>
                  <span className="text-[9px] font-bold text-slate-300">{currentSubtasks.filter(s => s.completed).length}/{currentSubtasks.length}</span>
                </div>

                <div className="flex gap-2">
                  <input
                    value={subtaskInput}
                    onChange={(e) => setSubtaskInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                    placeholder="Adicionar item..."
                    className="flex-1 bg-slate-50 border border-slate-100 p-3 rounded-xl font-bold text-xs outline-none focus:border-zentask-secondary transition-all"
                  />
                  <button type="button" onClick={addSubtask} className="bg-black text-white w-10 rounded-xl flex items-center justify-center hover:bg-zentask-secondary hover:text-black transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                  </button>
                </div>

                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 scrollbar-hide">
                  {currentSubtasks.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-transparent hover:border-slate-200 group">
                      <button type="button" onClick={() => toggleSubtask(sub.id)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${sub.completed ? 'bg-zentask-secondary border-black' : 'border-slate-300 hover:border-black'}`}>
                        {sub.completed && <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                      </button>
                      <span className={`flex-1 text-xs font-bold ${sub.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{sub.title}</span>
                      <button type="button" onClick={() => removeSubtask(sub.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-0.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button title="Salvar" type="submit" className="w-full bg-black text-white py-6 rounded-[24px] font-black uppercase tracking-[0.4em] shadow-xl hover:bg-zentask-primary hover:scale-[1.01] transition-all active:scale-95 text-sm">SALVAR</button>
          </form>
        </div>
      )}

      <AiAssistant tasks={tasks} onTaskCreated={(t) => { setTasks(p => [t, ...p]); db.saveTask(t); }} />
    </div>
  );
};

export default App;
