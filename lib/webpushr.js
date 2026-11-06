// Utilidad oficial para disparar notificaciones Push mediante Webpushr
const WEBPUSHR_KEY = '0935ad774b91df3bbac43f2784cda7ec';
const WEBPUSHR_AUTH_TOKEN = '125213';

export async function sendWebpushrNotification({ title, message, url, targetUrl }) {
  const finalUrl = url || targetUrl || 'https://panel-respira.vercel.app';
  try {
    const payload = {
      title: title || 'Estética Respira',
      message: message || 'Nueva reserva registrada',
      target_url: finalUrl,
      icon: 'https://panel-respira.vercel.app/logo-icono.png',
      action_buttons: [{ title: 'Ver en Panel', url: finalUrl }]
    };

    const res = await fetch('https://api.webpushr.com/v1/notification/send/all', {
      method: 'POST',
      headers: {
        'webpushrKey': WEBPUSHR_KEY,
        'webpushrAuthToken': WEBPUSHR_AUTH_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('[Webpushr Server] Push enviado:', data);
    return data;
  } catch (err) {
    console.error('[Webpushr Server] Error al enviar notificación:', err);
  }
}
