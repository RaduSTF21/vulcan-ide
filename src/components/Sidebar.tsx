"use client";
import React from "react";
import { useVFSStore } from "../store/useVFSStore";
import { VirtualFile } from "../types/vfs";

export const Sidebar = () => {
    const files = useVFSStore((state) => state.files);
    const addFile = useVFSStore((state) => state.addFile);
    const setActiveFile = useVFSStore((state) => state.setActiveFile);
    const activeFileId = useVFSStore((state) => state.activeFileId);
    const fileList = Object.values(files);
    const deleteFile = useVFSStore((state) => state.deleteFile);
    const updateFilePath = useVFSStore((state) => state.updateFilePath);

    const [isMounted,setIsMounted] = React.useState(false);
    
    React.useEffect(() => {
        setIsMounted(true);
    },[]);

    const [activeMenuId, setActiveMenuId] = React.useState<string | null>(null);
    const [expandedFolders, setExpandedFolders] = React.useState<string[]>([]);

    const handleAddFile = (targetParentId: string | null) => {
        const fileName = prompt("File name:", "NewFile");

        if (!fileName) return;
        let basePath = "";
        if (targetParentId) {
            const parentFolder = fileList.find(f => f.id === targetParentId);
            if (parentFolder) basePath = parentFolder.path;
        }
        const fullPath = `${basePath}/${fileName}`;

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
            sol: "solidity",
            vy: "vyper",
            cairo: "cairo"
        };

        addFile({
            name: fileName,
            path: fullPath,
            parentId: targetParentId,
            type: "file",
            content: "",
            language: languageMap[extension] || "plaintext",
        });
    };

    const addFolder = (targetParentId: string | null) => {
        const folderName = prompt("Folder name:", "NewFolder");
        if (!folderName) return;
        let basePath = "";
        if (targetParentId) {
            const parentFolder = fileList.find(f => f.id === targetParentId);
            if (parentFolder) basePath = parentFolder.path;
        }
        const fullPath = `${basePath}/${folderName}`;

        const existingFolder = fileList.find((file) => file.name === folderName && file.type === "folder");
        if (existingFolder) {
            alert(`Folder ${folderName} already exists.`);
            setActiveFile(existingFolder.id);
            return;
        }

        addFile({
            name: folderName,
            path: fullPath,
            parentId: targetParentId,
            type: "folder",
            content: "",
            language: undefined,
        });
    };
    const renderContent = () => {
        if(!isMounted) {
            return <p className="text-gray-500 text-sm px-4">Loading project...</p>;
        }
        
        if(fileList.length === 0){
            return <p className="text-gray-500 text-sm px-4">No files are open.</p>;
        }
        return renderTree(null);
    }
    const handleFolderDrop = (e: React.DragEvent , targetItem: VirtualFile, isExpanded: boolean) => {
        e.preventDefault();
        e.stopPropagation();

        const draggedId = e.dataTransfer.getData("text/plain");
        if(!draggedId || draggedId === targetItem.id) return;
        const draggedFile = fileList.find(f => f.id === draggedId);
        if(!draggedFile) return;
        console.log(`Moving ${draggedFile.name} to folder ${targetItem.name}`);
        updateFilePath(draggedFile.path, `${targetItem.path}/${draggedFile.name}`, targetItem.id);                                    
        if (!isExpanded) {toggleFolder(targetItem.id);}
        }
    

    const toggleFolder = (folderId: string) => {
        if (expandedFolders.includes(folderId)) {
            setExpandedFolders(expandedFolders.filter((id) => id !== folderId));
        } else {
            setExpandedFolders([...expandedFolders, folderId]);
        }
    };

    const renderTree = (parentId: string | null) => {
        const items = fileList.filter((file) => file.parentId === parentId);

        return items.map((item) => {
            if (item.type === "folder") {
                const isExpanded = expandedFolders.includes(item.id);

                return (
                    <div key={item.id} className="w-full relative group">
                        
                        <div className="flex items-center w-full">
                            
                            <button
                                className="flex-1 flex items-center px-2 py-2 text-gray-300 font-bold hover:bg-gray-700 rounded cursor-pointer select-none"
                            
                                onClick={() => toggleFolder(item.id)}
                                
                                onDragOver={(e) => {e.preventDefault();}}
                                onDrop={(e) => {handleFolderDrop(e, item, isExpanded);
                                    
                                }}
                            >
                                <span className="mr-1">{isExpanded ? "📂" : "📁"}</span> {item.name}
                            </button>

                            <button
                                className="px-2 py-1 text-gray-400 hover:text-white rounded hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(activeMenuId === item.id ? null : item.id);
                                }}
                            >
                                ⋮
                            </button>
                        </div>


                        {activeMenuId === item.id && (
                            <div className="absolute right-8 top-8 bg-gray-800 border border-gray-600 rounded shadow-lg z-50 flex flex-col min-w-30">
                                <button 
                                    className="px-4 py-2 text-green-400 hover:bg-gray-700 text-left text-sm border-b border-gray-700"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddFile(item.id);
                                        setActiveMenuId(null);
                                        
                                        if (!isExpanded) toggleFolder(item.id); 
                                    }}
                                >
                                    Add File
                                </button>
                                <button 
                                    className="px-4 py-2 text-blue-400 hover:bg-gray-700 text-left text-sm border-b border-gray-700"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        addFolder(item.id);
                                        setActiveMenuId(null);
                                        
                                        if (!isExpanded) toggleFolder(item.id); 
                                    }}
                                >
                                    Add Folder
                                </button>
                                <button 
                                    className="px-4 py-2 text-red-400 hover:bg-gray-700 text-left text-sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteFile(item.path);
                                        setActiveMenuId(null);
                                    }}
                                >
                                    Delete
                                </button>
                                
                            </div>
                        )}
                        
                        {isExpanded && (
                            <div className="ml-4 border-l border-gray-700 pl-2 mt-1">
                                {renderTree(item.id)}
                            </div>
                        )}
                    </div>
                );
            
            } else {
                return (
                    // NOSONAR
                    <div key={item.id} className="relative flex items-center w-full group"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", item.id);
                    }}
                    >
                        <button
                            className={`flex-1 text-left px-2 py-1.5 text-sm rounded truncate ${activeFileId === item.id ? "bg-gray-700 text-white" : "text-gray-300 hover:bg-gray-700"}`}
                            onClick={() => setActiveFile(item.id)}
                        >
                            📄 {item.name}
                        </button>

                        <button
                            className="px-2 py-1 text-gray-400 hover:text-white rounded hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === item.id ? null : item.id);
                            }}
                        >
                            ⋮
                        </button>

                        {activeMenuId === item.id && (
                            <div className="absolute right-8 top-8 bg-gray-800 border border-gray-600 rounded shadow-lg z-50 flex flex-col min-w-25">
                                <button 
                                    className="px-4 py-2 text-red-400 hover:bg-gray-700 text-left text-sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteFile(item.path);
                                        setActiveMenuId(null);
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                );
            }
        });
    };

    return (
        // NOSONAR
        <div 
            className="flex flex-col gap-2 h-full min-h-50"
            onDragOver={(e) => {
                e.preventDefault();
            }}
            onDrop={(e) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData("text/plain");

                if(draggedId){
                    const draggedFile = fileList.find(f => f.id === draggedId);
                    if(draggedFile) {
                        console.log(`Moving ${draggedFile.name} to root`);
                        updateFilePath(draggedFile.path, `/${draggedFile.name}`, null);
                    }
                    return;
                }
                
                const file = e.dataTransfer.files[0];
                if (!file) return;

                const existingFile = fileList.find((f) => f.name === file.name && f.parentId === null);
                if (existingFile) {
                    setActiveFile(existingFile.id);
                    return;
                }

                file.text().then((content) => {
                    const extension = file.name.split(".").pop() || "";
                    const languageMap: Record<string, string> = {
                        js: "javascript", ts: "typescript", py: "python", java: "java",
                        rb: "ruby", go: "go", rs: "rust", cpp: "cpp", cs: "csharp",
                        html: "html", css: "css", json: "json", md: "markdown",
                        sol: "solidity", vy: "vyper", cairo: "cairo"
                    };

                    addFile({
                        name: file.name,
                        path: `/${file.name}`,
                        parentId: null,
                        type: "file",
                        content: content,
                        language: languageMap[extension] || "plaintext",
                    });
                });
            }}
        >
            <h2 className="text-sm font-bold text-gray-400 mb-2 uppercase px-4 pt-4">Files</h2>
            <div className="flex flex-row gap-2 px-4 mb-2">
                <button className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-1.5 px-2 text-xs rounded font-medium flex items-center justify-center gap-1" onClick={() => handleAddFile(null)}>
                    <span>➕</span> File
                </button>
                <button className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1.5 px-2 text-xs rounded font-medium flex items-center justify-center gap-1" onClick={() => addFolder(null)}>
                    <span>📁</span> Folder
                </button>
            </div>
            <div className="flex flex-col mt-2 px-2 pb-4">
                {renderContent()}
            </div>
        </div>
    );
};