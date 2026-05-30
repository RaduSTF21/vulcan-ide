export const dynamic = "force-dynamic";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { exec } from "node:child_process";
import util from "node:util";
import { GoogleGenAI } from "@google/genai";


const apiKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4
].filter(Boolean) as string[];
let currentKeyIndex = 0;

const execAsync = util.promisify(exec);

const buildTestPrompt = (solidityCode: string, numberOfTests: number) => `Act as a professional Smart Contract Security Auditor. Analyze the following Solidity smart contract to validate its security posture. Look for potential vulnerabilities (Reentrancy, Access Control flaws, Delegatecall injections, Arithmetic overflows/underflows, State corruption, etc.). 

Write ${numberOfTests} strict Foundry security validation tests (including negative tests) that rigorously check boundary conditions and unauthorized access attempts. If the contract contains vulnerabilities, your tests should demonstrate where the validation fails.
Place all ${numberOfTests} tests in a single test file.

CRITICAL REQUIREMENTS:
1. PRAGMA MATCHING: You MUST start your test file with the EXACT SAME "pragma solidity" version found in the target contract code below. Do not default to ^0.8.0 if the target contract uses an older version!
2. Right above EVERY test function, you MUST add a comment block that includes:
   - A brief explanation of what vulnerability or edge case the test validates.
   - The exact expected outcome if the contract is strictly SECURE, written exactly as: "// Expected result: [PASS]" or "// Expected result: [FAIL]".
3. IMPORT PATH: Assume the target contract is saved as "src/TargetContract.sol". You MUST import it using this exact path in your test file (e.g., import { ContractName } from "../src/TargetContract.sol";).
4. Return ONLY the raw contents of that test file. Do not add any extra text, explanations, or markdown code fences.

Contract code:
${solidityCode}
`;

async function generateTestsWithApiKeys(solidityCode: string, numberOfTests: number) {
    console.log("[AI] Generating ${numberOfTests} tests for the contract...");
    let attempts = 0;
    while (attempts < apiKeys.length) {
        const apiKeyToTry = apiKeys[currentKeyIndex];
        console.log(`[AI] Attempting to generate tests using API key at index ${currentKeyIndex}...`);
        currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
        try {
            const aiClient = new GoogleGenAI({ apiKey: apiKeyToTry });
            const response = await aiClient.models.generateContent({
                model: "gemini-3.5-flash",
                contents: buildTestPrompt(solidityCode, numberOfTests)
            });
            console.log('[AI] Test generation successful with current API key.');
            return response.text;
        } catch (apiError) {
            console.log(`Error with API key at index ${currentKeyIndex}. Trying the next one.`, apiError);
        }
        attempts += 1;
    }
    console.error("All API keys have been tried and failed to generate tests.");
    return null;
}
async function setupFoundryProject(solidityCode:string){

    console.log("[Setup] Setting up Foundry project...");
    const uniqueId = crypto.randomUUID();
    const projectDir = path.join(os.homedir(), '.vulcan-temp', `vulcan-project-${uniqueId}`);
    
    console.log(`[Setup] Created unique project directory: ${projectDir}`);
    await fs.mkdir(path.join(projectDir, "src"), { recursive: true });
    await fs.mkdir(path.join(projectDir, 'test'), { recursive: true });

    await fs.writeFile(path.join(projectDir, "src", "TargetContract.sol"), solidityCode);

    const foundryConfig = `[profile.default]
auto_detect_solc = true
src = "src"
out = "out"
libs = ["lib"]`;

    await fs.writeFile(path.join(projectDir, "foundry.toml"), foundryConfig);
    const remapings = `forge-std/=lib/forge-std/src/\n@openzeppelin/=lib/openzeppelin-contracts/`;
    await fs.writeFile(path.join(projectDir, "remappings.txt"), remapings);

    console.log("[Setup] Foundry project structure created. Installing dependencies...");
    const installCommand = `docker run --rm --entrypoint sh -u root -v "${projectDir}:/workspace" -w /workspace ghcr.io/foundry-rs/foundry:latest -c "git init && forge install foundry-rs/forge-std --no-git && forge install OpenZeppelin/openzeppelin-contracts --no-git"`;
    await execAsync(installCommand);

    console.log("[Setup] Dependencies installed successfully.");
    return projectDir;
}

