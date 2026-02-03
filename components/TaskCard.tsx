
import React from 'react';
import { Task, TaskStatus, ViewType } from '../types';

interface TaskCardProps {
  task: Task;
  view: ViewType;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, newStatus: TaskStatus) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
}

const getTodayStr = () => new Date().toISOString().split('T')[0];
const isLate = (dateStr?: string) => dateStr && dateStr < getTodayStr();

const TaskCard: React.FC<TaskCardProps> = ({ task, view, isSelected, onSelect, onEdit, onDelete, onStatusChange, onDragStart }) => {
  const late = isLate(task.dueDate) && task.status !== TaskStatus.DONE;
  const isRecurring = task.recurrence && task.recurrence !== 'NONE';
  const isKanban = view === 'QUADRO';

  return (
    <div
      draggable
      title={isKanban ? "Arraste para mover ou clique para editar" : "Tarefa da lista"}
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onEdit(task)}
      className={`bg-white rounded-[24px] shadow-sm border-2 transition-all group relative flex flex-col cursor-pointer ${late ? 'border-zentask-red/20 bg-zentask-red/[0.01]' : 'border-slate-50 hover:border-black/5'} p-4 hover:shadow-xl active:scale-[0.98]`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${late ? 'bg-zentask-red text-white' : 'bg-zentask-bg text-zentask-primary border border-black/5'}`}>
            {task.category || 'Geral'}
          </span>
          {isRecurring && <span title="Recorrente" className="text-[11px] opacity-70">🔄</span>}
        </div>
      </div>

      <h3 className={`font-black text-[15px] text-black mb-1 leading-tight tracking-tight ${task.status === TaskStatus.DONE ? 'line-through opacity-60 text-slate-600' : ''}`}>
        {task.title}
      </h3>

      <p className="text-[12px] text-slate-400 font-medium line-clamp-2 mb-4 leading-snug">
        {task.description || "Sem descrição."}
      </p>

      {task.subtasks && task.subtasks.length > 0 && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Checklist</span>
            <span className="text-[9px] font-bold text-black">{task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-zentask-secondary transition-all duration-500"
              style={{ width: `${(task.subtasks.filter(s => s.completed).length / task.subtasks.length) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-50">
        <div title="Prazo" className={`flex items-center text-[9px] font-black uppercase tracking-widest ${late ? 'text-zentask-red animate-pulse' : 'text-slate-400'}`}>
          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          {task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : 'Sem Prazo'}
        </div>

        {task.status !== TaskStatus.DONE ? (
          <button
            title="Finalizar"
            onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, TaskStatus.DONE); }}
            className="w-9 h-9 rounded-[12px] bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-zentask-secondary hover:border-black hover:scale-110 transition-all"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-slate-200 group-hover:bg-black transition-all"></div>
          </button>
        ) : (
          <div title="Concluída" className="w-9 h-9 rounded-[12px] bg-zentask-secondary flex items-center justify-center">
            <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
