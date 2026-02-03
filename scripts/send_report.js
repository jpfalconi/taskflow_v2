
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

// --- CONFIGURAÇÃO ---
// As variáveis de ambiente devem ser configuradas no GitHub Secrets
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const EMAIL_USER = process.env.EMAIL_USER; // Seu email (gmail, outlook)
const EMAIL_PASS = process.env.EMAIL_PASS; // App Password do email
const EMAIL_TO = 'jp@jphub.com.br';        // Para quem enviar

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

if (!EMAIL_USER || !EMAIL_PASS) {
  console.error("⚠️ AVISO: Configuração de email ausente. Apenas gerando HTML para log.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const getTodayStr = () => new Date().toISOString().split('T')[0];

const formatDate = (dateStr) => {
  if (!dateStr) return 'Sem Prazo';
  return new Date(dateStr).toLocaleDateString('pt-BR');
};

async function main() {
  console.log("🚀 Iniciando geração do relatório...");

  // 1. Buscar tarefas
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .neq('status', 'DONE') // Apenas não concluídas
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

  // Se não houver nada urgente, talvez nem precise enviar email, mas vamos enviar um "Tudo certo"
  if (overdueTasks.length === 0 && todayTasks.length === 0) {
    console.log("✅ Nenhuma tarefa atrasada ou para hoje.");
    // Opcional: Enviar email motivacional
  }

  // 3. Montar HTML
  const html = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; background-color: ${COLORS.bg}; margin: 0; padding: 0; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); margin-top: 20px; margin-bottom: 20px; }
        .header { background-color: ${COLORS.primary}; color: #ffffff; padding: 40px 20px; text-align: center; border-radius: 20px 20px 0 0; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -1px; color: ${COLORS.secondary}; text-transform: uppercase; font-style: italic; }
        .header p { margin: 10px 0 0; opacity: 0.9; font-size: 14px; letter-spacing: 1px; text-transform: uppercase; font-weight: bold; }
        .content { padding: 40px 30px; }
        .section-title { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 15px; display: flex; align-items: center; gap: 10px; }
        .section-title.red { color: ${COLORS.red}; }
        .section-title.gold { color: #D9B300; }
        .card { background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 15px 20px; margin-bottom: 15px; position: relative; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.02); }
        .card.overdue { border-left: 5px solid ${COLORS.red}; }
        .card.today { border-left: 5px solid #D9B300; }
        .card h3 { margin: 0 0 5px; font-size: 16px; font-weight: 700; color: #000; }
        .card .meta { font-size: 11px; color: #999; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .footer { text-align: center; padding: 20px; color: #999; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; background-color: #f9f9f9; }
        .highlight { font-weight: 900; color: #000; }
      </style>
    </head>
    <body>
      <div className="container">
        <div className="header">
          <h1>TaskFlow Report</h1>
          <p>Seu planejamento estratégico diário</p>
        </div>
        
        <div className="content">
          <p style="margin-bottom: 30px; font-size: 16px; color: #666; text-align: center;">
            Resumo de hoje: <span className="highlight">${tasks.length}</span> missões ativas no total.
          </p>

          ${overdueTasks.length > 0 ? `
            <div className="section-title red">🚨 Atrasadas (${overdueTasks.length})</div>
            ${overdueTasks.map(t => `
              <div className="card overdue">
                <h3>${t.title}</h3>
                <div className="meta">${t.category || 'Geral'} • Prazo: ${formatDate(t.dueDate)}</div>
              </div>
            `).join('')}
            <br/>
          ` : ''}

          ${todayTasks.length > 0 ? `
            <div className="section-title gold">⭐ Para Hoje (${todayTasks.length})</div>
            ${todayTasks.map(t => `
              <div className="card today">
                <h3>${t.title}</h3>
                <div className="meta">${t.category || 'Geral'} • Prazo: ${formatDate(t.dueDate)}</div>
              </div>
            `).join('')}
            <br/>
          ` : ''}

          ${upcomingTasks.slice(0, 3).length > 0 ? `
            <div className="section-title" style="color: #999">📅 Próximas</div>
            ${upcomingTasks.slice(0, 3).map(t => `
              <div className="card">
                <h3>${t.title}</h3>
                <div className="meta">${t.category || 'Geral'} • Prazo: ${formatDate(t.dueDate)}</div>
              </div>
            `).join('')}
          ` : ''}
          
        </div>
        <div className="footer">
          Gerado automaticamente pelo TaskFlow AI
        </div>
      </div>
    </body>
    </html>
  `;

  if (EMAIL_USER && EMAIL_PASS) {
    const transporter = nodemailer.createTransport({
      host: 'smtp.protonmail.ch',
      port: 587,
      secure: false, // false para usar STARTTLS na porta 587
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
      },
      tls: {
        ciphers: 'SSLv3'
      }
    });

    await transporter.sendMail({
      from: `"TaskFlow AI" <${EMAIL_USER}>`,
      to: EMAIL_TO,
      subject: `📊 Relatório Diário: ${overdueTasks.length} Atrasadas | ${todayTasks.length} Hoje`,
      html: html
    });

    console.log("✅ Email enviado com sucesso!");
  } else {
    console.log("⚠️ Email não enviado (Credenciais ausentes). HTML gerado.");
    // console.log(html); // Descomente para debug
  }
}

main();
