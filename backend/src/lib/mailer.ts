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
<<<<<<< Updated upstream
      "api-key": process.env.BREVO_API_KEY!,
=======
      "api-key": env.BREVO_API_KEY!,
>>>>>>> Stashed changes
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: "UpCheck",
<<<<<<< Updated upstream
        email: process.env.SENDER_EMAIL!,
=======
        email: env.SENDER_EMAIL!,
>>>>>>> Stashed changes
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
