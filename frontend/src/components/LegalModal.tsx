import React from "react";

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "privacy" | "terms";
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, type }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-[#010905]/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
      style={{ zIndex: 999999 }}
      onClick={onClose}
    >
      <div 
        className="glass-panel w-full max-w-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 relative shadow-2xl"
        style={{ maxHeight: 'calc(100vh - 4rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 md:p-5 border-b border-[#33261a] bg-[#1a140d] shrink-0">
          <h3 className="text-base md:text-lg font-bold text-[var(--color-gold-light)] uppercase tracking-wider">
            {type === "privacy" ? "Privacy Policy" : "Terms & Conditions"}
          </h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-[#33261a] hover:bg-red-500 text-[#8c6b4a] hover:text-white transition-colors shrink-0 ml-4"
            title="Close"
          >
            <span className="font-bold">✕</span>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar text-xs md:text-sm text-[#f0e8d0] leading-relaxed space-y-4">
          {type === "privacy" ? (
            <>
              <p><strong>Last Updated: {new Date().toLocaleDateString()}</strong></p>
              <h4 className="font-bold text-[var(--color-gold)] mt-4">1. Information We Collect</h4>
              <p>For general users accessing the Quran reader and features, we do not require account creation and do not automatically collect personal identifiable information (PII) such as your name or email. However, if you choose to interact with specific services—such as the <strong>Hajj & Umrah Travel Agency Registration</strong>—we actively collect the information you voluntarily submit. This includes business names, contact names, email addresses, phone numbers, and package details necessary to integrate your services and provide booking leads.</p>
              
              <h4 className="font-bold text-[var(--color-gold)] mt-4">2. Use of Information</h4>
              <p>Any information collected through forms (such as agency registration) is used exclusively for the stated purpose: connecting pilgrims with your services, sending lead notifications, and improving platform integration. We do not sell this data to third-party data brokers.</p>
              
              <h4 className="font-bold text-[var(--color-gold)] mt-4">3. On-Chain Data</h4>
              <p>Any donations made (Sadaqah or Zakat) or token transactions are permanently recorded on the public Base network blockchain. This data is public by nature, pseudonymous (linked to your wallet address), and cannot be altered or deleted by us.</p>
              
              <h4 className="font-bold text-[var(--color-gold)] mt-4">4. Local Storage</h4>
              <p>We may use local browser storage to save your preferences (such as last read Surah, translation preferences, or audio settings) to improve your user experience. This data never leaves your device.</p>
              
              <h4 className="font-bold text-[var(--color-gold)] mt-4">5. Third-Party Services</h4>
              <p>We use third-party RPC providers (like Coinbase or public nodes) to interact with the blockchain. These providers may collect standard network logs (like IP addresses) according to their own privacy policies.</p>
            </>
          ) : (
            <>
              <p><strong>Last Updated: {new Date().toLocaleDateString()}</strong></p>
              <h4 className="font-bold text-[var(--color-gold)] mt-4">1. Acceptance of Terms</h4>
              <p>By accessing or using the Noor Quran platform, you agree to be bound by these Terms & Conditions. The platform provides access to Quranic texts, interactive tools, and blockchain-based charity functionality.</p>
              
              <h4 className="font-bold text-[var(--color-gold)] mt-4">2. The QURAN Token</h4>
              <p>The official QURAN token is a utility and donation receipt token designed to support the operational costs of the Noor Quran project. <strong>It is NOT an investment, security, or financial instrument.</strong> It carries no promise of future value, dividends, or financial returns. Users should not purchase the token with the expectation of profit.</p>
              
              <h4 className="font-bold text-[var(--color-gold)] mt-4">3. Religious Compliance (Halal Usage)</h4>
              <p>Noor Quran strives to ensure all features comply with Islamic principles. The token involves a 1% standard transfer fee utilized strictly for platform maintenance and treasury operations. This is an administrative fee and does not constitute Riba (interest). There are no staking mechanisms that guarantee fixed percentage yields. However, users are encouraged to consult their own Islamic scholars regarding their participation in Web3 ecosystems.</p>
              
              <h4 className="font-bold text-[var(--color-gold)] mt-4">4. Charity Distributions</h4>
              <p>All Zakat and Sadaqah funds sent to our smart contracts are processed transparently on-chain. We pledge to distribute Zakat strictly to eligible categories (Asnaf) and Sadaqah to general welfare needs. However, due to the immutable nature of the blockchain, all transfers are final and non-refundable.</p>
              
              <h4 className="font-bold text-[var(--color-gold)] mt-4">5. Disclaimer of Liability</h4>
              <p>The platform is provided "as is" without warranties of any kind. We are not responsible for any lost funds due to user error, wallet compromises, or network vulnerabilities on the Base blockchain.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
