"use client";

import { useEffect, useState } from "react";
import { useAuth, useWallet } from "@crossmint/client-sdk-react-ui";
import { cn, USDC_CONTRACT_ADDRESS } from "@/lib/utils";
import {
  createRainUserApplication,
  createRainUserContract,
  getDecryptedCardData,
  getRainUserByWalletAddress,
  getRainUserCards,
  getRainUserContracts,
  issueRainCard,
} from "@/actions/rain";
import Image from "next/image";

const steps = [
  "signup",
  "approved",
  "contract-created",
  "card-issued",
] as const;

type FlowStep = (typeof steps)[number];

export function RainCompleteFlow() {
  const { wallet } = useWallet();
  const { user } = useAuth();

  const [step, setStep] = useState<FlowStep>(steps[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [rainUserId, setRainUserId] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [contractData, setContractData] = useState<any>(null);
  const [cardData, setCardData] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [decryptedCardData, setDecryptedCardData] = useState<{
    cardNumber: string;
    cvc: string;
  } | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showCardDetails, setShowCardDetails] = useState(false);

  // Try to derive email from wallet owner, otherwise just use authed user email
  const walletEmail = wallet?.owner?.includes("email:")
    ? wallet?.owner?.replace("email:", "")
    : user?.email;

  console.log({ contractData });

  useEffect(() => {
    const determineCurrentStep = async () => {
      if (!wallet?.address || !walletEmail) return;

      setInitialLoading(true);
      try {
        console.log("🔍 Determining current demo state...");

        // Step 1: Check if user already exists with this wallet address
        const existingUsers = await getRainUserByWalletAddress(wallet.address);

        if (existingUsers.length === 0) {
          // No user exists - start from signup
          setStep("signup");
          console.log("📝 No existing user found - starting from signup");
          return;
        }

        // User exists - get their details
        const user = existingUsers[0];
        setRainUserId(user.id);
        console.log("👤 Found existing user:", user.id);

        // Step 2: Check if they have contracts
        try {
          const contractInfo = await getRainUserContracts(user.id);
          setContractAddress(contractInfo?.depositAddress);
          setContractData(contractInfo);
          console.log(
            "🏗️ Found existing contract:",
            contractInfo?.depositAddress
          );

          // Step 3: Check if they have cards
          try {
            const cards = await getRainUserCards(user.id);

            if (cards.length > 0) {
              // User has cards - ready for funding
              setCardData(cards[0]);
              setStep("card-issued");
              console.log("💳 Found existing card(s):", cards);
            } else {
              // User has contract but no card - ready to issue card
              setStep("contract-created");
              console.log("🏗️ Contract exists, no card - ready to issue card");
            }
          } catch (cardError) {
            // Error checking cards - assume no cards exist
            setStep("contract-created");
            console.log(
              "🏗️ Contract exists, no cards found - ready to issue card"
            );
          }
        } catch (contractError) {
          // User exists but no contract - create contract
          console.log("🏗️ User exists but no contract - creating contract");

          try {
            await createRainUserContract(user.id, 84532);
            const newContractInfo = await getRainUserContracts(user.id);
            setContractAddress(newContractInfo?.depositAddress);
            setContractData(newContractInfo);
            setStep("contract-created");
            console.log(
              "✅ Contract created:",
              newContractInfo?.depositAddress
            );
          } catch (createError) {
            console.error("Failed to create contract:", createError);
            setStep("signup"); // Fall back to signup
          }
        }
      } catch (error) {
        console.error("Error determining step:", error);
        setStep("signup"); // Default to signup on error
      } finally {
        setInitialLoading(false);
      }
    };

    determineCurrentStep();
  }, [wallet?.address, walletEmail]);

  const handleRefreshBalance = async () => {
    if (!rainUserId) return;

    setIsRefreshing(true);
    try {
      console.log("🔄 Manually refreshing contract balance...");
      const updatedContractInfo = await getRainUserContracts(rainUserId);

      const currentBalance = contractData?.rusdToken.balance || "0";
      const newBalance = updatedContractInfo?.rusdToken.balance || "0";

      console.log(
        `💰 Current: ${currentBalance} RUSD, New: ${newBalance} RUSD`
      );

      setContractData(updatedContractInfo);

      if (newBalance !== currentBalance) {
        console.log(
          `💰 Balance updated: ${currentBalance} → ${newBalance} RUSD`
        );
      }
    } catch (error) {
      console.error("Failed to refresh contract balance:", error);
      alert("Failed to refresh balance: " + error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRainSignup = async () => {
    if (!wallet || !walletEmail) return;

    setIsLoading(true);
    try {
      console.log("🌧️ Creating Rain consumer application...");

      const result = await createRainUserApplication({
        firstName: walletEmail,
        lastName: "approved",
        birthDate: "1990-01-01",
        nationalId: "123456789",
        countryOfIssue: "US",
        email: walletEmail,
        address: {
          line1: "123 Test Street",
          city: "San Francisco",
          region: "CA",
          postalCode: "94105",
          countryCode: "US",
        },
        ipAddress: "127.0.0.1",
        phoneCountryCode: "1",
        phoneNumber: "5551234567",
        annualSalary: "75000",
        accountPurpose: "personal",
        expectedMonthlyVolume: "2000",
        isTermsOfServiceAccepted: true,
        walletAddress: wallet.address,
      });

      setRainUserId(result.userId);

      console.log("✅ User created, waiting before creating contract...");

      // Wait for user to be fully processed before creating contract
      await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 second delay

      console.log("🏗️ Now creating contract...");

      // Create contract immediately after user creation
      await createRainUserContract(result.userId, 84532);
      const contractInfo = await getRainUserContracts(result.userId);

      setContractAddress(contractInfo?.depositAddress);
      setContractData(contractInfo);
      setStep("contract-created");
      alert("✅ Rain user and contract created!");
    } catch (error) {
      console.error("Rain signup failed:", error);
      alert("Rain signup failed: " + error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateContract = async () => {
    if (!rainUserId) return;

    setIsLoading(true);
    try {
      console.log("🏗️ Step 2: Creating Rain smart contract...");

      // Create the contract
      await createRainUserContract(rainUserId, 84532); // Base Sepolia

      // Get the contract details
      const contractInfo = await getRainUserContracts(rainUserId);

      setContractAddress(contractInfo?.depositAddress);
      setContractData(contractInfo);
      setStep("contract-created");
      alert("✅ Smart contract created! Ready to issue card.");
    } catch (error) {
      console.error("Contract creation failed:", error);
      alert("Contract creation failed: " + error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIssueCard = async () => {
    if (!rainUserId) return;

    setIsLoading(true);
    try {
      console.log("💳 Issuing Rain card...");

      const card = await issueRainCard(rainUserId, {
        type: "virtual",
        limit: { frequency: "allTime", amount: 1000 },
        displayName: walletEmail,
        status: "active",
      });

      setCardData({
        id: card.cardId,
        type: card.type,
        status: card.status,
        limit: card.limit,
        last4: card.lastFour,
        displayName: card.displayName,
      });

      setStep("card-issued");
      alert("🎉 Virtual card issued!");
    } catch (error) {
      console.error("Card issuance failed:", error);
      alert("Card issuance failed: " + error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevealCard = async () => {
    if (!cardData?.id) return;

    setIsRevealing(true);
    try {
      const decrypted = await getDecryptedCardData(cardData.id);
      setDecryptedCardData(decrypted);
      setShowCardDetails(true);
    } catch (error) {
      console.error("Failed to reveal card:", error);
      alert("Failed to reveal card details: " + error);
    } finally {
      setIsRevealing(false);
    }
  };

  const formatCardNumber = (cardNumber: string) => {
    return cardNumber.replace(/(.{4})/g, "$1 ").trim();
  };

  if (initialLoading) {
    return (
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600 ml-2">Checking demo state...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <Image
          src="/rainxyz.jpg"
          alt="Rain logo"
          width={32}
          height={32}
          className="rounded-full"
        />
        <div>
          <h3 className="text-lg font-semibold">Rain Demo</h3>
          <p className="text-sm text-gray-500">
            Hardcoded test data for quick demo
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        {steps.map((stepName, index) => (
          <div key={stepName} className="flex items-center">
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                step === stepName
                  ? "bg-blue-600 text-white"
                  : steps.indexOf(step) > index
                  ? "bg-green-600 text-white"
                  : "bg-gray-300 text-gray-600"
              )}
            >
              {index + 1}
            </div>
            {index < steps.length - 1 && (
              <div className="w-6 h-0.5 bg-gray-300 mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Simple signup */}
      {step === "signup" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">Quick Demo Setup</h4>
            <p className="text-sm text-blue-700">
              All KYC data is hardcoded for demo.
            </p>
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
            <p>
              <strong>Hardcoded test data:</strong>
            </p>
            <p>• Name: "{walletEmail} approved"</p>
            <p>• DOB: 1990-01-01</p>
            <p>• Address: 123 Test Street, San Francisco, CA 94105</p>
            <p>• Salary: $75,000</p>
            <p>
              • Note: For testing purposes, KYC will be skipped by passing
              "approved" as the last name
            </p>
          </div>

          <button
            onClick={handleRainSignup}
            disabled={isLoading || !walletEmail}
            className={cn(
              "w-full py-3 px-4 rounded-full text-sm font-medium transition-colors",
              isLoading || !walletEmail
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            {isLoading ? "Submitting..." : "Submit Rain Application"}
          </button>
        </div>
      )}

      {/* Step 2: Create Smart Contract */}
      {step === "approved" && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-800 mb-2">
              🎉 KYC Approved!
            </h4>
            <p className="text-sm text-green-700">
              Now we'll create your smart contract on Base Sepolia for
              collateral management.
            </p>
          </div>

          <button
            onClick={handleCreateContract}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-full text-sm font-medium bg-green-600 text-white hover:bg-green-700"
          >
            {isLoading ? "Creating Smart Contract..." : "Create Smart Contract"}
          </button>
        </div>
      )}

      {/* Step 3: Smart Contract Created */}
      {step === "contract-created" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">
              🏗️ Smart Contract Created!
            </h4>
            <p className="text-sm text-blue-700 font-mono">
              Contract: {contractAddress?.slice(0, 6)}...
              {contractAddress?.slice(-6)}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Base Sepolia • Ready for card issuance
            </p>
          </div>

          <button
            onClick={handleIssueCard}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-full text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
          >
            {isLoading ? "Issuing Card..." : "Issue Virtual Visa Card"}
          </button>
        </div>
      )}

      {/* Update Step 4: Fund Card text */}
      {step === "card-issued" && (
        <div className="space-y-4 mb-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-medium text-purple-800 mb-2">
              💳 Card Issued!
            </h4>
            <p className="text-sm text-purple-700">
              Your virtual Visa card is ready. Fund it with RUSD or USDC
              collateral to enable spending.
            </p>
          </div>

          {/* Card Details Display */}
          {cardData && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h5 className="font-medium text-gray-800">Card Details</h5>
                <button
                  onClick={() => {
                    if (showCardDetails) {
                      setShowCardDetails(false);
                    } else {
                      handleRevealCard();
                    }
                  }}
                  disabled={isRevealing}
                  className={cn(
                    "text-xs px-3 py-1 rounded transition-colors font-medium",
                    showCardDetails
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-blue-100 text-blue-700 hover:bg-blue-200",
                    isRevealing && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isRevealing
                    ? "Revealing..."
                    : showCardDetails
                    ? "Conceal Card"
                    : "Reveal Card"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Card Number:</span>
                  {showCardDetails && decryptedCardData ? (
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-lg font-semibold text-green-700">
                        {formatCardNumber(decryptedCardData.cardNumber)}
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            decryptedCardData.cardNumber
                          );
                          alert("Card number copied to clipboard");
                        }}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <Image
                          src="/copy.svg"
                          alt="Copy"
                          width={16}
                          height={16}
                        />
                      </button>
                    </div>
                  ) : (
                    <p className="font-mono">**** **** **** {cardData.last4}</p>
                  )}
                </div>

                <div>
                  <span className="text-gray-500">CVC:</span>
                  {showCardDetails && decryptedCardData ? (
                    <p className="font-mono text-lg font-semibold text-green-700">
                      {decryptedCardData.cvc}
                    </p>
                  ) : (
                    <p className="font-mono">***</p>
                  )}
                </div>

                <div>
                  <span className="text-gray-500">Type:</span>
                  <p className="capitalize">{cardData.type}</p>
                </div>

                <div>
                  <span className="text-gray-500">Status:</span>
                  <p
                    className={cn(
                      "capitalize font-medium",
                      cardData.status === "active"
                        ? "text-green-600"
                        : "text-yellow-600"
                    )}
                  >
                    {cardData.status}
                  </p>
                </div>

                {cardData.expirationMonth && cardData.expirationYear && (
                  <div>
                    <span className="text-gray-500">Expires:</span>
                    <p className="font-mono">
                      {cardData.expirationMonth}/{cardData.expirationYear}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-gray-500">Limit:</span>
                  <p>
                    $
                    {cardData.limit?.amount
                      ? cardData.limit.amount.toFixed(2)
                      : "N/A"}
                  </p>
                </div>
              </div>

              {/* Security Notice */}
              {showCardDetails && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    🔒 Card details are decrypted server-side. Keep this
                    information secure.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {contractData &&
        (step === "contract-created" || step === "card-issued") && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <h5 className="font-medium text-gray-800">Smart Contract Info</h5>
              <button
                onClick={handleRefreshBalance}
                disabled={isRefreshing}
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors",
                  isRefreshing
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                )}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Deposit Address:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">
                    {contractData.depositAddress.slice(0, 6)}...
                    {contractData.depositAddress.slice(-6)}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        contractData.depositAddress
                      );
                      alert("Deposit Address copied to clipboard");
                    }}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    title="Copy address"
                  >
                    <Image src="/copy.svg" alt="Copy" width={16} height={16} />
                  </button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Chain:</span>
                <span>Base Sepolia ({contractData.chainId})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Contract Version:</span>
                <span>v{contractData.contractVersion}</span>
              </div>

              {/* RUSD Token Info */}
              <div className="border-t border-gray-300 pt-3 mt-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-700">
                    RUSD Collateral
                  </span>
                  <span
                    className={cn(
                      "font-bold text-lg",
                      parseFloat(contractData.rusdToken.balance) > 0
                        ? "text-green-600"
                        : "text-gray-400"
                    )}
                  >
                    $ {contractData.rusdToken.balance} RUSD
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                  <div>
                    <span>Exchange Rate:</span>
                    <span className="ml-2">
                      {contractData.rusdToken.exchangeRate}:1
                    </span>
                  </div>
                  <div>
                    <span>Advance Rate:</span>
                    <span className="ml-2">
                      {contractData.rusdToken.advanceRate}%
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  Token: {contractData.rusdToken.address.slice(0, 8)}...
                  {contractData.rusdToken.address.slice(-8)}
                </div>
              </div>

              {/* USDC Token Info */}
              <div className="border-t border-gray-300 pt-3 mt-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-700">
                    USDC Collateral
                  </span>
                  <span
                    className={cn(
                      "font-bold text-lg",
                      parseFloat(
                        contractData.tokens.find(
                          (t: any) => t.address === USDC_CONTRACT_ADDRESS
                        )?.balance || "0"
                      ) > 0
                        ? "text-green-600"
                        : "text-gray-400"
                    )}
                  >
                    ${" "}
                    {contractData.tokens.find(
                      (t: any) => t.address === USDC_CONTRACT_ADDRESS
                    )?.balance || "0"}{" "}
                    USDC
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                  <div>
                    <span>Exchange Rate:</span>
                    <span className="ml-2">
                      {contractData.tokens.find(
                        (t: any) => t.address === USDC_CONTRACT_ADDRESS
                      )?.exchangeRate || "1"}
                      :1
                    </span>
                  </div>
                  <div>
                    <span>Advance Rate:</span>
                    <span className="ml-2">
                      {contractData.tokens.find(
                        (t: any) => t.address === USDC_CONTRACT_ADDRESS
                      )?.advanceRate || "100"}
                      %
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  Token:{" "}
                  {contractData.tokens
                    .find((t: any) => t.address === USDC_CONTRACT_ADDRESS)
                    ?.address.slice(0, 8)}
                  ...
                  {contractData.tokens
                    .find((t: any) => t.address === USDC_CONTRACT_ADDRESS)
                    ?.address.slice(-8)}
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
