
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Task, AiSuggestion } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// Declaração da função que o Gemini pode chamar
const createTaskTool: FunctionDeclaration = {
  name: 'create_task',
  parameters: {
    type: Type.OBJECT,
    description: 'Cria uma nova tarefa no sistema de gestão de tarefas.',
    properties: {
      title: {
        type: Type.STRING,
        description: 'O título conciso da tarefa.',
      },
      description: {
        type: Type.STRING,
        description: 'Detalhes adicionais ou notas sobre a tarefa.',
      },
      category: {
        type: Type.STRING,
        description: 'A categoria da tarefa (ex: Trabalho, Pessoal, Financeiro, Saúde).',
      },
      dueDate: {
        type: Type.STRING,
        description: 'A data de entrega no formato YYYY-MM-DD.',
      },
      recurrence: {
        type: Type.STRING,
        description: 'O tipo de recorrência: NONE, DAILY, WEEKLY, MONTHLY, YEARLY.',
      }
    },
    required: ['title'],
  },
};

export const processAssistantCommand = async (
  input: string | { data: string, mimeType: string },
  onTaskCreated: (taskData: any) => void
): Promise<{ text: string, type: 'text' | 'action' }> => {
  try {
    const model = 'gemini-3-flash-preview';
    const parts = typeof input === 'string'
      ? [{ text: input }]
      : [{ inlineData: input }];

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        tools: [{ functionDeclarations: [createTaskTool] }],
        systemInstruction: `Você é o assistente inteligente do TaskFlow. 
        Sua missão é ajudar o usuário a organizar sua vida.
        Se o usuário pedir para criar uma tarefa, use a ferramenta 'create_task'.
        Extraia inteligentemente a data (se ele disser 'amanhã', calcule a data de amanhã com base em ${new Date().toISOString().split('T')[0]}) e a categoria.
        Seja amigável e conciso.`
      },
    });

    const call = response.candidates?.[0]?.content?.parts?.find(p => p.functionCall);

    if (call) {
      const args = call.functionCall.args;
      onTaskCreated(args);
      return {
        text: `Entendido! Criei a tarefa "${args.title}" para você.`,
        type: 'action'
      };
    }

    return {
      text: response.text || "Comando processado.",
      type: 'text'
    };
  } catch (error) {
    console.error("Assistant error:", error);
    return { text: "Ops, tive um problema ao processar isso. Pode repetir?", type: 'text' };
  }
};

export const optimizeTaskWithAi = async (task: Partial<Task>): Promise<AiSuggestion | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analise esta tarefa e sugira como dividi-la em subtarefas menores e gerenciáveis. A resposta DEVE ser em Português do Brasil. Título da Tarefa: ${task.title}. Descrição: ${task.description}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            optimizedTitle: { type: Type.STRING },
            estimatedDuration: { type: Type.STRING },
            suggestedSubtasks: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["optimizedTitle", "estimatedDuration", "suggestedSubtasks"]
        }
      }
    });
    return JSON.parse(response.text.trim());
  } catch (error) {
    return null;
  }
};

export const generateDailyBriefing = async (tasks: Task[]): Promise<string> => {
  try {
    const taskContext = tasks.map(t => `- [${t.status}] ${t.title}`).join('\n');
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Com base na lista de tarefas a seguir, forneça um briefing diário conciso e motivador em Português do Brasil. Sugira quais 3 tarefas devem ser focadas hoje para produtividade máxima. \n\nTarefas:\n${taskContext}`,
    });
    return response.text;
  } catch (error) {
    return "Não foi possível gerar o briefing hoje. Foco no seu trabalho!";
  }
};
