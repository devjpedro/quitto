import { useEffect, useState } from "react";
import { api } from "./lib/api";

export function App() {
  const [status, setStatus] = useState<string>("...");

  useEffect(() => {
    api.api.ping.get().then(({ data }) => {
      if (data) {
        setStatus(`${data.service}: ${data.status}`);
      }
    });
  }, []);

  return (
    <main className="tw-flex tw-min-h-screen tw-items-center tw-justify-center tw-bg-stone-50">
      <p className="tw-text-stone-800">Quitto — {status}</p>
    </main>
  );
}
