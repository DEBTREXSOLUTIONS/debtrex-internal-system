import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || 'DEBTREX <noreply@debtrex.com>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function emailWrapper(content: string, ctaText?: string, ctaUrl?: string) {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f8f8f8;margin:0;padding:0;">
  <div style="max-width:600px;margin:40px auto;background:white;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5;">
    <div style="background:#E02020;padding:24px;text-align:left;">
      <div style="font-family:Arial,sans-serif;font-weight:900;font-size:24px;color:white;letter-spacing:2px;text-transform:uppercase;">
        DEBT<span style="opacity:0.6;">REX</span>
      </div>
      <div style="font-size:10px;font-weight:bold;letter-spacing:3px;color:rgba(255,255,255,0.7);text-transform:uppercase;margin-top:2px;">
        Internal System
      </div>
    </div>
    <div style="padding:32px;color:#333;line-height:1.6;font-size:14px;">
      ${content}
      ${ctaUrl && ctaText ? `
        <p style="margin-top:24px;text-align:center;">
          <a href="${ctaUrl}" style="background:#E02020;color:white;padding:12px 28px;text-decoration:none;border-radius:4px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;font-size:13px;display:inline-block;">${ctaText}</a>
        </p>
      ` : ''}
    </div>
    <div style="background:#f8f8f8;padding:16px;text-align:center;font-size:11px;color:#999;border-top:1px solid #e5e5e5;">
      DEBTREX SOLUTIONS — Internal System Notification<br>
      <a href="${APP_URL}/settings" style="color:#999;">Manage notification preferences</a>
    </div>
  </div>
</body></html>
  `;
}

export async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.log('[Email] (no API key) Would send to', to, '—', subject);
    return null;
  }
  try {
    return await resend.emails.send({ from: FROM, to, subject, html });
  } catch (e) {
    console.error('Email send failed:', e);
    return null;
  }
}

export async function sendTaskAssignedEmail(to: string, name: string, task: any, assignerName: string) {
  const html = emailWrapper(
    `<h2 style="color:#111;font-size:20px;margin:0 0 16px;">Hi ${name.split(' ')[0]},</h2>
     <p><strong>${assignerName}</strong> has assigned a new task to you:</p>
     <div style="background:#FFF0F0;border-left:3px solid #E02020;padding:16px;margin:16px 0;border-radius:0 4px 4px 0;">
       <h3 style="margin:0 0 8px;color:#111;">${task.title}</h3>
       ${task.description ? `<p style="margin:0;color:#666;font-size:13px;">${task.description}</p>` : ''}
       ${task.deadline ? `<p style="margin:8px 0 0;font-size:12px;"><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleDateString()}</p>` : ''}
       <p style="margin:8px 0 0;font-size:12px;"><strong>Priority:</strong> ${task.priority?.toUpperCase()}</p>
     </div>`,
    'View Task',
    `${APP_URL}/tasks/${task.id}`
  );
  return sendEmail(to, `New task: ${task.title}`, html);
}

export async function sendTaskOverdueEmail(to: string, name: string, task: any) {
  const html = emailWrapper(
    `<h2 style="color:#E02020;font-size:20px;margin:0 0 16px;">⚠ Task Overdue</h2>
     <p>Hi ${name.split(' ')[0]}, the task below is past its deadline:</p>
     <div style="background:#FFF0F0;border-left:3px solid #E02020;padding:16px;margin:16px 0;">
       <h3 style="margin:0 0 8px;">${task.title}</h3>
       <p style="margin:0;font-size:12px;"><strong>Was due:</strong> ${new Date(task.deadline).toLocaleDateString()}</p>
     </div>
     <p>Please update the task or contact your manager.</p>`,
    'Update Task',
    `${APP_URL}/tasks/${task.id}`
  );
  return sendEmail(to, `Overdue: ${task.title}`, html);
}

export async function sendExpenseSubmittedEmail(to: string, name: string, expense: any, submitter: string) {
  const html = emailWrapper(
    `<h2 style="color:#111;font-size:20px;margin:0 0 16px;">Expense Awaiting Approval</h2>
     <p>${submitter} has submitted an expense for your review:</p>
     <div style="background:#FFF0F0;border-left:3px solid #E02020;padding:16px;margin:16px 0;">
       <h3 style="margin:0 0 8px;">$${parseFloat(expense.amount).toFixed(2)} — ${expense.category}</h3>
       <p style="margin:0;font-size:13px;">${expense.description}</p>
       ${expense.vendor ? `<p style="margin:4px 0 0;font-size:12px;color:#666;">Vendor: ${expense.vendor}</p>` : ''}
     </div>`,
    'Review Expense',
    `${APP_URL}/budget`
  );
  return sendEmail(to, `Expense pending: $${parseFloat(expense.amount).toFixed(2)}`, html);
}

export async function sendUserInvitedEmail(to: string, name: string, tempPassword: string, inviterName: string) {
  const html = emailWrapper(
    `<h2 style="color:#111;font-size:20px;margin:0 0 16px;">Welcome to DEBTREX, ${name.split(' ')[0]}!</h2>
     <p>${inviterName} has invited you to join the DEBTREX SOLUTIONS internal system.</p>
     <div style="background:#FFF0F0;border-left:3px solid #E02020;padding:16px;margin:16px 0;">
       <p style="margin:0;font-size:13px;"><strong>Email:</strong> ${to}</p>
       <p style="margin:6px 0 0;font-size:13px;"><strong>Temporary Password:</strong> <code style="background:white;padding:2px 6px;border-radius:3px;">${tempPassword}</code></p>
     </div>
     <p style="font-size:13px;color:#666;">Please change your password after your first login.</p>`,
    'Sign In Now',
    `${APP_URL}/login`
  );
  return sendEmail(to, 'Welcome to DEBTREX SOLUTIONS', html);
}
