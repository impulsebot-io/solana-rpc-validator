# Solana RPC Validator

A TypeScript application for discovering, validating, and maintaining a list of functional Solana RPC endpoints.

## Features

- Discovers Solana RPC endpoints using the Solana gossip network
- Validates each RPC endpoint by testing actual API calls
- Exports a list of functional endpoints to a JSON file
- Customizable validation tests and timeouts
- Suitable for integration into DevOps pipelines or scheduled jobs

## Prerequisites

- Node.js (v16+)
- npm or yarn
- Solana CLI installed and in your PATH

## Installation

```bash
# Clone the repository
git clone https://github.com/impulse-io/solana-rpc-validator.git
cd solana-rpc-validator

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### Run the validator

```bash
npm start
```

This will:
1. Connect to the Solana gossip network
2. Discover RPC endpoints
3. Test each endpoint for connectivity and responsiveness
4. Save valid endpoints to `rpcHosts.json` in the project root

### Configuration

You can modify the configuration by editing the `CONFIG` object in `src/index.ts`:

```typescript
const CONFIG = {
  SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com', // Base RPC URL for gossip
  OUTPUT_FILE_PATH: path.join(process.cwd(), 'rpcHosts.json'), // Output file path
  TEST_TOKEN_ACCOUNT: 'H5Wuy51jEAV9mrDFUVbNsrSMcBckgHCqmc1r45e7ztVo', // Account to test
  CONNECTION_TIMEOUT_MS: 5000, // Timeout for RPC connections
  MAX_BUFFER_SIZE: 10 * 1024 * 1024, // 10MB buffer for gossip command output
  MAX_CONCURRENT_TESTS: 25 // Configurable parallel RPC tests
};
```

### Integration with CI/CD

You can add this tool to your CI/CD pipeline to regularly update your RPC endpoints list.

Example GitHub Actions workflow:

```yaml
name: Update RPC Endpoints

on:
  schedule:
    - cron: '0 0 * * *'  # Run daily at midnight

jobs:
  update-endpoints:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'
          
      - name: Install Solana CLI
        run: |
          sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"
          export PATH="/home/runner/.local/share/solana/install/active_release/bin:$PATH"
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build project
        run: npm run build
        
      - name: Run RPC validator
        run: npm start
        
      - name: Commit and push if changes exist
        run: |
          git config --global user.name 'GitHub Actions Bot'
          git config --global user.email 'actions@github.com'
          git add rpcHosts.json
          git diff --staged --quiet || (git commit -m "Update RPC endpoints" && git push)
```

## API

The package exports the following functions:

```typescript
// Execute the Solana gossip command and return nodes
function executeSolanaGossip(): Promise<SolanaNode[]>;

// Validate a single RPC endpoint
function validateRpcEndpoint(rpcHost: string): Promise<boolean>;

// Fetch and validate RPC hosts
function fetchValidRpcHosts(): Promise<string[]>;

// Write RPC hosts to a file
function writeRpcHostsToFile(rpcHosts: string[], outputPath?: string): Promise<void>;

// Main function to run the entire process
function main(): Promise<void>;
```

## Testing

```bash
# Run the test suite
npm test
```

## License

MIT

🤝 **Join the impulse community!** Made with ❤️ by the [impulse team](https://impulsebot.io). Together, we build better solutions.
