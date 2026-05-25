import { NextResponse } from "next/server";
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

export async function POST(request: Request) {
    const body = await request.json();
    const solidityCode = body.code;
    const numberOfTests = body.numberOfTests || 10;
    const stream = new ReadableStream({
        async start(controller){
            const sendUpdate = (data: any) => {
                const chunck = new TextEncoder().encode(JSON.stringify(data) + "\n");
                controller.enqueue(chunck);
            };
            try{
                sendUpdate({step:1, message:"Received code and parameters. Starting AI analysis..."});
                let succes = false;
                let aiResponse = null;
                for (let attempts = 0; attempts < apiKeys.length; attempts++) {
                    const apiKeyToTry = apiKeys[currentKeyIndex];
                    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
                    try{
                        const aiClient = new GoogleGenAI({ apiKey: apiKeyToTry });
                        const promptText = `Analyze the following Solidity smart contract in detail.
Write ${numberOfTests} security and functionality tests using Foundry based on your internal analysis.
Place all ${numberOfTests} tests in a single test file.

CRITICAL REQUIREMENT FOR COMMENTS:
Right above EVERY test function, you MUST add a comment block that includes:
1. A brief explanation of what vulnerability or behavior the test verifies.
2. The exact expected outcome if the contract is strictly SECURE, written exactly as: "// Expected result: [PASS]" or "// Expected result: [FAIL]".

IMPORTANT: Return ONLY the raw contents of that test file. Do not add any extra text, explanations, or markdown code fences.

Contract code:
${solidityCode}
`;
                        const response = await aiClient.models.generateContent({
                            model: "gemini-3.5-flash",
                            contents: promptText
                        });
                        aiResponse = response.text;
                        succes = true;
                        break;
                    }
                    catch(apiError){
                        console.log(`Error with API key at index ${currentKeyIndex}. Trying the next one.`, apiError);
                        currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
                    }
            }
            if (!succes || !aiResponse) {
                sendUpdate({step:1, message:"Failed to generate tests. Check the API keys."});
                return;
        }
        sendUpdate({step:2, message:"AI analysis completed. Setting up Foundry project..."});

        const uniqueId = crypto.randomUUID();
        const projectDir = path.join(os.homedir(), '.vulcan-temp', `vulcan-project-${uniqueId}`);
        await fs.mkdir(path.join(projectDir, "src"), { recursive: true });
        await fs.mkdir(path.join(projectDir, 'test'), { recursive: true });

        await fs.writeFile(path.join(projectDir, "src", "TargetContract.sol"), solidityCode);
        const cleanAiResponse = aiResponse.replace(/```solidity/gi, "").replace(/```/g, "").trim();
        await fs.writeFile(path.join(projectDir, "test", "GeneratedTests.t.sol"), cleanAiResponse);

        const foundryConfig = `[profile.default]
src = "src"
out = "out"
libs = ["lib"]`;

        await fs.writeFile(path.join(projectDir, "foundry.toml"), foundryConfig);
        sendUpdate({step:3, message:"Foundry project setup completed. Running tests..."});
        
        const command = `docker run --rm --entrypoint sh -v "${projectDir}:/workspace" -w /workspace ghcr.io/foundry-rs/foundry:latest -c "git init && forge install foundry-rs/forge-std --no-git && forge test -vvv"`;        
        let testOutput = "";

        try{
            const {stdout, stderr} = await execAsync(command);
            testOutput = stdout + (stderr ? "\nErrors:\n" + stderr : "");

        }
        catch(dockerError : unknown){
            let out = "";
            let err = "";
            if (typeof dockerError === "object" && dockerError !== null) {
                out = String((dockerError as { stdout?: string }).stdout ?? "");
                err = String((dockerError as { stderr?: string }).stderr ?? "");
            }
            testOutput = out + (err ? "\nErrors stderr:\n" + err : "");
            if(!testOutput.trim()){
                testOutput = "An error occurred while running the tests, and no output was captured.";
            }
        }
        sendUpdate({step:4, message:"Tests execution completed. Generating AI feedback..."});
        let aiFeedback = "Could not generate analysis for the results.";
        if (testOutput && testOutput.trim() !== "") {
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
                aiFeedback = feedbackResponse.text ?? "No feedback generated.";
            } catch (feedbackError) {
                console.error("Error generating AI feedback:", feedbackError);
            }
        }
        sendUpdate({step:5, message:"AI feedback generation completed.", success: true, testResults: testOutput, aiFeedback: aiFeedback, generatedTests: aiResponse, path: projectDir});


    }
catch (generalError) {
    console.error("General error in stream", generalError);
    sendUpdate({success: false, message: "An error occurred during the verification process."});
    
}
finally {
    controller.close();
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
    /* 
    let success = false;
    try {
    
    let aiResponse = null;
    //NOSONAR: This loop is designed to handle multiple API keys and is not an infinite loop due to the condition on attempts.
for (let attempts = 0; attempts < apiKeys.length; attempts++) {
            const apiKeyToTry = apiKeys[currentKeyIndex];
            currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
            try{
            const aiClient = new GoogleGenAI({ apiKey: apiKeyToTry });
           const promptText = `Analyze the following Solidity smart contract in detail.
Write ${numberOfTests} security and functionality tests using Foundry based on your internal analysis.
Place all ${numberOfTests} tests in a single test file.

CRITICAL REQUIREMENT FOR COMMENTS:
Right above EVERY test function, you MUST add a comment block that includes:
1. A brief explanation of what vulnerability or behavior the test verifies.
2. The exact expected outcome if the contract is strictly SECURE, written exactly as: "// Expected result: [PASS]" or "// Expected result: [FAIL]".

IMPORTANT: Return ONLY the raw contents of that test file. Do not add any extra text, explanations, or markdown code fences.

Contract code:
${solidityCode}
`;
            const response = await aiClient.models.generateContent({
                model: "gemini-3.5-flash",
                contents: promptText
            });
                aiResponse = response.text;


            success = true;
            break;
        }
        catch(apiError){
            console.log(`Error with API key at index ${currentKeyIndex}. Trying the next one.`, apiError);
            currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
        }
    }
    if (!success || !aiResponse) {
        return NextResponse.json(
            { success: false, message: "Failed to generate tests. All API keys are unavailable." },
            { status: 500 }
        );
    }
    const uniqueId = crypto.randomUUID();
        // 1. We move the temporary folder inside the project to bypass Docker snap isolation
        const projectDir = path.join(os.homedir(), '.vulcan-temp', `vulcan-project-${uniqueId}`);
        await fs.mkdir(path.join(projectDir, "src"), { recursive: true });
        await fs.mkdir(path.join(projectDir, 'test'), { recursive: true });

        await fs.writeFile(path.join(projectDir, "src", "TargetContract.sol"), solidityCode);

        // 2. We clean the AI response to ensure there are no markdown fences (```solidity) that break compilation
        const cleanAiResponse = aiResponse.replace(/```solidity/gi, "").replace(/```/g, "").trim();
        await fs.writeFile(path.join(projectDir, "test", "GeneratedTests.t.sol"), cleanAiResponse);

        const foundryConfig = `[profile.default]
src = "src"
out = "out"
libs = ["lib"]`;

        await fs.writeFile(path.join(projectDir, "foundry.toml"), foundryConfig);

        // 3. We use --entrypoint sh and initialize a git repo before installing forge-std
const command = `docker run --rm --entrypoint sh -v "${projectDir}:/workspace" -w /workspace ghcr.io/foundry-rs/foundry:latest -c "git init && forge install foundry-rs/forge-std --no-git && forge test -vvv"`;        let testOutput = "";
    try{
        const {stdout, stderr} = await execAsync(command);
        testOutput = stdout + (stderr ? "\nErrors:\n" + stderr : "");
        console.log("Result", stdout);
    }
    catch(dockerError : unknown){
        let out = "";
        let err = "";
        if (typeof dockerError === "object" && dockerError !== null) {
            out = String((dockerError as { stdout?: string }).stdout ?? "");
            err = String((dockerError as { stderr?: string }).stderr ?? "");
        }
        testOutput = out + (err ? "\nErrors stderr:\n" + err : "");
        if(!testOutput.trim()){
            testOutput = "An error occurred while running the tests, and no output was captured.";
        }
        

    }
    let aiFeedback = "Could not generate analysis for the results.";
    if (testOutput && testOutput.trim() !== "") {
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
                aiFeedback = feedbackResponse.text ?? "No feedback generated.";
            } catch (feedbackError) {
                console.error("Error generating AI feedback:", feedbackError);
            }
        }
    return NextResponse.json(
        {
            success : true,
            message : "Foundry project created successfully!",
            testResults : testOutput,
            generatedTests : aiResponse,
            aiFeedback : aiFeedback,
            path:projectDir
        }
    );


    }
    catch (error) {
        console.error("Error while creating the Foundry project:", error);
        return NextResponse.json(
            {
                success : false,
                message : "An error occurred while creating the Foundry project."
            },
            { status: 500 }
        );
    }
    
}
*/   