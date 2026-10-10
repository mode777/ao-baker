import type { InputEntry } from '../loader/bundle';
import { entryFromFile } from '../loader/bundle';

export interface Dropzone {
  setError(message: string | null): void;
  setEmptyState(empty: boolean): void;
  dispose(): void;
}

type DataTransferEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file: (success: (file: File) => void, failure: (error: DOMException) => void) => void;
  createReader: () => {
    readEntries: (
      success: (results: DataTransferEntry[]) => void,
      failure: (error: DOMException) => void,
    ) => void;
  };
};

function entryFromFileSystemEntry(
  entry: DataTransferEntry,
  base: string,
  out: InputEntry[],
): Promise<void> {
  const path = `${base}${entry.name}`;
  if (entry.isFile) {
    return new Promise<void>((resolve, reject) => {
      entry.file(
        (file) => {
          out.push(entryFromFile(file, path));
          resolve();
        },
        (error) => reject(error),
      );
    });
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    const readAll = (): Promise<DataTransferEntry[]> =>
      new Promise((resolve, reject) => {
        reader.readEntries(
          (results) => resolve(results),
          (error) => reject(error),
        );
      });
    return (async () => {
      // readEntries returns batches; loop until a batch comes back empty
      for (;;) {
        const batch = await readAll();
        if (batch.length === 0) {
          break;
        }
        for (const child of batch) {
          await entryFromFileSystemEntry(child, `${path}/`, out);
        }
      }
    })();
  }
  return Promise.resolve();
}

/**
 * Converts a drop's DataTransfer into bundle entries, expanding dropped
 * directories via the entries API (falling back to plain files when the
 * entries API is unavailable). A stall or error in the entries API falls
 * back to the plain file list, which covers every non-directory source.
 */
async function dataTransferToEntries(
  transfer: DataTransfer,
): Promise<InputEntry[]> {
  const fallback = (): InputEntry[] =>
    Array.from(transfer.files).map((file) => entryFromFile(file));

  const fsEntries: DataTransferEntry[] = [];
  for (const item of Array.from(transfer.items)) {
    const getAsEntry = (item as unknown as {
      webkitGetAsEntry?: () => DataTransferEntry | null;
    }).webkitGetAsEntry;
    const entry = getAsEntry?.call(item);
    if (entry) {
      fsEntries.push(entry);
    }
  }
  if (fsEntries.length === 0) {
    return fallback();
  }
  try {
    const entries: InputEntry[] = [];
    for (const entry of fsEntries) {
      await entryFromFileSystemEntry(entry, '', entries);
    }
    return entries.length > 0 ? entries : fallback();
  } catch {
    return fallback();
  }
}

export function createDropzone(
  root: HTMLElement,
  onFiles: (entries: InputEntry[]) => void,
): Dropzone {
  const overlay = root.querySelector<HTMLDivElement>('#dropzone');
  const toast = root.querySelector<HTMLDivElement>('#toast');
  if (!overlay || !toast) {
    throw new Error('dropzone markup missing');
  }
  const toastEl = toast;

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
    if (!event.dataTransfer) {
      return;
    }
    // guard against entry-API stalls (e.g. synthetic drops): plain files win
    const conversion = dataTransferToEntries(event.dataTransfer);
    const stallGuard = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 2000);
    });
    Promise.race([conversion, stallGuard])
      .then((entries) => {
        if (entries && entries.length > 0) {
          onFiles(entries);
        }
      })
      .catch((error: unknown) => {
        onFilesError(error);
      });
  };

  const onFilesError = (error: unknown): void => {
    setError(
      error instanceof Error ? `Could not read files: ${error.message}` : 'Could not read files',
    );
  };

  window.addEventListener('dragenter', onDragEnter);
  window.addEventListener('dragover', onDragOver);
  window.addEventListener('dragleave', onDragLeave);
  window.addEventListener('drop', onDrop);

  // picker fallback (same pipeline as drag-and-drop)
  const pickers = document.createElement('div');
  pickers.className = 'pickers';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.id = 'file-picker';
  const folderInput = document.createElement('input');
  folderInput.type = 'file';
  folderInput.id = 'folder-picker';
  folderInput.setAttribute('webkitdirectory', '');
  const fileButton = document.createElement('button');
  fileButton.textContent = 'Choose files';
  fileButton.addEventListener('click', () => fileInput.click());
  const folderButton = document.createElement('button');
  folderButton.textContent = 'Choose folder';
  folderButton.addEventListener('click', () => folderInput.click());
  const onPicked = (): void => {
    const files = fileInput.files ?? folderInput.files;
    if (files && files.length > 0) {
      const entries = Array.from(files).map((file) =>
        entryFromFile(file, file.webkitRelativePath || file.name),
      );
      onFiles(entries);
    }
    fileInput.value = '';
    folderInput.value = '';
  };
  fileInput.addEventListener('change', onPicked);
  folderInput.addEventListener('change', onPicked);
  pickers.append(fileButton, folderButton, fileInput, folderInput);
  overlay.querySelector('.dropzone-box')?.appendChild(pickers);

  function setError(message: string | null): void {
    clearTimeout(toastTimer);
    if (message === null) {
      toastEl.hidden = true;
      return;
    }
    toastEl.textContent = message;
    toastEl.hidden = false;
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 5000);
  }

  return {
    setError,
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
