// Edge Function: check-reminders
// Roda via pg_cron todo dia às 10:00 UTC (07:00 Brasília)
// Envia e-mail para todos os e-mails cadastrados em notification_emails (is_active=true)
// Fallback: e-mails de auth dos usuários com lembretes (comportamento anterior)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_KEY           = Deno.env.get('RESEND_API_KEY')!
const CRON_SECRET          = Deno.env.get('CRON_SECRET') ?? ''
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization') ?? ''
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Data de hoje no horário de Brasília (UTC-3)
    const brtNow = new Date(Date.now() - 3 * 60 * 60 * 1000)
    const today  = brtNow.toISOString().split('T')[0]   // 'yyyy-MM-dd'

    console.log(`[check-reminders] verificando lembretes para ${today}`)

    // Busca lembretes do dia com nome do usuário
    const { data: reminders, error } = await supabase
      .from('reminders')
      .select('id, text, reminder_date, reminder_time, user_id, profiles(full_name)')
      .eq('reminder_date', today)

    if (error) throw error

    if (!reminders?.length) {
      console.log('[check-reminders] nenhum lembrete hoje')
      return json({ sent: 0, date: today })
    }

    console.log(`[check-reminders] ${reminders.length} lembrete(s) encontrado(s)`)

    // Busca e-mails cadastrados em notification_emails (ativos)
    const { data: notifEmails } = await supabase
      .from('notification_emails')
      .select('email, label, is_active')
      .eq('is_active', true)

    // Monta lista de destinos
    type Dest = { email: string; name: string }
    let destinations: Dest[] = []

    if (notifEmails?.length) {
      // Usa e-mails cadastrados manualmente
      destinations = notifEmails.map(n => ({
        email: n.email,
        name:  n.label ?? 'você',
      }))
      console.log(`[check-reminders] ${destinations.length} e-mail(s) cadastrado(s) encontrado(s)`)
    } else {
      // Fallback: e-mails de auth dos usuários com lembretes hoje
      console.log('[check-reminders] nenhum e-mail cadastrado — usando fallback de auth')
      const userIds = [...new Set(reminders.map(r => r.user_id))]
      for (const userId of userIds) {
        const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(userId)
        if (userErr || !userData?.user?.email) {
          console.warn(`[check-reminders] e-mail não encontrado para user ${userId}`)
          continue
        }
        const profile = reminders.find(r => r.user_id === userId)?.profiles
        const name    = (profile as { full_name?: string } | null)?.full_name?.split(' ')[0] ?? 'você'
        destinations.push({ email: userData.user.email, name })
      }
    }

    if (!destinations.length) {
      console.log('[check-reminders] nenhum destino — encerrando')
      return json({ sent: 0, date: today })
    }

    // Monta linhas da lista de lembretes (todos os usuários, com nome de quem criou)
    const listRows = reminders.map((r) => {
      const authorName = (r.profiles as { full_name?: string } | null)?.full_name?.split(' ')[0]
      const authorTag  = authorName
        ? `<span style="color:#94a3b8;font-size:11px;margin-left:6px;">(${authorName})</span>`
        : ''
      const timeTag = r.reminder_time
        ? `<span style="color:#64748b;font-size:12px;margin-left:6px;">às ${r.reminder_time.slice(0, 5)}</span>`
        : ''
      return `
        <li style="display:flex;align-items:flex-start;gap:12px;padding:14px 0;border-bottom:1px solid #f1f5f9;">
          <span style="width:8px;height:8px;border-radius:50%;background:#3b82f6;flex-shrink:0;margin-top:4px;"></span>
          <span style="color:#1e293b;font-size:14px;font-weight:600;line-height:1.4;">${r.text}${timeTag}${authorTag}</span>
        </li>`
    }).join('')

    const count  = reminders.length
    const plural = count === 1 ? 'lembrete' : 'lembretes'

    let sent = 0
    for (const dest of destinations) {
      const html = buildHtml(dest.name, count, plural, listRows)

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    'HouseFinance <onboarding@resend.dev>',
          to:      [dest.email],
          subject: `🔔 ${count} ${plural} para hoje — HouseFinance`,
          html,
        }),
      })

      if (res.ok) {
        sent++
        console.log(`[check-reminders] ✓ e-mail enviado para ${dest.email}`)
      } else {
        const errText = await res.text()
        console.error(`[check-reminders] ✗ erro ao enviar para ${dest.email}:`, errText)
      }
    }

    return json({ sent, date: today, total: reminders.length, destinations: destinations.length })
  } catch (err) {
    console.error('[check-reminders] erro geral:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status:  500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

function buildHtml(firstName: string, count: number, plural: string, listRows: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:24px;">
      <p style="margin:0;font-size:32px;">🏠</p>
      <h1 style="margin:8px 0 0;font-size:20px;font-weight:900;color:#1e293b;letter-spacing:-0.5px;">HouseFinance</h1>
      <p style="margin:4px 0 0;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;">lembretes do dia</p>
    </div>

    <!-- Card principal -->
    <div style="background:#ffffff;border-radius:24px;padding:28px 28px 20px;box-shadow:0 2px 20px rgba(0,0,0,0.06);">
      <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#1e293b;">Bom dia, ${firstName}! 👋</p>
      <p style="margin:0 0 20px;font-size:13px;color:#64748b;">
        Há <strong style="color:#3b82f6;">${count} ${plural}</strong> agendado${count > 1 ? 's' : ''} para hoje:
      </p>

      <ul style="margin:0;padding:0;list-style:none;">${listRows}</ul>

      <!-- CTA -->
      <div style="margin-top:20px;padding:14px 20px;background:linear-gradient(135deg,#eff6ff,#eef2ff);border-radius:16px;border:1px solid #bfdbfe;text-align:center;">
        <p style="margin:0;font-size:12px;color:#3730a3;font-weight:700;">
          Abra o HouseFinance para gerenciar seus lembretes
        </p>
      </div>
    </div>

    <!-- Footer -->
    <p style="margin:20px 0 0;font-size:10px;color:#cbd5e1;text-align:center;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;">
      Enviado automaticamente às 07h · HouseFinance
    </p>
  </div>
</body>
</html>`
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
