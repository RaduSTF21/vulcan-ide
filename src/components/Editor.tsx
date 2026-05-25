"use client";
import React from "react";
import { useVFSStore } from "../store/useVFSStore";
import { Editor as MonacoEditor } from "@monaco-editor/react";

export const Editor = () => {
    const files = useVFSStore((state) => state.files);
    const activeFileId = useVFSStore((state) => state.activeFileId);
    const activeFile = Object.values(files).find((file) => file.id === activeFileId);

    return (
        <div className="flex-1">
            {activeFile ? (
                <MonacoEditor
                    height="100%"
                    language={activeFile.language}
                    value={activeFile.content}
                    path={activeFile.path}
                    onChange={(value) => {
                        useVFSStore.getState().updateFileContent(activeFile.path, value || "");
                    }}
                />
            ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                    Select a file to start editing.
                </div>
            )}
        </div>
    );
};