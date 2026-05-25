"use client";
import React from "react";
import { useVFSStore } from "../store/useVFSStore";

export const Sidebar = () => {
    const files = useVFSStore((state) => state.files);
    const addFile = useVFSStore((state) => state.addFile);
    const setActiveFile = useVFSStore((state) => state.setActiveFile);
    const activeFileId = useVFSStore((state) => state.activeFileId);
    const fileList = Object.values(files);

    const handleAddFile = () => {
        const fileName = prompt("File name:", "NewFile");

        if (!fileName) return;

        const existingFile = fileList.find((file) => file.name === fileName);
        if (existingFile) {
            alert(`File ${fileName} already exists.`);
            setActiveFile(existingFile.id);
            return;
        }

        const extension = fileName.split(".").pop() || "";
        const languageMap: Record<string, string> = {
            js: "javascript",
            ts: "typescript",
            py: "python",
            java: "java",
            rb: "ruby",
            go: "go",
            rs: "rust",
            cpp: "cpp",
            cs: "csharp",
            html: "html",
            css: "css",
            json: "json",
            md: "markdown",
        };

        addFile({
            name: fileName,
            path: `/${fileName}`,
            content: "",
            language: languageMap[extension] || "",
        });
    };

    return (
        <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-gray-400 mb-2 uppercase px-4">Files</h2>
            <button className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded" onClick={handleAddFile}>
                Add File
            </button>

            {fileList.length === 0 ? (
                <p className="text-gray-500 text-sm px-4">No files are open.</p>
            ) : (
                fileList.map((file) => (
                    <button
                        key={file.id}
                        className={`w-full text-left px-4 py-2 rounded ${activeFileId === file.id ? "bg-gray-700" : "hover:bg-gray-700"}`}
                        onClick={() => setActiveFile(file.id)}
                    >
                        {file.name}
                    </button>
                ))
            )}
        </div>
    );
};
