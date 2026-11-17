interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: SendEmailOptions) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": process.env.BREVO_API_KEY!,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: "UpCheck",
        email: process.env.SENDER_EMAIL!,
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const errorData = await res.text();
    throw new Error(`Email delivery failed: ${res.status} - ${errorData}`);
  }

  return res.json();
}
