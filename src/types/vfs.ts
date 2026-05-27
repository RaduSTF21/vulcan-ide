export interface VirtualFile {
    id: string;
    type: "file" | "folder";
    parentId: string | null;
    path: string;
    name: string;
    content?: string;
    language?: string;
    isModified: boolean;
}