import { handleBakeRequest, type BakeRequest, type BakeResponse } from './protocol';

interface WorkerContext {
  onmessage: ((event: MessageEvent<BakeRequest>) => void) | null;
  postMessage(message: BakeResponse, transfer?: Transferable[]): void;
}

const ctx = self as unknown as WorkerContext;

ctx.onmessage = (event) => {
  handleBakeRequest(event.data, (response, transfer) => {
    ctx.postMessage(response, transfer ?? []);
  });
};
