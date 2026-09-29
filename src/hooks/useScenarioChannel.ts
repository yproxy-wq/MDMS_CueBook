import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';

export interface ScenarioChannelMessage {
  type?: string;
  scenarioId?: string;
  source?: string;
}

/** Keep the transport alive while scenarios and callback closures change. */
export function useScenarioChannel({ enabled, scope, source, channelRef, onMessage }: {
  enabled: boolean;
  scope: string;
  source: string;
  channelRef: MutableRefObject<BroadcastChannel | null>;
  onMessage: (message: ScenarioChannelMessage) => void;
}) {
  const handlers = useRef({onMessage});
  useEffect(() => { handlers.current = {onMessage}; }, [onMessage]);
  useEffect(() => {
    if (!enabled) return;
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`cuebook-active-scenario:${scope}`) : null;
    channelRef.current = channel;
    const receive = (message: ScenarioChannelMessage | null) => {
      if (!message || typeof message !== 'object' || message.source === source) return;
      handlers.current.onMessage(message);
    };
    const handleMessage = (event: MessageEvent<ScenarioChannelMessage>) => receive(event.data);
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== `cuebook_active_scenario:${scope}` || !event.newValue) return;
      try { receive(JSON.parse(event.newValue)); } catch { /* Ignore malformed storage. */ }
    };
    channel?.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);
    channel?.postMessage({type:'scenario-active-request', source});
    return () => {
      channel?.removeEventListener('message', handleMessage);
      channel?.close();
      if (channelRef.current === channel) channelRef.current = null;
      window.removeEventListener('storage', handleStorage);
    };
  }, [enabled, scope, source, channelRef]);
}
