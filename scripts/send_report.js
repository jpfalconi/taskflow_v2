
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

// --- CONFIGURAÇÃO ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_TO = 'jp@jphub.com.br, joaohomem@falconi.com';

// Cores da marca
const COLORS = {
  primary: '#7A7423',
  secondary: '#A7E82B',
  bg: '#EAEBE9',
  red: '#D64550',
};

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ ERRO: Supabase URL ou Key não encontradas.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const getTodayStr = () => new Date().toISOString().split('T')[0];

const formatDate = (dateStr) => {
  if (!dateStr) return 'Sem Prazo';
  return new Date(dateStr).toLocaleDateString('pt-BR');
};

async function main() {
  console.log("🚀 Iniciando geração do relatório...");

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error("⚠️ AVISO: Configuração de email ausente.");
    // Continue to generate HTML logic for testing if needed, or exit.
  }

  // 1. Buscar tarefas
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .neq('status', 'DONE')
    .order('dueDate', { ascending: true });

  if (error) {
    console.error("Erro ao buscar tarefas:", error);
    process.exit(1);
  }

  const today = getTodayStr();

  // 2. Classificar tarefas
  const overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < today);
  const todayTasks = tasks.filter(t => t.dueDate === today);
  const upcomingTasks = tasks.filter(t => t.dueDate && t.dueDate > today);

  // 3. Montar HTML
  const html = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; color: #18181b; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
        .header { background-color: #18181b; padding: 40px 30px; text-align: center; border-bottom: 4px solid ${COLORS.secondary}; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; color: ${COLORS.secondary}; text-transform: uppercase; letter-spacing: -0.025em; font-style: italic; }
        .header p { margin: 8px 0 0; color: #a1a1aa; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .content { padding: 40px 30px; }
        .summary-box { background-color: #f4f4f5; padding: 20px; border-radius: 12px; margin-bottom: 30px; text-align: center; }
        .summary-text { font-size: 15px; color: #52525b; margin: 0; font-weight: 500; }
        .summary-highlight { color: #18181b; font-weight: 800; font-size: 18px; }
        
        .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; display: flex; align-items: center; color: #71717a; }
        .section-title span { margin-right: 8px; font-size: 16px; }
        .section-title.red { color: ${COLORS.red}; }
        .section-title.gold { color: #854d0e; }
        
        .task-card { background: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 16px 20px; margin-bottom: 12px; transition: all 0.2s; position: relative; overflow: hidden; }
        .task-card.overdue { border-left: 4px solid ${COLORS.red}; background-color: #fef2f2; border-color: #fee2e2; }
        .task-card.today { border-left: 4px solid ${COLORS.secondary}; background-color: #f7fee7; border-color: #d9f99d; }
        .task-card h3 { margin: 0 0 6px; font-size: 15px; font-weight: 600; color: #27272a; line-height: 1.4; }
        .task-card .meta { font-size: 12px; color: #71717a; font-weight: 500; display: flex; align-items: center; gap: 6px; }
        .task-card .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background-color: rgba(0,0,0,0.05); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.025em; }
        
        .footer { text-align: center; padding: 30px; background-color: #f4f4f5; color: #a1a1aa; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; border-top: 1px solid #e4e4e7; }

        @media only screen and (max-width: 600px) {
            .container { margin: 0; border-radius: 0; }
            .content { padding: 30px 20px; }
        }
        
        .btn-container { text-align: center; margin-top: 35px; }
        .btn { display: inline-block; background-color: ${COLORS.primary}; color: #ffffff; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(122, 116, 35, 0.3); }
        .btn:hover { background-color: #5e591b; transform: translateY(-1px); box-shadow: 0 6px 8px -1px rgba(122, 116, 35, 0.4); }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>TaskFlow</h1>
          <p>Relatório de Planejamento Diário</p>
        </div>
        
        <div class="content">
          <div class="summary-box">
             <p class="summary-text">Olá! Hoje você tem <span class="summary-highlight">${tasks.length} missões</span> ativas no radar.</p>
          </div>

          ${overdueTasks.length > 0 ? `
            <div class="section-title red"><span>🔥</span> Atrasadas — Prioridade Máxima</div>
            ${overdueTasks.map(t => `
              <div class="task-card overdue">
                <h3>${t.title}</h3>
                <div class="meta">
                   <span class="badge" style="color: ${COLORS.red}">Atrasada</span>
                   <span>•</span>
                   <span>${t.category || 'Geral'}</span>
                   <span>•</span>
                   <span>Prazo: ${formatDate(t.dueDate)}</span>
                </div>
              </div>
            `).join('')}
            <br/>
          ` : ''}

          ${todayTasks.length > 0 ? `
            <div class="section-title gold"><span>⭐</span> Missões de Hoje</div>
            ${todayTasks.map(t => `
              <div class="task-card today">
                <h3>${t.title}</h3>
                <div class="meta">
                   <span class="badge" style="color: #4d7c0f">Entregar Hoje</span>
                   <span>•</span>
                   <span>${t.category || 'Geral'}</span>
                </div>
              </div>
            `).join('')}
            <br/>
          ` : ''}

          ${upcomingTasks.slice(0, 5).length > 0 ? `
            <div class="section-title"><span>📅</span> Próximas no Radar</div>
            ${upcomingTasks.slice(0, 5).map(t => `
              <div class="task-card">
                <h3>${t.title}</h3>
                <div class="meta">
                   <span>${t.category || 'Geral'}</span>
                   <span>•</span>
                   <span>${formatDate(t.dueDate)}</span>
                </div>
              </div>
            `).join('')}
          ` : ''}
          
          <div class="btn-container">
            <a href="https://taskflow-v2-gilt.vercel.app" class="btn">Acessar Sistema</a>
          </div>

        </div>
        <div class="footer">
          Gerado automaticamente pelo TaskFlow AI • Falcons
        </div>
      </div>
    </body>
    </html>
    `;

  if (EMAIL_USER && EMAIL_PASS) {
    const transporter = nodemailer.createTransport({
      host: 'smtp.protonmail.ch',
      port: 587,
      secure: false,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
      },
      logger: true,
      debug: true
    });

    await transporter.sendMail({
      from: {
        name: 'TaskFlow Assistant',
        address: EMAIL_USER
      },
      to: EMAIL_TO,
      subject: `📊 Relatório: ${overdueTasks.length} Atrasadas | ${todayTasks.length} Hoje`,
      html: html
    });

    console.log("✅ Email enviado com sucesso!");
  } else {
    console.log("⚠️ Email não enviado (Credenciais ausentes). HTML gerado.");
  }
}

main();
