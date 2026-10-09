export interface Dropzone {
  setError(message: string | null): void;
  setEmptyState(empty: boolean): void;
  dispose(): void;
}

export function createDropzone(
  root: HTMLElement,
  onFile: (file: File) => void,
): Dropzone {
  const overlay = root.querySelector<HTMLDivElement>('#dropzone');
  const toast = root.querySelector<HTMLDivElement>('#toast');
  if (!overlay || !toast) {
    throw new Error('dropzone markup missing');
  }

  let dragDepth = 0;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const onDragEnter = (event: DragEvent): void => {
    event.preventDefault();
    dragDepth += 1;
    overlay.classList.add('dragover');
  };
  const onDragOver = (event: DragEvent): void => {
    event.preventDefault();
  };
  const onDragLeave = (event: DragEvent): void => {
    event.preventDefault();
    dragDepth = Math.max(dragDepth - 1, 0);
    if (dragDepth === 0) {
      overlay.classList.remove('dragover');
    }
  };
  const onDrop = (event: DragEvent): void => {
    event.preventDefault();
    dragDepth = 0;
    overlay.classList.remove('dragover');
    const file = event.dataTransfer?.files[0];
    if (file) {
      onFile(file);
    }
  };

  window.addEventListener('dragenter', onDragEnter);
  window.addEventListener('dragover', onDragOver);
  window.addEventListener('dragleave', onDragLeave);
  window.addEventListener('drop', onDrop);

  return {
    setError(message: string | null): void {
      clearTimeout(toastTimer);
      if (message === null) {
        toast.hidden = true;
        return;
      }
      toast.textContent = message;
      toast.hidden = false;
      toastTimer = setTimeout(() => {
        toast.hidden = true;
      }, 5000);
    },
    setEmptyState(empty: boolean): void {
      overlay.hidden = !empty;
    },
    dispose(): void {
      clearTimeout(toastTimer);
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    },
  };
}
