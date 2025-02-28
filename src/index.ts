import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { Connection, PublicKey } from '@solana/web3.js';

// Configuration
const CONFIG = {
    SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
    OUTPUT_FILE_PATH: path.join(process.cwd(), 'rpcHosts.json'),
    TEST_TOKEN_ACCOUNT: 'H5Wuy51jEAV9mrDFUVbNsrSMcBckgHCqmc1r45e7ztVo',
    CONNECTION_TIMEOUT_MS: 2000,
    MAX_BUFFER_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_CONCURRENT_TESTS: 25 // Configurable parallel RPC tests
};

interface SolanaNode {
    rpcHost?: string;
    gossipHost?: string;
    pubkey?: string;
    shredVersion?: number;
    tpu?: string;
    version?: string;
}

const execAsync = promisify(exec);

async function executeSolanaGossip(): Promise<SolanaNode[]> {
    try {
        const command = `solana gossip --url ${CONFIG.SOLANA_RPC_URL} --output json`;
        console.log(`Executing command: ${command}`);
        const { stdout, stderr } = await execAsync(command, { maxBuffer: CONFIG.MAX_BUFFER_SIZE });
        if (stderr && !stdout) throw new Error(`Error executing solana gossip: ${stderr}`);
        const nodes = JSON.parse(stdout) as SolanaNode[];
        console.log(`Found ${nodes.length} nodes in the gossip network.`);
        return nodes;
    } catch (error) {
        console.error('Failed to execute Solana gossip command:', error);
        return [];
    }
}

async function validateRpcEndpoint(rpcHost: string): Promise<boolean> {
    try {
        const connection = new Connection(`http://${rpcHost}`, 'confirmed');
        const testPublicKey = new PublicKey(CONFIG.TEST_TOKEN_ACCOUNT);
        const balancePromise = connection.getTokenAccountBalance(testPublicKey);
        const timeoutPromise = new Promise<null>((_, reject) => {
            setTimeout(() => reject(new Error('Connection timed out')), CONFIG.CONNECTION_TIMEOUT_MS);
        });
        await Promise.race([balancePromise, timeoutPromise]);
        console.log(`✅ Successful connection to ${rpcHost}`);
        return true;
    } catch (error) {
        console.log(`❌ Failed to connect to ${rpcHost}: ${(error as Error).message}`);
        return false;
    }
}

async function fetchValidRpcHosts(): Promise<string[]> {
    try {
        const nodes = await executeSolanaGossip();
        const rpcHosts = nodes.filter(node => node.rpcHost).map(node => node.rpcHost!);
        console.log(`Found ${rpcHosts.length} nodes with RPC endpoints.`);

        if (rpcHosts.length === 0) return [];

        const validRpcHosts: string[] = [];
        let counter = 0;

        const batchTest = async (batch: string[]) => {
            const results = await Promise.allSettled(batch.map(host => validateRpcEndpoint(host)));
            results.forEach((result, index) => {
                counter++;
                if (result.status === 'fulfilled' && result.value) {
                    validRpcHosts.push(batch[index]);
                }
                console.log(`Progress: ${counter}/${rpcHosts.length}`);
            });
        };

        const batches = [];
        for (let i = 0; i < rpcHosts.length; i += CONFIG.MAX_CONCURRENT_TESTS) {
            batches.push(rpcHosts.slice(i, i + CONFIG.MAX_CONCURRENT_TESTS));
        }

        for (const batch of batches) {
            await batchTest(batch);
        }

        console.log(`Validated ${validRpcHosts.length} working RPC endpoints out of ${rpcHosts.length}.`);
        return validRpcHosts;
    } catch (error) {
        console.error('Failed to fetch valid RPC hosts:', error);
        return [];
    }
}

async function writeRpcHostsToFile(rpcHosts: string[], outputPath: string = CONFIG.OUTPUT_FILE_PATH): Promise<void> {
    try {
        if (!fs.existsSync(path.dirname(outputPath))) {
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        }
        fs.writeFileSync(outputPath, JSON.stringify(rpcHosts, null, 2), 'utf-8');
        console.log(`Successfully saved ${rpcHosts.length} RPC hosts to ${outputPath}`);
    } catch (error) {
        console.error('Failed to write RPC hosts to file:', error);
        throw error;
    }
}

export async function main(): Promise<void> {
    console.log('Starting Solana RPC Validator...');
    try {
        const validRpcHosts = await fetchValidRpcHosts();
        if (validRpcHosts.length > 0) {
            await writeRpcHostsToFile(validRpcHosts);
            console.log('RPC validation completed successfully.');
        } else {
            console.warn('No valid RPC hosts found. No file will be written.');
        }
    } catch (error) {
        console.error('RPC validation failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

export {
    executeSolanaGossip,
    validateRpcEndpoint,
    fetchValidRpcHosts,
    writeRpcHostsToFile,
    CONFIG
};
