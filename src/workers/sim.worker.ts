/// <reference lib="webworker" />
import { createEngine } from '@/core/sim/engine';
import { EngineRunner } from '@/core/sim/runner';
import './engines';
import type { FromWorker, ToWorker } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

let runner: EngineRunner | undefined;

function post(msg: FromWorker) {
  if (msg.type === 'frame') {
    self.postMessage(msg, [msg.frame.prev.buffer, msg.frame.curr.buffer]);
  } else {
    self.postMessage(msg);
  }
}

self.onmessage = async (ev: MessageEvent<ToWorker>) => {
  const msg = ev.data;
  switch (msg.type) {
    case 'load': {
      try {
        const engine = await createEngine(msg.engineId);
        engine.reset(msg.params);
        runner = new EngineRunner(engine);
        post({
          type: 'loaded',
          requestId: msg.requestId,
          stateSize: engine.stateSize,
          dt: engine.dt,
        });
      } catch (e) {
        post({ type: 'error', error: { code: 'load', message: String(e) } });
      }
      return;
    }
    case 'frame': {
      if (!runner) return;
      const out = runner.frame(msg.frameSeconds, msg.speed, msg.paused);
      if ('code' in out) post({ type: 'error', error: out });
      else post({ type: 'frame', seq: msg.seq, frame: out });
      return;
    }
    case 'reset':
      runner?.reset(msg.params);
      return;
    case 'input':
      runner?.input(msg.msg);
      return;
    case 'budget':
      if (runner) runner.budgetMs = msg.ms;
      return;
  }
};
