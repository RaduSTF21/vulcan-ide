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

const buildTestPrompt = (solidityCode: string, numberOfTests: number) => `Analyze the following Solidity smart contract in detail.
Write ${numberOfTests} security and functionality tests using Foundry based on your internal analysis.
Place all ${numberOfTests} tests in a single test file.

CRITICAL REQUIREMENTS:
1. Right above EVERY test function, you MUST add a comment block that includes:
   - A brief explanation of what vulnerability or behavior the test verifies.
   - The exact expected outcome if the contract is strictly SECURE, written exactly as: "// Expected result: [PASS]" or "// Expected result: [FAIL]".
2. IMPORT PATH: Assume the target contract is saved as "src/TargetContract.sol". You MUST import it using this exact path in your test file (e.g., import { ContractName } from "../src/TargetContract.sol";).
3. Return ONLY the raw contents of that test file. Do not add any extra text, explanations, or markdown code fences.

Contract code:
${solidityCode}
`;

async function generateTestsWithApiKeys(solidityCode: string, numberOfTests: number) {
    let attempts = 0;
    while (attempts < apiKeys.length) {
        const apiKeyToTry = apiKeys[currentKeyIndex];
        currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
        try {
            const aiClient = new GoogleGenAI({ apiKey: apiKeyToTry });
            const response = await aiClient.models.generateContent({
                model: "gemini-3.5-flash",
                contents: buildTestPrompt(solidityCode, numberOfTests)
            });
            return response.text;
        } catch (apiError) {
            console.log(`Error with API key at index ${currentKeyIndex}. Trying the next one.`, apiError);
        }
        attempts += 1;
    }

    return null;
}
async function setupFoundryProject(solidityCode:string){
    const uniqueId = crypto.randomUUID();
    const projectDir = path.join(os.homedir(), '.vulcan-temp', `vulcan-project-${uniqueId}`);

    await fs.mkdir(path.join(projectDir, "src"), { recursive: true });
    await fs.mkdir(path.join(projectDir, 'test'), { recursive: true });

    await fs.writeFile(path.join(projectDir, "src", "TargetContract.sol"), solidityCode);

    const foundryConfig = `[profile.default]
auto_detect_solc = true
src = "src"
out = "out"
libs = ["lib"]`;

    await fs.writeFile(path.join(projectDir, "foundry.toml"), foundryConfig);
    const remapings = `forge-std/=lib/forge-std/\n@openzeppelin/=lib/openzeppelin-contracts/`;
    await fs.writeFile(path.join(projectDir, "remappings.txt"), remapings);

    const installCommand = `docker run --rm --entrypoint sh -v "${projectDir}:/workspace" -w /workspace ghcr.io/foundry-rs/foundry:latest -c "git init && forge install foundry-rs/forge-std --no-git && forge install OpenZeppelin/openzeppelin-contracts --no-git"`;
    await execAsync(installCommand);
    return projectDir;
}

async function runFoundryTests(projectDir: string, aiResponse: string) {
    const cleanAiResponse = aiResponse.replaceAll("```solidity", "").replaceAll("```", "").trim();
    await fs.writeFile(path.join(projectDir, "test", "GeneratedTests.t.sol"), cleanAiResponse);

    const testCommand = `docker run --rm --entrypoint sh -v "${projectDir}:/workspace" -w /workspace ghcr.io/foundry-rs/foundry:latest -c "forge test -vvv"`;

    try{
        const {stdout, stderr} = await execAsync(testCommand);
        return stdout + (stderr ? "\nErrors:\n" + stderr : "");
    }
    catch(dockerError: unknown){
        let out = "";
        let err = "";
        if(typeof dockerError === "object" && dockerError !== null){
            out = String((dockerError as { stdout?: string }).stdout ?? "");
            err = String((dockerError as { stderr?: string }).stderr ?? "");
        }
        const testOutput = out + (err ? "\nErrors stderr:\n" + err : "");
        return testOutput.trim() ? testOutput : "An error occurred while running the tests, and no output was captured.";
    }
}

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

async function generateFoundryFeedback(testOutput: string) {
    if (!testOutput.trim()) {
        return "Could not generate analysis for the results.";
    }

    try {
        const feedbackClient = new GoogleGenAI({ apiKey: apiKeys[currentKeyIndex] || apiKeys[0] });
        const feedbackPrompt = `Analyze the following Foundry test output. 
Provide a clear, concise, and friendly report (maximum 3-4 sentences) explaining to the user what vulnerabilities were found in the contract based on the failing tests. Do not use code block formatting.
                
Terminal Output:
${testOutput}`;

        const feedbackResponse = await feedbackClient.models.generateContent({
            model: "gemini-3.5-flash",
            contents: feedbackPrompt
        });
        return feedbackResponse.text ?? "No feedback generated.";
    } catch (feedbackError) {
        console.error("Error generating AI feedback:", feedbackError);
        return "Could not generate analysis for the results.";
    }
}

export async function POST(request: Request) {
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
                        // The stream may already be closed by the consumer.
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
            }, 10000);


            try{
                const [folder, tests] = await Promise.all([
                    setupFoundryProject(solidityCode),
                    generateTestsWithApiKeys(solidityCode, numberOfTests)
                ])
                sendUpdate({step:1, message:"Received code and parameters. Starting AI analysis..."});
                const aiResponse = await generateTestsWithApiKeys(solidityCode, numberOfTests);
                if (!aiResponse) {
                sendUpdate({step:1, message:"Failed to generate tests. Check the API keys."});
                return;
                }
                sendUpdate({step:2, message:"AI analysis completed. Setting up Foundry project..."});

                const { projectDir, testOutput } = await createAndRunFoundryProject(solidityCode, aiResponse);
                sendUpdate({step:3, message:"Foundry project setup completed. Running tests..."});
                sendUpdate({step:4, message:"Tests execution completed. Generating AI feedback..."});

                const aiFeedback = await generateFoundryFeedback(testOutput);
                sendUpdate({step:5, message:"AI feedback generation completed.", success: true, testResults: testOutput, aiFeedback: aiFeedback, generatedTests: aiResponse, path: projectDir});


    }
catch (generalError) {
    console.error("General error in stream", generalError);
    sendUpdate({success: false, message: "An error occurred during the verification process."});
    
}
finally {
    try{
        const tempDir = path.join(os.homedir(), '.vulcan-temp');
        const folders = await fs.readdir(tempDir);

        const folderDetails = await Promise.all(folders.map(async (name) => {
            const fullPath = path.join(tempDir, name);
            const stats = await fs.stat(fullPath);
            return { path: fullPath, mtime: stats.mtimeMs };
        })
    );

    const oldFolders = folderDetails.toSorted((a, b) => b.mtime -a.mtime).slice(5);
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
            "Connection": "keep-alive"
        },
    });
}
       