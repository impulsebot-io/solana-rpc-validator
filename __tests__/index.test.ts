/**
 * Unit tests for the Solana RPC Validator
 */

import * as fs from 'fs';
import { Connection } from '@solana/web3.js';
import { jest } from '@jest/globals';
import { RpcResponseAndContext, TokenAmount } from '@solana/web3.js';
import {
    executeSolanaGossip,
    validateRpcEndpoint,
    fetchValidRpcHosts,
    writeRpcHostsToFile,
    CONFIG
} from '../src/index';

// Mock the child_process module
jest.mock('child_process', () => ({
    exec: jest.fn()
}));

// Mock fs module
jest.mock('fs', () => ({
    existsSync: jest.fn(),
                       mkdirSync: jest.fn(),
                       writeFileSync: jest.fn()
}));

// Mock @solana/web3.js properly
jest.mock('@solana/web3.js', () => {
    return {
        Connection: jest.fn().mockImplementation(() => ({
            getTokenAccountBalance: jest.fn()
        })),
        PublicKey: jest.fn().mockImplementation(() => ({
            toString: () => 'mocked-public-key'
        }))
    };
});

describe('Solana RPC Validator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('executeSolanaGossip', () => {
        it('should execute the solana gossip command and return parsed nodes', async () => {
            // Fix: Use Promise.resolve instead of callback
            const mockExec = require('child_process').exec;
            mockExec.mockResolvedValue({
                stdout: JSON.stringify([
                    { rpcHost: 'example1.com:8899', pubkey: 'key1' },
                    { rpcHost: 'example2.com:8899', pubkey: 'key2' }
                ]),
                stderr: ''
            });

            const result = await executeSolanaGossip();

            expect(mockExec).toHaveBeenCalledWith(
                `solana gossip --url ${CONFIG.SOLANA_RPC_URL} --output json`,
                { maxBuffer: CONFIG.MAX_BUFFER_SIZE }
            );

            expect(result).toHaveLength(2);
            expect(result[0].rpcHost).toBe('example1.com:8899');
        });

        it('should handle errors from the solana gossip command', async () => {
            const mockExec = require('child_process').exec;
            mockExec.mockRejectedValue(new Error('Command failed'));

            const result = await executeSolanaGossip();

            expect(result).toEqual([]);
        });
    });

    describe('validateRpcEndpoint', () => {
        it('should return true for a valid RPC endpoint', async () => {
            const mockGetTokenAccountBalance = jest.fn<() => Promise<RpcResponseAndContext<TokenAmount>>>()
            .mockResolvedValue({
                value: {
                    amount: '1000',
                    decimals: 9
                }
            } as RpcResponseAndContext<TokenAmount>);

            (Connection as jest.Mock).mockImplementation(() => ({
                getTokenAccountBalance: mockGetTokenAccountBalance
            }));

            const result = await validateRpcEndpoint('valid-host.com:8899');

            expect(result).toBe(true);
            expect(mockGetTokenAccountBalance).toHaveBeenCalled();
        });

        it('should return false for an invalid RPC endpoint', async () => {
            const mockGetTokenAccountBalance = jest.fn<() => Promise<RpcResponseAndContext<TokenAmount>>>()
            .mockRejectedValue(new Error('Connection failed'));

            (Connection as jest.Mock).mockImplementation(() => ({
                getTokenAccountBalance: mockGetTokenAccountBalance
            }));

            const result = await validateRpcEndpoint('invalid-host.com:8899');

            expect(result).toBe(false);
            expect(mockGetTokenAccountBalance).toHaveBeenCalled();
        });
    });

    describe('fetchValidRpcHosts', () => {
        it('should return an array of valid RPC hosts', async () => {
            // Fix: Properly mock module functions
            jest.spyOn(require('../src/index'), 'executeSolanaGossip').mockResolvedValue([
                { rpcHost: 'valid1.com:8899', pubkey: 'key1' },
                { rpcHost: 'valid2.com:8899', pubkey: 'key2' },
                { rpcHost: 'invalid.com:8899', pubkey: 'key3' }
            ]);

            jest.spyOn(require('../src/index'), 'validateRpcEndpoint')
            .mockResolvedValueOnce(true)  // valid1.com is valid
            .mockResolvedValueOnce(true)  // valid2.com is valid
            .mockResolvedValueOnce(false); // invalid.com is invalid

            const result = await fetchValidRpcHosts();

            expect(result).toEqual(['valid1.com:8899', 'valid2.com:8899']);
        });

        it('should return an empty array when no nodes are found', async () => {
            jest.spyOn(require('../src/index'), 'executeSolanaGossip').mockResolvedValue([]);

            const result = await fetchValidRpcHosts();

            expect(result).toEqual([]);
        });
    });

    describe('writeRpcHostsToFile', () => {
        it('should write RPC hosts to a file', async () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'writeFileSync');

            const hosts = ['host1.com:8899', 'host2.com:8899'];
            const testPath = '/test/path/rpcHosts.json';

            await writeRpcHostsToFile(hosts, testPath);

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                testPath,
                JSON.stringify(hosts, null, 2),
                                                          'utf-8'
            );
        });

        it('should create the directory if it does not exist', async () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);
            jest.spyOn(fs, 'mkdirSync');
            jest.spyOn(fs, 'writeFileSync');

            const hosts = ['host1.com:8899'];
            const testPath = '/test/path/rpcHosts.json';

            await writeRpcHostsToFile(hosts, testPath);

            expect(fs.existsSync).toHaveBeenCalledWith('/test/path');
            expect(fs.mkdirSync).toHaveBeenCalledWith('/test/path', { recursive: true });
            expect(fs.writeFileSync).toHaveBeenCalled();
        });
    });
});
