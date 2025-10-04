import axios from 'axios';

const AGENT_WEBHOOK = process.env.AGENT_WEBHOOK_URL;

export async function forwardToAgent(agentId: string | null, payload: any) {
  try {
    if (!AGENT_WEBHOOK) {
      console.warn('forwardToAgent: no AGENT_WEBHOOK configured, logging payload instead');
      console.log('forwardToAgent payload:', { agentId, ...payload });
      return;
    }
    await axios.post(AGENT_WEBHOOK, { agentId, ...payload }, { timeout: 5000 });
    console.log('forwardToAgent: enviado al webhook');
  } catch (err) {
    console.error('forwardToAgent error', err);
    // Fallback: could store in DB queue
  }
}

export default { forwardToAgent };
