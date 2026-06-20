export class TimeoutError extends Error {
  constructor() {
    super("Tempo de resposta esgotado");
    this.name = "TimeoutError";
  }
}

// Corre `promise` contra um timeout. Necessário no bootstrap de sessão: numa
// máquina fria do Fly o GET /api/me pode pendurar indefinidamente; o timeout
// transforma a espera em rejeição, que o react-query então re-tenta.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (error) => {
        clearTimeout(id);
        reject(error);
      }
    );
  });
}
