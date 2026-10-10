/**
 * A stand-in for XMLHttpRequest (the proof's PUT, planner's decision 23):
 * the test drives the progress, the answer and the abort by hand.
 */
export class FakeXhr {
  static last: FakeXhr;
  status = 0;
  upload: {
    onprogress:
      | ((e: {
          lengthComputable: boolean;
          loaded: number;
          total: number;
        }) => void)
      | null;
  } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  headers: Record<string, string> = {};
  method = "";
  url = "";
  aborted = false;
  sent: unknown = null;
  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body?: unknown) {
    // driven by the test
    this.sent = body ?? null;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
}
