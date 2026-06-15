import { useEffect } from "react";

/** Define document.title enquanto o componente está montado; restaura ao sair. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
