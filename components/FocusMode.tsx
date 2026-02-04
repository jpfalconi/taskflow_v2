import React, { useState, useEffect } from 'react';
import { Task } from '../types';

interface FocusModeProps {
    task: Task;
    onClose: () => void;
    onComplete: () => void;
}

const FocusMode: React.FC<FocusModeProps> = ({ task, onClose, onComplete }) => {
    const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
        } else if (timeLeft === 0) {
            setIsActive(false);
            new Audio('/notification.mp3').play().catch(() => { }); // Simple notification sound attempt
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft]);

    const toggleTimer = () => setIsActive(!isActive);
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 z-[20000] bg-black text-white flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
            <button onClick={onClose} className="absolute top-6 left-6 p-4 text-white/50 hover:text-white transition-colors">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <div className="max-w-2xl w-full text-center space-y-12">
                <div className="space-y-4">
                    <span className="text-zentask-secondary font-black tracking-[0.3em] uppercase text-sm animate-pulse">Modo Foco</span>
                    <h1 className="text-4xl md:text-6xl font-black leading-tight">{task.title}</h1>
                </div>

                <div className="relative group cursor-pointer" onClick={toggleTimer}>
                    <div className={`text-[120px] md:text-[180px] font-black tabular-nums tracking-tighter leading-none transition-all ${isActive ? 'text-white scale-105' : 'text-white/20 hover:text-white/40'}`}>
                        {formatTime(timeLeft)}
                    </div>
                    <p className="text-sm font-bold text-zentask-secondary uppercase tracking-[0.2em] mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isActive ? 'Pausar' : 'Iniciar'}
                    </p>
                </div>

                {task.subtasks && task.subtasks.length > 0 && (
                    <div className="text-left bg-white/5 p-6 rounded-3xl border border-white/10 max-w-md mx-auto">
                        <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-4">Checklist</h3>
                        <div className="space-y-3">
                            {task.subtasks.map(s => (
                                <div key={s.id} className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${s.completed ? 'bg-zentask-secondary border-black' : 'border-white/20'}`}>
                                        {s.completed && <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                    <span className={s.completed ? 'line-through text-white/20' : 'text-white'}>{s.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <button
                    onClick={onComplete}
                    className="bg-zentask-secondary text-black px-12 py-5 rounded-full font-black uppercase tracking-[0.2em] hover:scale-105 transition-transform shadow-[0_0_40px_rgba(167,232,43,0.3)]"
                >
                    Concluir Tarefa
                </button>
            </div>
        </div>
    );
};

export default FocusMode;
