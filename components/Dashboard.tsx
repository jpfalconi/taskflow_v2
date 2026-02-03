
import React, { useRef, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Task, TaskStatus, RecurrenceType } from '../types';
import { db } from '../services/database';

interface DashboardProps {
  tasks: Task[];
  onImportComplete: (categoryToFocus?: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ tasks, onImportComplete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const statusData = [
    { name: 'Pendente', value: tasks.filter(t => t.status === TaskStatus.TODO).length, color: '#D9B300' },
    { name: 'Em Andamento', value: tasks.filter(t => t.status === TaskStatus.DOING).length, color: '#61C2FF' },
    { name: 'Concluído', value: tasks.filter(t => t.status === TaskStatus.DONE).length, color: '#A7E82B' },
  ];

  const completionRate = tasks.length > 0 
    ? Math.round((tasks.filter(t => t.status === TaskStatus.DONE).length / tasks.length) * 100) 
    : 0;

  const sqlCode = `-- Script Consolidado TaskFlow
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Geral',
ADD COLUMN IF NOT EXISTS "dueDate" DATE,
ADD COLUMN IF NOT EXISTS recurrence TEXT DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]';

-- Garante que a coluna de ordenação existe
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tasks' AND COLUMN_NAME='createdAt') THEN
    ALTER TABLE tasks ADD COLUMN "createdAt" TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppSync = () => {
    const link = db.getSyncLink();
    if (!link) {
      alert("Configure o Supabase primeiro!");
      return;
    }
    const text = encodeURIComponent(`🚀 *TaskFlow Sync* \n\nAcesse suas tarefas aqui:\n${link}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const parseTodoistDateInfo = (todoistDate: string): { date?: string, recurrence: RecurrenceType } => {
    if (!todoistDate || todoistDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return { recurrence: 'NONE' };
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    const dateStr = todoistDate.toLowerCase().trim();
    let calculatedDate: Date | null = null;
    let recurrence: RecurrenceType = 'NONE';

    if (dateStr.includes('in') && dateStr.includes('days')) {
      const daysStr = dateStr.match(/\d+/)?.[0] || '0';
      calculatedDate = new Date(today);
      calculatedDate.setDate(today.getDate() + parseInt(daysStr));
    } else if (dateStr.includes('todo') || dateStr.includes('every')) {
      recurrence = dateStr.includes('mes') || dateStr.includes('month') ? 'MONTHLY' : 'WEEKLY';
      calculatedDate = today;
    }
    return { date: calculatedDate?.toISOString().split('T')[0], recurrence };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const lines = content.split('\n');
      const headerLine = lines.find(l => l.includes('TYPE,CONTENT,DESCRIPTION'));
      if (!headerLine) {
        alert("Formato CSV inválido. Use o export do Todoist.");
        return;
      }

      const chosenCategory = prompt("Nome da categoria para estas tarefas?", "Importado");
      if (chosenCategory === null) return;
      const finalCategory = chosenCategory.trim() || "Geral";

      const headerIndex = lines.indexOf(headerLine);
      const rows = lines.slice(headerIndex + 1);
      const importedTasks: Task[] = [];
      
      for (const row of rows) {
        const trimmedRow = row.trim();
        if (!trimmedRow) continue;
        const cols = trimmedRow.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const type = cols[0]?.replace(/^"(.*)"$/, '$1').trim();
        
        if (type === 'task') {
          const title = cols[1]?.replace(/^"(.*)"$/, '$1').trim() || 'Sem título';
          const description = cols[2]?.replace(/^"(.*)"$/, '$1').trim() || '';
          const dateRaw = cols[8]?.replace(/^"(.*)"$/, '$1').trim() || '';
          const { date, recurrence } = parseTodoistDateInfo(dateRaw);
          
          importedTasks.push({
            id: Math.random().toString(36).substr(2, 9),
            title,
            description,
            status: TaskStatus.TODO,
            category: finalCategory,
            dueDate: date,
            recurrence,
            createdAt: new Date().toISOString(),
            tags: [],
            subtasks: []
          });
        }
      }

      if (importedTasks.length > 0) {
        if (confirm(`Importar ${importedTasks.length} tarefas para "${finalCategory}"?`)) {
          setImporting(true);
          try {
            await db.saveTasks(importedTasks);
            onImportComplete(finalCategory);
            alert("Sucesso! Tarefas importadas.");
          } catch (err) {
            console.error("Erro no Dashboard:", err);
          } finally {
            setImporting(false);
          }
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 pb-24 overflow-y-auto h-full scrollbar-hide">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-black/5 flex flex-col items-center justify-center text-center">
          <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-3">Total de Missões</span>
          <span className="text-5xl font-black text-zentask-black leading-none">{tasks.length}</span>
        </div>
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-black/5 flex flex-col items-center justify-center text-center">
          <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-3">Concluídas</span>
          <span className="text-5xl font-black text-zentask-secondary leading-none">{tasks.filter(t => t.status === TaskStatus.DONE).length}</span>
        </div>
        <div className="bg-zentask-primary p-8 rounded-[32px] shadow-xl text-white flex flex-col items-center justify-center text-center">
          <span className="text-zentask-secondary text-[10px] font-black uppercase tracking-[0.2em] mb-3">Produtividade</span>
          <span className="text-5xl font-black leading-none">{completionRate}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gráfico */}
        <div className="bg-white p-10 rounded-[40px] shadow-sm border border-black/5">
          <h3 className="font-black text-zentask-black mb-10 uppercase text-[11px] tracking-[0.3em] text-center">Distribuição de Fluxo</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={10} dataKey="value" stroke="none">
                  {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Manutenção e Sync */}
        <div className="bg-white p-10 rounded-[40px] shadow-sm border border-black/5 space-y-8">
          <h3 className="font-black text-zentask-black mb-2 uppercase text-[11px] tracking-[0.3em] text-center">Infraestrutura e Sincronia</h3>
          
          <div className="grid grid-cols-1 gap-4">
             <button 
                onClick={handleWhatsAppSync}
                className="w-full flex items-center justify-center gap-4 p-6 rounded-3xl bg-zentask-secondary text-black font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-lg hover:scale-105"
             >
                <span className="text-xl">📲</span> Enviar Link de Configuração por WhatsApp
             </button>

             <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
             <button 
                disabled={importing}
                onClick={() => fileInputRef.current?.click()} 
                className={`w-full flex items-center justify-center gap-4 p-6 rounded-3xl bg-slate-50 hover:bg-black hover:text-white border border-black/5 text-zentask-black font-black text-[10px] uppercase tracking-[0.15em] transition-all shadow-sm ${importing ? 'opacity-50 animate-pulse' : ''}`}
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0l-4 4m4-4v12" /></svg>
                {importing ? 'Processando Dados...' : 'Migrar do Todoist (CSV)'}
             </button>
          </div>
          
          <div className="p-8 rounded-[32px] bg-zentask-red/5 border border-zentask-red/10 space-y-4">
            <div className="flex items-center justify-between">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-zentask-red flex items-center gap-2">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                 Manutenção de Tabelas
               </h4>
               <button onClick={handleCopySql} className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-lg transition-all ${copied ? 'bg-zentask-secondary text-black' : 'bg-white/50 text-zentask-red hover:bg-white'}`}>
                  {copied ? 'Copiado!' : 'Copiar SQL'}
               </button>
            </div>
            
            <div className="bg-black/90 p-5 rounded-2xl overflow-hidden">
               <code className="text-[9px] text-zentask-secondary leading-relaxed font-mono whitespace-pre block overflow-x-auto scrollbar-hide">
                 {sqlCode}
               </code>
            </div>
            
            <p className="text-[10px] text-slate-500 leading-relaxed font-bold italic">
              * Rodar este script se você notar problemas na estrutura do Banco de Dados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
