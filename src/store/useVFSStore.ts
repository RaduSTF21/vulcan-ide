import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { VirtualFile } from '../types/vfs';

interface VFSState {
    files: Record<string, VirtualFile>;
    activeFileId: string | null;

    addFile: (file: Omit<VirtualFile, 'id' | 'isModified'>) => void;
    setActiveFile: (id: string) => void;
    updateFileContent: (path: string, content: string) => void;
    saveFile: (path: string) => void;
    deleteFile: (path: string) => void;
    updateFilePath: (oldPath: string, newPath: string, parentId: string | null) => void;
}

export const useVFSStore = create<VFSState>()(persist((set) => ({
    files: {},
    activeFileId: null,

    addFile: (file) =>
        set((state) => {
            if (state.files[file.path]) {
                console.error(`File named ${file.name} already exists.`);
                return state;
            }

            const id = crypto.randomUUID();
            return {
                files: {
                    ...state.files,
                    [file.path]: {
                        ...file,
                        id,
                        isModified: false,
                    },
                },
                activeFileId: id,
            };
        }),

    setActiveFile: (id) =>
        set((state) => {
            const exists = Object.values(state.files).some((file) => file.id === id);
            if (!exists) {
                console.error(`File with ID ${id} does not exist.`);
                return state;
            }

            return { activeFileId: id };
        }),

    updateFileContent: (path, content) =>
        set((state) => {
            const file = state.files[path];
            if (!file) {
                console.error(`File at path ${path} does not exist.`);
                return state;
            }

            return {
                files: {
                    ...state.files,
                    [path]: {
                        ...file,
                        content,
                        isModified: true,
                    },
                },
            };
        }),

    saveFile: (path) =>
        set((state) => {
            const file = state.files[path];
            if (!file) {
                console.error(`File at path ${path} does not exist.`);
                return state;
            }

            return {
                files: {
                    ...state.files,
                    [path]: {
                        ...file,
                        isModified: false,
                    },
                },
            };
        }),
    deleteFile: (path) =>
        set((state) => {
            const file = state.files[path];
            if (!file) {
                console.error(`File at path ${path} does not exist.`);
                return state;
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [path]: _, ...remainingFiles } = state.files;
            const isActiveFileDeleted = state.activeFileId === file.id;

            return {
                files: remainingFiles,
                activeFileId: isActiveFileDeleted ? null : state.activeFileId,
            };
        }),
    updateFilePath: (oldPath, newPath, parentId) =>
        set((state) => {
            const file = state.files[oldPath];
            if (!file) {
                console.error(`File at path ${oldPath} does not exist.`);
                return state;
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [oldPath]: _, ...remainingFiles } = state.files;

            return {
                files: {
                    ...remainingFiles,
                    [newPath]: {
                        ...file,
                        path: newPath,
                        parentId: parentId,
                    },
                },
            };
        }),
}),{
    name: 'vulcan-ide-vfs',
}));
