
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import process from 'node:process';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
const emailToRaw = process.env.EMAIL_TO || emailUser;
const appUrl = process.env.APP_URL || 'https://taskflow.io';

const emailTo = emailToRaw.split(',').map(e => e.trim()).join(', ');

if (!supabaseUrl || !supabaseKey || !emailUser || !emailPass) {
  console.error('❌ Erro: Faltam variáveis de ambiente nos Secrets do GitHub.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const getTodayStr = () => new Date().toISOString().split('T')[0];

async function generateAndSend() {
  console.log('🚀 Iniciando geração do relatório diário...');

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .neq('status', 'DONE')
    .order('dueDate', { ascending: true });

  if (error) {
    console.error('❌ Erro ao buscar dados no Supabase:', error);
    process.exit(1);
  }

  const todayStr = getTodayStr();
  const next7Days = new Date();
  next7Days.setDate(next7Days.getDate() + 7);
  const next7DaysStr = next7Days.toISOString().split('T')[0];

  const lateTasks = tasks.filter(t => t.dueDate && t.dueDate < todayStr);
  const todayTasks = tasks.filter(t => t.dueDate === todayStr);
  const upcomingTasks = tasks.filter(t => t.dueDate && t.dueDate > todayStr && t.dueDate <= next7DaysStr);

  const renderTaskList = (list, title, color) => {
    if (list.length === 0) return '';
    return `
      <div style="margin-top: 25px;">
        <h3 style="color: ${color}; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; font-weight: 800;">${title} (${list.length})</h3>
        ${list.map(t => `
          <div style="padding: 12px 16px; background: #fcfcfc; border: 1px solid #eee; margin-bottom: 8px; border-radius: 12px; border-left: 5px solid ${color};">
            <div style="font-weight: bold; color: #111; font-size: 14px;">${t.title}</div>
            <div style="font-size: 11px; color: #777; margin-top: 4px; font-weight: 500;">
              ${t.category || 'Geral'} • Prazo: ${new Date(t.dueDate).toLocaleDateString('pt-BR')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f4f4; padding: 40px 10px; color: #333;">
      <div style="max-width: 600px; margin: auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.05);">
        <div style="background: #7A7423; padding: 30px; text-align: center;">
          <h1 style="color: #A7E82B; margin: 0; font-size: 24px; letter-spacing: -1px; font-weight: 900; text-transform: uppercase;">TaskFlow Report</h1>
          <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin-top: 5px; font-weight: bold;">Seu planejamento estratégico diário</p>
        </div>
        
        <div style="padding: 30px;">
          <p style="font-size: 15px; margin-top: 0;">Resumo de hoje: <strong>${tasks.length}</strong> missões ativas no total.</p>
          
          ${renderTaskList(lateTasks, '🚨 Atrasadas', '#D64550')}
          ${renderTaskList(todayTasks, '⭐ Para Hoje', '#7A7423')}
          ${renderTaskList(upcomingTasks, '📅 Próximos 7 Dias', '#61C2FF')}

          <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #eee; text-align: center;">
            <a href="${appUrl}" style="display: inline-block; padding: 16px 32px; background: #7A7423; color: white; text-decoration: none; border-radius: 14px; font-weight: 800; font-size: 15px; box-shadow: 0 4px 15px rgba(122, 116, 35, 0.2);">ABRIR TASKFLOW</a>
            
            <div style="margin-top: 25px; padding: 15px; background: #fdfdfd; border-radius: 12px; border: 1px dashed #ddd;">
              <p style="margin: 0; font-size: 10px; color: #aaa; text-transform: uppercase; font-weight: bold; margin-bottom: 5px;">Acesso Direto (Hiperlink):</p>
              <a href="${appUrl}" style="color: #7A7423; font-size: 12px; word-break: break-all; text-decoration: underline; font-family: 'Courier New', monospace;">${appUrl}</a>
            </div>
            
            <p style="font-size: 10px; color: #bbb; margin-top: 30px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">Enviado via TaskFlow Cloud Engine</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const transporter = nodemailer.createTransport({
    host: "smtp.protonmail.ch",
    port: 587,
    secure: false,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false
    }
  });

  try {
    await transporter.sendMail({
      from: `"TaskFlow" <${emailUser}>`,
      to: emailTo,
      subject: `📋 Relatório: ${lateTasks.length > 0 ? '⚠️ ' + lateTasks.length + ' Atrasadas | ' : ''}${todayTasks.length} Hoje`,
      html: htmlContent,
    });
    console.log('✅ Relatório enviado com sucesso!');
  } catch (mailError) {
    console.error('❌ Erro ao enviar e-mail:', mailError);
    process.exit(1);
  }
}

generateAndSend().catch(err => {
  console.error('❌ Erro crítico no script:', err);
  process.exit(1);
});