async function runFoundryTests(projectDir: string, aiResponse: string) {
    console.log("[Testing] Writing generated tests to the project...");
    const cleanAiResponse = aiResponse.replaceAll("```solidity", "").replaceAll("```", "").trim();
    await fs.writeFile(path.join(projectDir, "test", "GeneratedTests.t.sol"), cleanAiResponse);

    const testCommand = `docker run --rm --entrypoint sh -u root -v "${projectDir}:/workspace" -w /workspace ghcr.io/foundry-rs/foundry:latest -c "forge test -vv"`;
    console.log("[Testing] Running Foundry tests with command:", testCommand);
    try{
        const {stdout, stderr} = await execAsync(testCommand);
        console.log("[Testing] Test execution completed.");
        const rawOutput = stdout + (stderr ? "\nErrors:\n" + stderr : "");
        return rawOutput.replaceAll(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
    }
    catch(dockerError: unknown){
        console.error("Error during test execution:", dockerError);
        let out = "";
        let err = "";
        if(typeof dockerError === "object" && dockerError !== null){
            out = String((dockerError as { stdout?: string }).stdout ?? "");
            err = String((dockerError as { stderr?: string }).stderr ?? "");
        }
        const testOutput = out + (err ? "\nErrors stderr:\n" + err : "");
        const cleanOutput = testOutput.replaceAll(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
        return cleanOutput.trim() ? cleanOutput : "An error occurred while running the tests, and no output was captured.";
    }
}
/*
async function createAndRunFoundryProject(solidityCode: string, aiResponse: string) {
    const uniqueId = crypto.randomUUID();
    const projectDir = path.join(os.homedir(), '.vulcan-temp', `vulcan-project-${uniqueId}`);
    await fs.mkdir(path.join(projectDir, "src"), { recursive: true });
    await fs.mkdir(path.join(projectDir, 'test'), { recursive: true });

    await fs.writeFile(path.join(projectDir, "src", "TargetContract.sol"), solidityCode);
    const cleanAiResponse = aiResponse.replaceAll("```solidity", "").replaceAll("```", "").trim();
    await fs.writeFile(path.join(projectDir, "test", "GeneratedTests.t.sol"), cleanAiResponse);

    const foundryConfig = `[profile.default]
auto_detect_solc = true
src = "src"
out = "out"
libs = ["lib"]`;

    await fs.writeFile(path.join(projectDir, "foundry.toml"), foundryConfig);
    const remapings = `forge-std/=lib/forge-std/\n@openzeppelin/=lib/openzeppelin-contracts/`;
    await fs.writeFile(path.join(projectDir, "remappings.txt"), remapings);

const command = `docker run --rm --entrypoint sh -v "${projectDir}:/workspace" -w /workspace ghcr.io/foundry-rs/foundry:latest -c "git init && forge install foundry-rs/forge-std --no-git && forge install OpenZeppelin/openzeppelin-contracts --no-git && forge test -vvv"`;

    try {
        const {stdout, stderr} = await execAsync(command);
        return {
            projectDir,
            testOutput: stdout + (stderr ? "\nErrors:\n" + stderr : "")
        };
    } catch (dockerError: unknown) {
        let out = "";
        let err = "";
        if (typeof dockerError === "object" && dockerError !== null) {
            out = String((dockerError as { stdout?: string }).stdout ?? "");
            err = String((dockerError as { stderr?: string }).stderr ?? "");
        }

        const testOutput = out + (err ? "\nErrors stderr:\n" + err : "");
        return {
            projectDir,
            testOutput: testOutput.trim() ? testOutput : "An error occurred while running the tests, and no output was captured."
        };
    }
}
*/
async function generateFoundryFeedback(testOutput: string, solidityCode: string, generatedTests: string) {
    if (!testOutput.trim()) {
        return "Could not generate analysis for the results.";
    }

        const feedbackPrompt = `Act as an expert Smart Contract Security Auditor. Analyze the following context to provide a clear, concise, and friendly report (maximum 3-4 sentences) explaining to the user what vulnerabilities were found based on the failing tests. Do not use code block formatting.

Target Contract Code:
${solidityCode}

Security Tests Executed:
${generatedTests}

Foundry Terminal Output:
${testOutput}

Based on the above, explain the vulnerabilities discovered and how the tests triggered them.`
;

    let attempts = 0;
    while (attempts < apiKeys.length) {
        const apiKeyToTry = apiKeys[currentKeyIndex];
        console.log(`[AI Feedback] Attempting to generate feedback using API key at index ${currentKeyIndex}...`);
        currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
        try {
            const feedbackClient = new GoogleGenAI({ apiKey: apiKeyToTry });
            const feedbackResponse = await feedbackClient.models.generateContent({
                model: "gemini-3.5-flash",
                contents: feedbackPrompt
            });
            console.log('[AI Feedback] Feedback generation successful with current API key.');
            const feedbackText = feedbackResponse.text;
            return feedbackText ? feedbackText.trim() : "Could not generate analysis for the results.";
            
            
        }
        catch (feedbackError) {
            console.log(`Error with API key at index ${currentKeyIndex} while generating feedback. Trying the next one.`, feedbackError);
        }
        attempts += 1;
    } 
    return "Could not generate analysis for the results.";

}

export async function POST(request: Request) {
    console.log("[POST]Received verification request.");
    const body = await request.json();
    const solidityCode = body.code;
    const numberOfTests = body.numberOfTests || 10;
    const stream = new ReadableStream({
        async start(controller){
            let streamClosed = false;
            const closeStream = () => {
                if (!streamClosed) {
                    streamClosed = true;
                    clearInterval(keepAlive);
                    try {
                        controller.close();
                    } catch {
                        // Ignore errors that occur when trying to close the stream, as it might already be closed by the client.
                        }
                }
            };
            const sendUpdate = (data: Record<string, unknown>) => {
                if (streamClosed) {
                    return;
                }
                const chunck = new TextEncoder().encode(JSON.stringify(data) + "\n");
                try {
                    controller.enqueue(chunck);
                } catch {
                    streamClosed = true;
                }
            };
            const keepAlive = setInterval(() => {
                if (streamClosed) {
                    return;
                }
                sendUpdate({ ping: true });
            }, 6000);


            try{
                console.log("[Stream] Starting parallel processes...");
                sendUpdate({step:1, message:"Received code and parameters. Preparing test environment and tests..."});
                const [folder, tests] = await Promise.all([
                    setupFoundryProject(solidityCode),
                    generateTestsWithApiKeys(solidityCode, numberOfTests)
                ])
                console.log("Generated tests:", tests);
                if (!tests) {
                console.error("Failed to generate tests. AI blocked the request or API is overloaded.");
                    sendUpdate({success: false, message:"The AI stopped the generation of tests, possibly due to high load or content filtering. Please remove any commentaries that can be picked up by the filters of the AI and try again."});
                    return;
                }
                console.log("[Stream] Test environment setup and test generation completed. Running tests...");
                sendUpdate({step:2, message:"Foundry project setup completed. Running tests..."});
                const testOutput = await runFoundryTests(folder, tests);

                console.log("[Stream] Test execution completed. Generating AI feedback...");
                sendUpdate({step:3, message:"Tests execution completed. Generating AI feedback..."});

                const aiFeedback = await generateFoundryFeedback(testOutput, solidityCode, tests);
                console.log("[Stream] AI feedback generation completed. Sending final results...");
                sendUpdate({step:4, message:"AI feedback generation completed.", success: true, testResults: testOutput, aiFeedback: aiFeedback, generatedTests: tests, path: folder});


    }
catch (generalError) {
    console.error("General error in stream", generalError);
    sendUpdate({success: false, message: "Detailed error: " + (generalError as Error).message});    
}
finally {
    try{
        console.log("[Cleanup] Cleaning up temporary folders...");
        const tempDir = path.join(os.homedir(), '.vulcan-temp');
        const folders = await fs.readdir(tempDir);

        const folderDetails = await Promise.all(folders.map(async (name) => {
            const fullPath = path.join(tempDir, name);
            const stats = await fs.stat(fullPath);
            return { path: fullPath, mtime: stats.mtimeMs };
        })
    );

    const oldFolders = folderDetails.toSorted((a, b) => b.mtime -a.mtime).slice(50);
    await Promise.all(oldFolders.map(async (folder) => {
        await fs.rm(folder.path, { recursive: true, force: true });
        console.log(`Deleted the ${folder.path} folder`);
    })
);
    }
    catch (cleanupError) {
        console.error("Error during cleanup of temporary folders:", cleanupError);
    }
    
    closeStream();
}
        }
    });
    return new Response(stream, {
        headers: {
            "Content-Type": "application/x-ndjson",
            "Connection": "keep-alive",
            "Cache-Control": "no-cache, no-transform",
            "X-Content-Type-Options": "nosniff"
        },
    });
}
       