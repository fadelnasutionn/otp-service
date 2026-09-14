export async function sendOtpEmail(env, recipient, otp, ttlMinutes) {
  if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN || !env.MAILGUN_FROM) {
    throw new Error("Mailgun environment variables are not configured.: " + JSON.stringify({ MAILGUN_API_KEY: !!env.MAILGUN_API_KEY, MAILGUN_DOMAIN: !!env.MAILGUN_DOMAIN, MAILGUN_FROM: !!env.MAILGUN_FROM }));
  }

  const formData = new FormData();
  formData.set("from", env.MAILGUN_FROM);
  formData.set("to", recipient);
  formData.set("subject", "Your OTP Code");
  formData.set(
    "text",
    [
      `Your OTP Code is: ${otp}`,
      "",
      `This OTP expires in ${ttlMinutes} minutes.`,
      "Do not share this code with anyone."
    ].join("\n")
  );

  const response = await fetch(
    `https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`api:${env.MAILGUN_API_KEY}`)}`
      },
      body: formData
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Mailgun request failed (${response.status}): ${details}`);
  }

  return response.json();
}