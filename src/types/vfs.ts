export interface VirtualFile {
    id: string;
    path: string;
    name: string;
    content: string;
    language: string;
    isModified: boolean;
}