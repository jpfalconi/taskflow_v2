
import React, { useState, useRef, useEffect } from 'react';
import { processAssistantCommand } from '../services/geminiService';
import { Task, TaskStatus } from '../types';

interface Message {
  role: 'user' | 'model';
  text: string;
  isAudio?: boolean;
}

interface AiAssistantProps {
  tasks: Task[];
  onTaskCreated?: (task: Task) => void;
}

const AiAssistant: React.FC<AiAssistantProps> = ({ tasks, onTaskCreated }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, loading]);

  const handleSendMessage = async (content: string | { data: string, mimeType: string }) => {
    if (!content) return;

    const userMsg: Message = { 
      role: 'user', 
      text: typeof content === 'string' ? content : '🎤 Comando de voz enviado',
      isAudio: typeof content !== 'string'
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    const response = await processAssistantCommand(content, (args) => {
      if (onTaskCreated) {
        const newTask: Task = {
          id: Math.random().toString(36).substr(2, 9),
          title: args.title || "Nova Tarefa",
          description: args.description || "",
          category: args.category || "Geral",
          status: TaskStatus.TODO,
          dueDate: args.dueDate,
          recurrence: args.recurrence || 'NONE',
          createdAt: new Date().toISOString(),
          tags: [],
          subtasks: []
        };
        onTaskCreated(newTask);
      }
    });

    setMessages(prev => [...prev, { role: 'model', text: response.text }]);
    setLoading(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result?.toString().split(',')[1];
          if (base64data) {
            handleSendMessage({ data: base64data, mimeType: 'audio/webm' });
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Não foi possível acessar o microfone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {isOpen && (
        <div className="bg-white rounded-[40px] shadow-2xl border border-zentask-secondary/30 w-[calc(100vw-3rem)] sm:w-[400px] mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 fade-in duration-500 h-[600px] max-h-[80dvh]">
          {/* Header */}
          <div className="p-6 bg-black text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-zentask-secondary rounded-full flex items-center justify-center animate-pulse">
                <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-zentask-secondary">Assistente Zen</h3>
                <p className="text-[9px] text-white/40 uppercase font-bold tracking-tight">IA Generativa Ativa</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/20 hover:text-white transition-colors p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          {/* Chat Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide bg-slate-50/50">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-sm border border-black/5">
                   <span className="text-2xl">✨</span>
                </div>
                <h4 className="font-black uppercase text-xs tracking-widest text-black/40">Como posso te ajudar agora?</h4>
                <p className="text-xs text-slate-400 font-medium leading-relaxed italic">"Crie uma tarefa de reunião amanhã às 10h" ou "Me dê um resumo do dia"</p>
              </div>
            )}
            
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-[24px] text-sm font-medium shadow-sm border ${
                  msg.role === 'user' 
                    ? 'bg-black text-white rounded-tr-none border-black' 
                    : 'bg-white text-slate-700 rounded-tl-none border-black/5'
                }`}>
                  {msg.isAudio && <span className="mr-2">🎤</span>}
                  {msg.text}
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white p-4 rounded-[24px] rounded-tl-none border border-black/5 flex gap-1">
                  <div className="w-1.5 h-1.5 bg-zentask-secondary rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-zentask-secondary rounded-full animate-bounce delay-75"></div>
                  <div className="w-1.5 h-1.5 bg-zentask-secondary rounded-full animate-bounce delay-150"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input Area */}
          <div className="p-6 bg-white border-t border-black/5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputText)}
                  placeholder="Escreva algo..." 
                  className="w-full bg-slate-100 border-none rounded-2xl py-4 pl-5 pr-12 text-sm font-bold outline-none focus:ring-2 focus:ring-zentask-secondary transition-all"
                />
                <button 
                  onClick={() => handleSendMessage(inputText)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zentask-primary hover:text-black transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              </div>
              
              <button 
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90 ${isRecording ? 'bg-zentask-red animate-pulse text-white scale-110' : 'bg-zentask-secondary text-black'}`}
                title="Segure para falar"
              >
                {isRecording ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H10a1 1 0 01-1-1v-4z" /></svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                )}
              </button>
            </div>
            {isRecording && <p className="text-[10px] text-zentask-red font-black uppercase tracking-widest text-center animate-pulse">Gravando... Solte para enviar</p>}
          </div>
        </div>
      )}
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 border-4 ${isOpen ? 'bg-black text-white border-white/10' : 'bg-zentask-secondary text-black border-white/50 hover:scale-105'}`}
      >
        {isOpen ? (
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <div className="relative">
             <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
             </svg>
             <div className="absolute -top-1 -right-1 w-3 h-3 bg-zentask-red rounded-full border-2 border-zentask-secondary"></div>
          </div>
        )}
      </button>
    </div>
  );
};

export default AiAssistant;
