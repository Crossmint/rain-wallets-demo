"use server";

import { RUSD_CONTRACT_ADDRESS } from "@/lib/utils";
import crypto from "crypto";

interface RainConsumerApplication {
  firstName: string;
  lastName: string;
  birthDate: string;
  nationalId: string;
  countryOfIssue: string;
  email: string;
  address: {
    line1: string;
    city: string;
    region: string;
    postalCode: string;
    countryCode: string;
  };
  ipAddress: string;
  phoneCountryCode: string;
  phoneNumber: string;
  annualSalary: string;
  accountPurpose: string;
  expectedMonthlyVolume: string;
  isTermsOfServiceAccepted: true;
  walletAddress: string;
}

interface RainCardRequest {
  type: "virtual" | "physical";
  limit: { frequency: "allTime"; amount: number };
  displayName?: string;
  status?: "notActivated" | "active";
  shipping?: {
    firstName: string;
    lastName: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    phone: string;
    method?:
      | "standard"
      | "express"
      | "international"
      | "apc"
      | "uspsinternational";
  };
}

const RAIN_API_URL = "https://api-dev.raincards.xyz/v1";

export async function createRainUserApplication(
  params: RainConsumerApplication
) {
  try {
    console.log("🌧️ Creating Rain consumer application...");

    console.log("Params: ", params);
    const response = await fetch(`${RAIN_API_URL}/issuing/applications/user`, {
      method: "POST",
      headers: {
        accept: "application/json",
        ["Api-Key"]: `${process.env.RAIN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName: params.firstName,
        lastName: params.lastName,
        birthDate: params.birthDate,
        nationalId: params.nationalId,
        countryOfIssue: params.countryOfIssue,
        email: params.email,
        address: {
          line1: params.address.line1,
          city: params.address.city,
          region: params.address.region,
          postalCode: params.address.postalCode,
          countryCode: params.address.countryCode,
        },
        ipAddress: params.ipAddress,
        phoneCountryCode: params.phoneCountryCode,
        phoneNumber: params.phoneNumber,
        annualSalary: params.annualSalary,
        accountPurpose: params.accountPurpose,
        expectedMonthlyVolume: params.expectedMonthlyVolume,
        isTermsOfServiceAccepted: params.isTermsOfServiceAccepted,
        walletAddress: params.walletAddress,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Rain application failed: ${error.message || response.statusText}`
      );
    }

    const result = await response.json();
    console.log("✅ Rain consumer application created:", result.id);

    let kycRedirectUrl = "";
    if (result.applicationExternalVerificationLink) {
      kycRedirectUrl = `${result.applicationExternalVerificationLink.url}?userId=${result.applicationExternalVerificationLink.params.userId}&signature=${result.applicationExternalVerificationLink.params.signature}`;
    }

    return {
      userId: result.id,
      applicationStatus: result.applicationStatus,
      email: result.email,
      walletAddress: result.walletAddress,
      kycRedirectUrl,
    };
  } catch (error) {
    console.error("Rain consumer application failed:", error);
    throw new Error(`Failed to create Rain consumer application: ${error}`);
  }
}

export async function getRainUserStatus(userId: string) {
  try {
    console.log("🔍 Checking Rain user status...");

    const response = await fetch(
      `${RAIN_API_URL}/issuing/applications/user/${userId}`,
      {
        headers: {
          ["Api-Key"]: `${process.env.RAIN_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get user status: ${response.statusText}`);
    }

    const result = await response.json();
    console.log("📊 User status:", result.applicationStatus);

    return {
      userId: result.id,
      applicationStatus: result.applicationStatus,
      firstName: result.firstName,
      lastName: result.lastName,
      email: result.email,
      walletAddress: result.walletAddress,
      isActive: result.isActive,
    };
  } catch (error) {
    console.error("Get user status failed:", error);
    throw new Error(`Failed to get user status: ${error}`);
  }
}

export async function issueRainCard(
  userId: string,
  cardParams: RainCardRequest
) {
  try {
    console.log("💳 Issuing Rain card...");

    const response = await fetch(
      `${RAIN_API_URL}/issuing/users/${userId}/cards`,
      {
        method: "POST",
        headers: {
          ["Api-Key"]: `${process.env.RAIN_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: cardParams.type,
          limit: cardParams.limit,
          displayName: cardParams.displayName,
          status: cardParams.status,
          ...(cardParams.shipping && { shipping: cardParams.shipping }),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Card issuance failed: ${error.message || response.statusText}`
      );
    }

    const result = await response.json();
    console.log("✅ Rain card issued:", result.id);

    return {
      cardId: result.id,
      status: result.status,
      type: result.type,
      limit: result.limit,
      lastFour: result.lastFour,
      displayName: result.displayName,
    };
  } catch (error) {
    console.error("Card issuance failed:", error);
    throw new Error(`Failed to issue card: ${error}`);
  }
}

export async function getRainUserCards(userId: string) {
  try {
    console.log("💳 Checking for existing cards...");

    const response = await fetch(
      `${RAIN_API_URL}/issuing/cards?userId=${userId}&limit=20`,
      {
        headers: {
          "Api-Key": `${process.env.RAIN_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get cards: ${response.statusText}`);
    }

    return await response.json(); // Returns array of cards
  } catch (error) {
    console.error("Get cards failed:", error);
    throw new Error(`Failed to get user cards: ${error}`);
  }
}

export async function getRainUserByWalletAddress(walletAddress: string) {
  try {
    const response = await fetch(`${RAIN_API_URL}/issuing/users?limit=100`, {
      method: "GET",
      headers: {
        ["Api-Key"]: `${process.env.RAIN_API_KEY}`,
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to get user by wallet address: ${response.statusText}`
      );
    }

    const json = await response.json();
    const filteredByWalletAddress = json.filter(
      (user: any) => user.walletAddress === walletAddress
    );

    if (filteredByWalletAddress.length > 0) {
      let kycRedirectUrl = "";
      if (filteredByWalletAddress[0].applicationExternalVerificationLink) {
        kycRedirectUrl = `${filteredByWalletAddress[0].applicationExternalVerificationLink.url}?userId=${filteredByWalletAddress[0].applicationExternalVerificationLink.params.userId}&signature=${filteredByWalletAddress[0].applicationExternalVerificationLink.params.signature}`;
      }
      filteredByWalletAddress[0].kycRedirectUrl = kycRedirectUrl;
    }

    return filteredByWalletAddress;
  } catch (err) {
    console.error("Get user by wallet address failed:", err);
    throw new Error(`Failed to get user by wallet address: ${err}`);
  }
}

export async function createRainUserContract(userId: string, chainId: number) {
  try {
    console.log("🏗️ Creating Rain smart contract for user...");

    await fetch(`${RAIN_API_URL}/issuing/users/${userId}/contracts`, {
      method: "POST",
      headers: {
        "Api-Key": `${process.env.RAIN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chainId,
      }),
    });
  } catch (error) {
    console.error("Contract creation failed:", error);
    throw new Error(`Failed to create Rain contract: ${error}`);
  }
}

export async function getRainUserContracts(
  userId: string,
  maxRetries: number = 10
) {
  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `📋 Getting Rain user contracts... (attempt ${attempt + 1}/${
          maxRetries + 1
        })`
      );

      const response = await fetch(
        `${RAIN_API_URL}/issuing/users/${userId}/contracts`,
        {
          headers: {
            "Api-Key": `${process.env.RAIN_API_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get contracts: ${response.statusText}`);
      }

      const contracts = await response.json();

      // Find the Base Sepolia contract (chainId 84532)
      const baseSepoliaContract = contracts.find(
        (contract: any) => contract.chainId === 84532
      );

      if (!baseSepoliaContract) {
        // If no contract found and we have retries left, wait and retry
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s
          console.log(
            `⏳ No Base Sepolia contract found, retrying in ${waitTime}ms...`
          );
          await sleep(waitTime);
          continue;
        }
        throw new Error(
          "No Base Sepolia contract found for user after all retries"
        );
      }

      // Find the RUSD token
      const rusdToken = baseSepoliaContract.tokens.find(
        (token: any) => token.address === RUSD_CONTRACT_ADDRESS
      );

      console.log(
        "✅ Found Base Sepolia contract:",
        baseSepoliaContract.depositAddress
      );

      if (rusdToken) {
        console.log("💰 RUSD balance:", rusdToken.balance);
      }

      return {
        contractId: baseSepoliaContract.id,
        chainId: baseSepoliaContract.chainId,
        depositAddress: baseSepoliaContract.depositAddress,
        proxyAddress: baseSepoliaContract.proxyAddress,
        controllerAddress: baseSepoliaContract.controllerAddress,
        tokens: baseSepoliaContract.tokens,
        contractVersion: baseSepoliaContract.contractVersion,
        // Add RUSD-specific data
        rusdToken: rusdToken || {
          address: RUSD_CONTRACT_ADDRESS,
          balance: "0.0",
          exchangeRate: 1,
          advanceRate: 100,
        },
      };
    } catch (error) {
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        console.error("Get contracts failed after all retries:", error);
        throw new Error(`Failed to get user contracts: ${error}`);
      }

      // For other attempts, log and continue to retry
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(
        `❌ Attempt ${attempt + 1} failed, retrying in ${waitTime}ms...`
      );
      await sleep(waitTime);
    }
  }
}

