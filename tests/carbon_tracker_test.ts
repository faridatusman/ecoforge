import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.1.0/index.ts';

// Constants mirroring contract constants
const CATEGORY_TRANSPORTATION = 1;
const CATEGORY_ENERGY = 2;
const CATEGORY_DIET = 3;

// Error Codes
const ERR_UNAUTHORIZED = 403;
const ERR_INVALID_EMISSION = 400;
const ERR_PROFILE_NOT_FOUND = 404;
const ERR_DUPLICATE_ENTRY = 409;

Clarinet.test({
  name: "Carbon Tracker: User can create a profile successfully",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user = accounts.get("wallet_1")!;
    
    const block = chain.mineBlock([
      Tx.contractCall("carbon_tracker", "create-profile", [], user.address)
    ]);

    // Verify profile creation is successful
    block.receipts[0].result.expectOk().expectBool(true);

    // Verify initial state of profile
    const totalEmissions = chain.callReadOnlyFn(
      "carbon_tracker", 
      "get-total-emissions", 
      [types.principal(user.address)], 
      user.address
    );
    totalEmissions.result.expectUint(0);
  }
});

Clarinet.test({
  name: "Carbon Tracker: Prevent duplicate profile creation",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user = accounts.get("wallet_1")!;
    
    // Create profile first time
    const block1 = chain.mineBlock([
      Tx.contractCall("carbon_tracker", "create-profile", [], user.address)
    ]);
    block1.receipts[0].result.expectOk().expectBool(true);

    // Try to create profile again
    const block2 = chain.mineBlock([
      Tx.contractCall("carbon_tracker", "create-profile", [], user.address)
    ]);
    // Expect this to fail due to map-insert constraint
    block2.receipts[0].result.expectErr();
  }
});

Clarinet.test({
  name: "Carbon Tracker: Log emissions for different categories",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user = accounts.get("wallet_1")!;
    
    // Create profile first
    const block1 = chain.mineBlock([
      Tx.contractCall("carbon_tracker", "create-profile", [], user.address)
    ]);
    block1.receipts[0].result.expectOk();

    // Log emissions for each category
    const block2 = chain.mineBlock([
      // Transportation emission
      Tx.contractCall(
        "carbon_tracker", 
        "log-emission", 
        [types.uint(50), types.uint(CATEGORY_TRANSPORTATION)], 
        user.address
      ),
      // Energy emission
      Tx.contractCall(
        "carbon_tracker", 
        "log-emission", 
        [types.uint(75), types.uint(CATEGORY_ENERGY)], 
        user.address
      ),
      // Diet emission
      Tx.contractCall(
        "carbon_tracker", 
        "log-emission", 
        [types.uint(25), types.uint(CATEGORY_DIET)], 
        user.address
      )
    ]);

    // Verify each emission logging was successful
    block2.receipts[0].result.expectOk();
    block2.receipts[1].result.expectOk();
    block2.receipts[2].result.expectOk();

    // Check total emissions
    const totalEmissions = chain.callReadOnlyFn(
      "carbon_tracker", 
      "get-total-emissions", 
      [types.principal(user.address)], 
      user.address
    );
    totalEmissions.result.expectUint(150);
  }
});

Clarinet.test({
  name: "Carbon Tracker: Prevent logging emissions without profile",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user = accounts.get("wallet_1")!;
    
    // Try to log emission without creating profile first
    const block = chain.mineBlock([
      Tx.contractCall(
        "carbon_tracker", 
        "log-emission", 
        [types.uint(50), types.uint(CATEGORY_TRANSPORTATION)], 
        user.address
      )
    ]);

    // Should return ERR_PROFILE_NOT_FOUND
    block.receipts[0].result.expectErr().expectUint(ERR_PROFILE_NOT_FOUND);
  }
});

Clarinet.test({
  name: "Carbon Tracker: Prevent logging invalid emissions",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user = accounts.get("wallet_1")!;
    
    // Create profile first
    const block1 = chain.mineBlock([
      Tx.contractCall("carbon_tracker", "create-profile", [], user.address)
    ]);
    block1.receipts[0].result.expectOk();

    // Test cases for invalid emissions
    const invalidCases = [
      // Zero emissions
      { units: 0, category: CATEGORY_TRANSPORTATION },
      // Too high emissions
      { units: 10001, category: CATEGORY_ENERGY },
      // Invalid category
      { units: 50, category: 4 }
    ];

    const block2 = chain.mineBlock(
      invalidCases.map(testCase => 
        Tx.contractCall(
          "carbon_tracker", 
          "log-emission", 
          [types.uint(testCase.units), types.uint(testCase.category)], 
          user.address
        )
      )
    );

    // All invalid emission logs should fail
    block2.receipts.forEach(receipt => {
      receipt.result.expectErr().expectUint(ERR_INVALID_EMISSION);
    });
  }
});

Clarinet.test({
  name: "Carbon Tracker: Prevent duplicate emissions in same block",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user = accounts.get("wallet_1")!;
    
    // Create profile first
    const block1 = chain.mineBlock([
      Tx.contractCall("carbon_tracker", "create-profile", [], user.address)
    ]);
    block1.receipts[0].result.expectOk();

    // Try to log same emission twice in same block
    const block2 = chain.mineBlock([
      Tx.contractCall(
        "carbon_tracker", 
        "log-emission", 
        [types.uint(50), types.uint(CATEGORY_TRANSPORTATION)], 
        user.address
      ),
      Tx.contractCall(
        "carbon_tracker", 
        "log-emission", 
        [types.uint(50), types.uint(CATEGORY_TRANSPORTATION)], 
        user.address
      )
    ]);

    // First emission should succeed, second should fail
    block2.receipts[0].result.expectOk();
    block2.receipts[1].result.expectErr().expectUint(ERR_DUPLICATE_ENTRY);
  }
});

Clarinet.test({
  name: "Carbon Tracker: Validate retrieval of emission history",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user = accounts.get("wallet_1")!;
    
    // Create profile first
    const block1 = chain.mineBlock([
      Tx.contractCall("carbon_tracker", "create-profile", [], user.address)
    ]);
    block1.receipts[0].result.expectOk();

    // Log some emissions
    const block2 = chain.mineBlock([
      Tx.contractCall(
        "carbon_tracker", 
        "log-emission", 
        [types.uint(50), types.uint(CATEGORY_TRANSPORTATION)], 
        user.address
      ),
      Tx.contractCall(
        "carbon_tracker", 
        "log-emission", 
        [types.uint(75), types.uint(CATEGORY_ENERGY)], 
        user.address
      )
    ]);
    block2.receipts[0].result.expectOk();
    block2.receipts[1].result.expectOk();

    // Check emission history (currently returns total emissions)
    const emissionHistory = chain.callReadOnlyFn(
      "carbon_tracker", 
      "get-emission-history", 
      [types.principal(user.address)], 
      user.address
    );
    
    // Verify total matches expected value
    emissionHistory.result.expectOk().expectUint(125);
  }
});