"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "../components/AppLayout";
import { Editor } from "../components/Editor";
import { useVFSStore } from "../store/useVFSStore";
import { Group, Panel, Separator } from "react-resizable-panels";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [numberOfTests, setNumberOfTests] = useState(10);
  const [executionTime, setExecutionTime] = useState<string | null>(null);
  
  const supportedLanguages : Record<string, string> = {
    "sol": "solidity", "js": "javascript", "py": "python", "java": "java",
    "cs": "csharp", "cpp": "cpp", "go": "go", "rb": "ruby",
    "php": "php", "vy": "vyper", "rs": "rust", "cairo": "cairo"
  };

  const files = useVFSStore((state) => state.files);
  const activeFileId = useVFSStore((state) => state.activeFileId);
  const addFile = useVFSStore((state) => state.addFile);
  const activeFile = Object.values(files).find((file) => file.id === activeFileId);
  const generatedTests = Object.values(files).find((file) => file.name === "GeneratedTests.t.sol");

  useEffect(() => {
    const checkIfMobile = () => setIsMobile(window.innerWidth <= 768);
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    void file.text().then((content) => {
      addFile({
        name: file.name,
        path: `/${file.name}`,
        content,
        language: supportedLanguages[file.name.split(".").pop() || ""] || "plaintext",
        parentId: null,
        type: "file"
      });
    });
    event.target.value = "";
  };

  const handleVerify = async (useExistingTests: boolean) => {
    const startTime = performance.now();
    setExecutionTime(null);
    if (!activeFile) {
      alert("Please select or upload a Solidity contract first.");
      return;
    }

    setIsLoading(true);
    setTestResults("Analyzing code and running tests. Please wait...");

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: activeFile.content, numberOfTests, useExistingTests ,generatedTests: generatedTests?.content || ""}),
      });
      if (!response.body) throw new Error("Nu am primit date de la server.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while(true){
        const { done, value } = await reader.read();
        if(done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        buffer = lines.pop() || "";

        for(const line of lines){
          if (line.trim() === "") continue;
          let data;
          try {
            data = JSON.parse(line);
          } catch(error){
            console.error("Failed to parse line as JSON:", line, error);
            continue;
          }
          if(data.ping) continue;
          
          setTestResults(data.message || "")

          if(data.success === false){
            setTestResults("Error:"+ data.message);
            setIsLoading(false);
            return;
          }

          if(data.step === 4 && data.success){
            setTestResults(data.testResults || "Tests finished but no output is available");
            
            if(data.generatedTests){
              addFile({
                name: "GeneratedTests.t.sol",
                path: "/GeneratedTests.t.sol",
                content: data.generatedTests,
                language: "solidity",
                parentId: null,
                type: "file"
              });
            }
            if(data.aiFeedback){
              addFile({
                name: "AuditReport.md",
                path: "/AuditReport.md",
                content: data.aiFeedback,
                language: "markdown",
                parentId: null,
                type: "file"
              });
            }
          }
        }
      }
    } catch (error) {
      setTestResults("An error occurred while communicating with the server: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      setExecutionTime(duration + " seconds");

      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex h-full w-full relative overflow-hidden">
        <Group 
          key={isMobile ? "mobile" : "desktop"} 
          orientation={isMobile ? "vertical" : "horizontal"} 
          className="h-full w-full"
        >
          <Panel defaultSize={isPanelOpen ? 65 : 100} minSize={30}>
            <div className="flex-1 flex flex-col h-full w-full">
              <Editor />
            </div>
          </Panel>

          {isPanelOpen && (
            <Separator className="w-1 bg-gray-700 hover:bg-blue-500 transition-colors cursor-col-resize" />
          )}

          {isPanelOpen && (
          <Panel defaultSize={35} minSize={20} className="bg-gray-900 border-l border-gray-700 overflow-y-auto">              <div className="h-full p-4 flex flex-col gap-4 pt-16">
                <h2 className="text-xl font-bold">Vulcan AI Security</h2>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium" htmlFor="file-input">
                    1. Upload contract (.sol)
                  </label>
                  <input
                    id="file-input"
                    type="file"
                    accept=".sol"
                    onChange={handleFileUpload}
                    className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-500 file:text-white hover:file:bg-blue-600 cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-2 mt-4">
                  <label className="text-sm font-medium" htmlFor="test-range">
                    Number of tests to generate: <span className="text-blue-500 font-bold">{numberOfTests}</span>
                  </label>
                  <input
                    id="test-range"
                    type="range"
                    min="1"
                    max="50"
                    value={numberOfTests}
                    onChange={(e) => setNumberOfTests(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-2 mt-4">
                  <label className="text-sm font-medium" htmlFor="analyze-input">
                    2. Start automated analysis
                  </label>

                  <button
                    id="analyze-input"
                    onClick={() => handleVerify(false)}
                    disabled={isLoading || !activeFile}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? "Analyzing..." : "Analyze Contract"}
                  </button>
                  {
                    generatedTests &&  (
                      <>
                      <label className="text-sm font-medium mt-4" htmlFor="rerun-input">
                        3. Rerun tests and analysis with the generated tests.
                      </label>
                      <button
                        id="rerun-input"
                        onClick={()=> handleVerify(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        disabled={isLoading}
                        >
                          Rerun with Generated Tests
                        </button>
                    </>
                      )
                    }
                  
                </div>

                <div className="mt-4 flex-1 flex flex-col">
                  <div className="text-sm font-medium mb-2 flex items-center gap-2">
                    <span>Foundry report 📊:</span>
                        { executionTime && (
                          <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded-md">
                            ⏱️ {executionTime}
                          </span>
                        )}
                    </div>
                  
                  {isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center bg-black rounded-md border border-gray-700 shadow-inner p-4">
                      <div className="animate-pulse flex flex-col items-center">
                        <span className="text-4xl mb-4">⏳</span>
                        <p className="text-blue-400 font-bold">{testResults || "Analyzing the contract..."}</p>
                        <p className="text-gray-500 text-xs mt-2 text-center">
                          The AI is writing tests, and Docker is running them.<br/>
                          This process may take a few tens of seconds.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <pre className="flex-1 bg-black text-green-400 p-4 rounded-md overflow-x-auto text-xs whitespace-pre-wrap border border-gray-700 shadow-inner">
                      {testResults || "Waiting for contract analysis..."}
                    </pre>
                  )}
                  
                </div>
              </div>
            </Panel>
          )}
        </Group>

        <button
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className="absolute top-4 right-4 z-10 px-4 py-2 bg-blue-600 text-white rounded-md shadow-lg hover:bg-blue-700 transition-colors"
        >
          {isPanelOpen ? "Close Vulcan AI" : "Open Vulcan AI 🛡️"}
        </button>
      </div>
    </AppLayout>
  );
}