"use client";

import React, { useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { Editor } from "../components/Editor";
import { useVFSStore } from "../store/useVFSStore";
import { Group, Panel, Separator } from "react-resizable-panels";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState("");
  const [aiFeedback, setAiFeedback] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [numberOfTests, setNumberOfTests] = useState(10);

  const files = useVFSStore((state) => state.files);
  const activeFileId = useVFSStore((state) => state.activeFileId);
  const addFile = useVFSStore((state) => state.addFile);
  const activeFile = Object.values(files).find((file) => file.id === activeFileId);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    void file.text().then((content) => {
      addFile({
        name: file.name,
        path: `/${file.name}`,
        content,
        language: file.name.endsWith(".sol") ? "solidity" : "plaintext",
      });
    });

    event.target.value = "";
  };

  const handleVerify = async () => {
    if (!activeFile) {
      alert("Please select or upload a Solidity contract first.");
      return;
    }

    setIsLoading(true);
    setTestResults("Analyzing code and running tests. Please wait...");
    setAiFeedback("");

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: activeFile.content, numberOfTests }),
      });

      const data = await response.json();
      if (data.success) {
        setTestResults(data.testResults || "Tests ran successfully, but no output was captured.");
        setAiFeedback(data.aiFeedback || "No feedback generated.");
        
        if (data.generatedTests) {
          addFile({
            name: "GeneratedTests.t.sol",
            path: "/GeneratedTests.t.sol",
            content: data.generatedTests,
            language: "solidity",
          });
        }
      } else {
        setTestResults("An error occurred during verification: " + (data.message || "Unknown error"));
      }
    } catch (error) {
      setTestResults("An error occurred while communicating with the server: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex h-full w-full relative overflow-hidden">
        
        <Group orientation="horizontal" className="h-full w-full">
          {/* Editor Panel */}
          <Panel defaultSize={isPanelOpen ? 65 : 100} minSize={30}>
            <div className="flex-1 flex flex-col h-full w-full">
              <Editor />
            </div>
          </Panel>

          {/* Resize Handle */}
          {isPanelOpen && (
            <Separator className="w-1 bg-gray-300 dark:bg-gray-700 hover:bg-blue-500 transition-colors cursor-col-resize" />
          )}

          {/* Vulcan AI Panel */}
          {isPanelOpen && (
            <Panel defaultSize={35} minSize={20} className="bg-gray-50 dark:bg-gray-900 border-l border-gray-300 dark:border-gray-700 overflow-y-auto">
              <div className="h-full p-4 flex flex-col gap-4 pt-16">
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
                    className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-2 mt-4">
                  <label className="text-sm font-medium" htmlFor="analyze-input">
                    2. Start automated analysis
                  </label>
                  <button
                    id="analyze-input"
                    onClick={handleVerify}
                    disabled={isLoading || !activeFile}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? "Analyzing..." : "Analyze Contract"}
                  </button>
                </div>

                {/* AI Feedback Section */}
                {aiFeedback && !isLoading && (
                  <div className="mt-4 p-4 bg-blue-900/30 border border-blue-500/50 rounded-md">
                    <h3 className="text-sm font-bold text-blue-400 mb-2">🤖 AI Security Analyst:</h3>
                    <p className="text-sm text-gray-300 leading-relaxed">{aiFeedback}</p>
                  </div>
                )}

                <div className="mt-4 flex-1 flex flex-col">
                  <div className="text-sm font-medium mb-2">Foundry report 📊:</div>
                  
                  {isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center bg-black rounded-md border border-gray-700 shadow-inner p-4">
                      <div className="animate-pulse flex flex-col items-center">
                        <span className="text-4xl mb-4">⏳</span>
                        <p className="text-blue-400 font-bold">Analyzing the contract...</p>
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