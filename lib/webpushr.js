const WEBPUSHR_KEY = process.env.WEBPUSHR_KEY || '0935ad774b91df3bbac43f2784cda7ec';
const WEBPUSHR_AUTH_TOKEN = process.env.WEBPUSHR_AUTH_TOKEN || '125213';

export async function sendWebpushrNotification({ title, message, targetUrl = 'https://panel-respira.vercel.app' }) {
  if (!WEBPUSHR_KEY || !WEBPUSHR_AUTH_TOKEN) return;
  try {
    const res = await fetch('https://api.webpushr.com/v1/notification/send/all', {
      method: 'POST',
      headers: {
        'webpushrKey': WEBPUSHR_KEY,
        'webpushrAuthToken': WEBPUSHR_AUTH_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        message,
        target_url: targetUrl
      })
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('[webpushr] Error sending notification:', err);
  }
}