/**
 * Rain Credit card encrypt/decrypt utilities
 */

const RAIN_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCAP192809jZyaw62g/eTzJ3P9H
+RmT88sXUYjQ0K8Bx+rJ83f22+9isKx+lo5UuV8tvOlKwvdDS/pVbzpG7D7NO45c
0zkLOXwDHZkou8fuj8xhDO5Tq3GzcrabNLRLVz3dkx0znfzGOhnY4lkOMIdKxlQb
LuVM/dGDC9UpulF+UwIDAQAB
-----END PUBLIC KEY-----`;

// Step 1: Generate session ID
async function generateSessionId(pem: string, secret?: string) {
  if (!pem) throw new Error("pem is required");
  if (secret && !/^[0-9A-Fa-f]+$/.test(secret)) {
    throw new Error("secret must be a hex string");
  }

  const secretKey = secret ?? crypto.randomUUID().replace(/-/g, "");
  const secretKeyBase64 = Buffer.from(secretKey, "hex").toString("base64");
  const secretKeyBase64Buffer = Buffer.from(secretKeyBase64, "utf-8");
  const secretKeyBase64BufferEncrypted = crypto.publicEncrypt(
    {
      key: pem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    secretKeyBase64Buffer
  );

  return {
    secretKey,
    sessionId: secretKeyBase64BufferEncrypted.toString("base64"),
  };
}

// Step 3: Decrypt the card data
async function decryptSecret(
  base64Secret: string,
  base64Iv: string,
  secretKey: string
) {
  if (!base64Secret) throw new Error("base64Secret is required");
  if (!base64Iv) throw new Error("base64Iv is required");
  if (!secretKey || !/^[0-9A-Fa-f]+$/.test(secretKey)) {
    throw new Error("secretKey must be a hex string");
  }

  const secret = Buffer.from(base64Secret, "base64");
  const iv = Buffer.from(base64Iv, "base64");
  const secretKeyBuffer = Buffer.from(secretKey, "hex");

  const cryptoKey = crypto.createDecipheriv("aes-128-gcm", secretKeyBuffer, iv);
  cryptoKey.setAutoPadding(false);

  const decrypted = cryptoKey.update(secret);

  return decrypted.toString("utf-8").trim();
}

// Main server action to get decrypted card data
export async function getDecryptedCardData(cardId: string) {
  try {
    console.log("🔐 Getting encrypted card data...");

    // Step 1: Generate session ID
    const { secretKey, sessionId } = await generateSessionId(RAIN_PUBLIC_KEY);

    // Step 2: Get encrypted card data
    const response = await fetch(
      `${RAIN_API_URL}/issuing/cards/${cardId}/secrets`,
      {
        headers: {
          "Api-Key": `${process.env.RAIN_API_KEY}`,
          SessionId: sessionId,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get card secrets: ${response.statusText}`);
    }

    const encryptedData = await response.json();

    // Step 3: Decrypt the data
    const decryptedCardNumber = await decryptSecret(
      encryptedData.encryptedPan.data,
      encryptedData.encryptedPan.iv,
      secretKey
    );

    const decryptedCVC = await decryptSecret(
      encryptedData.encryptedCvc.data,
      encryptedData.encryptedCvc.iv,
      secretKey
    );

    console.log("✅ Card data decrypted successfully");

    return {
      cardNumber: decryptedCardNumber.substring(0, 16), // Remove null bytes
      cvc: decryptedCVC.substring(0, 3), // Remove null bytes
    };
  } catch (error) {
    console.error("Failed to decrypt card data:", error);
    throw new Error(`Failed to get card data: ${error}`);
  }
}
